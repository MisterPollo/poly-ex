// Background service worker

console.log('[Polymarket Bot] Background service worker loaded');

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message);
  return true; // Keep message channel open for async response
});

// Handle extension icon click - toggle floating panel
chrome.action.onClicked.addListener(async (tab) => {
  console.log('[Background] Extension icon clicked on tab:', tab.id);

  try {
    // Send message to content script to toggle panel
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
  } catch (error) {
    console.log('[Background] Could not toggle panel:', error);
  }
});
