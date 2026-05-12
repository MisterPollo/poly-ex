
// ===== FLOATING PANEL UI =====
// Inject floating panel into page

async function injectFloatingPanel() {
  try {
    // Check if panel already exists
    if (document.getElementById('polymarket-bot-panel')) {
      document.getElementById('polymarket-bot-panel').style.display = 'block';
      return;
    }

    // Add custom styles for resizer and animations
    const style = document.createElement('style');
    style.textContent = `
      #polymarket-bot-panel::-webkit-resizer {
        background: linear-gradient(135deg, transparent 0%, transparent 40%, #2a2a2a 40%, #2a2a2a 50%, transparent 50%, transparent 90%, #2a2a2a 90%);
      }
      #polymarket-bot-panel.auto-resizing {
        transition: height 0.3s ease-out;
      }
      .panel-section-slide {
        overflow: hidden;
        transition: max-height 0.3s ease-out, opacity 0.3s ease-out;
      }
      .panel-section-slide.collapsed {
        max-height: 0 !important;
        opacity: 0;
      }
      .console-line {
        margin-bottom: 2px;
        color: #22c55e;
      }
      .console-line.info { color: #22c55e; }
      .console-line.success { color: #22c55e; }
      .console-line.error { color: #ef4444; }
      .console-line.warning { color: #eab308; }
    `;
    document.head.appendChild(style);

    // Inline the HTML directly
    const panelHTML = `
<div id="polymarket-bot-panel" style="position: fixed !important; top: 100px; left: 20px; width: 380px; min-width: 300px; min-height: 250px; max-width: 700px; max-height: 90vh; resize: both; overflow: hidden; background: #111111; border: 1px solid #2a2a2a; border-radius: 8px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8); z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e5e5e5; font-size: 13px; display: flex; flex-direction: column;">
  <div id="panel-header" style="background: linear-gradient(135deg, #1a1a1a 0%, #222222 100%); padding: 10px 12px; border-bottom: 1px solid #2a2a2a; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
    <div class="panel-title" style="display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13px; color: #22c55e; cursor: move; user-select: none; flex: 1;">
      <span style="font-size: 14px; color: #22c55e;">⚡</span>
      <span>Lecsó</span>
    </div>
    <div class="panel-controls" style="display: flex; gap: 4px; align-items: center;">
      <select id="floatMarketSelector" title="Select market" style="height: 20px; padding: 0 4px; border: none; background: #2a2a2a; color: #22c55e; border-radius: 3px; cursor: pointer; font-size: 10px; font-weight: 600;">
        <option value="BTC">BTC</option>
        <option value="ETH">ETH</option>
        <option value="SOL">SOL</option>
        <option value="XRP">XRP</option>
        <option value="DOGE">DOGE</option>
      </select>
      <button id="floatNavBtn" title="Navigate to selected market" style="height: 20px; padding: 0 6px; border: none; background: #2a2a2a; color: #888; border-radius: 3px; cursor: pointer; font-size: 9px; font-weight: 600;">NAV</button>
      <button id="floatManualBtn" title="Manual trading mode" style="height: 20px; padding: 0 6px; border: none; background: #2a2a2a; color: #888; border-radius: 3px; cursor: pointer; font-size: 9px; font-weight: 600;">MAN</button>
      <button id="floatSoftStartBtn" title="Auto-navigate to next market (testing)" style="height: 20px; padding: 0 6px; border: none; background: #2a2a2a; color: #888; border-radius: 3px; cursor: pointer; font-size: 9px; font-weight: 600;">SOFT</button>
      <button id="minimizeBtn" style="width: 20px; height: 20px; border: none; background: #2a2a2a; color: #888; border-radius: 4px; cursor: pointer; font-size: 16px; padding: 0;">−</button>
      <button id="closeBtn" style="width: 20px; height: 20px; border: none; background: #2a2a2a; color: #888; border-radius: 4px; cursor: pointer; font-size: 16px; padding: 0;">×</button>
    </div>
  </div>

  <div id="panel-content" style="padding: 12px; overflow-y: auto; flex: 1;">
    <!-- Manual Trading Section (Collapsible) -->
    <div id="panel-manual-section" class="panel-section-slide collapsed" style="max-height: 0; opacity: 0;">
      <div style="background: #1a1a1a; padding: 10px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #2a2a2a;">
        <div style="margin-bottom: 8px;">
          <label style="display: block; font-size: 11px; color: #888; margin-bottom: 4px;">Amount (USD)</label>
          <input type="number" id="manualStake" min="0.1" step="0.1" value="1.0" style="width: 100%; padding: 6px 8px; background: #0a0a0a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 12px;">
        </div>
        <div style="display: flex; gap: 6px;">
          <button id="manualUpBtn" style="flex: 1; padding: 10px; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; background: #22c55e; color: #000;">BUY UP</button>
          <button id="manualDownBtn" style="flex: 1; padding: 10px; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; background: #ef4444; color: #fff;">BUY DOWN</button>
        </div>
      </div>
    </div>

    <!-- Market Info -->
    <div style="background: #1a1a1a; padding: 10px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #2a2a2a;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11px;">
        <span style="color: #888;">Market ID:</span>
        <span id="floatMarketSlug" style="font-family: 'Courier New', monospace; font-weight: 600; color: #22c55e; font-size: 10px;">------</span>
      </div>
      <div style="display: flex; justify-content: center; font-size: 11px; margin-bottom: 12px; color: #888;">
        <span style="margin-right: 6px;">Time:</span>
        <span id="floatTimeRemaining" style="font-family: 'Courier New', monospace; font-weight: 600; color: #22c55e;">--:--</span>
      </div>
      <div style="display: flex; justify-content: space-around; gap: 20px;">
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 10px; color: #22c55e; margin-bottom: 4px; font-weight: 600;">UP</div>
          <div id="floatUpPrice" style="font-family: 'Courier New', monospace; font-weight: 700; font-size: 28px; color: #22c55e; line-height: 1;">--¢</div>
        </div>
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 10px; color: #ef4444; margin-bottom: 4px; font-weight: 600;">DOWN</div>
          <div id="floatDownPrice" style="font-family: 'Courier New', monospace; font-weight: 700; font-size: 28px; color: #ef4444; line-height: 1;">--¢</div>
        </div>
      </div>
    </div>

    <!-- Status -->
    <div style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #1a1a1a; border-radius: 6px; margin-bottom: 10px; font-size: 11px; border: 1px solid #2a2a2a;">
      <div id="floatStatusIndicator" style="width: 8px; height: 8px; border-radius: 50%; background: #444; flex-shrink: 0;"></div>
      <div id="floatStatusText" style="color: #888; flex: 1;">Bot is idle</div>
    </div>

    <!-- Control Buttons -->
    <div style="margin-bottom: 10px;">
      <button id="floatStartBtn" title="Full bot with trading" style="width: 100%; padding: 10px; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; background: #22c55e; color: #000;">Start Bot</button>
    </div>

    <!-- Settings & Console Buttons -->
    <div style="display: flex; gap: 6px; margin-bottom: 10px;">
      <button id="toggleSettingsBtn" style="flex: 1; padding: 8px; border: none; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; background: #2a2a2a; color: #e5e5e5;">⚙ Settings</button>
      <button id="toggleConsoleBtn" style="flex: 1; padding: 8px; border: none; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; background: #2a2a2a; color: #e5e5e5;">📋 Console</button>
    </div>

    <!-- Settings Section (Collapsible) -->
    <div id="panel-settings-section" class="panel-section-slide collapsed" style="max-height: 0; opacity: 0;">
      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 11px; color: #888; margin-bottom: 4px;">Stake per Trade (USD)</label>
        <input type="number" id="floatStake" min="0.1" step="0.1" value="1.0" style="width: 100%; padding: 6px 8px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 12px;">
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 11px; color: #888; margin-bottom: 4px;">Entry Probability Range</label>
        <div style="display: flex; gap: 6px; align-items: center;">
          <input type="number" id="floatProbMin" min="0.5" max="0.99" step="0.01" value="0.70" style="flex: 1; padding: 6px 8px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 12px;">
          <span style="color: #888; font-size: 11px;">to</span>
          <input type="number" id="floatProbMax" min="0.5" max="0.99" step="0.01" value="0.78" style="flex: 1; padding: 6px 8px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 12px;">
        </div>
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 11px; color: #888; margin-bottom: 4px;">Entry Time Window (MM:SS)</label>
        <div style="display: flex; gap: 6px; align-items: center;">
          <input type="text" id="floatTimeMin" placeholder="03:00" maxlength="5" value="03:00" style="flex: 1; padding: 6px 8px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 12px; text-align: center; font-family: 'Courier New', monospace;">
          <span style="color: #888; font-size: 11px;">to</span>
          <input type="text" id="floatTimeMax" placeholder="05:00" maxlength="5" value="05:00" style="flex: 1; padding: 6px 8px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 12px; text-align: center; font-family: 'Courier New', monospace;">
        </div>
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; cursor: pointer;">
          <input type="checkbox" id="floatScalingEnabled" style="cursor: pointer;">
          <span style="color: #e5e5e5; font-weight: 600;">Enable Scaling (Pyramiding)</span>
        </label>
        <div id="floatScalingSettings" style="display: none; margin-top: 6px; padding-left: 20px;">
          <label style="display: block; font-size: 10px; color: #888; margin-bottom: 3px;">Scale Probability Threshold</label>
          <input type="number" id="floatScaleProb" min="0.5" max="0.99" step="0.01" value="0.80" placeholder="0.80" style="width: 100%; padding: 5px 7px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 11px; margin-bottom: 6px;">
          <label style="display: block; font-size: 10px; color: #888; margin-bottom: 3px;">Additional Stake Amount ($)</label>
          <input type="number" id="floatScaleStake" min="0.1" step="0.1" value="5.0" placeholder="5.0" style="width: 100%; padding: 5px 7px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 11px;">
          <div style="font-size: 9px; color: #666; margin-top: 4px; font-style: italic;">Add more to winning position when probability increases</div>
        </div>
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; cursor: pointer;">
          <input type="checkbox" id="floatMartingaleEnabled" style="cursor: pointer;">
          <span style="color: #e5e5e5; font-weight: 600;">Enable Martingale</span>
        </label>
        <div id="floatMartingaleSettings" style="display: none; margin-top: 6px; padding-left: 20px;">
          <label style="display: block; font-size: 10px; color: #888; margin-bottom: 3px;">Stake Multiplier After Loss</label>
          <input type="number" id="floatMartingaleMultiplier" min="1.1" max="5" step="0.1" value="2.0" placeholder="2.0" style="width: 100%; padding: 5px 7px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 11px; margin-bottom: 6px;">
          <label style="display: block; font-size: 10px; color: #888; margin-bottom: 3px;">Maximum Consecutive Steps</label>
          <input type="number" id="floatMartingaleMaxSteps" min="1" max="10" step="1" value="3" placeholder="3" style="width: 100%; padding: 5px 7px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 11px;">
          <div style="font-size: 9px; color: #666; margin-top: 4px; font-style: italic;">Double stake after losses to recover (high risk)</div>
        </div>
      </div>

      <button id="floatSaveBtn" style="width: 100%; padding: 8px; background: #2a2a2a; color: #e5e5e5; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; margin-top: 4px; margin-bottom: 10px;">Save Settings</button>
    </div>

    <!-- Console Section (Collapsible) -->
    <div id="panel-console-section" class="panel-section-slide collapsed" style="max-height: 0; opacity: 0;">
      <div style="background: #1a1a1a; border-radius: 6px; overflow: hidden; border: 1px solid #2a2a2a;">
        <div style="padding: 6px 10px; background: #222; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2a2a2a;">
          <span style="font-size: 11px; font-weight: 600; color: #22c55e;">Console</span>
          <div style="display: flex; gap: 4px;">
            <button id="floatDebugBtn" style="padding: 3px 8px; background: #2a2a2a; color: #888; border: none; border-radius: 3px; font-size: 10px; cursor: pointer;">DBG</button>
            <button id="floatExportConsole" style="padding: 3px 8px; background: #2a2a2a; color: #888; border: none; border-radius: 3px; font-size: 10px; cursor: pointer;">Export</button>
            <button id="floatClearConsole" style="padding: 3px 8px; background: #2a2a2a; color: #888; border: none; border-radius: 3px; font-size: 10px; cursor: pointer;">Clear</button>
          </div>
        </div>
        <div id="floatConsole" style="max-height: 200px; overflow-y: auto; padding: 8px; font-family: 'Courier New', monospace; font-size: 10px; background: #0a0a0a;"></div>
      </div>
    </div>
  </div>
</div>
    `;

    // Create container
    const container = document.createElement('div');
    container.innerHTML = panelHTML;
    document.body.appendChild(container.firstElementChild);

    // Set market type in title and selector
    const marketType = window.MARKET_TYPE || 'BTC';

    // Set title
    const titleSpan = document.querySelector('.panel-title span:last-child');
    if (titleSpan) {
      titleSpan.textContent = marketType;
    }

    // Set the header selector value
    const headerSelector = document.getElementById('floatMarketSelector');
    if (headerSelector) {
      headerSelector.value = marketType;
    }

    // Setup panel functionality
    setupFloatingPanel();

    console.log(`[Bot] ✅ Floating panel injected for ${marketType} market`);
  } catch (error) {
    console.error('[Bot] Failed to inject panel:', error);
  }
}

