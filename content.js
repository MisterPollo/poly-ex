// Content script - runs on Polymarket BTC 5min market pages

console.log('[Polymarket Bot] Content script loaded');

// ===== POLYMARKET API INTEGRATION =====
// Use the Gamma API to fetch market data instead of scraping the page

const POLYMARKET_API = {
  baseUrl: 'https://gamma-api.polymarket.com',
  clobBaseUrl: 'https://clob.polymarket.com',

  // Calculate current market timestamp (markets occur every 300 seconds)
  getCurrentMarketTimestamp() {
    const now = Math.floor(Date.now() / 1000);
    return Math.floor(now / 300) * 300;
  },

  // Calculate next market timestamp
  getNextMarketTimestamp() {
    const now = Math.floor(Date.now() / 1000);
    return Math.ceil(now / 300) * 300;
  },

  // Generate market slug from timestamp
  getMarketSlug(timestamp) {
    return `btc-updown-5m-${timestamp}`;
  },

  // Fetch market by slug
  async getMarketBySlug(slug) {
    try {
      const response = await fetch(`${this.baseUrl}/events?slug=${slug}`);
      if (!response.ok) return null;

      const data = await response.json();
      const events = Array.isArray(data) ? data : [data];

      if (events.length === 0 || events[0].closed || !events[0].active) {
        return null;
      }

      return events[0];
    } catch (error) {
      console.error('[API] Error fetching market:', error);
      return null;
    }
  },

  // Get last trade price for a token (most accurate price)
  async getLastTradePrice(tokenId) {
    try {
      const response = await fetch(`${this.clobBaseUrl}/last-trade-price?token_id=${tokenId}`);
      if (!response.ok) return null;

      const data = await response.json();
      return data.price ? parseFloat(data.price) : null;
    } catch (error) {
      return null;
    }
  },

  // Get current market data including prices and time remaining
  async getCurrentMarketData() {
    // Extract slug from current URL
    const urlMatch = window.location.pathname.match(/btc-updown-5m-(\d+)/);
    if (!urlMatch) {
      console.warn('[API] Not on a BTC 5-min market page');
      return null;
    }

    const marketTimestamp = parseInt(urlMatch[1]);
    const slug = this.getMarketSlug(marketTimestamp);

    const market = await this.getMarketBySlug(slug);
    if (!market) return null;

    // Calculate time remaining from slug timestamp
    const marketEndTime = (marketTimestamp + 300) * 1000; // Add 5 minutes
    const now = Date.now();
    const timeRemainingSeconds = Math.max(0, Math.floor((marketEndTime - now) / 1000));

    // Get tokens (UP and DOWN)
    let upPrice = 0.5, downPrice = 0.5;

    if (market.markets && market.markets[0]) {
      const m = market.markets[0];
      const outcomes = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : m.outcomes;
      const outcomePrices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
      const clobTokenIds = typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : m.clobTokenIds;

      if (outcomes && outcomePrices && clobTokenIds) {
        const upIndex = outcomes.findIndex(o => o.toLowerCase().includes('up') || o.toLowerCase().includes('yes'));
        const downIndex = outcomes.findIndex(o => o.toLowerCase().includes('down') || o.toLowerCase().includes('no'));

        if (upIndex >= 0) {
          // Try to get live price from CLOB API
          const livePrice = await this.getLastTradePrice(clobTokenIds[upIndex]);
          upPrice = livePrice !== null ? livePrice : parseFloat(outcomePrices[upIndex]);
        }

        if (downIndex >= 0) {
          const livePrice = await this.getLastTradePrice(clobTokenIds[downIndex]);
          downPrice = livePrice !== null ? livePrice : parseFloat(outcomePrices[downIndex]);
        }
      }
    }

    return {
      slug,
      marketTimestamp,
      timeRemainingSeconds,
      upPrice,
      downPrice
    };
  },

  // Get next market slug for navigation
  async getNextMarketSlug() {
    const nextTs = this.getNextMarketTimestamp();
    return this.getMarketSlug(nextTs);
  }
};

// Global variable to cache market data
let cachedMarketData = null;
let lastFetchTime = 0;

