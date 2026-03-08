/**
 * background.js - Service Worker for Humanify AI Chrome Extension
 *
 * Handles message passing, badge updates, and side panel management.
 */

// Open side panel when extension icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'UPDATE_BADGE':
      updateBadge(sender.tab?.id, message.score);
      sendResponse({ success: true });
      break;

    case 'OPEN_SIDE_PANEL':
      if (sender.tab?.id) {
        chrome.sidePanel.open({ tabId: sender.tab.id });
        sendResponse({ success: true });
      }
      break;

    case 'GET_TAB_INFO':
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const tab = tabs[0];
        sendResponse({
          tabId: tab?.id,
          url: tab?.url,
          isGoogleDoc: tab?.url?.includes('docs.google.com/document') || false,
        });
      });
      return true; // Keep channel open for async response

    case 'EXTRACT_TEXT':
      // Forward to content script
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'EXTRACT_TEXT' }, response => {
            sendResponse(response);
          });
        } else {
          sendResponse({ error: 'No active tab' });
        }
      });
      return true;

    case 'INJECT_TEXT':
      // Forward text injection to content script
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { type: 'INJECT_TEXT', text: message.text },
            response => sendResponse(response)
          );
        } else {
          sendResponse({ error: 'No active tab' });
        }
      });
      return true;

    case 'GET_SELECTED_TEXT':
      // Forward to content script
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_SELECTED_TEXT' }, response => {
            sendResponse(response);
          });
        } else {
          sendResponse({ text: '' });
        }
      });
      return true;

    case 'HIGHLIGHT_SENTENCES':
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { type: 'HIGHLIGHT_SENTENCES', sentences: message.sentences },
            response => sendResponse(response)
          );
        } else {
          sendResponse({ error: 'No active tab' });
        }
      });
      return true;

    case 'SCROLL_TO_SENTENCE':
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { type: 'SCROLL_TO_SENTENCE', sentenceId: message.sentenceId },
            response => sendResponse(response)
          );
        } else {
          sendResponse({ error: 'No active tab' });
        }
      });
      return true;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
  return false;
});

/**
 * Update the extension badge with the AI score.
 * @param {number} tabId
 * @param {number} score - 0-100 human score
 */
function updateBadge(tabId, score) {
  if (!tabId) return;

  const roundedScore = Math.round(score);
  let color;
  if (roundedScore >= 80) {
    color = '#00B894'; // green
  } else if (roundedScore >= 50) {
    color = '#FDCB6E'; // yellow
  } else {
    color = '#E17055'; // red
  }

  chrome.action.setBadgeText({ text: roundedScore + '%', tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
}

// Clear badge when navigating away from Google Docs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    const isGoogleDoc = tab.url?.includes('docs.google.com/document');
    if (!isGoogleDoc) {
      chrome.action.setBadgeText({ text: '', tabId });
    }
  }
});
