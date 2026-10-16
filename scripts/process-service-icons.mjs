import fs from 'fs';
import zlib from 'zlib';

function decodePng(buf) {
  let offset = 8;
  const idats = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idats.push(buf.slice(offset + 8, offset + 8 + len));
    offset += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idats));
  const w = 380, h = 380;
  const stride = w * 4;
  const out = Buffer.alloc(stride * h);

  let rawOff = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rawOff++];
    const prevRow = y > 0 ? out.slice((y - 1) * stride, y * stride) : null;
    const curRow = out.slice(y * stride, (y + 1) * stride);

    for (let x = 0; x < stride; x++) {
      const byte = raw[rawOff++];
      const a = x >= 4 ? curRow[x - 4] : 0;
      const b = prevRow ? prevRow[x] : 0;
      const c = (prevRow && x >= 4) ? prevRow[x - 4] : 0;

      if (filter === 0) curRow[x] = byte;
      else if (filter === 1) curRow[x] = (byte + a) & 0xff;
      else if (filter === 2) curRow[x] = (byte + b) & 0xff;
      else if (filter === 3) curRow[x] = (byte + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
        curRow[x] = (byte + pr) & 0xff;
      }
    }
  }
  return { w, h, data: out, origBuf: buf };
}

function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function encodePng(w, h, rgba) {
  const stride = w * 4;
  const encoded = Buffer.alloc(h * (1 + stride));
  let encOff = 0;
  for (let y = 0; y < h; y++) {
    encoded[encOff++] = 0; // Filter None
    rgba.copy(encoded, encOff, y * stride, (y + 1) * stride);
    encOff += stride;
  }

  const compressed = zlib.deflateSync(encoded);
  const outBuf = Buffer.alloc(8 + 25 + 12 + compressed.length + 12);
  let pos = 0;
  // Signature
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(outBuf, 0); pos += 8;
  // IHDR
  outBuf.writeUInt32BE(13, pos); pos += 4;
  outBuf.write('IHDR', pos, 'ascii'); pos += 4;
  outBuf.writeUInt32BE(w, pos); pos += 4;
  outBuf.writeUInt32BE(h, pos); pos += 4;
  outBuf[pos++] = 8; outBuf[pos++] = 6; outBuf[pos++] = 0; outBuf[pos++] = 0; outBuf[pos++] = 0;
  outBuf.writeUInt32BE(crc32(outBuf.slice(12, 12 + 17)), pos); pos += 4;
  // IDAT
  outBuf.writeUInt32BE(compressed.length, pos); pos += 4;
  outBuf.write('IDAT', pos, 'ascii'); pos += 4;
  compressed.copy(outBuf, pos); pos += compressed.length;
  outBuf.writeUInt32BE(crc32(Buffer.concat([Buffer.from('IDAT', 'ascii'), compressed])), pos); pos += 4;
  // IEND
  outBuf.writeUInt32BE(0, pos); pos += 4;
  outBuf.write('IEND', pos, 'ascii'); pos += 4;
  outBuf.writeUInt32BE(crc32(Buffer.from('IEND', 'ascii')), pos); pos += 4;

  return outBuf.slice(0, pos);
}

function transform(srcPath, destPathGradient, destPathRed) {
  const { w, h, data } = decodePng(fs.readFileSync(srcPath));
  const cx = 190, cy = 190, r = 168;
  const stride = w * 4;

  const gradRgba = Buffer.alloc(stride * h);
  const redRgba = Buffer.alloc(stride * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const dist = Math.hypot(x - cx, y - cy);

      let rVal = data[idx];
      let gVal = data[idx + 1];
      let bVal = data[idx + 2];
      let aVal = data[idx + 3];

      if (dist > r + 3) {
        gradRgba[idx] = 0; gradRgba[idx + 1] = 0; gradRgba[idx + 2] = 0; gradRgba[idx + 3] = 0;
        redRgba[idx] = 0; redRgba[idx + 1] = 0; redRgba[idx + 2] = 0; redRgba[idx + 3] = 0;
        continue;
      }

      // Edge anti-aliasing
      if (dist > r - 2) {
        const edgeAlpha = Math.max(0, Math.min(1, (r + 3 - dist) / 5));
        aVal = Math.round(aVal * edgeAlpha);
      }

      // Red version: keep original button colors, clean transparent outside
      redRgba[idx] = rVal;
      redRgba[idx + 1] = gVal;
      redRgba[idx + 2] = bVal;
      redRgba[idx + 3] = aVal;

      // Gradient version:
      // Check if it's the white icon
      const maxC = Math.max(rVal, gVal, bVal);
      const minC = Math.min(rVal, gVal, bVal);
      const isWhite = (minC > 170) && (maxC - minC < 50);

      if (isWhite) {
        gradRgba[idx] = rVal;
        gradRgba[idx + 1] = gVal;
        gradRgba[idx + 2] = bVal;
        gradRgba[idx + 3] = aVal;
      } else {
        // Linear gradient from top-left (x=0, y=0) to bottom-right (x=w, y=h)
        // #f55f24 -> (245, 95, 36)
        // #ffb86a -> (255, 184, 106)
        const t = Math.max(0, Math.min(1, (x + y) / (2 * 380)));
        const targetR = 245 + t * (255 - 245);
        const targetG = 95 + t * (184 - 95);
        const targetB = 36 + t * (106 - 36);

        // Normalize luminance from original button so highlights and button curvature remain
        const lum = (rVal * 0.55 + gVal * 0.35 + bVal * 0.1) / 255;
        const factor = Math.max(0.4, Math.min(1.4, lum * 1.1));

        gradRgba[idx] = Math.min(255, Math.round(targetR * factor));
        gradRgba[idx + 1] = Math.min(255, Math.round(targetG * factor));
        gradRgba[idx + 2] = Math.min(255, Math.round(targetB * factor));
        gradRgba[idx + 3] = aVal;
      }
    }
  }

  fs.writeFileSync(destPathGradient, encodePng(w, h, gradRgba));
  if (destPathRed) {
    fs.writeFileSync(destPathRed, encodePng(w, h, redRgba));
  }
}

