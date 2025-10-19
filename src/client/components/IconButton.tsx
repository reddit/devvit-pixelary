import { PixelSymbol } from './PixelSymbol';
import { SupportedGlyph } from './glyphs';
import { useTelemetry } from '@client/hooks/useTelemetry';
import type { TelemetryEventType } from '@shared/types';

interface IconButtonProps {
  symbol: SupportedGlyph;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  className?: string;
  telemetryEvent?: TelemetryEventType;
}

export function IconButton({
  symbol,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  className = '',
  telemetryEvent,
}: IconButtonProps) {
  const { track } = useTelemetry();
  const baseClasses =
    'relative inline-flex items-center justify-center border-4 transition-all duration-150';

  const variantClasses = {
    primary: disabled
      ? 'bg-gray-300 border-gray-300 text-gray-500 cursor-not-allowed'
      : 'bg-black border-black text-white hover:bg-gray-800 cursor-pointer active:bg-gray-900',
    secondary: disabled
      ? 'bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed'
      : 'bg-[#56CCF2] border-black text-black hover:bg-[#4AB8D9] cursor-pointer active:bg-[#3FA3C6]',
  };

  const sizeClasses = {
    small: 'w-6 h-6',
    medium: 'w-8 h-8',
    large: 'w-10 h-10',
  };

  const fontScales = {
    small: 1,
    medium: 2,
    large: 2.5,
  };

  const shadowClasses = disabled
    ? ''
    : 'hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px]';

  const handleClick = () => {
    // Track telemetry if provided
    if (telemetryEvent) {
      track(telemetryEvent);
    }

    // Call original onClick
    onClick?.();
  };

  return (
    <button
      onClick={disabled ? undefined : handleClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${shadowClasses} shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] active:shadow-none ${className}`}
    >
      <PixelSymbol
        type={symbol}
        scale={fontScales[size]}
        color={
          variant === 'primary'
            ? disabled
              ? '#9ca3af'
              : '#ffffff'
            : disabled
              ? '#9ca3af'
              : '#000000'
        }
      />
    </button>
  );
}
