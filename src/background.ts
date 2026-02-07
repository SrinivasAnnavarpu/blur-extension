// MV3 service worker (background)
// - Adds right-click context menu entries.
// - Opens the editor tab.
// - Can capture the current tab screenshot and pass it to the editor.

/// <reference types="chrome" />

type OpenMode = "blank" | "capture-visible-tab";

const MENU_REDACT_PAGE = "blur_redact_page";
const MENU_OPEN_EDITOR = "blur_open_editor";

async function openEditor(mode: OpenMode, tab?: chrome.tabs.Tab) {
  // If we need an image, capture and stash it in session storage.
  if (mode === "capture-visible-tab") {
    // captureVisibleTab needs a windowId; fall back to currentWindow if missing.
    const windowId = tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
    await chrome.storage.session.set({ lastCaptureDataUrl: dataUrl });
  } else {
    await chrome.storage.session.remove(["lastCaptureDataUrl"]);
  }

  // Pass mode in query so editor can decide what to load.
  await chrome.tabs.create({
    url: chrome.runtime.getURL(`editor.html?mode=${encodeURIComponent(mode)}`),
  });
}

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items.
  chrome.contextMenus.create({
    id: MENU_REDACT_PAGE,
    title: "Redact this page (Blur)",
    contexts: ["page"],
  });
  chrome.contextMenus.create({
    id: MENU_OPEN_EDITOR,
    title: "Open Blur editor",
    contexts: ["action"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_REDACT_PAGE) {
    void openEditor("capture-visible-tab", tab);
  }
});

chrome.runtime.onMessage.addListener(
  (
    msg: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    const m = msg as { type?: string; mode?: OpenMode };

    if (m?.type === "OPEN_EDITOR") {
      void openEditor(m.mode ?? "blank", sender.tab).then(
        () => sendResponse({ ok: true }),
        (err) => sendResponse({ ok: false, error: String(err) })
      );
      return true; // async
    }
  }
);
