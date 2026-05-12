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

  // Generate market slug from timestamp (supports BTC, ETH, SOL, XRP, DOGE)
  getMarketSlug(timestamp, marketType = 'BTC') {
    const prefix = marketType.toLowerCase();
    return `${prefix}-updown-5m-${timestamp}`;
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
    // Extract slug from current URL - supports all market types
    const urlMatch = window.location.pathname.match(/(btc|eth|sol|xrp|doge)-updown-5m-(\d+)/);
    if (!urlMatch) {
      console.warn('[API] Not on a 5-min market page');
      return null;
    }

    const marketType = urlMatch[1].toUpperCase();
    const marketTimestamp = parseInt(urlMatch[2]);
    const slug = this.getMarketSlug(marketTimestamp, marketType);

    // Store market end time globally for accurate real-time calculations
    marketTimestampFromURL = (marketTimestamp + 300) * 1000;

    const market = await this.getMarketBySlug(slug);
    if (!market) return null;

    // IMPORTANT: Calculate time remaining using current time, NOT cached time
    // This ensures timer is always accurate even if API is slow
    const now = Date.now();
    const timeRemainingSeconds = Math.max(0, Math.floor((marketTimestampFromURL - now) / 1000));

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
  },

  // Get current active market slug (finds the one that's actually tradeable NOW)
  async getCurrentActiveMarketSlug(marketType = 'BTC') {
    const nowMs = Date.now();
    const now = Math.floor(nowMs / 1000);

    // Market slug timestamp is the START TIME of the market
    // Market runs from: timestamp to (timestamp + 300)

    // Get current 5-min bucket start
    const currentStart = this.getCurrentMarketTimestamp();

    // Calculate time remaining using the SAME logic as getCurrentMarketData() (line 78-80)
    const marketEndTime = (currentStart + 300) * 1000; // milliseconds
    const timeRemaining = Math.max(0, Math.floor((marketEndTime - nowMs) / 1000));

    console.log(`[API] Current ${marketType} market ${currentStart}: timeRemaining=${timeRemaining}s`);

    // CRITICAL: Only return this market if timeRemaining is 0-300 seconds (same validation as monitorMarket line 403)
    if (timeRemaining > 0 && timeRemaining <= 300) {
      const slug = this.getMarketSlug(currentStart, marketType);
      const market = await this.getMarketBySlug(slug);

      if (market && market.active && !market.closed) {
        console.log(`[API] ✅ Found current active ${marketType} market: ${slug} (${timeRemaining}s remaining)`);
        return slug;
      } else {
        console.log(`[API] Current ${marketType} market ${slug} exists but not active/open`);
      }
    } else {
      console.log(`[API] Current ${marketType} market timeRemaining=${timeRemaining} is outside 0-300 range, trying next...`);
    }

    // Try next market window
    const nextStart = currentStart + 300;
    const nextMarketEndTime = (nextStart + 300) * 1000;
    const nextTimeRemaining = Math.max(0, Math.floor((nextMarketEndTime - nowMs) / 1000));

    console.log(`[API] Next ${marketType} market ${nextStart}: timeRemaining=${nextTimeRemaining}s`);

    if (nextTimeRemaining > 0 && nextTimeRemaining <= 300) {
      const nextSlug = this.getMarketSlug(nextStart, marketType);
      const nextMarket = await this.getMarketBySlug(nextSlug);

      if (nextMarket && nextMarket.active && !nextMarket.closed) {
        console.log(`[API] ✅ Found next active ${marketType} market: ${nextSlug} (${nextTimeRemaining}s remaining)`);
        return nextSlug;
      }
    }

    // Fallback: return current bucket (shouldn't happen but just in case)
    const fallbackSlug = this.getMarketSlug(currentStart, marketType);
    console.log(`[API] ⚠️ Using fallback: ${fallbackSlug}`);
    return fallbackSlug;
  }
};

// Global variable to cache market data (but NOT time remaining)
let cachedMarketData = null;
let lastFetchTime = 0;
let marketTimestampFromURL = null; // Store the market end timestamp for accurate time calculations

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

