import { useEffect, useMemo, useRef, useState } from "react";

type Redaction = {
  id: string;
  x: number; // 0..1
  y: number; // 0..1
  w: number; // 0..1
  h: number; // 0..1
};

function uid() {
  return Math.random().toString(16).slice(2);
}

export default function Editor() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [boxes, setBoxes] = useState<Redaction[]>([]);
  const [drag, setDrag] = useState<null | { id: string; startX: number; startY: number; start: Redaction }>(null);
  const [preview, setPreview] = useState(false);

  const selected = useMemo(() => boxes[boxes.length - 1]?.id ?? null, [boxes]);

  const onPick = async (file: File) => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setBoxes([]);

    const img = new Image();
    img.onload = () => setImgEl(img);
    img.src = url;
  };

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: MouseEvent) => {
      const host = document.getElementById("claw-redactor-canvas");
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;
      setBoxes((prev) =>
        prev.map((b) =>
          b.id === drag.id
            ? {
                ...b,
                x: Math.min(1 - b.w, Math.max(0, drag.start.x + dx)),
                y: Math.min(1 - b.h, Math.max(0, drag.start.y + dy)),
              }
            : b
        )
      );
    };

    const onUp = () => setDrag(null);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag]);

  const download = async () => {
    if (!imgEl) return;

    const canvas = document.createElement("canvas");
    canvas.width = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(imgEl, 0, 0);

    const fillRoundedRect = (x: number, y: number, w: number, h: number) => {
      const r = Math.max(4, Math.min(18, Math.min(w, h) * 0.18));
      // roundRect is supported in modern Chromium; keep a fallback.
      const anyCtx = ctx as unknown as { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void };
      if (typeof anyCtx.roundRect === "function") {
        ctx.beginPath();
        anyCtx.roundRect(x, y, w, h, r);
        ctx.fill();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
    };

    // Default style: black bars with rounded corners.
    ctx.fillStyle = "#000";
    for (const b of boxes) {
      const x = b.x * canvas.width;
      const y = b.y * canvas.height;
      const w = b.w * canvas.width;
      const h = b.h * canvas.height;
      fillRoundedRect(x, y, w, h);
    }

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "redacted.png";
    a.click();
  };

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Claw Redactor — Editor</div>
          <div style={{ fontSize: 13, color: "#666" }}>Local-first. No uploads. MVP: manual redaction boxes.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", background: "white" }}
          >
            Upload image
          </button>
          <button
            onClick={() => {
              if (!imgUrl) return;
              const b: Redaction = { id: uid(), x: 0.1, y: 0.1, w: 0.3, h: 0.08 };
              setBoxes((prev) => [...prev, b]);
            }}
            disabled={!imgUrl}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: imgUrl ? "white" : "#f3f3f3",
            }}
          >
            Add box
          </button>

          <button
            onClick={() => setPreview((p) => !p)}
            disabled={!imgUrl}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: !imgUrl ? "#f3f3f3" : preview ? "#111827" : "white",
              color: !imgUrl ? "#666" : preview ? "white" : "#111827",
              fontWeight: 700,
            }}
          >
            {preview ? "Preview: ON" : "Preview: OFF"}
          </button>

          <button
            onClick={download}
            disabled={!imgUrl}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: imgUrl ? "#111827" : "#f3f3f3",
              color: imgUrl ? "white" : "#666",
              fontWeight: 700,
            }}
          >
            Export PNG
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onPick(file);
        }}
      />

      {!imgUrl ? (
        <div style={{ marginTop: 20, padding: 16, border: "1px dashed #ccc", borderRadius: 12, color: "#666" }}>
          Upload an image to start.
        </div>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 280px", gap: 12 }}>
          <div
            id="claw-redactor-canvas"
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
              background: "#fff",
              position: "relative",
            }}
          >
            <img src={imgUrl} style={{ width: "100%", display: "block" }} alt="upload" />

            {/* Overlay using percentage-based boxes */}
            {boxes.map((b) => (
              <div
                key={b.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startY = e.clientY;
                  setDrag({ id: b.id, startX, startY, start: b });
                }}
                style={{
                  position: "absolute",
                  left: `${b.x * 100}%`,
                  top: `${b.y * 100}%`,
                  width: `${b.w * 100}%`,
                  height: `${b.h * 100}%`,
                  border: preview
                    ? "2px solid rgba(255,255,255,0.35)"
                    : b.id === selected
                      ? "2px solid #ef4444"
                      : "2px solid #111827",
                  borderRadius: 12,
                  background: preview ? "rgba(0,0,0,1)" : "rgba(0,0,0,0.25)",
                  boxSizing: "border-box",
                  cursor: "move",
                }}
              />
            ))}
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" }}>
            <div style={{ fontWeight: 800 }}>Boxes</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              Drag boxes on the image. Export draws solid black rectangles.
            </div>

            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {boxes.length === 0 ? (
                <div style={{ color: "#666", fontSize: 13 }}>No boxes yet. Click “Add box”.</div>
              ) : (
                boxes
                  .slice()
                  .reverse()
                  .map((b) => (
                    <div
                      key={b.id}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 10,
                        padding: 10,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#444" }}>
                        {b.id.slice(0, 6)} • x:{b.x.toFixed(2)} y:{b.y.toFixed(2)}
                      </div>
                      <button
                        onClick={() => setBoxes((prev) => prev.filter((x) => x.id !== b.id))}
                        style={{
                          padding: "6px 8px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          background: "white",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
