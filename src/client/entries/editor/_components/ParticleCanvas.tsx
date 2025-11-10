import type { RefObject } from 'react';

type ParticleCanvasProps = {
  className?: string;
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

export function ParticleCanvas(props: ParticleCanvasProps) {
  const { className, canvasRef } = props;
  return <canvas ref={canvasRef} className={className} />;
}
