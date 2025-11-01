import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Drawing } from './Drawing';
import { DrawingData } from '@shared/schema/drawing';
import { Icon, Text } from './PixelFont';

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  drawing: DrawingData;
  author?: string | undefined;
  children?: ReactNode;
}

export function Lightbox({
  isOpen,
  onClose,
  drawing,
  author,
  children,
}: LightboxProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const lightboxContent = (
    <div
      className="absolute inset-0 flex flex-col p-6 gap-6 items-center justify-center bg-black-90"
      onClick={onClose}
    >
      {/* Drawing container */}
      <Drawing data={drawing} size={288} />

      <div className="flex flex-col items-center justify-center gap-2 text-white">
        {/* Author (built-in) */}
        {author && <Text scale={3}>{`By u/${author}`}</Text>}

        {/* Custom metadata */}
        {children}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-0 right-0 p-6 text-white hover:text-white/50 transition-colors cursor-pointer"
      >
        <Icon type="X" scale={3} />
      </button>
    </div>
  );

  // Render the lightbox as a portal to the dedicated portal container
  const portalRoot = document.getElementById('portal-root');
  if (!portalRoot) return null;

  return createPortal(lightboxContent, portalRoot);
}
