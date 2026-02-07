/// <reference types="chrome" />

import { useCallback, useState } from "react";

type Props = {};

export default function Popup(_props: Props) {
  const [busy, setBusy] = useState(false);

  const openEditor = useCallback(async () => {
    setBusy(true);
    try {
      await chrome.runtime.sendMessage({ type: "OPEN_EDITOR" });
      window.close();
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div style={{ width: 340, padding: 14, fontFamily: "ui-sans-serif, system-ui" }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>Claw Redactor</div>
      <div style={{ marginTop: 6, color: "#555", fontSize: 13 }}>
        Local-first redaction. No uploads.
      </div>

      <button
        onClick={openEditor}
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
          fontWeight: 600,
        }}
      >
        Open editor
      </button>

      <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
        Next: upload image → draw redaction boxes → export.
      </div>
    </div>
  );
}