function setupFloatingPanel() {
  const panel = document.getElementById('polymarket-bot-panel');
  const header = document.getElementById('panel-header');
  const content = document.getElementById('panel-content');
  const minimizeBtn = document.getElementById('minimizeBtn');
  const closeBtn = document.getElementById('closeBtn');

  // Make draggable
  let isDragging = false;
  let currentX, currentY, initialX, initialY;

  header.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  function dragStart(e) {
    // Only allow dragging from the title area, not buttons
    if (e.target.closest('.panel-btn') || e.target.closest('.panel-controls')) return;
    if (!e.target.closest('.panel-title')) return;

    const rect = panel.getBoundingClientRect();
    initialX = e.clientX - rect.left;
    initialY = e.clientY - rect.top;
    isDragging = true;
    panel.classList.add('dragging');
    e.preventDefault();
  }

  function drag(e) {
    if (!isDragging) return;

    e.preventDefault();
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;

    const maxX = window.innerWidth - panel.offsetWidth;
    const maxY = window.innerHeight - panel.offsetHeight;

    currentX = Math.max(0, Math.min(currentX, maxX));
    currentY = Math.max(0, Math.min(currentY, maxY));

    panel.style.left = currentX + 'px';
    panel.style.top = currentY + 'px';
    panel.style.right = 'auto';
  }

  function dragEnd() {
    isDragging = false;
    panel.classList.remove('dragging');
  }

  minimizeBtn.addEventListener('click', () => {
    content.classList.toggle('minimized');
    minimizeBtn.textContent = content.classList.contains('minimized') ? '+' : '−';
  });

  closeBtn.addEventListener('click', async () => {
    panel.style.display = 'none';
    await chrome.storage.local.set({ floatingPanelVisible: false });
  });

  // Market selector - Change market type
  document.getElementById('floatMarketSelector').addEventListener('change', async (e) => {
    e.stopPropagation();
    const newMarketType = e.target.value;

    console.log('[Panel] Market selector changed to:', newMarketType);
    console.log('[Panel] Before: window.MARKET_TYPE =', window.MARKET_TYPE);

    // Update global MARKET_TYPE
    window.MARKET_TYPE = newMarketType;

    // PERSIST the selected market so it survives page reload
    await chrome.storage.local.set({ selectedMarket: newMarketType });

    console.log('[Panel] After: window.MARKET_TYPE =', window.MARKET_TYPE);
    console.log('[Panel] Saved selectedMarket to storage:', newMarketType);

    // Update title
    const titleSpan = document.querySelector('.panel-title span:last-child');
    if (titleSpan) {
      titleSpan.textContent = `${newMarketType}`;
    }

    // Reload settings for new market
    await loadPanelSettings();

    addFloatingConsoleLog('success', `Switched to ${newMarketType}. Settings loaded.`);
  });

  // NAV button - Navigate to selected market
  document.getElementById('floatNavBtn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const marketType = window.MARKET_TYPE || 'BTC';
    addFloatingConsoleLog('info', `Finding active ${marketType} 5-min market...`);
    try {
      // Get CURRENT ACTIVE market slug from API
      const activeSlug = await window.POLYMARKET_API.getCurrentActiveMarketSlug(marketType);
      const activeUrl = `https://polymarket.com/event/${activeSlug}`;
      addFloatingConsoleLog('success', `Navigating to: ${activeSlug}`);
      window.location.href = activeUrl;
    } catch (error) {
      addFloatingConsoleLog('error', `Navigation failed: ${error.message}`);
    }
  });

  // Manual mode toggle button
  document.getElementById('floatManualBtn').addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent dragging
    const manualSection = document.getElementById('panel-manual-section');
    const manualBtn = document.getElementById('floatManualBtn');

    if (manualSection.classList.contains('collapsed')) {
      // Expand manual mode
      manualSection.classList.remove('collapsed');
      manualSection.style.maxHeight = '200px';
      manualSection.style.opacity = '1';
      manualBtn.style.background = '#3b82f6';
      manualBtn.style.color = '#fff';

      // Auto-expand panel if needed
      autoResizePanel(true);
    } else {
      // Collapse manual mode
      manualSection.classList.add('collapsed');
      manualSection.style.maxHeight = '0';
      manualSection.style.opacity = '0';
      manualBtn.style.background = '#2a2a2a';
      manualBtn.style.color = '#888';

      // Shrink panel back
      autoResizePanel(false);
    }
  });

  // Manual UP button
  document.getElementById('manualUpBtn').addEventListener('click', async () => {
    const stake = parseFloat(document.getElementById('manualStake').value);
    if (isNaN(stake) || stake < 0.1) {
      addFloatingConsoleLog('error', 'Invalid stake amount');
      return;
    }

    addFloatingConsoleLog('info', `Manual trade: BUY UP $${stake.toFixed(2)}`);

    // Call the trade execution function from content.js
    try {
      window.fillStakeInput(stake);
      setTimeout(() => {
        window.clickTradeButton('UP');
        addFloatingConsoleLog('success', `✅ Manual UP trade executed`);
      }, 800);
    } catch (error) {
      addFloatingConsoleLog('error', `Manual trade failed: ${error.message}`);
    }
  });

  // Manual DOWN button
  document.getElementById('manualDownBtn').addEventListener('click', async () => {
    const stake = parseFloat(document.getElementById('manualStake').value);
    if (isNaN(stake) || stake < 0.1) {
      addFloatingConsoleLog('error', 'Invalid stake amount');
      return;
    }

    addFloatingConsoleLog('info', `Manual trade: BUY DOWN $${stake.toFixed(2)}`);

    // Call the trade execution function from content.js
    try {
      window.fillStakeInput(stake);
      setTimeout(() => {
        window.clickTradeButton('DOWN');
        addFloatingConsoleLog('success', `✅ Manual DOWN trade executed`);
      }, 800);
    } catch (error) {
      addFloatingConsoleLog('error', `Manual trade failed: ${error.message}`);
    }
  });

  // Settings toggle button with smooth animation
  document.getElementById('toggleSettingsBtn').addEventListener('click', () => {
    const settingsSection = document.getElementById('panel-settings-section');
    const toggleBtn = document.getElementById('toggleSettingsBtn');

    if (settingsSection.classList.contains('collapsed')) {
      // Expand settings
      settingsSection.classList.remove('collapsed');
      settingsSection.style.maxHeight = '600px';
      settingsSection.style.opacity = '1';
      toggleBtn.textContent = '⚙';
      toggleBtn.style.background = '#22c55e';
      toggleBtn.style.color = '#000';

      // Auto-expand panel if needed
      autoResizePanel(true);
    } else {
      // Collapse settings
      settingsSection.classList.add('collapsed');
      settingsSection.style.maxHeight = '0';
      settingsSection.style.opacity = '0';
      toggleBtn.textContent = '⚙';
      toggleBtn.style.background = '#2a2a2a';
      toggleBtn.style.color = '#e5e5e5';

      // Shrink panel back
      autoResizePanel(false);
    }
  });

  // Console toggle button with smooth animation
  document.getElementById('toggleConsoleBtn').addEventListener('click', () => {
    const consoleSection = document.getElementById('panel-console-section');
    const toggleBtn = document.getElementById('toggleConsoleBtn');

    if (consoleSection.classList.contains('collapsed')) {
      // Expand console
      consoleSection.classList.remove('collapsed');
      consoleSection.style.maxHeight = '300px';
      consoleSection.style.opacity = '1';
      toggleBtn.textContent = '📋';
      toggleBtn.style.background = '#22c55e';
      toggleBtn.style.color = '#000';

      // Auto-expand panel if needed
      autoResizePanel(true);
    } else {
      // Collapse console
      consoleSection.classList.add('collapsed');
      consoleSection.style.maxHeight = '0';
      consoleSection.style.opacity = '0';
      toggleBtn.textContent = '📋';
      toggleBtn.style.background = '#2a2a2a';
      toggleBtn.style.color = '#e5e5e5';

      // Shrink panel back
      autoResizePanel(false);
    }
  });

  // Load settings into panel
  loadPanelSettings();

  // Settings toggles
  document.getElementById('floatScalingEnabled').addEventListener('change', (e) => {
    document.getElementById('floatScalingSettings').style.display = e.target.checked ? 'block' : 'none';
  });

  document.getElementById('floatMartingaleEnabled').addEventListener('change', (e) => {
    document.getElementById('floatMartingaleSettings').style.display = e.target.checked ? 'block' : 'none';
  });

  // Save settings button
  document.getElementById('floatSaveBtn').addEventListener('click', savePanelSettings);

  // Soft Start button (only auto-navigate) - in header
  const softBtn = document.getElementById('floatSoftStartBtn');
  softBtn.addEventListener('click', async (e) => {
    e.stopPropagation(); // Prevent dragging
    const { softStartRunning } = await chrome.storage.local.get('softStartRunning');
    const newState = !softStartRunning;

    await chrome.storage.local.set({
      softStartRunning: newState,
      botRunning: false // Make sure full bot is off
    });

    if (newState) {
      startSoftMode();
      softBtn.style.background = '#eab308';
      softBtn.style.color = '#000';
      softBtn.textContent = 'STOP';
    } else {
      stopSoftMode();
      softBtn.style.background = '#2a2a2a';
      softBtn.style.color = '#888';
      softBtn.textContent = 'SOFT';
    }

    updateFloatingPanelStatus(newState, true);
  });

  // Full Start button
  document.getElementById('floatStartBtn').addEventListener('click', async () => {
    console.log('[Panel] Start button clicked');
    addFloatingConsoleLog('info', 'Start button clicked');

    const { botRunning } = await chrome.storage.local.get('botRunning');
    console.log('[Panel] Current botRunning state:', botRunning);
    const newState = !botRunning;
    console.log('[Panel] New state will be:', newState);

    await chrome.storage.local.set({
      botRunning: newState,
      softStartRunning: false // Turn off soft mode
    });

    // Call window functions exposed by content.js
    if (newState) {
      console.log('[Panel] Attempting to start bot. window.startBot exists:', !!window.startBot);
      if (window.startBot) {
        window.startBot();
        addFloatingConsoleLog('success', 'Bot started!');
      } else {
        addFloatingConsoleLog('error', 'Bot functions not available - content.js may not be loaded');
        console.error('[Panel] window.startBot not found');
      }
    } else {
      console.log('[Panel] Attempting to stop bot. window.stopBot exists:', !!window.stopBot);
      if (window.stopBot) {
        window.stopBot();
        addFloatingConsoleLog('success', 'Bot stopped!');
      } else {
        addFloatingConsoleLog('error', 'Bot functions not available - content.js may not be loaded');
        console.error('[Panel] window.stopBot not found');
      }
    }

    updateFloatingPanelStatus(newState, false);
  });

  // Debug button - Toggle debug mode
  document.getElementById('floatDebugBtn').addEventListener('click', () => {
    window.DEBUG_MODE = !window.DEBUG_MODE;
    const debugBtn = document.getElementById('floatDebugBtn');

    if (window.DEBUG_MODE) {
      debugBtn.style.background = '#eab308';
      debugBtn.style.color = '#000';
      debugBtn.textContent = 'DBG✓';
      addFloatingConsoleLog('warning', '🔧 DEBUG MODE ON - All logs will show');
    } else {
      debugBtn.style.background = '#2a2a2a';
      debugBtn.style.color = '#888';
      debugBtn.textContent = 'DBG';
      addFloatingConsoleLog('info', 'Debug mode off');
    }
  });

  // Clear console button
  document.getElementById('floatClearConsole').addEventListener('click', () => {
    document.getElementById('floatConsole').innerHTML = '';
    addFloatingConsoleLog('info', 'Console cleared');
  });

  // Export console button
  document.getElementById('floatExportConsole').addEventListener('click', () => {
    const consoleEl = document.getElementById('floatConsole');
    if (!consoleEl || consoleEl.children.length === 0) {
      addFloatingConsoleLog('warning', 'No logs to export');
      return;
    }

    // Collect all console lines
    const logs = [];
    for (let line of consoleEl.children) {
      logs.push(line.textContent);
    }

    // Create text content
    const content = logs.join('\n');

    // Create blob and download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Filename with timestamp
    const now = new Date();
    const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}${now.getSeconds().toString().padStart(2,'0')}`;
    a.download = `polymarket_bot_logs_${timestamp}.txt`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addFloatingConsoleLog('success', `✅ Exported ${logs.length} log entries`);
  });

  // Setup time input formatting
  setupTimeInputFormatting();

  // Restore console logs from previous session
  restoreConsoleLogs();

  // Check and restore bot state on page load
  checkAndRestoreBotState();

  startFloatingPanelUpdates();
}

async function checkAndRestoreBotState() {
  // Wait a moment for window.MARKET_TYPE to be initialized from storage
  await new Promise(resolve => setTimeout(resolve, 500));

  const { botRunning, softStartRunning } = await chrome.storage.local.get(['botRunning', 'softStartRunning']);
  const softBtn = document.getElementById('floatSoftStartBtn');

  if (softStartRunning) {
    // Restart soft mode
    startSoftMode();
    softBtn.style.background = '#eab308';
    softBtn.style.color = '#000';
    softBtn.textContent = 'STOP';
    updateFloatingPanelStatus(true, true);
    addFloatingConsoleLog('info', 'Soft mode resumed after page reload');
  } else if (botRunning) {
    // Restart full bot - ensure MARKET_TYPE is set first
    console.log('[Panel] Resuming bot. window.MARKET_TYPE =', window.MARKET_TYPE);
    if (window.startBot) {
      window.startBot();
      updateFloatingPanelStatus(true, false);
      addFloatingConsoleLog('info', 'Bot resumed after page reload');
    } else {
      addFloatingConsoleLog('error', 'Bot functions not loaded yet');
    }
  }
}

function autoResizePanel(expanding) {
  const panel = document.getElementById('polymarket-bot-panel');
  const content = document.getElementById('panel-content');

  if (!panel || !content) return;

  const delay = expanding ? 320 : 350; // Wait longer for collapse animation

  setTimeout(() => {
    // Calculate height of only visible sections
    const header = document.getElementById('panel-header');
    const manualSection = document.getElementById('panel-manual-section');
    const settingsSection = document.getElementById('panel-settings-section');
    const consoleSection = document.getElementById('panel-console-section');

    let totalHeight = 24; // Base padding (12px top + 12px bottom from panel-content)

    // Add header height
    if (header) {
      totalHeight += header.offsetHeight;
    }

    // Get all direct children of panel-content
    const children = content.children;
    for (let child of children) {
      // Skip the collapsible sections - we'll handle them separately
      if (child.id === 'panel-manual-section' || child.id === 'panel-settings-section' || child.id === 'panel-console-section') {
        continue;
      }
      // Add height of all other visible elements
      totalHeight += child.offsetHeight;

      // Add margin-bottom (10px for most elements)
      const marginBottom = parseInt(window.getComputedStyle(child).marginBottom) || 0;
      totalHeight += marginBottom;
    }

    // Only add height for expanded collapsible sections
    if (manualSection && !manualSection.classList.contains('collapsed')) {
      totalHeight += manualSection.scrollHeight;
    }
    if (settingsSection && !settingsSection.classList.contains('collapsed')) {
      totalHeight += settingsSection.scrollHeight;
    }
    if (consoleSection && !consoleSection.classList.contains('collapsed')) {
      totalHeight += consoleSection.scrollHeight;
    }

    const minHeight = 250;
    const maxHeight = window.innerHeight * 0.9;
    const newHeight = Math.min(Math.max(totalHeight, minHeight), maxHeight);

    // Enable smooth transition
    panel.classList.add('auto-resizing');
    panel.style.height = newHeight + 'px';

    // Remove transition class after animation
    setTimeout(() => panel.classList.remove('auto-resizing'), 300);
  }, delay);
}

function updateFloatingPanelStatus(isRunning, isSoftMode) {
  const startBtn = document.getElementById('floatStartBtn');
  const softStartBtn = document.getElementById('floatSoftStartBtn');
  const indicator = document.getElementById('floatStatusIndicator');
  const statusText = document.getElementById('floatStatusText');

  if (isSoftMode && isRunning) {
    // Soft mode active
    softStartBtn.textContent = 'STOP';
    softStartBtn.style.background = '#eab308';
    softStartBtn.style.color = '#000';
    startBtn.textContent = 'Start Bot';
    startBtn.style.background = '#22c55e';
    indicator.style.background = '#eab308';
    statusText.textContent = 'Soft mode: Auto-navigating only';
  } else if (!isSoftMode && isRunning) {
    // Full bot active
    startBtn.textContent = 'Stop Bot';
    startBtn.style.background = '#ef4444';
    softStartBtn.textContent = 'SOFT';
    softStartBtn.style.background = '#2a2a2a';
    softStartBtn.style.color = '#888';
    indicator.style.background = '#22c55e';
    statusText.textContent = 'Bot is running';
  } else {
    // Both off
    startBtn.textContent = 'Start Bot';
    startBtn.style.background = '#22c55e';
    softStartBtn.textContent = 'SOFT';
    softStartBtn.style.background = '#2a2a2a';
    softStartBtn.style.color = '#888';
    indicator.style.background = '#444';
    statusText.textContent = 'Bot is idle';
  }
}

// Global debug mode flag
window.DEBUG_MODE = false;

// Override console.log to also show in UI when debug mode is on
const originalConsoleLog = console.log;
console.log = function(...args) {
  originalConsoleLog.apply(console, args);
  if (window.DEBUG_MODE) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    addFloatingConsoleLog('info', message);
  }
};

function addFloatingConsoleLog(level, message) {
  // Filter out repetitive messages UNLESS in debug mode
  if (!window.DEBUG_MODE) {
    if (message.includes('Market data:') ||
        message.includes('UP:') ||
        message.includes('DOWN:')) {
      return;
    }
  }

  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const timestamp = `${hours}:${minutes}:${seconds}`;

  const consoleEl = document.getElementById('floatConsole');
  if (!consoleEl) return;

  const line = document.createElement('div');
  line.className = `console-line ${level}`;
  line.textContent = `[${timestamp}] ${message}`;

  consoleEl.appendChild(line);

  while (consoleEl.children.length > 100) {
    consoleEl.removeChild(consoleEl.firstChild);
  }

  consoleEl.scrollTop = consoleEl.scrollHeight;

  // Persist console logs to storage
  persistConsoleLogs();
}

// Save console logs to storage (debounced)
let persistTimeout = null;
function persistConsoleLogs() {
  clearTimeout(persistTimeout);
  persistTimeout = setTimeout(async () => {
    const consoleEl = document.getElementById('floatConsole');
    if (!consoleEl) return;

    const logs = Array.from(consoleEl.children).map(line => ({
      level: line.className.replace('console-line ', ''),
      text: line.textContent
    }));

    await chrome.storage.local.set({ consoleLogs: logs });
  }, 500);
}

// Restore console logs from storage
async function restoreConsoleLogs() {
  const { consoleLogs } = await chrome.storage.local.get(['consoleLogs']);
  if (!consoleLogs || consoleLogs.length === 0) return;

  const consoleEl = document.getElementById('floatConsole');
  if (!consoleEl) return;

  consoleEl.innerHTML = '';

  consoleLogs.forEach(log => {
    const line = document.createElement('div');
    line.className = `console-line ${log.level}`;
    line.textContent = log.text;
    consoleEl.appendChild(line);
  });

  consoleEl.scrollTop = consoleEl.scrollHeight;
}

let panelUpdateInterval = null;

function startFloatingPanelUpdates() {
  updateFloatingPanelData();
  panelUpdateInterval = setInterval(updateFloatingPanelData, 1000);
}

async function updateFloatingPanelData() {
  try {
    const data = await getMarketData();
    if (!data) return;

    // Update market slug
    const slugEl = document.getElementById('floatMarketSlug');
    if (slugEl && data.slug) {
      const slugParts = data.slug.split('-');
      slugEl.textContent = slugParts[slugParts.length - 1];
    }

    // Update time
    const mins = Math.floor(data.timeRemainingSeconds / 60);
    const secs = data.timeRemainingSeconds % 60;
    const timeEl = document.getElementById('floatTimeRemaining');
    if (timeEl) {
      timeEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Update prices with cent symbol
    const upEl = document.getElementById('floatUpPrice');
    if (upEl) {
      upEl.textContent = `${Math.round(data.upPrice * 100)}¢`;
    }

    const downEl = document.getElementById('floatDownPrice');
    if (downEl) {
      downEl.textContent = `${Math.round(data.downPrice * 100)}¢`;
    }
  } catch (error) {
    // Ignore
  }
}

// Helper: Convert seconds to MM:SS format
function secondsToMMSS(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Helper: Convert MM:SS format to seconds
function mmssToSeconds(mmss) {
  const parts = mmss.split(':');
  if (parts.length !== 2) return 0;
  const mins = parseInt(parts[0]) || 0;
  const secs = parseInt(parts[1]) || 0;
  return mins * 60 + secs;
}

async function loadPanelSettings() {
  // Load settings per market type
  const marketType = window.MARKET_TYPE || 'BTC';
  const settingsKey = `settings_${marketType}`;
  const data = await chrome.storage.local.get([settingsKey]);
  const settings = data[settingsKey] || {};

  console.log(`[Panel] Loading settings for ${marketType}:`, settings);

  document.getElementById('floatStake').value = settings.stake || 1.0;
  document.getElementById('floatProbMin').value = settings.probMin || 0.70;
  document.getElementById('floatProbMax').value = settings.probMax || 0.78;
  document.getElementById('floatTimeMin').value = secondsToMMSS(settings.timeMin || 180);
  document.getElementById('floatTimeMax').value = secondsToMMSS(settings.timeMax || 300);

  document.getElementById('floatScalingEnabled').checked = settings.scalingEnabled || false;
  document.getElementById('floatScaleProb').value = settings.scaleProb || 0.80;
  document.getElementById('floatScaleStake').value = settings.scaleStake || 5.0;
  document.getElementById('floatScalingSettings').style.display = settings.scalingEnabled ? 'block' : 'none';

  document.getElementById('floatMartingaleEnabled').checked = settings.martingaleEnabled || false;
  document.getElementById('floatMartingaleMultiplier').value = settings.martingaleMultiplier || 2.0;
  document.getElementById('floatMartingaleMaxSteps').value = settings.martingaleMaxSteps || 3;
  document.getElementById('floatMartingaleSettings').style.display = settings.martingaleEnabled ? 'block' : 'none';
}

async function savePanelSettings() {
  const marketType = window.MARKET_TYPE || 'BTC';
  const settings = {
    stake: parseFloat(document.getElementById('floatStake').value),
    probMin: parseFloat(document.getElementById('floatProbMin').value),
    probMax: parseFloat(document.getElementById('floatProbMax').value),
    timeMin: mmssToSeconds(document.getElementById('floatTimeMin').value),
    timeMax: mmssToSeconds(document.getElementById('floatTimeMax').value),
    scalingEnabled: document.getElementById('floatScalingEnabled').checked,
    scaleProb: parseFloat(document.getElementById('floatScaleProb').value),
    scaleStake: parseFloat(document.getElementById('floatScaleStake').value),
    martingaleEnabled: document.getElementById('floatMartingaleEnabled').checked,
    martingaleMultiplier: parseFloat(document.getElementById('floatMartingaleMultiplier').value),
    martingaleMaxSteps: parseInt(document.getElementById('floatMartingaleMaxSteps').value)
  };

  // Save settings per market type
  const settingsKey = `settings_${marketType}`;
  await chrome.storage.local.set({ [settingsKey]: settings });
  console.log(`[Panel] Saved settings for ${marketType}:`, settings);

  // Visual feedback
  const saveBtn = document.getElementById('floatSaveBtn');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = '✓ Saved!';
  saveBtn.style.background = '#22c55e';
  saveBtn.style.color = '#000';

  setTimeout(() => {
    saveBtn.textContent = originalText;
    saveBtn.style.background = '#2a2a2a';
    saveBtn.style.color = '#e5e5e5';
  }, 1500);
}

// Format MM:SS inputs automatically
function setupTimeInputFormatting() {
  const timeInputs = ['floatTimeMin', 'floatTimeMax'];

  timeInputs.forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;

    input.addEventListener('blur', function() {
      let value = this.value.replace(/[^0-9:]/g, '');

      // If just numbers, try to parse as MM:SS
      if (!value.includes(':')) {
        const num = parseInt(value) || 0;
        if (num <= 9) {
          // Assume it's minutes
          value = `0${num}:00`;
        } else if (num <= 99) {
          // Two digits - assume MM
          value = `${value.padStart(2, '0')}:00`;
        } else {
          // Three or more digits - assume MMSS
          const str = value.padStart(4, '0');
          value = `${str.substring(0, 2)}:${str.substring(2, 4)}`;
        }
      }

      // Validate format MM:SS
      const match = value.match(/^(\d{1,2}):(\d{1,2})$/);
      if (match) {
        let mins = parseInt(match[1]) || 0;
        let secs = parseInt(match[2]) || 0;

        // Clamp to 5:00 max
        if (mins > 5) mins = 5;
        if (mins === 5 && secs > 0) secs = 0;
        if (secs > 59) secs = 59;

        this.value = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      } else {
        // Invalid format, reset to default
        this.value = id === 'floatTimeMin' ? '03:00' : '05:00';
      }
    });
  });
}

// Override sendStatusUpdate to also update floating panel
const originalSendStatusUpdate = sendStatusUpdate;
window.sendStatusUpdate = function(status, details) {
  originalSendStatusUpdate(status, details);
  addFloatingConsoleLog('info', details);
  const statusEl = document.getElementById('floatStatusText');
  if (statusEl) {
    statusEl.textContent = details;
  }
};

// Listen for messages to toggle panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_PANEL' || message.action === 'toggleFloatingPanel') {
    const panel = document.getElementById('polymarket-bot-panel');
    if (panel) {
      const isVisible = panel.style.display !== 'none';
      panel.style.display = isVisible ? 'none' : 'block';
      chrome.storage.local.set({ floatingPanelVisible: !isVisible });
    } else {
      injectFloatingPanel();
      chrome.storage.local.set({ floatingPanelVisible: true });
    }
    sendResponse({ success: true });
  }
  return true;
});

// Auto-inject panel if it was visible before navigation
setTimeout(async () => {
  const { floatingPanelVisible } = await chrome.storage.local.get({ floatingPanelVisible: false });
  if (floatingPanelVisible) {
    console.log('[Panel] Restoring panel after navigation');
    injectFloatingPanel();
  } else {
    console.log('[Panel] Panel was closed, waiting for user to click icon');
  }
}, 1000);
