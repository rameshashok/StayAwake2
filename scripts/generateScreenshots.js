// node scripts/generateScreenshots.js
const { Jimp, rgbaToInt } = require("jimp");
const path = require("path");
const fs = require("fs");

const OUT = path.join(__dirname, "..", "assets", "screenshots");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const BG     = rgbaToInt(26,  26,  46,  255);
const GREEN  = rgbaToInt(0,   230, 118, 255);
const WHITE  = rgbaToInt(255, 255, 255, 255);
const PURPLE = rgbaToInt(79,  70,  229, 255);
const RED    = rgbaToInt(180, 20,  20,  220);
const W = 1284, H = 2778;

function fill(img, x, y, w, h, color) {
  for (let px = x; px < x + w; px++)
    for (let py = y; py < y + h; py++)
      img.setPixelColor(color, px, py);
}

function circle(img, cx, cy, r, color) {
  for (let px = cx - r; px <= cx + r; px++)
    for (let py = cy - r; py <= cy + r; py++)
      if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r)
        img.setPixelColor(color, px, py);
}

function rrect(img, x, y, w, h, r, color) {
  fill(img, x + r, y, w - r * 2, h, color);
  fill(img, x, y + r, w, h - r * 2, color);
  [[ x+r, y+r ],[ x+w-r, y+r ],[ x+r, y+h-r ],[ x+w-r, y+h-r ]]
    .forEach(([cx, cy]) => circle(img, cx, cy, r, color));
}

function eye(img, cx, cy, size, color) {
  const ew = size * 0.56, eh = size * 0.26;
  for (let a = 0; a < 360; a += 0.3) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(cx + ew * Math.cos(rad));
    const y = Math.round(cy + eh * Math.sin(rad));
    for (let t = -3; t <= 3; t++) {
      img.setPixelColor(color, x + t, y);
      img.setPixelColor(color, x, y + t);
    }
  }
  circle(img, cx, cy, Math.round(size * 0.09), color);
  circle(img, cx, cy, Math.round(size * 0.04), BG);
}

async function base() {
  const img = new Jimp({ width: W, height: H, color: BG });
  fill(img, 0, 0, W, 100, rgbaToInt(15, 15, 30, 255));
  return img;
}

(async () => {
  console.log("Generating screenshots...");

  // 1 — Monitoring
  const s1 = await base();
  fill(s1, 0, 100, W, Math.round(H * 0.55), rgbaToInt(8, 8, 16, 255));
  eye(s1, W/2, Math.round(100 + H * 0.275), 180, GREEN);
  circle(s1, W/2 - 100, Math.round(H * 0.72), 18, GREEN);
  rrect(s1, 40, Math.round(H - 140), W - 80, 70, 20, rgbaToInt(30, 30, 60, 255));
  await s1.write(path.join(OUT, "01_monitoring.png"));
  console.log("✓ 01_monitoring.png");

  // 2 — Alert
  const s2 = await base();
  fill(s2, 0, 100, W, Math.round(H * 0.55), rgbaToInt(8, 8, 16, 255));
  eye(s2, W/2, Math.round(100 + H * 0.275), 180, rgbaToInt(80, 80, 80, 255));
  rrect(s2, 60, Math.round(H * 0.62), W - 120, 440, 32, RED);
  circle(s2, W/2, Math.round(H * 0.62 + 90), 52, rgbaToInt(255, 200, 0, 255));
  rrect(s2, W/2 - 180, Math.round(H * 0.62 + 320), 360, 80, 40, WHITE);
  await s2.write(path.join(OUT, "02_alert.png"));
  console.log("✓ 02_alert.png");

  // 3 — Onboarding
  const s3 = await base();
  eye(s3, W/2, Math.round(H * 0.28), 200, GREEN);
  rrect(s3, 80, Math.round(H * 0.47), W - 160, 56, 12, rgbaToInt(50, 50, 80, 255));
  for (let i = 0; i < 3; i++)
    rrect(s3, 120, Math.round(H * 0.56 + i * 68), W - 240, 40, 8, rgbaToInt(40, 40, 70, 255));
  for (let i = 0; i < 4; i++)
    circle(s3, W/2 - 60 + i * 44, Math.round(H * 0.77),
      i === 0 ? 16 : 10, i === 0 ? GREEN : rgbaToInt(55, 55, 80, 255));
  rrect(s3, W/2 - 220, Math.round(H * 0.82), 440, 100, 50, PURPLE);
  await s3.write(path.join(OUT, "03_onboarding.png"));
  console.log("✓ 03_onboarding.png");

  // 4 — Settings
  const s4 = await base();
  fill(s4, 0, 100, W, Math.round(H * 0.5), rgbaToInt(8, 8, 16, 255));
  eye(s4, W/2, Math.round(100 + H * 0.25), 160, GREEN);
  rrect(s4, 0, Math.round(H * 0.56), W, Math.round(H * 0.44), 28, rgbaToInt(30, 30, 58, 255));
  rrect(s4, W/2 - 50, Math.round(H * 0.575), 100, 10, 5, rgbaToInt(80, 80, 100, 255));
  const cw = Math.round((W - 120) / 3) - 12;
  for (let i = 0; i < 3; i++)
    rrect(s4, 60 + i * (cw + 12), Math.round(H * 0.64), cw, 100, 14,
      i === 1 ? PURPLE : rgbaToInt(42, 42, 74, 255));
  rrect(s4, 60, Math.round(H * 0.76), W - 120, 76, 12, rgbaToInt(42, 42, 74, 255));
  rrect(s4, 60, Math.round(H * 0.86), W - 120, 76, 12, rgbaToInt(42, 42, 74, 255));
  await s4.write(path.join(OUT, "04_settings.png"));
  console.log("✓ 04_settings.png");

  console.log("\nDone. Written to assets/screenshots/");
})();
