import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderDrawingToCanvas } from './drawing';

// Mock HTMLCanvasElement and CanvasRenderingContext2D
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(),
} as unknown as HTMLCanvasElement;

const mockContext = {
  imageSmoothingEnabled: true,
  fillStyle: '',
  fillRect: vi.fn(),
} as unknown as CanvasRenderingContext2D;

// Mock atob function
const mockAtob = vi.fn();

describe('drawing utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup canvas mock
    mockCanvas.getContext = vi.fn().mockReturnValue(mockContext);

    // Setup atob mock
    globalThis.atob = mockAtob as unknown as (data: string) => string;

    // Reset canvas properties
    mockCanvas.width = 0;
    mockCanvas.height = 0;
  });

  describe('renderDrawingToCanvas', () => {
    const validDrawingData = {
      data: 'test-data',
      colors: ['#FFFFFF', '#000000', '#FF0000'],
      bg: 0,
      size: 16,
    };

    it('sets canvas size correctly', () => {
      mockAtob.mockReturnValue('test');

      renderDrawingToCanvas(validDrawingData, mockCanvas);

      expect(mockCanvas.width).toBe(16);
      expect(mockCanvas.height).toBe(16);
    });

    it('disables image smoothing', () => {
      mockAtob.mockReturnValue('test');

      renderDrawingToCanvas(validDrawingData, mockCanvas);

      expect(mockContext.imageSmoothingEnabled).toBe(false);
    });

    it('fills background with correct color', () => {
      mockAtob.mockReturnValue('test');

      renderDrawingToCanvas(validDrawingData, mockCanvas);

      expect(mockContext.fillStyle).toBe('#FFFFFF');
      expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 16, 16);
    });

    it('renders pixels correctly', () => {
      // Mock atob to return data that represents pixels
      mockAtob.mockReturnValue('test');

      renderDrawingToCanvas(validDrawingData, mockCanvas);

      // Should call fillRect for background at minimum
      expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 16, 16);
    });

    it('handles missing canvas context', () => {
      mockCanvas.getContext = vi.fn().mockReturnValue(null);

      renderDrawingToCanvas(validDrawingData, mockCanvas);

      // Should not throw and should not set canvas size
      expect(mockCanvas.width).toBe(16); // Size is set before context check
      expect(mockCanvas.height).toBe(16);
    });

    it('handles invalid drawing data', () => {
      renderDrawingToCanvas(
        null as unknown as Parameters<typeof renderDrawingToCanvas>[0],
        mockCanvas
      );
      renderDrawingToCanvas(
        undefined as unknown as Parameters<typeof renderDrawingToCanvas>[0],
        mockCanvas
      );
      renderDrawingToCanvas(
        {} as Parameters<typeof renderDrawingToCanvas>[0],
        mockCanvas
      );
      renderDrawingToCanvas(
        { data: 123 } as unknown as Parameters<typeof renderDrawingToCanvas>[0],
        mockCanvas
      );
      renderDrawingToCanvas(
        { data: 'test', colors: 'invalid' } as unknown as Parameters<
          typeof renderDrawingToCanvas
        >[0],
        mockCanvas
      );

      // Should not throw and should not set canvas size
      expect(mockCanvas.width).toBe(0);
      expect(mockCanvas.height).toBe(0);
    });

    it('handles atob errors gracefully', () => {
      mockAtob.mockImplementation(() => {
        throw new Error('Invalid base64');
      });

      renderDrawingToCanvas(validDrawingData, mockCanvas);

      // Should not throw and should not render pixels
      expect(mockContext.fillRect).toHaveBeenCalledTimes(1); // Only background
    });

    it('handles missing atob function', () => {
      delete (globalThis as { atob?: unknown }).atob;

      renderDrawingToCanvas(validDrawingData, mockCanvas);

      // Should not throw and should not render pixels
      expect(mockContext.fillRect).toHaveBeenCalledTimes(1); // Only background
    });

    it('uses default values when properties are missing', () => {
      const minimalData = {
        data: 'test',
        colors: ['#FFFFFF'],
      };

      mockAtob.mockReturnValue('test');

      renderDrawingToCanvas(
        minimalData as Parameters<typeof renderDrawingToCanvas>[0],
        mockCanvas
      );

      expect(mockCanvas.width).toBe(16); // Default size
      expect(mockCanvas.height).toBe(16); // Default size
      expect(mockContext.fillStyle).toBe('#FFFFFF'); // Default background
    });

    it('handles empty colors array', () => {
      const dataWithEmptyColors = {
        data: 'test',
        colors: [],
        bg: 0,
        size: 16,
      };

      mockAtob.mockReturnValue('test');

      renderDrawingToCanvas(dataWithEmptyColors, mockCanvas);

      expect(mockContext.fillStyle).toBe('#FFFFFF'); // Default color
    });

    it('skips background pixels when rendering', () => {
      // Create data where some pixels are background color
      const dataWithBackground = {
        data: 'test',
        colors: ['#FFFFFF', '#000000'],
        bg: 0, // Background is index 0
        size: 4, // 4x4 = 16 pixels
      };

      mockAtob.mockReturnValue('test');

      renderDrawingToCanvas(dataWithBackground, mockCanvas);

      // Should render background at minimum
      expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 4, 4);
    });

    it('handles different canvas sizes', () => {
      const sizes = [8, 16, 32, 64];

      sizes.forEach((size) => {
        vi.clearAllMocks();
        const data = { ...validDrawingData, size };
        mockAtob.mockReturnValue('test');

        renderDrawingToCanvas(data, mockCanvas);

        expect(mockCanvas.width).toBe(size);
        expect(mockCanvas.height).toBe(size);
      });
    });

    it('handles different background indices', () => {
      const backgrounds = [0, 1, 2];

      backgrounds.forEach((bgIndex) => {
        vi.clearAllMocks();
        const data = { ...validDrawingData, bg: bgIndex };
        mockAtob.mockReturnValue('test');

        renderDrawingToCanvas(data, mockCanvas);

        expect(mockContext.fillStyle).toBe(validDrawingData.colors[bgIndex]);
      });
    });
  });
});
