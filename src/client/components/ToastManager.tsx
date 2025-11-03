import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  useMemo,
} from 'react';
import type { ReactNode } from 'react';
import { Toast } from './Toast';
import type { ToastConfig, ToastPosition } from './Toast';

export type ToastData = {
  id: string;
  timestamp: number;
  height?: number;
} & Omit<ToastConfig, 'id'>;

type ToastContextType = {
  showToast: (toast: Omit<ToastData, 'id' | 'timestamp'>) => string;
  hideToast: (id: string) => void;
  hideAllToasts: () => void;
  getToastCount: () => number;
  updateToastHeight: (id: string, height: number) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Toast queue management
type ToastQueue = {
  toasts: ToastData[];
  maxToasts: number;
};

// Production-grade toast manager with enterprise features
export function ToastProvider({
  children,
  maxToasts = 5,
  defaultPosition = 'top-right',
  defaultDuration = 4000,
}: {
  children: ReactNode;
  maxToasts?: number;
  defaultPosition?: ToastPosition;
  defaultDuration?: number;
}) {
  const [toastQueue, setToastQueue] = useState<ToastQueue>({
    toasts: [],
    maxToasts,
  });

  const toastIdCounter = useRef(0);

  // Generate unique, predictable IDs for better debugging
  const generateId = useCallback(() => {
    toastIdCounter.current += 1;
    return `toast-${Date.now()}-${toastIdCounter.current}`;
  }, []);

  // Show toast with queue management
  const showToast = useCallback(
    (toast: Omit<ToastData, 'id' | 'timestamp'>) => {
      const id = generateId();
      const newToast: ToastData = {
        ...toast,
        id,
        timestamp: Date.now(),
        duration: toast.duration ?? defaultDuration,
        position: toast.position ?? defaultPosition,
      };

      setToastQueue((prev) => {
        const updatedToasts = [...prev.toasts, newToast];

        // Enforce max toast limit by removing oldest toasts
        if (updatedToasts.length > prev.maxToasts) {
          const sortedToasts = updatedToasts
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-prev.maxToasts);
          return { ...prev, toasts: sortedToasts };
        }

        return { ...prev, toasts: updatedToasts };
      });

      return id;
    },
    [generateId, defaultDuration, defaultPosition]
  );

  // Hide specific toast
  const hideToast = useCallback((id: string) => {
    setToastQueue((prev) => ({
      ...prev,
      toasts: prev.toasts.filter((toast) => toast.id !== id),
    }));
  }, []);

  // Hide all toasts
  const hideAllToasts = useCallback(() => {
    setToastQueue((prev) => ({ ...prev, toasts: [] }));
  }, []);

  // Get current toast count
  const getToastCount = useCallback(() => {
    return toastQueue.toasts.length;
  }, [toastQueue.toasts.length]);

  // Update toast height
  const updateToastHeight = useCallback((id: string, height: number) => {
    setToastQueue((prev) => ({
      ...prev,
      toasts: prev.toasts.map((toast) =>
        toast.id === id ? { ...toast, height } : toast
      ),
    }));
  }, []);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      showToast,
      hideToast,
      hideAllToasts,
      getToastCount,
      updateToastHeight,
    }),
    [showToast, hideToast, hideAllToasts, getToastCount, updateToastHeight]
  );

  // Group toasts by position for better rendering
  const toastsByPosition = useMemo(() => {
    const groups: Record<string, ToastData[]> = {};
    toastQueue.toasts.forEach((toast) => {
      const position = toast.position ?? defaultPosition;
      groups[position] ??= [];
      groups[position].push(toast);
    });

    // Sort toasts within each position by timestamp (newest first for proper stacking)
    Object.keys(groups).forEach((position) => {
      groups[position]?.sort((a, b) => b.timestamp - a.timestamp);
    });

    return groups;
  }, [toastQueue.toasts, defaultPosition]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Render toasts grouped by position */}
      {Object.entries(toastsByPosition).map(([, toasts]) =>
        toasts.map((toast, index) => {
          // Calculate heights of previous toasts for proper stacking
          const previousToastHeights = toasts
            .slice(0, index)
            .map((prevToast) => prevToast.height ?? 80) // Default height if not measured yet
            .reverse(); // Reverse to get correct stacking order

          return (
            <Toast
              key={toast.id}
              {...toast}
              onClose={hideToast}
              index={index}
              totalToasts={toasts.length}
              previousToastHeights={previousToastHeights}
              onHeightChange={(height) => {
                updateToastHeight(toast.id, height);
              }}
            />
          );
        })
      )}
    </ToastContext.Provider>
  );
}

// Enhanced hook with additional utilities
export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Convenience hooks for common toast types
export function useToastHelpers() {
  const { showToast } = useToast();

  return {
    success: useCallback(
      (message: string, options?: Partial<ToastData>) => {
        return showToast({ message, type: 'success', ...options });
      },
      [showToast]
    ),

    error: useCallback(
      (message: string, options?: Partial<ToastData>) => {
        return showToast({
          message,
          type: 'error',
          duration: 6000,
          ...options,
        });
      },
      [showToast]
    ),

    warning: useCallback(
      (message: string, options?: Partial<ToastData>) => {
        return showToast({
          message,
          type: 'warning',
          duration: 5000,
          ...options,
        });
      },
      [showToast]
    ),

    info: useCallback(
      (message: string, options?: Partial<ToastData>) => {
        return showToast({ message, type: 'info', ...options });
      },
      [showToast]
    ),

    // Persistent toast that requires user action
    persistent: useCallback(
      (
        message: string,
        action: ToastData['action'],
        options?: Partial<ToastData>
      ) => {
        return showToast({
          message,
          type: 'warning',
          persistent: true,
          ...(action && { action }),
          ...options,
        });
      },
      [showToast]
    ),
  };
}
