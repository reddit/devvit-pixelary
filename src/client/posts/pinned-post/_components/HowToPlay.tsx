import { PixelFont } from '@components/PixelFont';
import { CardLayout } from './CardLayout';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useEffect } from 'react';

interface HowToPlayProps {
  onClose: () => void;
}

export function HowToPlay({ onClose }: HowToPlayProps) {
  // Telemetry
  const { track } = useTelemetry();
  useEffect(() => {
    void track('view_how_to_play');
  }, []);

  return (
    <CardLayout title="How to Play" onClose={onClose}>
      <PixelFont scale={3}>Draw words</PixelFont>
      <div className="h-1" />
      <PixelFont scale={3}>for others</PixelFont>
      <div className="h-4" />
      <PixelFont scale={2} className="text-slate-600">
        Earn points if they
      </PixelFont>
      <div className="h-1" />
      <PixelFont scale={2} className="text-slate-600">
        guess correctly!
      </PixelFont>
    </CardLayout>
  );
}