// Generate unique instance ID for this tab (used for storage isolation)
// Persist across page reloads using sessionStorage (tab-specific, cleared when tab closes)
let INSTANCE_ID;
if (window.sessionStorage.getItem('BOT_INSTANCE_ID')) {
  INSTANCE_ID = window.sessionStorage.getItem('BOT_INSTANCE_ID');
  console.log(`[Bot] Reusing existing Instance ID: ${INSTANCE_ID}`);
} else {
  INSTANCE_ID = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  window.sessionStorage.setItem('BOT_INSTANCE_ID', INSTANCE_ID);
  console.log(`[Bot] Created new Instance ID: ${INSTANCE_ID}`);
}

// Storage key helpers - all storage is now scoped to this instance
function getStorageKey(key) {
  return `${INSTANCE_ID}_${key}`;
}

// Detect current market type from URL
function detectMarketType() {
  const url = window.location.href;
  if (url.includes('btc-updown-5m')) return 'BTC';
  if (url.includes('eth-updown-5m')) return 'ETH';
  if (url.includes('sol-updown-5m')) return 'SOL';
  if (url.includes('xrp-updown-5m')) return 'XRP';
  if (url.includes('doge-updown-5m')) return 'DOGE';
  return 'BTC'; // Default
}

// Initialize market type (async) with a promise we can await
window.MARKET_TYPE_READY = (async function() {
  const storageKey = getStorageKey('selectedMarket');
  const data = await chrome.storage.local.get(storageKey);
  const selectedMarket = data[storageKey];

  if (selectedMarket) {
    window.MARKET_TYPE = selectedMarket;
    console.log(`[Bot] Using stored market preference for this tab: ${window.MARKET_TYPE}`);
  } else {
    window.MARKET_TYPE = detectMarketType();
    console.log(`[Bot] Detected market from URL: ${window.MARKET_TYPE}`);
  }
  return window.MARKET_TYPE;
})();

// Set initial value synchronously (will be updated by async function above)
window.MARKET_TYPE = detectMarketType();

let botState = {
  instanceId: INSTANCE_ID,
  get marketType() { return window.MARKET_TYPE; }, // Dynamic getter
  isRunning: false,
  settings: {},
  currentStake: 1.0,
  tradeExecuted: false,
  scalingExecuted: false,
  martingaleStep: 0,
  lastTradeWon: null,
  checkInterval: null,
  stakePreFilled: false,
  tradeDirection: null, // Track which direction we traded for win/loss detection
  lastTimeRemaining: null, // Track timer to detect if it gets stuck
  timeStuckCounter: 0 // Count how many cycles timer hasn't decreased
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
  // Load settings per market type (e.g., 'settings_BTC', 'settings_ETH')
  const settingsKey = `settings_${window.MARKET_TYPE}`;
  const martingaleKey = `martingale_${window.MARKET_TYPE}`;

  const data = await chrome.storage.local.get([settingsKey, martingaleKey]);

  // Get market-specific settings or use defaults
  const savedSettings = data[settingsKey] || {};
  const savedMartingale = data[martingaleKey] || {};

  botState.settings = {
    stake: savedSettings.stake || 1.0,
    probMin: savedSettings.probMin || 0.70,
    probMax: savedSettings.probMax || 0.78,
    timeMin: savedSettings.timeMin || 180,
    timeMax: savedSettings.timeMax || 300,
    scalingEnabled: savedSettings.scalingEnabled || false,
    scaleProb: savedSettings.scaleProb || 0.80,
    scaleStake: savedSettings.scaleStake || 5.0,
    martingaleEnabled: savedSettings.martingaleEnabled || false,
    martingaleMultiplier: savedSettings.martingaleMultiplier || 2.0,
    martingaleMaxSteps: savedSettings.martingaleMaxSteps || 3
  };

  botState.martingaleStep = savedMartingale.step || 0;
  botState.lastTradeWon = savedMartingale.lastWon || null;

  // DO NOT auto-start - wait for user to click START button
  console.log(`[Bot] Initialized for ${window.MARKET_TYPE} market with settings:`, botState.settings);
})();

