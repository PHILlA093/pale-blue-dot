// Minimal PNG decoder + element presence/position probe for the 观澜 demo canvas screenshot
const fs = require('fs');
const zlib = require('zlib');

function decodePNG(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let off = 8, w = 0, h = 0, bitDepth = 8, colorType = 6, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('bitDepth ' + bitDepth);
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!ch) throw new Error('colorType ' + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (ft === 1) v = (v + a) & 255;
      else if (ft === 2) v = (v + b) & 255;
      else if (ft === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (ft === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c))) & 255;
      }
      cur[i] = v;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, ch, data: out };
}

const img = decodePNG(process.argv[2]);
const crop = process.argv.length >= 7 ? {
  x: parseInt(process.argv[3], 10), y: parseInt(process.argv[4], 10),
  w: parseInt(process.argv[5], 10), h: parseInt(process.argv[6], 10)
} : { x: 0, y: 0, w: img.w, h: img.h };
const targets = [
  { name: 'dotA/B 珊瑚红 #ff8a80', r: 255, g: 138, b: 128, tol: 26 },
  { name: 'dotA′ 半透明珊瑚 rgba(255,138,128,.7)', r: 178, g: 112, b: 104, tol: 26 },
  { name: '金色 #ffd54f (Q/最短路)', r: 255, g: 213, b: 79, tol: 30 },
  { name: '青色 #4fc3f7 (河岸/P)', r: 79, g: 195, b: 247, tol: 30 },
  { name: '灰虚线 #8fa3c0', r: 143, g: 163, b: 192, tol: 24 },
  { name: '文字近白 #eaf2ff', r: 234, g: 242, b: 255, tol: 28 }
];
const stats = targets.map(t => ({ t, n: 0, minX: 1e9, maxX: -1, minY: 1e9, maxY: -1 }));
const { w, h, ch, data } = img;
const x0 = Math.max(0, crop.x), y0 = Math.max(0, crop.y);
const x1 = Math.min(w, crop.x + crop.w), y1 = Math.min(h, crop.y + crop.h);
for (let y = y0; y < y1; y++) {
  for (let x = x0; x < x1; x++) {
    const i = (y * w + x) * ch;
    const r = data[i], g = data[i + 1], b = data[i + 2], a = ch === 4 ? data[i + 3] : 255;
    if (a < 200) continue;
    for (const s of stats) {
      if (Math.abs(r - s.t.r) <= s.t.tol && Math.abs(g - s.t.g) <= s.t.tol && Math.abs(b - s.t.b) <= s.t.tol) {
        s.n++;
        if (x < s.minX) s.minX = x; if (x > s.maxX) s.maxX = x;
        if (y < s.minY) s.minY = y; if (y > s.maxY) s.maxY = y;
      }
    }
  }
}
console.log('IMG ' + w + 'x' + h + ' ch=' + ch + ' crop=(' + x0 + ',' + y0 + ')-(' + x1 + ',' + y1 + ')');
for (const s of stats) {
  console.log((s.n ? 'FOUND ' : 'MISS  ') + s.t.name + ' px=' + s.n +
    (s.n ? ' bbox=(' + s.minX + ',' + s.minY + ')-(' + s.maxX + ',' + s.maxY + ')' : ''));
}
