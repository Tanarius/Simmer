#!/usr/bin/env node
// Generates placeholder PWA icons (terracotta circle + white "S")
// Run: node scripts/generate-icons.cjs
"use strict";
const zlib = require("zlib");
const fs   = require("fs");
const path = require("path");

// ── CRC-32 ────────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG chunk helper ──────────────────────────────────────────────────────
function chunk(type, data) {
  const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// ── "S" glyph — 7×7 pixel grid ───────────────────────────────────────────
const S_GLYPH = [
  [0,1,1,1,1,1,0],
  [1,1,0,0,0,0,0],
  [1,1,0,0,0,0,0],
  [0,1,1,1,1,0,0],
  [0,0,0,0,1,1,0],
  [0,0,0,0,1,1,0],
  [0,1,1,1,1,0,0],
];
const GLYPH_ROWS = S_GLYPH.length;
const GLYPH_COLS = S_GLYPH[0].length;

// ── Icon generator ────────────────────────────────────────────────────────
function makePNG(size) {
  const BG = [201, 106, 58];  // #C96A3A terracotta
  const FG = [255, 255, 255]; // white

  const rgba = new Uint8Array(size * size * 4);

  // Draw circular background
  const cx = size / 2, cy = size / 2, radius = size * 0.46;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5, dy = y - cy + 0.5;
      const i = (y * size + x) * 4;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        rgba[i] = BG[0]; rgba[i+1] = BG[1]; rgba[i+2] = BG[2]; rgba[i+3] = 255;
      }
      // else transparent (already 0)
    }
  }

  // Draw "S" glyph centred (occupies 42% of icon height)
  const glyphH  = size * 0.42;
  const glyphW  = glyphH * (GLYPH_COLS / GLYPH_ROWS);
  const startX  = (size - glyphW) / 2;
  const startY  = (size - glyphH) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sy = ((y - startY) / glyphH) * GLYPH_ROWS;
      const sx = ((x - startX) / glyphW) * GLYPH_COLS;
      if (sy < 0 || sy >= GLYPH_ROWS || sx < 0 || sx >= GLYPH_COLS) continue;
      if (!S_GLYPH[Math.floor(sy)][Math.floor(sx)]) continue;
      const i = (y * size + x) * 4;
      if (rgba[i+3] === 0) continue; // only draw on filled background
      rgba[i] = FG[0]; rgba[i+1] = FG[1]; rgba[i+2] = FG[2]; rgba[i+3] = 255;
    }
  }

  // Pack into PNG raw data (filter byte 0 per row)
  const rowStride = 1 + size * 4;
  const raw = Buffer.alloc(rowStride * size);
  for (let y = 0; y < size; y++) {
    raw[y * rowStride] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4;
      raw.set(rgba.subarray(s, s + 4), y * rowStride + 1 + x * 4);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  // bytes 10-12 = 0 (compression, filter, interlace)

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Output ────────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, "../client/public/icons");
fs.mkdirSync(outDir, { recursive: true });

const icons = [
  { file: "icon-192.png",        size: 192 },
  { file: "icon-512.png",        size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of icons) {
  fs.writeFileSync(path.join(outDir, file), makePNG(size));
  console.log(`  ✓ icons/${file}  (${size}×${size})`);
}
console.log("Icons generated.");
