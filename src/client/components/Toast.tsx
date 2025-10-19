import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { PixelFont } from './PixelFont';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'bottom-center';

export interface ToastConfig {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
  position?: ToastPosition;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  attachment?: ReactNode;
  onClose?: () => void;
  onAction?: () => void;
}

interface ToastProps extends Omit<ToastConfig, 'onClose'> {
  onClose: (id: string) => void;
  index: number;
  totalToasts: number;
}

// Production-grade ID generation using crypto API
// const generateToastId = (): string => {
//   if (typeof crypto !== 'undefined' && crypto.randomUUID) {
//     return crypto.randomUUID();
//   }
//   // Fallback for older browsers
//   return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
// };

// Toast configuration constants
const TOAST_CONFIG = {
  DEFAULT_DURATION: 4000,
  ANIMATION_DURATION: 300,
  MAX_TOASTS: 5,
  STACK_OFFSET: 80, // Increased for proper spacing (80px = 5rem)
  Z_INDEX_BASE: 1000,
} as const;

// Accessibility configuration
const ARIA_CONFIG = {
  ROLE: 'alert',
  LIVE_REGION: 'polite',
} as const;

export function Toast({
  id,
  message,
  type = 'info',
  duration = TOAST_CONFIG.DEFAULT_DURATION,
  position = 'top-right',
  persistent = false,
  action,
  attachment,
  onClose,
  index,
  totalToasts: _totalToasts,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastRef = useRef<HTMLDivElement>(null);

  // Memoized styles for performance
  const toastStyles = useMemo(() => {
    const baseStyles = `
      fixed max-w-sm cursor-pointer
      bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]
      transition-all duration-${TOAST_CONFIG.ANIMATION_DURATION} ease-out
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    `;

    const positionStyles = {
      'top-right': `top-4 right-4`,
      'top-left': `top-4 left-4`,
      'bottom-right': `bottom-4 right-4`,
      'bottom-left': `bottom-4 left-4`,
      'top-center': `top-4 left-1/2`,
      'bottom-center': `bottom-4 left-1/2`,
    };

    // Calculate proper stacking offset using CSS transforms
    // const stackOffset = index > 0 ? TOAST_CONFIG.STACK_OFFSET * index : 0;
    const visibilityStyles =
      isVisible && !isExiting
        ? 'opacity-100 translate-x-0'
        : 'opacity-0 translate-x-full';

    return `${baseStyles} ${positionStyles[position]} ${visibilityStyles}`;
  }, [position, index, isVisible, isExiting]);

  // Calculate dynamic positioning for stacking
  const dynamicPosition = useMemo(() => {
    const basePosition = {
      'top-right': { top: 16, right: 16 },
      'top-left': { top: 16, left: 16 },
      'bottom-right': { bottom: 16, right: 16 },
      'bottom-left': { bottom: 16, left: 16 },
      'top-center': { top: 16, left: '50%', transform: 'translateX(-50%)' },
      'bottom-center': {
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
      },
    }[position];

    // Add stacking offset
    const stackOffset = index * TOAST_CONFIG.STACK_OFFSET;

    if (position.includes('top')) {
      return {
        ...basePosition,
        top: (basePosition.top as number) + stackOffset,
      };
    } else if (position.includes('bottom')) {
      return {
        ...basePosition,
        bottom: (basePosition.bottom as number) + stackOffset,
      };
    }

    return basePosition;
  }, [position, index]);

  const typeStyles = useMemo(() => {
    // Use neutral style for all toast types
    return 'bg-white border-black text-black';
  }, [type]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }
  }, []);

  // Handle toast dismissal
  const handleDismiss = useCallback(() => {
    if (isExiting) return;

    setIsExiting(true);
    exitTimeoutRef.current = setTimeout(() => {
      onClose(id);
    }, TOAST_CONFIG.ANIMATION_DURATION);
  }, [id, onClose, isExiting]);

  // Handle action click
  const handleAction = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      action?.onClick();
    },
    [action]
  );

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      } else if (e.key === 'Enter' && action) {
        handleAction(e as unknown as React.MouseEvent);
      }
    },
    [handleDismiss, handleAction, action]
  );

  // Auto-dismiss timer
  useEffect(() => {
    if (persistent) return;

    timeoutRef.current = setTimeout(() => {
      handleDismiss();
    }, duration);

    return cleanup;
  }, [duration, persistent, handleDismiss, cleanup]);

  // Show toast on mount
  useEffect(() => {
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 10); // Small delay for smooth animation

    return () => clearTimeout(showTimer);
  }, []);

  // Focus management for accessibility
  useEffect(() => {
    if (isVisible && toastRef.current) {
      toastRef.current.focus();
    }
  }, [isVisible]);

  const toastContent = (
    <div
      ref={toastRef}
      className={`${toastStyles} ${typeStyles}`}
      style={{
        zIndex: TOAST_CONFIG.Z_INDEX_BASE + index,
        ...dynamicPosition,
      }}
      onClick={handleDismiss}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role={ARIA_CONFIG.ROLE}
      aria-live={ARIA_CONFIG.LIVE_REGION}
      aria-label={`${type} notification: ${message}`}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-3 p-4">
          <PixelFont scale={2} className="flex-1">
            {message}
          </PixelFont>
          {action && (
            <button
              onClick={handleAction}
              className="ml-2 px-2 py-1 bg-black text-white text-xs hover:bg-gray-800 transition-colors"
              aria-label={`${action.label} action`}
            >
              {action.label}
            </button>
          )}
        </div>
        {attachment && (
          <div className="border-t-2 border-black px-4 pb-4">{attachment}</div>
        )}
      </div>
    </div>
  );

  const portalRoot = document.getElementById('portal-root');
  if (!portalRoot) {
    console.error('Toast: portal-root element not found');
    return null;
  }

  return createPortal(toastContent, portalRoot);
}
