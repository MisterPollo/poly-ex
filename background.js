// Background service worker

console.log('[Polymarket Bot] Background service worker loaded');

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message);

  // Handle openPopup action
  if (message.action === 'openPopup') {
    chrome.action.openPopup();
    return true;
  }

  // Handle any background tasks if needed
  // For now, just forward status updates to popup if it's open

  return true; // Keep message channel open for async response
});

// Toggle floating panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  console.log('[Background] Extension icon clicked');

  // Send message to content script to toggle panel
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleFloatingPanel' });
  } catch (error) {
    console.error('[Background] Failed to send message to tab:', error);
  }
});
