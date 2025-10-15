import { z } from 'zod';

// Declare global variables for cross-environment compatibility
declare const atob: ((data: string) => string) | undefined;
declare const btoa: ((data: string) => string) | undefined;
declare const Buffer:
  | {
      from(
        data: string,
        encoding: string
      ): { toString(encoding: string): string };
    }
  | undefined;

// Browser/Node.js compatible base64 encoding
const encodeBase64 = (str: string): string => {
  if (typeof btoa !== 'undefined') {
    return btoa(str);
  }
  // Node.js fallback
  return Buffer!.from(str, 'binary').toString('base64');
};

const decodeBase64 = (str: string): string => {
  if (typeof atob !== 'undefined') {
    return atob(str);
  }
  // Node.js fallback
  return Buffer!.from(str, 'base64').toString('binary');
};

// Optimized drawing schema for maximum efficiency
export const DrawingDataSchema = z.object({
  // Bit-packed data: each pixel = 8 bits (256 colors max)
  // Each byte represents one pixel's color index
  data: z.string(), // Base64 encoded bit-packed data

  // Color palette (max 256 colors)
  colors: z.array(z.string()).max(256),

  // Background color index in palette
  bg: z.number().int().min(0),

  // Grid size (square grid)
  size: z.number().int().min(1).max(64).default(16),
});

export type DrawingData = z.infer<typeof DrawingDataSchema>;

// Utility functions for drawing format
export const DrawingUtils = {
  /**
   * Create blank drawing
   */
  createBlank: (size = 16): DrawingData => {
    const totalPixels = size * size;
    const data = new Uint8Array(totalPixels);
    data.fill(0); // All pixels set to background color (0)

    return {
      data: encodeBase64(String.fromCharCode.apply(null, Array.from(data))),
      colors: ['#FFFFFF'], // Default white background
      bg: 0,
      size,
    };
  },

  /**
   * Efficiently decode base64 data to Uint8Array
   */
  _decodeData: (base64Data: string): Uint8Array => {
    const binaryString = decodeBase64(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  },

  /**
   * Efficiently encode Uint8Array to base64
   */
  _encodeData: (data: Uint8Array): string => {
    let binaryString = '';
    for (let i = 0; i < data.length; i++) {
      binaryString += String.fromCharCode(data[i]!);
    }
    return encodeBase64(binaryString);
  },

  /**
   * Get pixel color at position
   */
  getPixelColor: (v3: DrawingData, pixelIndex: number): string => {
    const data = DrawingUtils._decodeData(v3.data);
    const colorIndex = data[pixelIndex] || 0;
    return v3.colors[colorIndex] || v3.colors[v3.bg] || '#FFFFFF';
  },

  /**
   * Set pixel color
   */
  setPixel: (
    v3: DrawingData,
    pixelIndex: number,
    color: string
  ): DrawingData => {
    // Find color index (optimized lookup)
    let colorIndex = v3.colors.indexOf(color);
    if (colorIndex === -1) {
      if (v3.colors.length >= 256) {
        throw new Error('Maximum 256 colors allowed');
      }
      colorIndex = v3.colors.length;
      v3.colors.push(color);
    }

    // Decode current data efficiently
    const data = DrawingUtils._decodeData(v3.data);

    // Set pixel color
    data[pixelIndex] = colorIndex;

    return {
      ...v3,
      data: DrawingUtils._encodeData(data),
    };
  },

  /**
   * Get storage size estimate
   */
  getStorageSize: (v3: DrawingData): number => {
    // Rough estimate: colors + data + metadata
    const colorsSize = v3.colors.join('').length;
    const dataSize = v3.data.length; // Base64 encoded
    const metadataSize = 15; // bg, size
    return colorsSize + dataSize + metadataSize;
  },

  /**
   * Check if drawing is empty (all pixels are background)
   */
  isEmpty: (v3: DrawingData): boolean => {
    const data = DrawingUtils._decodeData(v3.data);
    return data.every((byte) => byte === v3.bg);
  },

  /**
   * Get total number of colored pixels (non-background)
   */
  getPixelCount: (v3: DrawingData): number => {
    const data = DrawingUtils._decodeData(v3.data);
    let count = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] !== v3.bg) count++;
    }
    return count;
  },

  /**
   * Batch operations for multiple pixels (more efficient)
   */
  setPixels: (
    v3: DrawingData,
    pixels: Array<{ index: number; color: string }>
  ): DrawingData => {
    if (pixels.length === 0) return v3;

    const data = DrawingUtils._decodeData(v3.data);
    const colors = [...v3.colors];
    const colorMap = new Map<string, number>();

    // Build color map for O(1) lookups
    colors.forEach((color, index) => {
      colorMap.set(color, index);
    });

    // Process all pixels
    for (const { index, color } of pixels) {
      let colorIndex = colorMap.get(color);
      if (colorIndex === undefined) {
        if (colors.length >= 256) {
          throw new Error('Maximum 256 colors allowed');
        }
        colorIndex = colors.length;
        colors.push(color);
        colorMap.set(color, colorIndex);
      }
      data[index] = colorIndex;
    }

    return {
      ...v3,
      colors,
      data: DrawingUtils._encodeData(data),
    };
  },

  /**
   * Get all pixel colors as a flat array (for rendering)
   */
  getAllPixelColors: (v3: DrawingData): string[] => {
    const data = DrawingUtils._decodeData(v3.data);
    const result: string[] = new Array(data.length);

    for (let i = 0; i < data.length; i++) {
      const colorIndex = data[i] || 0;
      result[i] = v3.colors[colorIndex] || v3.colors[v3.bg] || '#FFFFFF';
    }

    return result;
  },
};
