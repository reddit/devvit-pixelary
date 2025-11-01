import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Text } from './PixelFont';
import { ModalScrim } from './ModalScrim';
import { ModalBody } from './ModalBody';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
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
    <ModalScrim onClick={onClose}>
      <ModalBody>
        {/* Header */}
        {title && (
          <div className="flex justify-start" aria-label={title}>
            <Text scale={2}>{title}</Text>
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col items-start justify-start text-secondary gap-6">
          {children}
        </div>
      </ModalBody>
    </ModalScrim>
  );

  // Render the modal as a portal to the dedicated portal container
  const portalRoot = document.getElementById('portal-root');
  if (!portalRoot) return null;

  return createPortal(modalContent, portalRoot);
}
