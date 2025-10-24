import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Confetti } from './Confetti';

// Mock requestAnimationFrame
const mockRAF = vi.fn((callback: FrameRequestCallback) => {
  setTimeout(callback, 16);
  return 1;
});
const mockCancelRAF = vi.fn();

// Mock WebGL context
const mockWebGLContext = {
  createShader: vi.fn(() => ({})),
  createProgram: vi.fn(() => ({})),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  getProgramParameter: vi.fn(() => true),
  getProgramInfoLog: vi.fn(() => ''),
  useProgram: vi.fn(),
  createBuffer: vi.fn(() => ({})),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  getAttribLocation: vi.fn(() => 0),
  enableVertexAttribArray: vi.fn(),
  vertexAttribPointer: vi.fn(),
  getUniformLocation: vi.fn(() => ({})),
  uniform2f: vi.fn(),
  uniform1f: vi.fn(),
  enable: vi.fn(),
  blendFunc: vi.fn(),
  viewport: vi.fn(),
  clearColor: vi.fn(),
  clear: vi.fn(),
  drawArrays: vi.fn(),
  deleteBuffer: vi.fn(),
  deleteProgram: vi.fn(),
  deleteShader: vi.fn(),
  getShaderParameter: vi.fn(() => true),
  getShaderInfoLog: vi.fn(() => ''),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  ARRAY_BUFFER: 34962,
  STATIC_DRAW: 35044,
  FLOAT: 5126,
  BLEND: 3042,
  SRC_ALPHA: 770,
  ONE_MINUS_SRC_ALPHA: 771,
  COLOR_BUFFER_BIT: 16384,
  TRIANGLE_STRIP: 5,
  VERTEX_SHADER: 35633,
  FRAGMENT_SHADER: 35632,
  LINK_STATUS: 35714,
  COMPILE_STATUS: 35713,
};

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', mockRAF);
  vi.stubGlobal('cancelAnimationFrame', mockCancelRAF);
  vi.stubGlobal('window', {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  // Mock canvas getContext method
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    mockWebGLContext as WebGLRenderingContext
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Confetti', () => {
  it('renders nothing when not active', () => {
    render(<Confetti isActive={false} />);
    expect(screen.queryByTestId('confetti-canvas')).not.toBeInTheDocument();
  });

  it('renders canvas when active', () => {
    render(<Confetti isActive={true} />);
    const canvas = screen.getByTestId('confetti-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveClass(
      'fixed',
      'inset-0',
      'pointer-events-none',
      'z-50'
    );
  });

  it('applies correct styling', () => {
    render(<Confetti isActive={true} />);
    const canvas = screen.getByTestId('confetti-canvas');
    expect(canvas).toHaveStyle({
      imageRendering: 'pixelated',
    });
  });

  it('accepts custom pixel size', () => {
    render(<Confetti isActive={true} pixelSize={16} />);
    const canvas = screen.getByTestId('confetti-canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('accepts custom duration', () => {
    render(<Confetti isActive={true} duration={5000} />);
    const canvas = screen.getByTestId('confetti-canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('uses default props when not provided', () => {
    render(<Confetti isActive={true} />);
    const canvas = screen.getByTestId('confetti-canvas');
    expect(canvas).toBeInTheDocument();
  });
});
