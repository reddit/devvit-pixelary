import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PixelFont } from './PixelFont';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
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

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center p-2 justify-center bg-black/85"
      onClick={onClose}
    >
      {/* Modal container */}
      <div
        className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.3)] w-full max-w-xs flex flex-col gap-6 p-6 items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <PixelFont scale={2.5}>{title}</PixelFont>

        {/* Content */}
        <div className="flex flex-col items-start justify-start text-[var(--color-brand-secondary)] gap-6">
          {children}
        </div>
      </div>
    </div>
  );

  // Render the modal as a portal to the dedicated portal container
  const portalRoot = document.getElementById('portal-root');
  if (!portalRoot) return null;

  return createPortal(modalContent, portalRoot);
}
