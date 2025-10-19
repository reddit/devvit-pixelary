/**
 * Render DrawingData to canvas (bit-packed format)
 */

// Declare global variables for cross-environment compatibility
declare const atob: ((data: string) => string) | undefined;
declare const console: Console | undefined;

export function renderDrawingToCanvas(
  drawingData: { data: string; colors: string[]; bg: number; size: number },
  canvas: HTMLCanvasElement
): void {
  // Validate input data
  if (
    !drawingData ||
    typeof drawingData.data !== 'string' ||
    !Array.isArray(drawingData.colors)
  ) {
    return;
  }

  const resolution = drawingData.size || 16;
  const bgIndex = drawingData.bg || 0;
  const colors = drawingData.colors || ['#FFFFFF'];

  // Set canvas size to match drawing resolution
  canvas.width = resolution;
  canvas.height = resolution;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Disable image smoothing for crisp pixels
  ctx.imageSmoothingEnabled = false;

  // Fill background
  ctx.fillStyle = colors[bgIndex] || '#FFFFFF';
  ctx.fillRect(0, 0, resolution, resolution);

  // Validate and decode data
  let data: Uint8Array;
  try {
    if (typeof atob === 'undefined') {
      throw new Error('atob not available');
    }
    data = new Uint8Array(
      atob(drawingData.data)
        .split('')
        .map((c) => c.charCodeAt(0))
    );
  } catch (error) {
    return;
  }

  // Draw pixels
  for (let pixelIndex = 0; pixelIndex < data.length; pixelIndex++) {
    const colorIndex = data[pixelIndex] || 0;
    const color = colors[colorIndex];

    if (color && colorIndex !== bgIndex) {
      const x = pixelIndex % resolution;
      const y = Math.floor(pixelIndex / resolution);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
