// Popup control panel logic

let marketDataInterval = null;
let consoleLines = [];

// Load saved settings and start market data updates
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupTabs();
  setupEventListeners();
  startMarketDataUpdates();
  loadConsoleHistory();
});

async function loadSettings() {
  const settings = await chrome.storage.local.get([
    'stake', 'probMin', 'probMax', 'timeMin', 'timeMax',
    'scalingEnabled', 'scaleProb', 'scaleStake',
    'martingaleEnabled', 'martingaleMultiplier', 'martingaleMaxSteps',
    'botRunning'
  ]);

  document.getElementById('stake').value = settings.stake || 1.0;
  document.getElementById('probMin').value = settings.probMin || 0.70;
  document.getElementById('probMax').value = settings.probMax || 0.78;
  document.getElementById('timeMin').value = settings.timeMin || 180;
  document.getElementById('timeMax').value = settings.timeMax || 300;

  document.getElementById('scalingEnabled').checked = settings.scalingEnabled || false;
  document.getElementById('scaleProb').value = settings.scaleProb || 0.80;
  document.getElementById('scaleStake').value = settings.scaleStake || 5.0;

  document.getElementById('martingaleEnabled').checked = settings.martingaleEnabled || false;
  document.getElementById('martingaleMultiplier').value = settings.martingaleMultiplier || 2.0;
  document.getElementById('martingaleMaxSteps').value = settings.martingaleMaxSteps || 3;

  updateSubSettings();
  updateBotStatus(settings.botRunning || false);
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      // Add active to clicked tab
      tab.classList.add('active');
      const tabName = tab.getAttribute('data-tab');
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });
}

function setupEventListeners() {
  document.getElementById('scalingEnabled').addEventListener('change', updateSubSettings);
  document.getElementById('martingaleEnabled').addEventListener('change', updateSubSettings);
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('startBtn').addEventListener('click', toggleBot);
  document.getElementById('clearConsoleBtn').addEventListener('click', clearConsole);
  document.getElementById('exportLogsBtn').addEventListener('click', exportLogs);
  document.getElementById('toggleFloatingPanelBtn').addEventListener('click', toggleFloatingPanel);

  // Update floating panel button text on load
  updateFloatingPanelButtonText();

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STATUS_UPDATE') {
      updateStatusDisplay(message.status, message.details);
      addConsoleLog('info', message.details);
    } else if (message.type === 'CONSOLE_LOG') {
      addConsoleLog(message.level, message.message);
    } else if (message.type === 'MARKET_DATA') {
      updateMarketDisplay(message.data);
    }
  });
}

function updateSubSettings() {
  const scalingEnabled = document.getElementById('scalingEnabled').checked;
  const martingaleEnabled = document.getElementById('martingaleEnabled').checked;

  document.getElementById('scalingSettings').style.display = scalingEnabled ? 'block' : 'none';
  document.getElementById('martingaleSettings').style.display = martingaleEnabled ? 'block' : 'none';
}

async function saveSettings() {
  const settings = {
    stake: parseFloat(document.getElementById('stake').value),
    probMin: parseFloat(document.getElementById('probMin').value),
    probMax: parseFloat(document.getElementById('probMax').value),
    timeMin: parseInt(document.getElementById('timeMin').value),
    timeMax: parseInt(document.getElementById('timeMax').value),
    scalingEnabled: document.getElementById('scalingEnabled').checked,
    scaleProb: parseFloat(document.getElementById('scaleProb').value),
    scaleStake: parseFloat(document.getElementById('scaleStake').value),
    martingaleEnabled: document.getElementById('martingaleEnabled').checked,
    martingaleMultiplier: parseFloat(document.getElementById('martingaleMultiplier').value),
    martingaleMaxSteps: parseInt(document.getElementById('martingaleMaxSteps').value)
  };

  await chrome.storage.local.set(settings);

  // Visual feedback
  const saveBtn = document.getElementById('saveBtn');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = '✓ Saved!';
  saveBtn.style.background = '#10b981';

  setTimeout(() => {
    saveBtn.textContent = originalText;
    saveBtn.style.background = '#2a2a2a';
  }, 1500);

  // Notify content script
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url?.includes('polymarket.com/event/btc-updown-5m-')) {
    chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings });
  }

  addConsoleLog('success', 'Settings saved successfully');
}

async function toggleBot() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url?.includes('polymarket.com/event/btc-updown-5m-')) {
    alert('Please navigate to a Polymarket BTC 5-min market page first!');
    return;
  }

  const { botRunning } = await chrome.storage.local.get('botRunning');
  const newState = !botRunning;

  await chrome.storage.local.set({ botRunning: newState });
  updateBotStatus(newState);

  // Send message to content script
  chrome.tabs.sendMessage(tab.id, {
    type: newState ? 'START_BOT' : 'STOP_BOT'
  });

  addConsoleLog(newState ? 'success' : 'warning', newState ? 'Bot started' : 'Bot stopped');
}

