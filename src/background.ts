// MV3 service worker (background)
// For now: listens for messages and can open the editor tab.

/// <reference types="chrome" />

chrome.runtime.onMessage.addListener(
  (
    msg: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    const m = msg as { type?: string };
    if (m?.type === "OPEN_EDITOR") {
      chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") }).then((tab: chrome.tabs.Tab) => {
        sendResponse({ ok: true, tabId: tab.id });
      });
      return true; // async
    }
  }
);
