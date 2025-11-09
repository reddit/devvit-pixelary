import { describe, it, expect } from 'vitest';
import { inflateSync } from 'zlib';
import { encodeDrawingToPngDataUrl } from './png';
import { DrawingUtils, type DrawingData } from '@shared/schema/drawing';

function dataUrlToBuffer(dataUrl: string): Buffer {
  const idx = dataUrl.indexOf(',');
  const base64 = dataUrl.slice(idx + 1);
  return Buffer.from(base64, 'base64');
}

function parsePngChunks(buf: Buffer): Array<{ type: string; data: Buffer }> {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(buf.subarray(0, 8)).toEqual(signature);
  const chunks: Array<{ type: string; data: Buffer }> = [];
  let offset = 8;
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buf.subarray(offset + 8, offset + 8 + length);
    // const crc = buf.readUInt32BE(offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return chunks;
}

describe('encodeDrawingToPngDataUrl', () => {
  it('encodes a valid PNG data URL at 256x256 with nearest-neighbor pixels', () => {
    let d: DrawingData = DrawingUtils.createBlank(2);
    d = DrawingUtils.setPixel(d, 0, '#FF0000'); // top-left red
    const dataUrl = encodeDrawingToPngDataUrl(d, 256);
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);

    const buf = dataUrlToBuffer(dataUrl);
    const chunks = parsePngChunks(buf);
    const ihdr = chunks.find((c) => c.type === 'IHDR');
    if (!ihdr) throw new Error('IHDR chunk not found');
    const width = ihdr.data.readUInt32BE(0);
    const height = ihdr.data.readUInt32BE(4);
    expect(width).toBe(256);
    expect(height).toBe(256);

    // Concatenate all IDAT data and inflate scanlines
    const idatData = Buffer.concat(
      chunks.filter((c) => c.type === 'IDAT').map((c) => c.data)
    );
    const scan = inflateSync(idatData);
    const stride = width * 4;
    expect(scan.length).toBe((stride + 1) * height);

    // Sample a top-left pixel (should be red)
    const row0 = 0 * (stride + 1);
    expect(scan[row0]).toBe(0); // filter byte
    const px0 = row0 + 1 + 0 * 4;
    expect(scan[px0 + 0]).toBe(255);
    expect(scan[px0 + 1]).toBe(0);
    expect(scan[px0 + 2]).toBe(0);
    expect(scan[px0 + 3]).toBe(255);

    // Sample a bottom-right pixel (should be white background)
    const rowLast = (height - 1) * (stride + 1);
    const pxLast = rowLast + 1 + (width - 1) * 4;
    expect(scan[pxLast + 0]).toBe(255);
    expect(scan[pxLast + 1]).toBe(255);
    expect(scan[pxLast + 2]).toBe(255);
    expect(scan[pxLast + 3]).toBe(255);
  });

  it('supports 3-digit hex colors in the palette', () => {
    // Background white (#fff), set one pixel to green (#0f0)
    let d: DrawingData = {
      ...DrawingUtils.createBlank(2),
      colors: ['#fff'], // start with explicit 3-digit background
      bg: 0,
    };
    d = DrawingUtils.setPixel(d, 0, '#0f0'); // top-left green, 3-digit hex
    const dataUrl = encodeDrawingToPngDataUrl(d, 64);
    const buf = dataUrlToBuffer(dataUrl);
    const chunks = parsePngChunks(buf);
    const ihdr = chunks.find((c) => c.type === 'IHDR');
    if (!ihdr) throw new Error('IHDR chunk not found');
    const width = ihdr.data.readUInt32BE(0);
    const height = ihdr.data.readUInt32BE(4);
    expect(width).toBe(64);
    expect(height).toBe(64);

    const idatData = Buffer.concat(
      chunks.filter((c) => c.type === 'IDAT').map((c) => c.data)
    );
    const scan = inflateSync(idatData);
    const stride = width * 4;

    // top-left should be green (0,255,0)
    const row0 = 0 * (stride + 1);
    expect(scan[row0]).toBe(0);
    const px0 = row0 + 1 + 0 * 4;
    expect(scan[px0 + 0]).toBe(0);
    expect(scan[px0 + 1]).toBe(255);
    expect(scan[px0 + 2]).toBe(0);
    expect(scan[px0 + 3]).toBe(255);
  });
});
