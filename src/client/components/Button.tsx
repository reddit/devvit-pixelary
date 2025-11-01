import { PixelFont } from './PixelFont';
import { PixelSymbol } from './PixelSymbol';
import { type SupportedGlyph } from './glyphs';
import { useTelemetry } from '@client/hooks/useTelemetry';
import type { TelemetryEventType } from '@shared/types';

interface ButtonProps {
  children?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'white';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  leadingIcon?: SupportedGlyph;
  trailingIcon?: SupportedGlyph;
  className?: string;
  title?: string;
  telemetryEvent?: TelemetryEventType;
}

export function Button({
  children,
  onClick = () => {},
  variant = 'primary',
  size = 'medium',
  disabled = false,
  leadingIcon,
  trailingIcon,
  className = '',
  title,
  telemetryEvent,
}: ButtonProps) {
  const { track } = useTelemetry();
  const baseClasses =
    'flex flex-row gap-2 items-center justify-center transition-all border-4';

  const variantClasses = {
    primary: disabled
      ? 'bg-gray-300 text-gray-500 cursor-not-allowed border-transparent'
      : 'bg-black text-white hover:bg-gray-800 cursor-pointer active:bg-gray-900 border-transparent',
    secondary: disabled
      ? 'bg-gray-200 border-4 border-gray-300 text-gray-500 cursor-not-allowed'
      : 'bg-background border-4 border-black text-black hover:bg-background/90 cursor-pointer active:bg-background/80',
    white: disabled
      ? 'bg-gray-200 border-4 border-gray-300 text-gray-500 cursor-not-allowed'
      : 'bg-white border-4 border-black text-black hover:bg-gray-100 cursor-pointer active:bg-gray-200',
  };

  const sizeClasses = {
    small: 'px-2 py-[5px]',
    medium: 'px-2 py-[9px]',
    large: 'px-3 py-[13px]',
  };

  const fontScales = {
    small: 2,
    medium: 2,
    large: 2,
  };

  const handleClick = () => {
    // Track telemetry if provided
    if (telemetryEvent) {
      void track(telemetryEvent);
    }

    // Call original onClick
    onClick();
  };

  return (
    <button
      onClick={disabled ? undefined : handleClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-pixel hover:shadow-pixel-sm active:shadow-none ${className}`}
      title={title}
    >
      {leadingIcon && <PixelSymbol type={leadingIcon} />}
      {children && <PixelFont scale={fontScales[size]} children={children} />}
      {trailingIcon && <PixelSymbol type={trailingIcon} />}
    </button>
  );
}
