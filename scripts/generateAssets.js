// Run with: node scripts/generateAssets.js
const { Jimp, rgbaToInt } = require("jimp");
const path = require("path");

const ASSETS = path.join(__dirname, "..", "assets");

const BG    = rgbaToInt(26,  26,  46,  255);
const GREEN = rgbaToInt(0,   230, 118, 255);

async function makeIcon(size) {
  const img = new Jimp({ width: size, height: size, color: BG });
  const cx = size / 2;
  const cy = size / 2 - size * 0.04;

  // Eye ellipse outline
  const ew = size * 0.28;
  const eh = size * 0.13;
  for (let a = 0; a < 360; a += 0.4) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(cx + ew * Math.cos(rad));
    const y = Math.round(cy + eh * Math.sin(rad));
    for (let t = -2; t <= 2; t++) {
      img.setPixelColor(GREEN, x + t, y);
      img.setPixelColor(GREEN, x, y + t);
    }
  }

  // Pupil (filled circle)
  const pr = size * 0.09;
  for (let px = -pr; px <= pr; px++) {
    for (let py = -pr; py <= pr; py++) {
      if (px * px + py * py <= pr * pr) {
        img.setPixelColor(GREEN, Math.round(cx + px), Math.round(cy + py));
      }
    }
  }

  // Inner pupil (dark)
  const ir = size * 0.045;
  for (let px = -ir; px <= ir; px++) {
    for (let py = -ir; py <= ir; py++) {
      if (px * px + py * py <= ir * ir) {
        img.setPixelColor(BG, Math.round(cx + px), Math.round(cy + py));
      }
    }
  }

  return img;
}

async function makeSplash(w, h) {
  const img = new Jimp({ width: w, height: h, color: BG });
  const iconSize = Math.round(Math.min(w, h) * 0.22);
  const icon = await makeIcon(iconSize);
  const ix = Math.round((w - iconSize) / 2);
  const iy = Math.round(h / 2 - iconSize * 0.9);
  img.composite(icon, ix, iy);
  return img;
}

(async () => {
  console.log("Generating assets...");

  await (await makeIcon(1024)).write(path.join(ASSETS, "icon.png"));
  console.log("✓ icon.png (1024x1024)");

  await (await makeIcon(1024)).write(path.join(ASSETS, "adaptive-icon.png"));
  console.log("✓ adaptive-icon.png (1024x1024)");

  await (await makeSplash(1284, 2778)).write(path.join(ASSETS, "splash.png"));
  console.log("✓ splash.png (1284x2778)");

  console.log("\nDone. Assets written to /assets");
})();
