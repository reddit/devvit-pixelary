import { PixelFont } from '@components/PixelFont';
import { CardLayout } from './CardLayout';

interface HowToPlayProps {
  onClose: () => void;
}

export function HowToPlay({ onClose }: HowToPlayProps) {
  return (
    <CardLayout title="How to play" onClose={onClose}>
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
