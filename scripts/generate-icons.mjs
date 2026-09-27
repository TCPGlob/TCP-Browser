/**
 * Generates the PWA icons in public/ as real, valid PNGs.
 *
 * The icons are drawn programmatically (no image dependencies) and written with
 * Node's built-in zlib, so this script always works on a fresh clone.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
mkdirSync(publicDir, { recursive: true });

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const SLATE_950 = [2, 6, 23];
const EMERALD_500 = [16, 185, 129];

function blend(dst, i, rgb, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  for (let c = 0; c < 3; c++) {
    dst[i + c] = Math.round(dst[i + c] * (1 - a) + rgb[c] * a);
  }
}

/** Distance from point p to the segment ab. */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Draws the TCP Browser mark: the same lightning bolt used as the favicon,
 * rendered in emerald on the slate-950 theme colour, inside a rounded square.
 */
function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const strokeWidth = Math.max(1.5, size * 0.055);

  // Lightning bolt outline in the 24x24 coordinate space of the favicon.
  const points = [[13, 2], [3, 14], [12, 14], [11, 22], [21, 10], [12, 10], [13, 2]];
  const scale = size / 24;
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push([
      points[i][0] * scale, points[i][1] * scale,
      points[i + 1][0] * scale, points[i + 1][1] * scale,
    ]);
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;

      // Rounded-square alpha mask.
      const cx = Math.min(Math.max(px, radius), size - radius);
      const cy = Math.min(Math.max(py, radius), size - radius);
      const cornerDist = Math.hypot(px - cx, py - cy);
      const coverage = Math.max(0, Math.min(1, radius - cornerDist + 0.5));
      if (coverage <= 0) continue;

      rgba[i] = SLATE_950[0];
      rgba[i + 1] = SLATE_950[1];
      rgba[i + 2] = SLATE_950[2];

      let minDist = Infinity;
      for (const [ax, ay, bx, by] of segments) {
        minDist = Math.min(minDist, distToSegment(px, py, ax, ay, bx, by));
      }
      const bolt = Math.max(0, Math.min(1, strokeWidth / 2 - minDist + 0.5));
      if (bolt > 0) blend(rgba, i, EMERALD_500, bolt);

      rgba[i + 3] = Math.round(coverage * 255);
    }
  }
  return rgba;
}

for (const size of [192, 512]) {
  const png = encodePng(size, size, drawIcon(size));
  const target = path.join(publicDir, `icon-${size}.png`);
  writeFileSync(target, png);
  console.log(`wrote ${path.relative(path.resolve(__dirname, '..'), target)} (${size}x${size}, ${png.length} bytes)`);
}

// Maskable variant: same mark, extra padding so Android can crop it safely.
{
  const size = 512;
  const inner = drawIcon(Math.round(size * 0.72));
  const rgba = Buffer.alloc(size * size * 4);
  const offset = Math.round((size - Math.round(size * 0.72)) / 2);
  const innerSize = Math.round(size * 0.72);
  for (let y = 0; y < innerSize; y++) {
    for (let x = 0; x < innerSize; x++) {
      const src = (y * innerSize + x) * 4;
      const dstX = x + offset;
      const dstY = y + offset;
      if (dstX >= size || dstY >= size) continue;
      const dst = (dstY * size + dstX) * 4;
      rgba[dst] = inner[src];
      rgba[dst + 1] = inner[src + 1];
      rgba[dst + 2] = inner[src + 2];
      rgba[dst + 3] = inner[src + 3];
    }
  }
  const png = encodePng(size, size, rgba);
  const target = path.join(publicDir, 'icon-maskable-512.png');
  writeFileSync(target, png);
  console.log(`wrote ${path.relative(path.resolve(__dirname, '..'), target)} (${size}x${size}, ${png.length} bytes)`);
}