// Updated selectors based on actual Polymarket page structure
const SELECTORS = {
  // Timer - Parent container with MINS/SECS text
  // Format: <span>02</span> MINS  <span>25</span> SECS
  timerContainer: 'div.flex.items-center.gap-1\\.5.my-auto.cursor-pointer.hover\\:opacity-90',

  // UP/DOWN selection buttons (choose which side to bet on)
  upButton: '.trading-button[value="0"]', // UP selection button (has value="0")
  upPrice: '.ml-1.text-base', // ⚠️ THIS MAY MATCH MULTIPLE ELEMENTS - need to be more specific (first occurrence = UP?)
  downButton: '.trading-button[value="1"]', // DOWN selection button (has value="1")
  downPrice: '.ml-1.text-base', // ⚠️ THIS MAY MATCH MULTIPLE ELEMENTS - need to be more specific (second occurrence = DOWN?)

  // Place Order button (final confirmation button after selecting UP/DOWN and entering amount)
  placeOrderButton: '.trading-button[data-color="blue"]', // ✅ The blue "Place Order" button

  // Trade form
  stakeInput: '#market-order-amount-input', // ✅ ID selector is reliable

  // Next market navigation - matches any BTC 5-min market link
  // The timestamp part (e.g., 1777831500) changes, but "btc-updown-5m-" stays the same
  nextMarketButton: 'a[href*="btc-updown-5m-"]' // ✅ Matches any link with "btc-updown-5m-" followed by timestamp
};

let botState = {
  isRunning: false,
  settings: {},
  currentStake: 1.0,
  tradeExecuted: false,
  scalingExecuted: false,
  martingaleStep: 0,
  lastTradeWon: null,
  checkInterval: null
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Bot] Received message:', message.type);

  switch (message.type) {
    case 'START_BOT':
      startBot();
      break;
    case 'STOP_BOT':
      stopBot();
      break;
    case 'SETTINGS_UPDATED':
      botState.settings = message.settings;
      console.log('[Bot] Settings updated:', botState.settings);
      break;
    case 'GET_MARKET_DATA':
      // Respond with current market data
      getMarketData().then(data => {
        sendResponse({ data });
      });
      return true; // Keep channel open for async response
  }
});

// Initialize bot on page load
(async function init() {
  // Load settings and bot state from storage
  const data = await chrome.storage.local.get([
    'stake',
    'probMin',
    'probMax',
    'timeMin',
    'timeMax',
    'scalingEnabled',
    'scaleProb',
    'scaleStake',
    'martingaleEnabled',
    'martingaleMultiplier',
    'martingaleMaxSteps',
    'botRunning',
    'martingaleStep'
  ]);

  botState.settings = {
    stake: data.stake || 1.0,
    probMin: data.probMin || 0.70,
    probMax: data.probMax || 0.78,
    timeMin: data.timeMin || 180,
    timeMax: data.timeMax || 300,
    scalingEnabled: data.scalingEnabled || false,
    scaleProb: data.scaleProb || 0.80,
    scaleStake: data.scaleStake || 5.0,
    martingaleEnabled: data.martingaleEnabled || false,
    martingaleMultiplier: data.martingaleMultiplier || 2.0,
    martingaleMaxSteps: data.martingaleMaxSteps || 3
  };

  botState.martingaleStep = data.martingaleStep || 0;

  // Auto-start if bot was running before
  if (data.botRunning) {
    startBot();
  }

  console.log('[Bot] Initialized with settings:', botState.settings);
})();

function startBot() {
  if (botState.isRunning) {
    console.log('[Bot] Already running');
    return;
  }

  console.log('[Bot] Starting...');
  botState.isRunning = true;
  botState.tradeExecuted = false;
  botState.scalingExecuted = false;

  // Start monitoring loop (check every 500ms)
  botState.checkInterval = setInterval(monitorMarket, 500);

  sendStatusUpdate('running', 'Bot is monitoring market...');
}

function stopBot() {
  if (!botState.isRunning) {
    console.log('[Bot] Already stopped');
    return;
  }

  console.log('[Bot] Stopping...');
  botState.isRunning = false;

  if (botState.checkInterval) {
    clearInterval(botState.checkInterval);
    botState.checkInterval = null;
  }

  sendStatusUpdate('stopped', 'Bot stopped');
}

// Soft mode - only auto-navigate to next market, no trading
let softModeInterval = null;

function startSoftMode() {
  console.log('[Bot] Starting soft mode (auto-navigation only)...');

  // Start monitoring loop for market resolution
  softModeInterval = setInterval(checkForMarketResolution, 2000);

  sendStatusUpdate('soft', 'Soft mode active: Will auto-navigate to next market');
}

function stopSoftMode() {
  console.log('[Bot] Stopping soft mode...');

  if (softModeInterval) {
    clearInterval(softModeInterval);
    softModeInterval = null;
  }

  sendStatusUpdate('idle', 'Soft mode stopped');
}

