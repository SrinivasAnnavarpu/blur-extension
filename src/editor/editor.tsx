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
  const [toolbarStuck, setToolbarStuck] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const selected = useMemo(() => selectedId ?? (boxes[boxes.length - 1]?.id ?? null), [selectedId, boxes]);

  const computeVisibleCenter01 = (): { cx: number; cy: number } => {
    const host = document.getElementById("claw-redactor-canvas");
    if (!host) return { cx: 0.5, cy: 0.25 };

    const rect = host.getBoundingClientRect();
    const vpTop = 0;
    const vpBottom = window.innerHeight;
    const vpLeft = 0;
    const vpRight = window.innerWidth;

    const visTop = Math.max(rect.top, vpTop);
    const visBottom = Math.min(rect.bottom, vpBottom);
    const visLeft = Math.max(rect.left, vpLeft);
    const visRight = Math.min(rect.right, vpRight);

    // if not visible, default to top area
    if (visBottom <= visTop || visRight <= visLeft) return { cx: 0.5, cy: 0.25 };

    const centerX = (visLeft + visRight) / 2;
    const centerY = (visTop + visBottom) / 2;

    const cx = (centerX - rect.left) / rect.width;
    const cy = (centerY - rect.top) / rect.height;

    return {
      cx: Math.max(0, Math.min(1, cx)),
      cy: Math.max(0, Math.min(1, cy)),
    };
  };

  const onPick = async (file: File) => {
    // Clean up old object URL to avoid leaks
    setImgUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return prev;
    });

    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setBoxes([]);
    setSelectedId(null);

    const img = new Image();
    img.onload = () => setImgEl(img);
    img.src = url;

    // Allow re-selecting the same file again later
    if (fileRef.current) fileRef.current.value = "";
  };

  // clearImage removed; use Change to pick a new image.

  // Sticky toolbar shadow when stuck
  useEffect(() => {
    const onScroll = () => {
      const el = document.getElementById("claw-redactor-toolbar");
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setToolbarStuck(top <= 12.5);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.2 }}>BlurBar</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            Local-only. No uploads. No tracking.{' '}
            <button
              onClick={() => setShowPrivacy(true)}
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                margin: 0,
                color: "#0f172a",
                textDecoration: "underline",
                cursor: "pointer",
                fontWeight: 650,
              }}
            >
              Privacy
            </button>
          </div>
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

      <div style={{ marginTop: 20, maxWidth: 1100, marginLeft: "auto", marginRight: "auto" }}>
        {/* Sticky toolbar (stays visible while scrolling) */}
        <div
          id="claw-redactor-toolbar"
          style={{
            position: "sticky",
            top: 12,
            zIndex: 30,
            display: "flex",
            justifyContent: "center",
            marginBottom: 16,
            transition: "filter 160ms ease",
            filter: toolbarStuck ? "drop-shadow(0 10px 22px rgba(15, 23, 42, 0.16))" : "none",
          }}
        >
          {/* Privacy modal */}
          {showPrivacy && (
            <div
              onMouseDown={() => setShowPrivacy(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 80,
                background: "rgba(15,23,42,0.35)",
                display: "grid",
                placeItems: "center",
                padding: 18,
              }}
            >
              <div
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  width: "min(520px, 96vw)",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.92)",
                  border: "1px solid rgba(148,163,184,0.35)",
                  boxShadow: "0 18px 60px rgba(15, 23, 42, 0.25)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 850, letterSpacing: -0.2, fontSize: 16 }}>Privacy</div>
                  <button
                    onClick={() => setShowPrivacy(false)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,0.45)",
                      background: "rgba(255,255,255,0.9)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                    }}
                    title="Close"
                  >
                    ×
                  </button>
                </div>

                <div style={{ marginTop: 10, color: "#0f172a", fontSize: 13, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 750 }}>Local-only processing</div>
                  <div style={{ color: "#475569", marginTop: 2 }}>
                    BlurBar processes your images on your device. Your images are not uploaded.
                  </div>

                  <div style={{ fontWeight: 750, marginTop: 10 }}>No tracking</div>
                  <div style={{ color: "#475569", marginTop: 2 }}>
                    BlurBar does not collect analytics or personal data.
                  </div>

                  <div style={{ fontWeight: 750, marginTop: 10 }}>No image storage</div>
                  <div style={{ color: "#475569", marginTop: 2 }}>
                    BlurBar does not save your images. Only your redaction boxes exist in memory until you change the image or refresh.
                  </div>
                </div>
              </div>
            </div>
          )}
          <div
            style={{
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
              title={imgUrl ? "Choose a different image" : "Upload an image"}
            >
              {imgUrl ? "Change" : "Upload"}
            </button>

            {/* Clear button removed (redundant); use Change to replace the image. */}
            <button
              onClick={() => {
                if (!imgUrl) return;
                const { cx, cy } = computeVisibleCenter01();
                const w = 0.3;
                const h = 0.08;
                const x = Math.min(1 - w, Math.max(0, cx - w / 2));
                const y = Math.min(1 - h, Math.max(0, cy - h / 2));
                const b: Redaction = { id: uid(), x, y, w, h };
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
        </div>

        <div
          id="claw-redactor-canvas"
          style={{
            border: "1px solid rgba(148,163,184,0.35)",
            borderRadius: 18,
            overflow: "hidden",
            background: "#fff",
            position: "relative",
            boxShadow: "0 12px 40px rgba(15, 23, 42, 0.08)",
            minHeight: 220,
            margin: "0 10px",
          }}
        >
          {!imgUrl ? (
            <div style={{ height: 260, display: "grid", placeItems: "center", color: "#64748b" }}>
              Upload an image to start.
            </div>
          ) : (
            <img src={imgUrl} style={{ width: "100%", display: "block" }} alt="upload" />
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
