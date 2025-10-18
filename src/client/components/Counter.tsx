import React, { useState, useEffect, useRef } from 'react';
import { PixelFont, PixelFontProps } from './PixelFont';
import { getFontHeight } from './glyphs';

export interface CounterProps extends Omit<PixelFontProps, 'children'> {
  value: number | null | undefined;
  fallback?: number;
}

export function Counter({
  value,
  fallback = 0,
  scale = 2,
  ...pixelFontProps
}: CounterProps) {
  const [currentValue, setCurrentValue] = useState(value ?? fallback);
  const [previousValue, setPreviousValue] = useState<number | null | undefined>(
    null
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const newValue = value ?? fallback;
    if (newValue !== currentValue) {
      // Clear any existing timeout
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      setPreviousValue(currentValue);
      setCurrentValue(newValue);
      setIsAnimating(true);

      // Clean up previous value after animation completes
      animationTimeoutRef.current = setTimeout(() => {
        setPreviousValue(null);
        setIsAnimating(false);
      }, 400); // Match animation duration
    }

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [value, currentValue, fallback]);

  const fontHeight = getFontHeight() * scale;

  const displayValue = (val: number | null | undefined) => {
    return (val ?? fallback).toString();
  };

  // Outer wrapper for masking - allow width to change
  const outerStyle: React.CSSProperties = {
    height: fontHeight,
    overflow: 'hidden',
    position: 'relative',
    display: 'inline-block',
    transition: 'width 0.4s ease-out', // Smooth width transitions
  };

  // Inner flex container that animates vertically
  const innerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.4s ease-out',
    transform: isAnimating ? `translateY(-${fontHeight}px)` : 'translateY(0px)',
  };

  return (
    <div style={outerStyle}>
      <div style={innerStyle}>
        {/* Previous value */}
        {previousValue !== null && previousValue !== undefined && (
          <PixelFont scale={scale} {...pixelFontProps}>
            {displayValue(previousValue)}
          </PixelFont>
        )}
        {/* Current value */}
        <PixelFont scale={scale} {...pixelFontProps}>
          {displayValue(currentValue)}
        </PixelFont>
      </div>
    </div>
  );
}