async function startBot() {
  if (botState.isRunning) {
    console.log('[Bot] Already running');
    return;
  }

  console.log('[Bot] Starting...');

  // CRITICAL: Wait for market type to be initialized from storage
  await window.MARKET_TYPE_READY;
  console.log('[Bot] Market type initialized from storage');

  // CRITICAL: Check if we're on a valid market page BEFORE starting
  console.log('[Bot] startBot called. window.MARKET_TYPE =', window.MARKET_TYPE);
  const currentUrl = window.location.href;
  const marketSlug = `${window.MARKET_TYPE.toLowerCase()}-updown-5m-`;
  console.log('[Bot] Looking for market slug:', marketSlug);
  console.log('[Bot] Current URL:', currentUrl);
  const isCorrectMarketPage = currentUrl.includes(marketSlug);
  console.log('[Bot] Is correct market page?', isCorrectMarketPage);

  if (!isCorrectMarketPage) {
    console.log(`[Bot] Not on a ${window.MARKET_TYPE} 5-min market page, navigating to active market first...`);
    sendStatusUpdate('warning', `Navigating to active ${window.MARKET_TYPE} market...`);

    try {
      const activeSlug = await POLYMARKET_API.getCurrentActiveMarketSlug(window.MARKET_TYPE);
      const activeUrl = `https://polymarket.com/event/${activeSlug}`;
      console.log(`[Bot] Redirecting to: ${activeSlug}`);

      // Only navigate if we're not already going to this URL
      if (!currentUrl.includes(activeSlug)) {
        // Set flag so bot auto-starts after navigation (instance-specific)
        const storageKey = getStorageKey('botRunning');
        await chrome.storage.local.set({ [storageKey]: true });
        window.location.href = activeUrl;
        return; // Stop here, bot will auto-start on new page
      } else {
        console.log('[Bot] Already on target market, continuing...');
      }
    } catch (error) {
      console.error(`[Bot] Failed to find active ${window.MARKET_TYPE} market:`, error);
      sendStatusUpdate('error', `Failed to find active ${window.MARKET_TYPE} market`);
      return;
    }
  }

  botState.isRunning = true;
  botState.tradeExecuted = false;
  botState.scalingExecuted = false;

  // Restore martingale state from storage
  restoreMartingaleState();

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
        const activeSlug = await POLYMARKET_API.getCurrentActiveMarketSlug(window.MARKET_TYPE);
        if (activeSlug) {
          console.log('[Bot] Navigating to active market:', activeSlug);
          sendStatusUpdate('soft', `Navigating to: ${activeSlug}`);
          window.location.href = `https://polymarket.com/event/${activeSlug}`;
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

    // CRITICAL: Validate we're in a proper 5-min market (0-300 seconds)
    if (timeRemaining > 300) {
      console.log(`[Bot] ⚠️ Invalid market: Timer shows ${Math.floor(timeRemaining/60)}m ${timeRemaining%60}s (>5min). Navigating to current market...`);
      sendStatusUpdate('error', `Wrong market detected (>${Math.floor(timeRemaining/60)}min), navigating to correct one...`);
      navigateToNextMarket();
      return;
    }

    // Check if market has resolved (timer reached 0 or negative)
    if (timeRemaining <= 0) {
      console.log('[Bot] Market resolved (timer <= 0), navigating to next market...');
      navigateToNextMarket();
      return;
    }

    // STUCK TIMER DETECTION: If timer hasn't decreased in 10 seconds, force navigation
    if (botState.lastTimeRemaining !== null) {
      // Timer should always be decreasing (or stay same within 1 second due to caching)
      if (timeRemaining >= botState.lastTimeRemaining) {
        botState.timeStuckCounter++;
        if (botState.timeStuckCounter >= 20) { // 20 checks * 500ms = 10 seconds stuck
          console.log(`[Bot] ⚠️ Timer stuck at ${timeRemaining}s for 10+ seconds, forcing navigation...`);
          sendStatusUpdate('error', 'Timer stuck, forcing market refresh...');
          botState.timeStuckCounter = 0;
          navigateToNextMarket();
          return;
        }
      } else {
        // Timer is decreasing normally, reset counter
        botState.timeStuckCounter = 0;
      }
    }
    botState.lastTimeRemaining = timeRemaining;

    // Calculate current stake (considering martingale)
    botState.currentStake = botState.settings.stake * Math.pow(botState.settings.martingaleMultiplier, botState.martingaleStep);

    // PRE-FILL STAKE INPUT at market start (only once)
    if (!botState.stakePreFilled && elapsed >= 5) { // Wait 5 seconds into market to ensure page is loaded
      try {
        fillStakeInput(botState.currentStake);
        botState.stakePreFilled = true;
        console.log(`[Bot] 💰 Pre-filled stake input with $${botState.currentStake.toFixed(2)}`);
      } catch (error) {
        console.log(`[Bot] Could not pre-fill stake (will try again): ${error.message}`);
      }
    }

    // Check if we're in the entry time window
    const inTimeWindow = elapsed >= botState.settings.timeMin && elapsed <= botState.settings.timeMax;

    if (!inTimeWindow) {
      // Silent wait - don't spam console
      return;
    }

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
  botState.tradeDirection = direction; // Track direction for win/loss detection

  try {
    // Stake should already be pre-filled, but refill to ensure correct amount
    fillStakeInput(botState.currentStake);

    // NO DELAY - stake was pre-filled, just click immediately
    clickTradeButton(direction);

    // Confirm trade was placed
    setTimeout(() => {
      sendStatusUpdate('trade_placed', `✅ ${direction} trade: $${botState.currentStake} @ ${(probability * 100).toFixed(1)}%`);
    }, 500);

  } catch (error) {
    console.error('[Bot] ❌ Trade execution error:', error);
    sendStatusUpdate('error', `Trade failed: ${error.message}`);
    // Reset flag on error
    botState.tradeExecuted = false;
    botState.tradeDirection = null;
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
  // Use cached data if fetched recently (within 500ms for fresher data)
  const now = Date.now();
  if (cachedMarketData && (now - lastFetchTime) < 500) {
    return cachedMarketData;
  }

  // Fetch fresh data from API
  cachedMarketData = await POLYMARKET_API.getCurrentMarketData();
  lastFetchTime = now;

  return cachedMarketData;
}

async function getTimeRemaining() {
  try {
    // CRITICAL FIX: Calculate time remaining in real-time, not from cached data
    // This prevents timer desync issues when API is slow

    // If we have the market end timestamp from URL, calculate directly
    if (marketTimestampFromURL) {
      const now = Date.now();
      const timeRemaining = Math.max(0, Math.floor((marketTimestampFromURL - now) / 1000));
      return timeRemaining;
    }

    // Fallback: fetch market data (this also sets marketTimestampFromURL)
    const marketData = await getMarketData();
    if (!marketData) {
      console.warn('[Bot] No market data available');
      return 0;
    }

    // Recalculate time with current timestamp (don't use cached value)
    const now = Date.now();
    if (marketTimestampFromURL) {
      return Math.max(0, Math.floor((marketTimestampFromURL - now) / 1000));
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
    }, 100); // Wait 100ms after finding button before clicking

  }, 150); // Wait 150ms after selection button click to let Place Order button appear
}

