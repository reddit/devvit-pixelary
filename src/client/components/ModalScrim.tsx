import type { ReactNode } from 'react';

/**
 * Shared modal scrim (backdrop)
 */

export function ModalScrim({
  onClick,
  persistent = false,
  children,
  className = '',
}: {
  onClick?: () => void;
  persistent?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`absolute inset-0 flex items-center p-2 justify-center bg-black/70 pointer-events-auto z-[200] ${className}`}
      onClick={persistent ? undefined : onClick}
    >
      {children}
    </div>
  );
}
