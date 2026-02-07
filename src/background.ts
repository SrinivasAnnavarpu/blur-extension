// MV3 service worker (background)
// - Adds right-click context menu entries.
// - Opens the editor tab.
// - Can capture the current tab screenshot and pass it to the editor.

/// <reference types="chrome" />

type OpenMode = "blank" | "capture-visible-tab" | "image";

const MENU_REDACT_PAGE = "blur_redact_page";
const MENU_REDACT_IMAGE = "blur_redact_image";
const MENU_OPEN_EDITOR = "blur_open_editor";

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function openEditor(mode: OpenMode, tab?: chrome.tabs.Tab, imageSrcUrl?: string) {
  // Clear any prior payload.
  await chrome.storage.session.remove(["lastCaptureDataUrl", "lastImageDataUrl", "lastImageSrcUrl"]);

  if (mode === "capture-visible-tab") {
    const windowId = tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
    await chrome.storage.session.set({ lastCaptureDataUrl: dataUrl });
  }

  if (mode === "image" && imageSrcUrl) {
    // Fetch the image and convert to a data URL so the editor can render it locally.
    // Note: very large images may exceed storage/session limits.
    const res = await fetch(imageSrcUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const blob = await res.blob();
    const dataUrl = await blobToDataUrl(blob);
    await chrome.storage.session.set({ lastImageDataUrl: dataUrl, lastImageSrcUrl: imageSrcUrl });
  }

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
    id: MENU_REDACT_IMAGE,
    title: "Redact this image (Blur)",
    contexts: ["image"],
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
    return;
  }
  if (info.menuItemId === MENU_REDACT_IMAGE) {
    const srcUrl = info.srcUrl;
    if (!srcUrl) return;
    void openEditor("image", tab, srcUrl);
    return;
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
