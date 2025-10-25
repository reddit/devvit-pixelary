import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PixelFont } from './PixelFont';

interface ModalProps {
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
      className="fixed inset-0 flex items-center p-2 justify-center bg-black-70"
      onClick={onClose}
    >
      {/* Modal container */}
      <div
        className="bg-white flex flex-col gap-4 p-5 justify-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-start">
          <PixelFont scale={2}>{title}</PixelFont>
        </div>

        {/* Content */}
        <div className="flex flex-col items-start justify-start text-secondary gap-6">
          {children}
        </div>

        {/* Border Decoration - Top Bar */}
        <div className="absolute -top-1 left-1 right-1 h-1 bg-black" />
        {/* Border Decoration - Bottom Bar */}
        <div className="absolute -bottom-1 left-1 right-1 h-1 bg-black" />
        {/* Border Decoration - Left Bar */}
        <div className="absolute top-1 -left-1 bottom-1 w-1 bg-black" />
        {/* Border Decoration - Right Bar */}
        <div className="absolute top-1 -right-1 bottom-1 w-1 bg-black" />
        {/* Border Decoration - Top Left Corner */}
        <div className="absolute top-0 left-0 w-1 h-1 bg-black" />
        {/* Border Decoration - Top Right Corner */}
        <div className="absolute top-0 right-0 w-1 h-1 bg-black" />
        {/* Border Decoration - Bottom Left Corner */}
        <div className="absolute bottom-0 left-0 w-1 h-1 bg-black" />
        {/* Border Decoration - Bottom Right Corner */}
        <div className="absolute bottom-0 right-0 w-1 h-1 bg-black" />
      </div>
    </div>
  );

  // Render the modal as a portal to the dedicated portal container
  const portalRoot = document.getElementById('portal-root');
  if (!portalRoot) return null;

  return createPortal(modalContent, portalRoot);
}
