// Dependency-free placeholder icon generator.
//
// Produces icon16/48/128.png: a dark rounded square with a red "record" dot,
// matching the extension's REC theme. Run with:  node extension/icons/generate-icons.js
//
// Encodes PNG by hand (zlib + manual chunks) so no npm packages are needed.

const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// ---- PNG encoding ---------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data with a 0 filter byte per scanline.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- drawing --------------------------------------------------------------

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const r = size * 0.22; // corner radius
  const cx = size / 2;
  const cy = size / 2;
  const dotR = size * 0.28;

  // colors
  const bg = [38, 39, 43, 255]; // dark panel
  const rec = [217, 48, 37, 255]; // record red

  function inRoundedRect(x, y) {
    const dx = Math.min(x, size - 1 - x);
    const dy = Math.min(y, size - 1 - y);
    if (dx >= r || dy >= r) return true;
    const ex = r - dx;
    const ey = r - dy;
    return ex * ex + ey * ey <= r * r;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let color = [0, 0, 0, 0]; // transparent outside the rounded square
      if (inRoundedRect(x, y)) {
        color = bg;
        const d = Math.hypot(x - cx, y - cy);
        if (d <= dotR) color = rec;
      }
      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = color[3];
    }
  }
  return rgba;
}

// ---- write ----------------------------------------------------------------

const sizes = [16, 48, 128];
for (const size of sizes) {
  const png = encodePng(size, size, drawIcon(size));
  const out = path.join(__dirname, `icon${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes)`);
}