// Expose for manual trading from panel
window.clickTradeButton = clickTradeButton;

// Detect win/loss by checking which outcome won (UP or DOWN)
async function detectTradeResult() {
  if (!botState.tradeDirection) {
    console.log('[Bot] No trade was placed, skipping win/loss detection');
    return null;
  }

  try {
    // Get the final market data to see which side won
    const data = await POLYMARKET_API.getCurrentMarketData();

    if (!data || !data.outcome) {
      console.log('[Bot] Cannot determine outcome yet, market may not be fully resolved');
      return null;
    }

    // Polymarket outcome: "Yes" = UP won, "No" = DOWN won
    const marketWinner = data.outcome === 'Yes' ? 'UP' : 'DOWN';
    const won = marketWinner === botState.tradeDirection;

    console.log(`[Bot] 🏁 Market Result: ${marketWinner} won. We traded ${botState.tradeDirection}. ${won ? '✅ WON' : '❌ LOST'}`);

    return won;
  } catch (error) {
    console.error('[Bot] Error detecting trade result:', error);
    return null;
  }
}

async function navigateToNextMarket() {
  try {
    // DETECT WIN/LOSS before navigating (if martingale enabled)
    if (botState.settings.martingaleEnabled && botState.tradeExecuted) {
      const won = await detectTradeResult();

      if (won !== null) {
        if (won) {
          // Won - reset martingale
          console.log(`[Bot] 🎉 Trade won! Resetting martingale step to 0`);
          botState.martingaleStep = 0;
          botState.lastTradeWon = true;
        } else {
          // Lost - increase martingale step
          if (botState.martingaleStep < botState.settings.martingaleMaxSteps) {
            botState.martingaleStep++;
            console.log(`[Bot] 😞 Trade lost. Increasing martingale step to ${botState.martingaleStep}`);
          } else {
            console.log(`[Bot] ⚠️ Trade lost but already at max martingale steps (${botState.settings.martingaleMaxSteps})`);
          }
          botState.lastTradeWon = false;
        }
      }
    }

    // Get CURRENT ACTIVE market slug (not necessarily "next")
    const activeSlug = await POLYMARKET_API.getCurrentActiveMarketSlug(window.MARKET_TYPE);
    const activeUrl = `https://polymarket.com/event/${activeSlug}`;

    console.log(`[Bot] Navigating to active ${window.MARKET_TYPE} market: ${activeSlug}`);

    // Reset trade state for new market
    botState.tradeExecuted = false;
    botState.scalingExecuted = false;
    botState.stakePreFilled = false;
    botState.tradeDirection = null;
    botState.lastTimeRemaining = null; // Reset timer tracking
    botState.timeStuckCounter = 0; // Reset stuck counter
    cachedMarketData = null; // Clear cache
    marketTimestampFromURL = null; // Clear cached timestamp

    // Persist martingale state before navigation
    await saveMartingaleState();

    sendStatusUpdate('next_market', `Moving to active market: ${activeSlug}`);

    // Navigate to active market
    window.location.href = activeUrl;

  } catch (error) {
    console.error('[Bot] Error navigating to active market:', error);
    stopBot();
  }
}

