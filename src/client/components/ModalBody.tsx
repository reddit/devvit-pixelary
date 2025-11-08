import type { ReactNode } from 'react';

/**
 * Shared modal body with border decorations
 */

export function ModalBody({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const borderClasses = 'absolute bg-black';
  return (
    <div
      className={`bg-white flex flex-col gap-6 p-6 items-center justify-center relative animate-slide-up-fade-in will-change-transform origin-center ${className}`}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {children}

      {/* Border Decorations */}
      <div className={`${borderClasses} -top-1 left-1 right-1 h-1`} />
      <div className={`${borderClasses} -bottom-1 left-1 right-1 h-1`} />
      <div className={`${borderClasses} top-1 -left-1 bottom-1 w-1`} />
      <div className={`${borderClasses} top-1 -right-1 bottom-1 w-1`} />
      <div className={`${borderClasses} top-0 left-0 w-1 h-1`} />
      <div className={`${borderClasses} top-0 right-0 w-1 h-1`} />
      <div className={`${borderClasses} bottom-0 left-0 w-1 h-1`} />
      <div className={`${borderClasses} bottom-0 right-0 w-1 h-1`} />
    </div>
  );
}
