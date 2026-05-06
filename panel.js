
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
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px;">
        <span style="color: #888;">Market ID:</span>
        <span id="floatMarketSlug" style="font-family: 'Courier New', monospace; font-weight: 600; color: #22c55e; font-size: 10px;">------</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;">
        <span style="color: #888;">Time:</span>
        <span id="floatTimeRemaining" style="font-family: 'Courier New', monospace; font-weight: 600; color: #22c55e;">--:--</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;">
        <span style="color: #888;">UP:</span>
        <span id="floatUpPrice" style="font-family: 'Courier New', monospace; font-weight: 600; color: #22c55e;">--%</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px;">
        <span style="color: #888;">DOWN:</span>
        <span id="floatDownPrice" style="font-family: 'Courier New', monospace; font-weight: 600; color: #22c55e;">--%</span>
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
        <label style="display: block; font-size: 11px; color: #888; margin-bottom: 4px;">Entry Time Window (seconds)</label>
        <div style="display: flex; gap: 6px; align-items: center;">
          <input type="number" id="floatTimeMin" min="0" max="300" step="1" value="180" style="flex: 1; padding: 6px 8px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 12px;">
          <span style="color: #888; font-size: 11px;">to</span>
          <input type="number" id="floatTimeMax" min="0" max="300" step="1" value="300" style="flex: 1; padding: 6px 8px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 12px;">
        </div>
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; cursor: pointer;">
          <input type="checkbox" id="floatScalingEnabled" style="cursor: pointer;">
          <span style="color: #e5e5e5; font-weight: 600;">Enable Scaling</span>
        </label>
        <div id="floatScalingSettings" style="display: none; margin-top: 6px; padding-left: 20px;">
          <input type="number" id="floatScaleProb" min="0.5" max="0.99" step="0.01" value="0.80" placeholder="Scale at probability" style="width: 100%; padding: 5px 7px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 11px; margin-bottom: 4px;">
          <input type="number" id="floatScaleStake" min="0.1" step="0.1" value="5.0" placeholder="Scale stake" style="width: 100%; padding: 5px 7px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 11px;">
        </div>
      </div>

      <div style="margin-bottom: 10px;">
        <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; cursor: pointer;">
          <input type="checkbox" id="floatMartingaleEnabled" style="cursor: pointer;">
          <span style="color: #e5e5e5; font-weight: 600;">Enable Martingale</span>
        </label>
        <div id="floatMartingaleSettings" style="display: none; margin-top: 6px; padding-left: 20px;">
          <input type="number" id="floatMartingaleMultiplier" min="1.1" max="5" step="0.1" value="2.0" placeholder="Multiplier" style="width: 100%; padding: 5px 7px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 11px; margin-bottom: 4px;">
          <input type="number" id="floatMartingaleMaxSteps" min="1" max="10" step="1" value="3" placeholder="Max steps" style="width: 100%; padding: 5px 7px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-size: 11px;">
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

    // Setup panel functionality
    setupFloatingPanel();

    console.log('[Bot] ✅ Floating panel injected (resizable)');
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
    const { botRunning } = await chrome.storage.local.get('botRunning');
    const newState = !botRunning;

    await chrome.storage.local.set({
      botRunning: newState,
      softStartRunning: false // Turn off soft mode
    });

    if (newState) {
      startBot();
    } else {
      stopBot();
    }

    updateFloatingPanelStatus(newState, false);
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

  // Check and restore bot state on page load
  checkAndRestoreBotState();

  startFloatingPanelUpdates();
}

async function checkAndRestoreBotState() {
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
    // Restart full bot
    startBot();
    updateFloatingPanelStatus(true, false);
    addFloatingConsoleLog('info', 'Bot resumed after page reload');
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

function addFloatingConsoleLog(level, message) {
  // Only filter out the most repetitive messages
  if (message.includes('Market data:') ||
      message.includes('UP:') ||
      message.includes('DOWN:')) {
    return;
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

    // Update prices
    const upEl = document.getElementById('floatUpPrice');
    if (upEl) {
      upEl.textContent = `${(data.upPrice * 100).toFixed(1)}%`;
    }

    const downEl = document.getElementById('floatDownPrice');
    if (downEl) {
      downEl.textContent = `${(data.downPrice * 100).toFixed(1)}%`;
    }
  } catch (error) {
    // Ignore
  }
}

async function loadPanelSettings() {
  const settings = await chrome.storage.local.get([
    'stake', 'probMin', 'probMax', 'timeMin', 'timeMax',
    'scalingEnabled', 'scaleProb', 'scaleStake',
    'martingaleEnabled', 'martingaleMultiplier', 'martingaleMaxSteps'
  ]);

  document.getElementById('floatStake').value = settings.stake || 1.0;
  document.getElementById('floatProbMin').value = settings.probMin || 0.70;
  document.getElementById('floatProbMax').value = settings.probMax || 0.78;
  document.getElementById('floatTimeMin').value = settings.timeMin || 180;
  document.getElementById('floatTimeMax').value = settings.timeMax || 300;

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
  const settings = {
    stake: parseFloat(document.getElementById('floatStake').value),
    probMin: parseFloat(document.getElementById('floatProbMin').value),
    probMax: parseFloat(document.getElementById('floatProbMax').value),
    timeMin: parseInt(document.getElementById('floatTimeMin').value),
    timeMax: parseInt(document.getElementById('floatTimeMax').value),
    scalingEnabled: document.getElementById('floatScalingEnabled').checked,
    scaleProb: parseFloat(document.getElementById('floatScaleProb').value),
    scaleStake: parseFloat(document.getElementById('floatScaleStake').value),
    martingaleEnabled: document.getElementById('floatMartingaleEnabled').checked,
    martingaleMultiplier: parseFloat(document.getElementById('floatMartingaleMultiplier').value),
    martingaleMaxSteps: parseInt(document.getElementById('floatMartingaleMaxSteps').value)
  };

  await chrome.storage.local.set(settings);

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

  addFloatingConsoleLog('success', 'Settings saved');
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
  if (message.action === 'toggleFloatingPanel') {
    const panel = document.getElementById('polymarket-bot-panel');
    if (panel) {
      const isVisible = panel.style.display !== 'none';
      panel.style.display = isVisible ? 'none' : 'block';
      chrome.storage.local.set({ floatingPanelVisible: !isVisible });
    } else {
      injectFloatingPanel();
      chrome.storage.local.set({ floatingPanelVisible: true });
    }
  }
});

// Initialize floating panel
setTimeout(async () => {
  const { floatingPanelVisible } = await chrome.storage.local.get({ floatingPanelVisible: true });
  if (floatingPanelVisible) {
    injectFloatingPanel();
  }
}, 1000);
