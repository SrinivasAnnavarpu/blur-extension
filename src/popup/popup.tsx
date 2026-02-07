/// <reference types="chrome" />

import { useCallback, useState } from "react";

type Props = {};

export default function Popup(_props: Props) {
  const [busy, setBusy] = useState(false);

  const openEditor = useCallback(async (mode: "blank" | "capture-visible-tab") => {
    setBusy(true);
    try {
      await chrome.runtime.sendMessage({ type: "OPEN_EDITOR", mode });
      window.close();
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div style={{ width: 340, padding: 14, fontFamily: "ui-sans-serif, system-ui" }}>
      <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.2 }}>Blur</div>
      <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
        Local-only. No uploads. No tracking.
      </div>

      <button
        onClick={() => openEditor("capture-visible-tab")}
        disabled={busy}
        style={{
          marginTop: 12,
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: busy ? "#f3f3f3" : "#111827",
          color: busy ? "#666" : "white",
          cursor: busy ? "not-allowed" : "pointer",
          fontWeight: 650,
        }}
      >
        Redact current tab
      </button>

      <button
        onClick={() => openEditor("blank")}
        disabled={busy}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: busy ? "#f3f3f3" : "#ffffff",
          color: busy ? "#666" : "#111827",
          cursor: busy ? "not-allowed" : "pointer",
          fontWeight: 650,
        }}
      >
        Open editor (upload image)
      </button>

      <div style={{ marginTop: 10, fontSize: 12, color: "#666", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Upload image → add boxes → export.</span>
        <a
          href="https://bluryourpics.com"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#111827", fontWeight: 650, textDecoration: "underline" }}
        >
          Website
        </a>
      </div>
    </div>
  );
}
