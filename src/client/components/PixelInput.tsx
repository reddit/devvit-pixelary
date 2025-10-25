import React, {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { PixelFont } from './PixelFont';
import { PixelSymbol } from './PixelSymbol';

// Animation constants
const TYPE_SPEED = 150; // ms per character
const HOLD_DURATION = 1000; // ms to hold complete text

interface PixelInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholderPhrases: string[];
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  showClearButton?: boolean;
}

interface PixelInputRef {
  focus: () => void;
  blur: () => void;
}

export const PixelInput = forwardRef<PixelInputRef, PixelInputProps>(
  (
    {
      value,
      onChange,
      placeholderPhrases,
      autoFocus = false,
      className = '',
      disabled = false,
      onKeyDown,
      showClearButton = false,
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [showCursor, setShowCursor] = useState(true);

    // Animation state - simple and clean
    const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
    const [visibleChars, setVisibleChars] = useState(0);
    const [isTyping, setIsTyping] = useState(true);

    // Expose focus/blur methods
    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
      blur: () => {
        inputRef.current?.blur();
      },
    }));

    // Handle focus/blur
    const handleFocus = () => {
      setIsFocused(true);
      setShowCursor(true);
    };

    const handleBlur = () => {
      setIsFocused(false);
      setShowCursor(false);
    };

    // Handle key events to prevent cursor movement and selection
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Prevent arrow keys, home, end, etc.
      if (
        [
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'Home',
          'End',
        ].includes(e.key)
      ) {
        e.preventDefault();
        return;
      }

      // Prevent Ctrl+A or Cmd+A (select all)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        return;
      }

      // Prevent Ctrl+C, Ctrl+V, Ctrl+X (copy, paste, cut)
      if (e.ctrlKey && ['c', 'v', 'x'].includes(e.key)) {
        e.preventDefault();
        return;
      }

      // Call the original onKeyDown if provided
      onKeyDown?.(e);
    };

    // Handle container click to focus input
    const handleContainerClick = (e: React.MouseEvent) => {
      if (!disabled && e.target === e.currentTarget) {
        inputRef.current?.focus();
      }
    };

    // Handle clear button click
    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (inputRef.current) {
        // Create a synthetic change event to clear the input
        const syntheticEvent = {
          target: { value: '' },
          currentTarget: { value: '' },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
        inputRef.current.focus();
      }
    };

    // Cursor blink animation
    useEffect(() => {
      if (!isFocused) return;

      const interval = setInterval(() => {
        setShowCursor((prev) => !prev);
      }, 530);

      return () => clearInterval(interval);
    }, [isFocused]);

    // Auto-scroll to keep the end of text visible
    useEffect(() => {
      if (!scrollContainerRef.current || !value) return;

      const containerWidth = scrollContainerRef.current.clientWidth;
      const padding = 16; // px-4 = 16px

      // Calculate text width using simple estimation
      const estimatedWidth = value.length * 8; // Rough estimate: 8px per character
      const textWidth = estimatedWidth;

      // Scroll to show the end of the text
      if (textWidth + padding > containerWidth) {
        const targetPosition = textWidth - containerWidth + padding + 8; // 8px for cursor space
        scrollContainerRef.current.scrollTo({
          left: Math.max(0, targetPosition),
          behavior: 'smooth',
        });
      } else {
        scrollContainerRef.current.scrollTo({
          left: 0,
          behavior: 'smooth',
        });
      }
    }, [value]);

    // Character-by-character typing animation
    useEffect(() => {
      // Early exit if user has typed or no phrases to animate
      if (value || placeholderPhrases.length === 0) return;

      const currentPhrase = placeholderPhrases[currentPhraseIndex];
      if (!currentPhrase) return;

      let timeoutId: ReturnType<typeof setTimeout>;

      if (isTyping) {
        // Typing phase - add characters one by one
        if (visibleChars < currentPhrase.length) {
          timeoutId = setTimeout(() => {
            setVisibleChars((prev) => prev + 1);
          }, TYPE_SPEED);
        } else {
          // Finished typing, hold for a moment
          timeoutId = setTimeout(() => {
            setIsTyping(false);
          }, HOLD_DURATION);
        }
      } else {
        // Erasing phase - remove characters one by one
        if (visibleChars > 0) {
          timeoutId = setTimeout(() => {
            setVisibleChars((prev) => prev - 1);
          }, TYPE_SPEED / 4); // Erase much faster than typing
        } else {
          // Finished erasing, move to next phrase
          setCurrentPhraseIndex(
            (prev) => (prev + 1) % placeholderPhrases.length
          );
          setIsTyping(true);
        }
      }

      return () => clearTimeout(timeoutId);
    }, [value, placeholderPhrases, currentPhraseIndex, visibleChars, isTyping]);

    return (
      <div
        className={`
         relative w-full bg-white border-4 border-black cursor-text
         shadow-pixel
         ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
         ${className}
       `.trim()}
        onClick={handleContainerClick}
        style={{
          // Mobile-specific styles
          WebkitUserSelect: 'none', // Prevent container text selection
          userSelect: 'none',
          touchAction: 'manipulation', // Optimize touch interactions
        }}
        onMouseDown={(e) => {
          // Ensure input gets focus on any click within container
          if (!disabled && e.target !== inputRef.current) {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
      >
        {/* Content area with proper layout */}
        <div className="flex items-center h-[40px] pl-4 pr-1 relative">
          {/* Text content area with input overlay */}
          <div
            ref={scrollContainerRef}
            className="flex items-center gap-1 flex-1 overflow-hidden relative"
          >
            {/* Interactive input for keyboard handling - only covers text area */}
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={onChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              autoFocus={autoFocus}
              disabled={disabled}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              inputMode="text"
              className="absolute inset-0 cursor-text"
              style={{
                fontSize: '16px', // Prevent zoom on iOS
                userSelect: 'none', // Disable text selection
                WebkitUserSelect: 'none', // Safari
                WebkitTouchCallout: 'none', // Disable iOS selection handles
                color: 'transparent', // Hide text
                background: 'transparent', // Transparent background
                border: 'none', // Remove border
                outline: 'none', // Remove focus outline
                caretColor: 'transparent', // Hide cursor
              }}
            />
            {value ? (
              <>
                <PixelFont scale={2}>{value}</PixelFont>
                {/* Blinking cursor - always at the end */}
                {isFocused && showCursor && (
                  <div className="w-1 h-6 bg-brand-orangered animate-pulse" />
                )}
              </>
            ) : (
              <>
                {/* Character-by-character animated placeholder */}
                <div className="text-brand-weak">
                  <PixelFont scale={2}>
                    {placeholderPhrases[currentPhraseIndex]?.slice(
                      0,
                      visibleChars
                    ) || ''}
                  </PixelFont>
                </div>
              </>
            )}
          </div>

          {/* Cursor for placeholder - positioned outside the clipped container */}
          {!value && isFocused && showCursor && (
            <div className="w-1 h-6 bg-brand-orangered animate-pulse absolute left-4 top-1/2 transform -translate-y-1/2" />
          )}

          {/* Clear button - only show when there's text and showClearButton is true */}
          {value && showClearButton && (
            <button
              onClick={handleClear}
              className="w-8 h-8 bg-black border-2 border-black flex items-center justify-center hover:bg-gray-800 transition-colors"
              type="button"
            >
              <PixelSymbol type="X" className="text-white" scale={2} />
            </button>
          )}
        </div>
      </div>
    );
  }
);

PixelInput.displayName = 'PixelInput';
