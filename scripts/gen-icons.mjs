import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function setPixel(png, x, y, c, a = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = c.r;
  png.data[idx + 1] = c.g;
  png.data[idx + 2] = c.b;
  png.data[idx + 3] = a;
}

function fill(png, c) {
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = c.r;
    png.data[i + 1] = c.g;
    png.data[i + 2] = c.b;
    png.data[i + 3] = 255;
  }
}

function drawRoundedRect(png, x, y, w, h, r, c) {
  const rr = Math.max(0, Math.min(r, Math.floor(Math.min(w, h) / 2)));
  const x0 = x;
  const y0 = y;
  const x1 = x + w - 1;
  const y1 = y + h - 1;

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const inLeft = px < x0 + rr;
      const inRight = px > x1 - rr;
      const inTop = py < y0 + rr;
      const inBottom = py > y1 - rr;

      let ok = true;
      if (inLeft && inTop) {
        const dx = px - (x0 + rr);
        const dy = py - (y0 + rr);
        ok = dx * dx + dy * dy <= rr * rr;
      } else if (inRight && inTop) {
        const dx = px - (x1 - rr);
        const dy = py - (y0 + rr);
        ok = dx * dx + dy * dy <= rr * rr;
      } else if (inLeft && inBottom) {
        const dx = px - (x0 + rr);
        const dy = py - (y1 - rr);
        ok = dx * dx + dy * dy <= rr * rr;
      } else if (inRight && inBottom) {
        const dx = px - (x1 - rr);
        const dy = py - (y1 - rr);
        ok = dx * dx + dy * dy <= rr * rr;
      }
      if (ok) setPixel(png, px, py, c);
    }
  }
}

// Blocky "B" built from rectangles; scales well without font dependencies.
function drawB(png, c) {
  const s = png.width;
  const pad = Math.floor(s * 0.22);
  const stroke = Math.max(2, Math.floor(s * 0.10));

  const x = pad;
  const y = pad;
  const w = s - pad * 2;
  const h = s - pad * 2;

  // vertical spine
  drawRoundedRect(png, x, y, stroke, h, Math.floor(stroke / 2), c);

  // top bowl
  drawRoundedRect(png, x, y, w, stroke, Math.floor(stroke / 2), c);
  drawRoundedRect(png, x + w - stroke, y, stroke, Math.floor(h * 0.52), Math.floor(stroke / 2), c);
  drawRoundedRect(png, x, y + Math.floor(h * 0.48), w, stroke, Math.floor(stroke / 2), c);

  // bottom bowl
  drawRoundedRect(png, x, y + Math.floor(h * 0.48), w, stroke, Math.floor(stroke / 2), c);
  drawRoundedRect(png, x + w - stroke, y + Math.floor(h * 0.48), stroke, Math.floor(h * 0.52), Math.floor(stroke / 2), c);
  drawRoundedRect(png, x, y + h - stroke, w, stroke, Math.floor(stroke / 2), c);

  // carve inner gaps by overdrawing background rectangles (simple)
  const bg = hexToRgb("#0b0b0f");
  const innerPad = Math.floor(stroke * 0.7);

  // top inner
  drawRoundedRect(
    png,
    x + stroke + innerPad,
    y + stroke + innerPad,
    w - stroke * 2 - innerPad * 2,
    Math.floor(h * 0.36),
    Math.floor(stroke / 2),
    bg
  );

  // bottom inner
  drawRoundedRect(
    png,
    x + stroke + innerPad,
    y + Math.floor(h * 0.56),
    w - stroke * 2 - innerPad * 2,
    Math.floor(h * 0.32),
    Math.floor(stroke / 2),
    bg
  );
}

function writeIcon(size) {
  const bg = hexToRgb("#0b0b0f");
  const fg = hexToRgb("#ffffff");

  const png = new PNG({ width: size, height: size });
  fill(png, bg);

  // subtle rounded square container
  const r = Math.floor(size * 0.22);
  // keep background but add a slightly lighter rounded border effect
  // (draw a translucent white stroke by drawing an inset rect)
  const border = Math.max(1, Math.floor(size * 0.04));
  const borderColor = hexToRgb("#111827");
  drawRoundedRect(png, border, border, size - border * 2, size - border * 2, r, borderColor);
  drawRoundedRect(png, border * 2, border * 2, size - border * 4, size - border * 4, r - border, bg);

  drawB(png, fg);

  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, PNG.sync.write(png));
  console.log("wrote", outPath);
}

[16, 32, 48, 128].forEach(writeIcon);