function sendStatusUpdate(status, details) {
  // Send to background script
  chrome.runtime.sendMessage({
    type: 'STATUS_UPDATE',
    status,
    details
  });

  // ALSO dispatch custom event for panel.js (runs in same page context)
  window.dispatchEvent(new CustomEvent('bot-status-update', {
    detail: { status, details }
  }));
}

// Martingale persistence functions (per market AND per instance)
async function saveMartingaleState() {
  const martingaleKey = getStorageKey(`martingale_${window.MARKET_TYPE}`);
  await chrome.storage.local.set({
    [martingaleKey]: {
      step: botState.martingaleStep,
      lastWon: botState.lastTradeWon
    }
  });
  console.log(`[Bot] Saved ${window.MARKET_TYPE} martingale state for this tab: step=${botState.martingaleStep}, lastWon=${botState.lastTradeWon}`);
}

async function restoreMartingaleState() {
  const martingaleKey = getStorageKey(`martingale_${window.MARKET_TYPE}`);
  const data = await chrome.storage.local.get([martingaleKey]);
  const savedMartingale = data[martingaleKey] || {};

  if (savedMartingale.step !== undefined) {
    botState.martingaleStep = savedMartingale.step;
    botState.lastTradeWon = savedMartingale.lastWon;
    console.log(`[Bot] Restored ${window.MARKET_TYPE} martingale state for this tab: step=${savedMartingale.step}, lastWon=${savedMartingale.lastWon}`);
  }
}

// Handle tab visibility changes - resume bot when tab becomes active
document.addEventListener('visibilitychange', async () => {
  if (!document.hidden && botState.isRunning) {
    console.log('[Bot] Tab became visible, resuming monitoring...');
    sendStatusUpdate('running', 'Bot resumed (tab became active)');

    // Ensure interval is running
    if (!botState.checkInterval) {
      botState.checkInterval = setInterval(monitorMarket, 500);
    }
  } else if (document.hidden && botState.isRunning) {
    console.log('[Bot] ⚠️ Tab hidden - bot will pause until tab is active again');
    sendStatusUpdate('warning', 'Bot paused (tab hidden - Chrome limitation)');
  }
});

// Export for debugging in console and panel access
window.polymarketBot = {
  start: startBot,
  stop: stopBot,
  state: botState,
  selectors: SELECTORS
};

// Expose API, state, and functions for panel.js
window.POLYMARKET_API = POLYMARKET_API;
// window.MARKET_TYPE already set above
window.INSTANCE_ID = INSTANCE_ID;
window.startBot = startBot;
window.stopBot = stopBot;

console.log(`[Polymarket Bot] Ready for ${window.MARKET_TYPE} market. Instance: ${INSTANCE_ID}`);
