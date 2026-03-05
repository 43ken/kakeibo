import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}
function createPNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0); ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; ihdrData[9] = 2;
  const pixels = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3);
    pixels[row] = 0;
    for (let x = 0; x < size; x++) {
      pixels[row + 1 + x * 3] = r;
      pixels[row + 2 + x * 3] = g;
      pixels[row + 3 + x * 3] = b;
    }
  }
  return Buffer.concat([sig, chunk('IHDR', ihdrData), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
const pub = join(__dir, '../public');
if (!existsSync(pub)) mkdirSync(pub, { recursive: true });
writeFileSync(join(pub, 'pwa-192x192.png'), createPNG(192, 0, 122, 255));
writeFileSync(join(pub, 'pwa-512x512.png'), createPNG(512, 0, 122, 255));
writeFileSync(join(pub, 'apple-touch-icon.png'), createPNG(180, 0, 122, 255));
console.log('PWAアイコンを生成しました');