// Map the 5 images
const imageMap = [
  {
    src: 'C:/Users/lirid/.gemini/antigravity/brain/82501a0f-9443-43e9-9238-bd732b6852c2/.user_uploaded/media_1792098121048_6c8a054d.png',
    name: 'technical-repairs',
  },
  {
    src: 'C:/Users/lirid/.gemini/antigravity/brain/82501a0f-9443-43e9-9238-bd732b6852c2/.user_uploaded/media_1792098121089_f20656a4.png',
    name: 'engine-diagnostics',
  },
  {
    src: 'C:/Users/lirid/.gemini/antigravity/brain/82501a0f-9443-43e9-9238-bd732b6852c2/.user_uploaded/media_1792098121052_8674d056.png',
    name: 'system-service',
  },
  {
    src: 'C:/Users/lirid/.gemini/antigravity/brain/82501a0f-9443-43e9-9238-bd732b6852c2/.user_uploaded/media_1792098121060_6d434f6d.png',
    name: 'oil-filters',
  },
  {
    src: 'C:/Users/lirid/.gemini/antigravity/brain/82501a0f-9443-43e9-9238-bd732b6852c2/.user_uploaded/media_1792098121042_14e6d0d8.png',
    name: 'tires-wheels',
  },
];

const outDir = 'artifacts/auto-service-hub/public/service-icons';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (const item of imageMap) {
  const destGrad = `${outDir}/${item.name}.png`;
  const destRed = `${outDir}/${item.name}-red.png`;
  transform(item.src, destGrad, destRed);
  console.log(`Processed ${item.name} -> ${destGrad} & ${destRed}`);
}

// Generate the 6th matching icon: electrical-system with lightning bolt & battery circle
function generateElectricalIcon(destGrad, destRed) {
  const w = 380, h = 380;
  const cx = 190, cy = 190, r = 168;
  const stride = w * 4;

  const gradRgba = Buffer.alloc(stride * h);
  const redRgba = Buffer.alloc(stride * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const dist = Math.hypot(x - cx, y - cy);

      if (dist > r + 3) {
        gradRgba[idx] = 0; gradRgba[idx + 1] = 0; gradRgba[idx + 2] = 0; gradRgba[idx + 3] = 0;
        redRgba[idx] = 0; redRgba[idx + 1] = 0; redRgba[idx + 2] = 0; redRgba[idx + 3] = 0;
        continue;
      }

      let aVal = 255;
      if (dist > r - 2) {
        aVal = Math.round(255 * Math.max(0, Math.min(1, (r + 3 - dist) / 5)));
      }

      // 3D sphere gradient highlight
      const nx = (x - cx) / r;
      const ny = (y - cy) / r;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      // Light from top-left (-0.5, -0.6, 0.6)
      const lx = -0.4, ly = -0.5, lz = 0.77;
      const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
      const specular = Math.pow(diffuse, 8);
      const factor = 0.65 + diffuse * 0.45 + specular * 0.55;

      const t = Math.max(0, Math.min(1, (x + y) / (2 * 380)));
      const gradR = Math.min(255, Math.round((245 + t * 10) * factor));
      const gradG = Math.min(255, Math.round((95 + t * 89) * factor));
      const gradB = Math.min(255, Math.round((36 + t * 70) * factor));

      // Red version
      const redR = Math.min(255, Math.round(230 * factor));
      const redG = Math.min(255, Math.round(35 * factor));
      const redB = Math.min(255, Math.round(35 * factor));

      gradRgba[idx] = gradR; gradRgba[idx + 1] = gradG; gradRgba[idx + 2] = gradB; gradRgba[idx + 3] = aVal;
      redRgba[idx] = redR; redRgba[idx + 1] = redG; redRgba[idx + 2] = redB; redRgba[idx + 3] = aVal;
    }
  }

  // Draw 6th symbol: Battery / Lightning bolt
  // Simple crisp white lightning bolt
  const bolt = [
    [205, 100], [145, 195], [190, 195], [165, 280], [240, 175], [195, 175], [215, 100]
  ];
  function pointInPoly(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  for (let y = 80; y < 300; y++) {
    for (let x = 120; x < 260; x++) {
      const idx = (y * w + x) * 4;
      // Also check curved circle lines (revolving arrows)
      const d = Math.hypot(x - cx, y - cy);
      const isRing = (d >= 105 && d <= 120) && ((x < cx - 15 || y < cy - 15) && (x > cx + 15 || y > cy + 15));
      const isBolt = pointInPoly(x, y, bolt);

      if (isBolt || isRing) {
        gradRgba[idx] = 255; gradRgba[idx + 1] = 255; gradRgba[idx + 2] = 255; gradRgba[idx + 3] = 255;
        redRgba[idx] = 255; redRgba[idx + 1] = 255; redRgba[idx + 2] = 255; redRgba[idx + 3] = 255;
      }
    }
  }

  fs.writeFileSync(destGrad, encodePng(w, h, gradRgba));
  fs.writeFileSync(destRed, encodePng(w, h, redRgba));
  console.log(`Generated electrical-system -> ${destGrad} & ${destRed}`);
}

generateElectricalIcon(`${outDir}/electrical-system.png`, `${outDir}/electrical-system-red.png`);