function updateBotStatus(isRunning) {
  const startBtn = document.getElementById('startBtn');
  const indicator = document.getElementById('statusIndicator');

  if (isRunning) {
    startBtn.textContent = 'Stop Bot';
    startBtn.classList.add('running');
    indicator.classList.add('active');
  } else {
    startBtn.textContent = 'Start Bot';
    startBtn.classList.remove('running');
    indicator.classList.remove('active');
  }
}

function updateStatusDisplay(status, details) {
  document.getElementById('statusText').textContent = details || 'Unknown status';
}

// Market Data Updates
function startMarketDataUpdates() {
  updateMarketData(); // Initial update
  marketDataInterval = setInterval(updateMarketData, 2000); // Update every 2 seconds
}

async function updateMarketData() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url?.includes('polymarket.com/event/btc-updown-5m-')) {
    updateMarketDisplay(null);
    return;
  }

  // Request market data from content script
  try {
    chrome.tabs.sendMessage(tab.id, { type: 'GET_MARKET_DATA' }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script not loaded yet
        updateMarketDisplay(null);
        return;
      }
      if (response) {
        updateMarketDisplay(response.data);
      }
    });
  } catch (error) {
    updateMarketDisplay(null);
  }
}

function updateMarketDisplay(data) {
  if (!data) {
    document.getElementById('marketSlug').textContent = 'Not on market page';
    document.getElementById('timeRemaining').textContent = '--:--';
    document.getElementById('upPrice').textContent = '--%';
    document.getElementById('downPrice').textContent = '--%';
    return;
  }

  // Update slug (show last part only)
  const slugParts = data.slug.split('-');
  document.getElementById('marketSlug').textContent = slugParts[slugParts.length - 1];

  // Update time remaining
  const mins = Math.floor(data.timeRemainingSeconds / 60);
  const secs = data.timeRemainingSeconds % 60;
  document.getElementById('timeRemaining').textContent =
    `${mins}:${secs.toString().padStart(2, '0')}`;

  // Update prices
  document.getElementById('upPrice').textContent = `${(data.upPrice * 100).toFixed(1)}%`;
  document.getElementById('downPrice').textContent = `${(data.downPrice * 100).toFixed(1)}%`;
}

// Console Functions
function addConsoleLog(level, message) {
  const now = new Date();
  const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

  const logEntry = { timestamp, level, message };
  consoleLines.push(logEntry);

  // Keep only last 100 lines
  if (consoleLines.length > 100) {
    consoleLines.shift();
  }

  // Save to storage
  chrome.storage.local.set({ consoleLogs: consoleLines });

  // Update UI
  renderConsole();
}

function renderConsole() {
  const consoleEl = document.getElementById('console');
  consoleEl.innerHTML = consoleLines.map(log => `
    <div class="console-line ${log.level}">
      <span class="console-time">[${log.timestamp}]</span>
      <span>${log.message}</span>
    </div>
  `).join('');

  // Auto-scroll to bottom
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

async function loadConsoleHistory() {
  const { consoleLogs } = await chrome.storage.local.get('consoleLogs');
  if (consoleLogs) {
    consoleLines = consoleLogs;
    renderConsole();
  }
}

function clearConsole() {
  consoleLines = [];
  chrome.storage.local.set({ consoleLogs: [] });
  renderConsole();
  addConsoleLog('info', 'Console cleared');
}

function exportLogs() {
  const logText = consoleLines.map(log =>
    `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`
  ).join('\n');

  const blob = new Blob([logText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `polymarket-bot-logs-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  addConsoleLog('success', 'Logs exported');
}

// Floating Panel Toggle
async function toggleFloatingPanel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.includes('polymarket.com')) {
    alert('Please navigate to a Polymarket page first');
    return;
  }

  await chrome.tabs.sendMessage(tab.id, { action: 'toggleFloatingPanel' });

  // Update button text after a short delay
  setTimeout(updateFloatingPanelButtonText, 100);
}

async function updateFloatingPanelButtonText() {
  const { floatingPanelVisible } = await chrome.storage.local.get({ floatingPanelVisible: true });
  const btn = document.getElementById('toggleFloatingPanelBtn');
  if (btn) {
    btn.textContent = floatingPanelVisible ? 'Hide Floating Panel' : 'Show Floating Panel';
    btn.style.background = floatingPanelVisible ? '#2a2a2a' : '#22c55e';
    btn.style.color = floatingPanelVisible ? '#e5e5e5' : '#000';
  }
}

// Cleanup on popup close
window.addEventListener('beforeunload', () => {
  if (marketDataInterval) {
    clearInterval(marketDataInterval);
  }
});