async function checkForMarketResolution() {
  try {
    const data = await getMarketData();

    if (!data) return;

    // Check if time is up (market should resolve soon)
    if (data.timeRemainingSeconds <= 5) {
      console.log('[Bot] Market ending soon, waiting for resolution...');

      // Wait a bit for resolution
      setTimeout(async () => {
        const nextSlug = await POLYMARKET_API.getNextMarketSlug();
        if (nextSlug) {
          console.log('[Bot] Navigating to next market:', nextSlug);
          sendStatusUpdate('soft', `Navigating to: ${nextSlug}`);
          window.location.href = `https://polymarket.com/event/${nextSlug}`;
        }
      }, 10000); // Wait 10 seconds for market to resolve
    }
  } catch (error) {
    console.error('[Bot] Error in soft mode:', error);
  }
}

// Make functions available to panel.js
window.startSoftMode = startSoftMode;
window.stopSoftMode = stopSoftMode;

async function monitorMarket() {
  if (!botState.isRunning) return;

  try {
    // Get current market state from API
    const timeRemaining = await getTimeRemaining();
    const elapsed = 300 - timeRemaining; // Market is 5 minutes = 300 seconds
    const upProb = await getProbability('UP');
    const downProb = await getProbability('DOWN');

    // Check if market has resolved (timer reached 0)
    if (timeRemaining <= 0) {
      console.log('[Bot] Market resolved, navigating to next market...');
      navigateToNextMarket();
      return;
    }

    // Check if we're in the entry time window
    const inTimeWindow = elapsed >= botState.settings.timeMin && elapsed <= botState.settings.timeMax;

    if (!inTimeWindow) {
      // Silent wait - don't spam console
      return;
    }

    // Calculate current stake (considering martingale)
    botState.currentStake = botState.settings.stake * Math.pow(botState.settings.martingaleMultiplier, botState.martingaleStep);

    // Check for initial entry
    if (!botState.tradeExecuted) {
      if (upProb >= botState.settings.probMin && upProb <= botState.settings.probMax) {
        console.log(`[Bot] UP trigger: ${upProb.toFixed(3)} in range [${botState.settings.probMin}-${botState.settings.probMax}]`);
        executeTrade('UP', upProb);
        return;
      }

      if (downProb >= botState.settings.probMin && downProb <= botState.settings.probMax) {
        console.log(`[Bot] DOWN trigger: ${downProb.toFixed(3)} in range [${botState.settings.probMin}-${botState.settings.probMax}]`);
        executeTrade('DOWN', downProb);
        return;
      }

      // Silent monitoring - prices shown in panel already
    }

    // Check for scaling entry (if enabled and initial trade executed)
    if (botState.settings.scalingEnabled && botState.tradeExecuted && !botState.scalingExecuted) {
      const currentProb = Math.max(upProb, downProb);

      if (currentProb >= botState.settings.scaleProb) {
        console.log(`[Bot] Scaling trigger: ${currentProb.toFixed(3)} >= ${botState.settings.scaleProb}`);
        executeScaling(currentProb >= upProb ? 'UP' : 'DOWN', currentProb);
        return;
      }
    }

  } catch (error) {
    console.error('[Bot] Error in monitor loop:', error);
    sendStatusUpdate('error', `Error: ${error.message}`);
  }
}

function executeTrade(direction, probability) {
  // Prevent duplicate execution
  if (botState.tradeExecuted) {
    console.log('[Bot] ⚠️ Trade already executed, skipping');
    return;
  }

  console.log(`[Bot] 🎯 Executing ${direction} trade at ${(probability * 100).toFixed(1)}% with stake $${botState.currentStake}`);

  // Mark as executed IMMEDIATELY to prevent duplicates
  botState.tradeExecuted = true;

  try {
    // Fill stake input first
    fillStakeInput(botState.currentStake);

    // Wait longer for input to register and UI to update
    setTimeout(() => {
      clickTradeButton(direction);

      // Confirm trade was placed
      setTimeout(() => {
        sendStatusUpdate('trade_placed', `✅ ${direction} trade: $${botState.currentStake} @ ${(probability * 100).toFixed(1)}%`);
      }, 1000);
    }, 800); // Increased from 300ms to 800ms

  } catch (error) {
    console.error('[Bot] ❌ Trade execution error:', error);
    sendStatusUpdate('error', `Trade failed: ${error.message}`);
    // Reset flag on error
    botState.tradeExecuted = false;
  }
}

