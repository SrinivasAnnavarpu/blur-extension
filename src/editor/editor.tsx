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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<
    | null
    | {
        id: string;
        startX: number;
        startY: number;
        start: Redaction;
        mode: "move" | "resize-br";
      }
  >(null);
  const [preview, setPreview] = useState(false);

  const selected = useMemo(() => selectedId ?? (boxes[boxes.length - 1]?.id ?? null), [selectedId, boxes]);

  const onPick = async (file: File) => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setBoxes([]);
    setSelectedId(null);

    const img = new Image();
    img.onload = () => setImgEl(img);
    img.src = url;
  };

  // Delete key support for selected box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (!selected) return;
      setBoxes((prev) => prev.filter((b) => b.id !== selected));
      setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: MouseEvent) => {
      const host = document.getElementById("claw-redactor-canvas");
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;

      setBoxes((prev) =>
        prev.map((b) => {
          if (b.id !== drag.id) return b;

          if (drag.mode === "move") {
            return {
              ...b,
              x: Math.min(1 - b.w, Math.max(0, drag.start.x + dx)),
              y: Math.min(1 - b.h, Math.max(0, drag.start.y + dy)),
            };
          }

          // resize from bottom-right
          const minW = 0.02;
          const minH = 0.02;
          const newW = Math.max(minW, Math.min(1 - drag.start.x, drag.start.w + dx));
          const newH = Math.max(minH, Math.min(1 - drag.start.y, drag.start.h + dy));
          return {
            ...b,
            w: newW,
            h: newH,
          };
        })
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
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.2 }}>Claw Redactor</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>Local-first redaction (no uploads).</div>
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

      <div style={{ marginTop: 16 }}>
        <div
          id="claw-redactor-canvas"
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            overflow: "hidden",
            background: "#fff",
            position: "relative",
            boxShadow: "0 8px 30px rgba(15, 23, 42, 0.08)",
            minHeight: 240,
            paddingTop: 74,
          }}
        >
          {/* Floating toolbar (Apple-minimal) */}
          <div
            style={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 20,
              display: "flex",
              gap: 8,
              padding: 8,
              borderRadius: 14,
              background: "rgba(255,255,255,0.82)",
              border: "1px solid rgba(148,163,184,0.35)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.10)",
            }}
          >
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.35)",
                background: "rgba(255,255,255,0.9)",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              Upload
            </button>
            <button
              onClick={() => {
                if (!imgUrl) return;
                const b: Redaction = { id: uid(), x: 0.1, y: 0.1, w: 0.3, h: 0.08 };
                setBoxes((prev) => [...prev, b]);
                setSelectedId(b.id);
              }}
              disabled={!imgUrl}
              style={{
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.35)",
                background: imgUrl ? "rgba(255,255,255,0.9)" : "rgba(241,245,249,0.9)",
                fontWeight: 650,
                cursor: imgUrl ? "pointer" : "not-allowed",
                color: imgUrl ? "#0f172a" : "#64748b",
              }}
            >
              + Box
            </button>
            <button
              onClick={() => setPreview((p) => !p)}
              disabled={!imgUrl}
              style={{
                padding: "8px 10px",
                borderRadius: 12,
                border: preview ? "1px solid rgba(15,23,42,0.15)" : "1px solid rgba(148,163,184,0.35)",
                background: !imgUrl
                  ? "rgba(241,245,249,0.9)"
                  : preview
                    ? "rgba(15,23,42,0.92)"
                    : "rgba(255,255,255,0.9)",
                color: !imgUrl ? "#64748b" : preview ? "#fff" : "#0f172a",
                fontWeight: 650,
                cursor: imgUrl ? "pointer" : "not-allowed",
              }}
            >
              Preview
            </button>
            <button
              onClick={download}
              disabled={!imgUrl}
              style={{
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.15)",
                background: imgUrl ? "rgba(15,23,42,0.92)" : "rgba(241,245,249,0.9)",
                color: imgUrl ? "#fff" : "#64748b",
                fontWeight: 750,
                cursor: imgUrl ? "pointer" : "not-allowed",
              }}
            >
              Export
            </button>
          </div>

          {!imgUrl ? (
            <div style={{ height: 260, display: "grid", placeItems: "center", color: "#64748b" }}>
              Upload an image to start.
            </div>
          ) : (
            <img src={imgUrl} style={{ width: "100%", display: "block", marginTop: 6 }} alt="upload" />
          )}

          {/* Overlay using percentage-based boxes */}
          {boxes.map((b) => (
            <div
              key={b.id}
              onMouseDown={(e) => {
                e.preventDefault();
                setSelectedId(b.id);
                const startX = e.clientX;
                const startY = e.clientY;
                setDrag({ id: b.id, startX, startY, start: b, mode: "move" });
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
            >
              {!preview && (
                <>
                  {b.id === selected && (
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={() => {
                        setBoxes((prev) => prev.filter((x) => x.id !== b.id));
                        setSelectedId((cur) => (cur === b.id ? null : cur));
                      }}
                      style={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        width: 16,
                        height: 16,
                        padding: 0,
                        borderRadius: 999,
                        border: "1px solid rgba(148,163,184,0.55)",
                        background: "rgba(255,255,255,0.95)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 1px 10px rgba(15, 23, 42, 0.12)",
                        fontWeight: 800,
                        lineHeight: 0,
                        fontSize: 14,
                        color: "#0f172a",
                      }}
                      title="Delete"
                    >
                      <span style={{ transform: "translateY(-0.5px)" }}>×</span>
                    </button>
                  )}

                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setSelectedId(b.id);
                      const startX = e.clientX;
                      const startY = e.clientY;
                      setDrag({ id: b.id, startX, startY, start: b, mode: "resize-br" });
                    }}
                    style={{
                      position: "absolute",
                      right: -5,
                      bottom: -5,
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.95)",
                      border: "1.5px solid rgba(15,23,42,0.85)",
                      cursor: "nwse-resize",
                      boxShadow: "0 1px 10px rgba(15, 23, 42, 0.12)",
                    }}
                    title="Resize"
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
