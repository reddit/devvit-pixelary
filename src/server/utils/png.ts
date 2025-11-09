import { deflateSync, constants } from 'zlib';
import { DrawingUtils, type DrawingData } from '@shared/schema/drawing';
import { hexToRgb } from '@shared/utils/color';

// Precompute CRC-32 table once (IEEE 802.3 polynomial)
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * Compute CRC-32 for a buffer (IEEE 802.3 polynomial) as required by PNG chunk CRCs.
 * @param buffer Input data to compute the checksum for
 * @returns Unsigned 32-bit CRC
 */
function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    const t = CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0;
    crc = t ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Build a PNG chunk from type and data, including length prefix and CRC-32.
 * @param type 4-character ASCII chunk type (e.g. 'IHDR', 'IDAT', 'IEND')
 * @param data Raw chunk payload
 * @returns Full chunk buffer: length(4) + type(4) + data + crc(4)
 */
function makeChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.allocUnsafe(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/**
 * Encode DrawingData to a PNG data URL at the given output size.
 * - Uses nearest-neighbor sampling for crisp pixel art.
 * - Produces a standard 32-bit RGBA PNG with no interlace and filter type 0 per row.
 * @param drawing The Pixelary drawing to encode
 * @param outputSize Final PNG width/height in pixels (square). Defaults to 256
 * @returns 'data:image/png;base64,...' URL
 */
export function encodeDrawingToPngDataUrl(
  drawing: DrawingData,
  outputSize: number = 256
): string {
  const srcSize = drawing.size;
  const dstSize = Math.max(1, Math.min(4096, Math.floor(outputSize)));

  // Decode pixel indices
  const indices = DrawingUtils._decodeData(drawing.data);

  // Precompute palette RGB
  const bgColorHex = drawing.colors[drawing.bg] ?? '#FFFFFF';
  const paletteRgb: Array<[number, number, number]> = drawing.colors.map(
    (c) => {
      const rgb = hexToRgb(c as never);
      return rgb
        ? ([rgb.r, rgb.g, rgb.b] as [number, number, number])
        : [255, 255, 255];
    }
  );
  const bgObj = hexToRgb(bgColorHex as never);
  const bgRgb: [number, number, number] = bgObj
    ? [bgObj.r, bgObj.g, bgObj.b]
    : [255, 255, 255];
  const fallbackRgb = paletteRgb[drawing.bg] ?? bgRgb;

  // Precompute nearest-neighbor source coordinate maps
  const yMap = new Uint16Array(dstSize);
  const xMap = new Uint16Array(dstSize);
  for (let y = 0; y < dstSize; y++)
    yMap[y] = Math.floor((y * srcSize) / dstSize);
  for (let x = 0; x < dstSize; x++)
    xMap[x] = Math.floor((x * srcSize) / dstSize);

  // Create scanlines with filter type 0 (None)
  const stride = dstSize * 4;
  const scanlines = Buffer.allocUnsafe((stride + 1) * dstSize);

  for (let y = 0; y < dstSize; y++) {
    const srcY = yMap[y] ?? 0;
    const rowStart = y * (stride + 1);
    scanlines[rowStart] = 0; // filter type 0
    let off = rowStart + 1;
    for (let x = 0; x < dstSize; x++) {
      const srcX = xMap[x] ?? 0;
      const srcIndex = srcY * srcSize + srcX;
      const colorIndex = indices[srcIndex] ?? drawing.bg;
      const rgb = paletteRgb[colorIndex] ?? fallbackRgb;
      const r = rgb[0];
      const g = rgb[1];
      const b = rgb[2];
      scanlines[off] = r;
      scanlines[off + 1] = g;
      scanlines[off + 2] = b;
      scanlines[off + 3] = 255;
      off += 4;
    }
  }

  // Compress image data
  const compressed = deflateSync(scanlines, {
    level: constants.Z_BEST_SPEED,
  });

  // Build PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(dstSize, 0); // width
  ihdrData.writeUInt32BE(dstSize, 4); // height
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type (RGBA)
  ihdrData[10] = 0; // compression (deflate)
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace (none)
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT chunk
  const idat = makeChunk('IDAT', compressed);

  // IEND chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));

  const png = Buffer.concat([signature, ihdr, idat, iend]);
  return `data:image/png;base64,${png.toString('base64')}`;
}