function executeScaling(direction, probability) {
  console.log(`[Bot] Executing scaling ${direction} at ${probability} with stake $${botState.settings.scaleStake}`);

  try {
    fillStakeInput(botState.settings.scaleStake);
    clickTradeButton(direction);

    botState.scalingExecuted = true;
    sendStatusUpdate('scaling_placed', `Scaling: $${botState.settings.scaleStake} @ ${(probability * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('[Bot] Scaling execution error:', error);
  }
}

// Helper functions to interact with page elements

async function getMarketData() {
  // Use cached data if fetched recently (within 1 second)
  const now = Date.now();
  if (cachedMarketData && (now - lastFetchTime) < 1000) {
    return cachedMarketData;
  }

  // Fetch fresh data from API
  cachedMarketData = await POLYMARKET_API.getCurrentMarketData();
  lastFetchTime = now;

  return cachedMarketData;
}

async function getTimeRemaining() {
  try {
    const marketData = await getMarketData();
    if (!marketData) {
      console.warn('[Bot] No market data available');
      return 0;
    }

    return marketData.timeRemainingSeconds;
  } catch (error) {
    console.error('[Bot] Error getting time remaining:', error);
    return 0;
  }
}

async function getProbability(direction) {
  try {
    const marketData = await getMarketData();
    if (!marketData) {
      console.warn('[Bot] No market data available');
      return 0;
    }

    return direction === 'UP' ? marketData.upPrice : marketData.downPrice;
  } catch (error) {
    console.error(`[Bot] Error getting ${direction} probability:`, error);
    return 0;
  }
}

function fillStakeInput(amount) {
  const input = document.querySelector(SELECTORS.stakeInput);
  if (!input) {
    console.error('[Bot] Stake input not found with selector:', SELECTORS.stakeInput);
    throw new Error('Stake input not found');
  }

  console.log(`[Bot] Filling stake input with $${amount.toFixed(2)}`);
  input.value = amount.toFixed(2);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  console.log(`[Bot] Stake input filled successfully`);
}

// Expose for manual trading from panel
window.fillStakeInput = fillStakeInput;

function clickTradeButton(direction) {
  console.log(`\n========== ATTEMPTING TO PLACE ${direction} ORDER ==========`);

  // STEP 1: Click the UP/DOWN selection button
  const tradeWidget = document.querySelector('#trade-widget');
  console.log(`[Bot] 1. Trade widget found: ${!!tradeWidget}`);

  const selectionSelector = direction === 'UP' ? SELECTORS.upButton : SELECTORS.downButton;
  console.log(`[Bot] 2. Looking for ${direction} selection button: "${selectionSelector}"`);

  let selectionButton = tradeWidget ? tradeWidget.querySelector(selectionSelector) : null;
  if (!selectionButton) {
    selectionButton = document.querySelector(selectionSelector);
  }

  if (!selectionButton) {
    console.error(`[Bot] ❌ ${direction} selection button NOT FOUND`);
    // Debug output
    if (tradeWidget) {
      const allButtons = tradeWidget.querySelectorAll('.trading-button');
      console.log(`[Bot] DEBUG: Found ${allButtons.length} .trading-button elements:`);
      allButtons.forEach((btn, i) => {
        console.log(`  Button ${i}: value="${btn.getAttribute('value')}", data-color="${btn.getAttribute('data-color')}", text="${btn.textContent.trim().substring(0, 30)}"`);
      });
    }
    throw new Error(`${direction} selection button not found`);
  }

  console.log(`[Bot] ✅ 3. Found ${direction} selection button (value="${selectionButton.getAttribute('value')}")`);

  // Click the selection button
  selectionButton.click();
  console.log(`[Bot] 4. Clicked ${direction} selection button`);

  // STEP 2: Wait a moment, then click the blue "Place Order" button
  setTimeout(() => {
    console.log(`[Bot] 5. Looking for Place Order button: "${SELECTORS.placeOrderButton}"`);

    let placeOrderBtn = tradeWidget ? tradeWidget.querySelector(SELECTORS.placeOrderButton) : null;
    if (!placeOrderBtn) {
      placeOrderBtn = document.querySelector(SELECTORS.placeOrderButton);
    }

    if (!placeOrderBtn) {
      console.error(`[Bot] ❌ Place Order button NOT FOUND`);
      // Debug output
      if (tradeWidget) {
        const allButtons = tradeWidget.querySelectorAll('.trading-button');
        console.log(`[Bot] DEBUG: Found ${allButtons.length} .trading-button elements after selection:`);
        allButtons.forEach((btn, i) => {
          console.log(`  Button ${i}: value="${btn.getAttribute('value')}", data-color="${btn.getAttribute('data-color')}", text="${btn.textContent.trim().substring(0, 30)}"`);
        });
      }
      throw new Error('Place Order button not found - may need to wait longer after selection');
    }

    console.log(`[Bot] ✅ 6. Found Place Order button`);
    console.log(`[Bot]    - data-color: "${placeOrderBtn.getAttribute('data-color')}"`);
    console.log(`[Bot]    - Disabled: ${placeOrderBtn.disabled}`);
    console.log(`[Bot]    - aria-disabled: "${placeOrderBtn.getAttribute('aria-disabled')}"`);
    console.log(`[Bot]    - Text: "${placeOrderBtn.textContent.trim()}"`);
    console.log(`[Bot]    - Classes: "${placeOrderBtn.className}"`);

    // Check if button has pointer-events disabled via CSS
    const computedStyle = window.getComputedStyle(placeOrderBtn);
    console.log(`[Bot]    - pointer-events: ${computedStyle.pointerEvents}`);
    console.log(`[Bot]    - opacity: ${computedStyle.opacity}`);

    // Wait a moment, then click (no scrolling - it might interfere)
    setTimeout(() => {
      try {
        console.log(`[Bot] 7. Clicking Place Order button...`);

        // Try React's way: dispatch pointer events first, then mouse events
        const pointerDownEvent = new PointerEvent('pointerdown', {
          view: window,
          bubbles: true,
          cancelable: true,
          isPrimary: true,
          button: 0
        });
        placeOrderBtn.dispatchEvent(pointerDownEvent);
        console.log(`[Bot] 8. pointerdown dispatched`);

        const mouseDownEvent = new MouseEvent('mousedown', {
          view: window,
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1
        });
        placeOrderBtn.dispatchEvent(mouseDownEvent);
        console.log(`[Bot] 9. mousedown dispatched`);

        // Focus
        placeOrderBtn.focus();
        console.log(`[Bot] 10. Button focused`);

        // Standard click
        placeOrderBtn.click();
        console.log(`[Bot] 11. .click() executed`);

        // Click event
        const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1
        });
        placeOrderBtn.dispatchEvent(clickEvent);
        console.log(`[Bot] 12. click event dispatched`);

        // Mouse up
        const mouseUpEvent = new MouseEvent('mouseup', {
          view: window,
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1
        });
        placeOrderBtn.dispatchEvent(mouseUpEvent);
        console.log(`[Bot] 13. mouseup dispatched`);

        // Pointer up
        const pointerUpEvent = new PointerEvent('pointerup', {
          view: window,
          bubbles: true,
          cancelable: true,
          isPrimary: true,
          button: 0
        });
        placeOrderBtn.dispatchEvent(pointerUpEvent);
        console.log(`[Bot] 14. pointerup dispatched`);

        console.log(`[Bot] ✅ ${direction} ORDER PLACED SUCCESSFULLY!`);
        console.log(`========== ORDER PLACEMENT COMPLETE ==========\n`);
      } catch (error) {
        console.error(`[Bot] ❌ Error clicking Place Order button:`, error);
        console.log(`========== ORDER PLACEMENT FAILED ==========\n`);
        throw error;
      }
    }, 400); // Wait 400ms after finding button before clicking

  }, 500); // Wait 500ms after selection button click to let Place Order button appear
}

// Expose for manual trading from panel
window.clickTradeButton = clickTradeButton;

async function navigateToNextMarket() {
  try {
    // Get next market slug from API
    const nextSlug = await POLYMARKET_API.getNextMarketSlug();
    const nextUrl = `https://polymarket.com/event/${nextSlug}`;

    console.log(`[Bot] Navigating to next market: ${nextSlug}`);

    // Reset trade state for new market
    botState.tradeExecuted = false;
    botState.scalingExecuted = false;
    cachedMarketData = null; // Clear cache

    sendStatusUpdate('next_market', `Moving to next market: ${nextSlug}`);

    // Navigate to next market
    window.location.href = nextUrl;

  } catch (error) {
    console.error('[Bot] Error navigating to next market:', error);
    stopBot();
  }
}

function sendStatusUpdate(status, details) {
  chrome.runtime.sendMessage({
    type: 'STATUS_UPDATE',
    status,
    details
  });
}

// Export for debugging in console
window.polymarketBot = {
  start: startBot,
  stop: stopBot,
  state: botState,
  selectors: SELECTORS
};

console.log('[Polymarket Bot] Ready. Access via window.polymarketBot');
