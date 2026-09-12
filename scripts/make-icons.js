"use strict";

/**
 * Génère public/assets/icon-192.png et public/assets/icon-512.png
 * (icône satellite STARNÉT AFRIC) sans aucune dépendance externe.
 * Utilisation : node scripts/make-icons.js
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ---------- encodeur PNG minimal (RGB8) ----------
function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgb /* Buffer length width*height*3 */) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  // rest 0
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0; // filter none
    rgb.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- dessin de l'icône ----------
const BG = [11, 15, 20];
const BLUE = [59, 130, 246];
const WHITE = [235, 243, 255];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function ellStroke(px, py, cx, cy, a, b, rotDeg, t) {
  const rad = (-rotDeg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
  const d = Math.sqrt((rx / a) * (rx / a) + (ry / b) * (ry / b));
  return Math.abs(d - 1) < t;
}

function makeIcon(size, out) {
  const rgb = Buffer.alloc(size * size * 3);
  const cx = size / 2;
  const cy = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let col = BG;
      const highlight = 0.55 * Math.max(0, 1 - Math.sqrt(((x / size) - 0.5) ** 2 + ((y / size) - 0.5) ** 2) * 1.6);
      col = [BG[0] + highlight * 12, BG[1] + highlight * 18, BG[2] + highlight * 28];

      const a1 = [size * 0.36, size * 0.16, -28, size * 0.05];
      const a2 = [size * 0.21, size * 0.10, 62, size * 0.045];

      if (ellStroke(x, y, cx, cy, a1[0], a1[1], a1[2], a1[3])) col = WHITE;
      if (ellStroke(x, y, cx, cy, a2[0], a2[1], a2[2], a2[3])) col = WHITE;
      if (ellStroke(x, y, cx, cy, size * 0.30, size * 0.13, -28, size * 0.06)) col = BLUE;

      // centre
      const dc = Math.hypot(x - cx, y - cy);
      if (dc < size * 0.055) col = BLUE;
      else if (dc < size * 0.075) col = lerp(BLUE[0], 90, 0.5) < 0 ? BLUE : [Math.round(lerp(BLUE[0], 120, 0.5)), Math.round(lerp(BLUE[1], 170, 0.5)), Math.round(lerp(BLUE[2], 255, 0.5))];

      const i = (y * size + x) * 3;
      rgb[i] = col[0];
      rgb[i + 1] = col[1];
      rgb[i + 2] = col[2];
    }
  }
  fs.writeFileSync(out, encodePng(size, size, rgb));
  console.log("✓ " + out + " (" + size + "x" + size + ")");
}

const assets = path.join(__dirname, "..", "public", "assets");
fs.mkdirSync(assets, { recursive: true });
makeIcon(512, path.join(assets, "icon-512.png"));
makeIcon(192, path.join(assets, "icon-192.png"));