import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(width, height, drawPixel) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdr);

  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      const idx = 1 + x * 4;
      row[idx] = r;
      row[idx + 1] = g;
      row[idx + 2] = b;
      row[idx + 3] = a;
    }
    rawRows.push(row);
  }
  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Distance to rounded rectangle
function sdRoundedRect(x, y, cx, cy, w, h, r) {
  const dx = Math.abs(x - cx) - (w / 2 - r);
  const dy = Math.abs(y - cy) - (h / 2 - r);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - r;
}

// Distance to cross emblem
function sdCross(x, y, cx, cy, armLength, armWidth, r) {
  const dH = sdRoundedRect(x, y, cx, cy, armLength, armWidth, r);
  const dV = sdRoundedRect(x, y, cx, cy, armWidth, armLength, r);
  return Math.min(dH, dV);
}

// 1. App Icon (1024x1024) - Sky Blue squircle container with crisp White Medical Cross & subtle pulse
function drawAppIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const bgDist = sdRoundedRect(x, y, cx, cy, w * 0.88, h * 0.88, w * 0.22);

  if (bgDist > 1) {
    return [0, 0, 0, 0]; // Transparent outside icon bounds
  }

  // Antialiasing on squircle edge
  let bgAlpha = 1;
  if (bgDist > -1) {
    bgAlpha = 0.5 - bgDist * 0.5;
  }

  // Cross dimensions
  const crossDist = sdCross(x, y, cx, cy, w * 0.46, w * 0.16, w * 0.05);

  if (crossDist <= 0) {
    // Pure white medical cross
    return [255, 255, 255, Math.round(255 * bgAlpha)];
  } else if (crossDist < 2) {
    // Cross edge antialiasing
    const t = crossDist / 2;
    const r = Math.round(255 * (1 - t) + 2 * t);
    const g = Math.round(255 * (1 - t) + 132 * t);
    const b = Math.round(255 * (1 - t) + 199 * t);
    return [r, g, b, Math.round(255 * bgAlpha)];
  }

  // Base Blue: #0284C7 (2, 132, 199) with subtle vertical gradient to #0369A1 (3, 105, 161)
  const gradT = y / h;
  const r = Math.round(2 * (1 - gradT) + 3 * gradT);
  const g = Math.round(132 * (1 - gradT) + 105 * gradT);
  const b = Math.round(199 * (1 - gradT) + 161 * gradT);

  return [r, g, b, Math.round(255 * bgAlpha)];
}

// 2. Adaptive Icon (1024x1024) - Centered cross inside safe circle area for Android Adaptive
function drawAdaptiveIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const bgDist = sdRoundedRect(x, y, cx, cy, w * 0.68, h * 0.68, w * 0.18);

  if (bgDist > 1) {
    return [255, 255, 255, 0];
  }

  let bgAlpha = 1;
  if (bgDist > -1) {
    bgAlpha = 0.5 - bgDist * 0.5;
  }

  const crossDist = sdCross(x, y, cx, cy, w * 0.36, w * 0.12, w * 0.04);

  if (crossDist <= 0) {
    return [255, 255, 255, Math.round(255 * bgAlpha)];
  } else if (crossDist < 2) {
    const t = crossDist / 2;
    const r = Math.round(255 * (1 - t) + 2 * t);
    const g = Math.round(255 * (1 - t) + 132 * t);
    const b = Math.round(255 * (1 - t) + 199 * t);
    return [r, g, b, Math.round(255 * bgAlpha)];
  }

  const gradT = y / h;
  const r = Math.round(2 * (1 - gradT) + 3 * gradT);
  const g = Math.round(132 * (1 - gradT) + 105 * gradT);
  const b = Math.round(199 * (1 - gradT) + 161 * gradT);

  return [r, g, b, Math.round(255 * bgAlpha)];
}

// 3. Splash Screen (1242x2436) - Clean white with centered emblem
function drawSplash(x, y, w, h) {
  const cx = w / 2;
  const cy = h * 0.44; // Slightly above center for visual balance
  const emblemSize = w * 0.28;

  const bgDist = sdRoundedRect(x, y, cx, cy, emblemSize, emblemSize, emblemSize * 0.28);

  if (bgDist > 1) {
    // Pure clean white background: #FFFFFF
    return [255, 255, 255, 255];
  }

  let bgAlpha = 1;
  if (bgDist > -1) {
    bgAlpha = 0.5 - bgDist * 0.5;
  }

  const crossDist = sdCross(x, y, cx, cy, emblemSize * 0.52, emblemSize * 0.18, emblemSize * 0.06);

  if (crossDist <= 0) {
    return [255, 255, 255, 255];
  } else if (crossDist < 2) {
    const t = crossDist / 2;
    const r = Math.round(255 * (1 - t) + 2 * t);
    const g = Math.round(255 * (1 - t) + 132 * t);
    const b = Math.round(255 * (1 - t) + 199 * t);
    return [r, g, b, 255];
  }

  // Sky Blue: #0284C7
  const r = Math.round(2 * bgAlpha + 255 * (1 - bgAlpha));
  const g = Math.round(132 * bgAlpha + 255 * (1 - bgAlpha));
  const b = Math.round(199 * bgAlpha + 255 * (1 - bgAlpha));

  return [r, g, b, 255];
}

const assetsDir = path.resolve('apps/patient-mobile/assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

console.log('Generating branding assets...');

console.log('1. Generating icon.png (1024x1024)...');
const iconPng = createPng(1024, 1024, drawAppIcon);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), iconPng);

console.log('2. Generating adaptive-icon.png (1024x1024)...');
const adaptivePng = createPng(1024, 1024, drawAdaptiveIcon);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), adaptivePng);

console.log('3. Generating splash.png (1242x2436)...');
const splashPng = createPng(1242, 2436, drawSplash);
fs.writeFileSync(path.join(assetsDir, 'splash.png'), splashPng);

console.log('4. Generating favicon.png (48x48)...');
const faviconPng = createPng(48, 48, drawAppIcon);
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), faviconPng);

console.log('All branding assets generated successfully in apps/patient-mobile/assets!');
