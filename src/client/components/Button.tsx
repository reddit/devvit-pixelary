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
    'flex flex-row gap-2 items-center justify-center border-4 transition-all';

  const variantClasses = {
    primary: disabled
      ? 'bg-gray-300 border-gray-300 text-gray-500 cursor-not-allowed'
      : 'bg-black border-black text-white hover:bg-gray-800 cursor-pointer active:bg-gray-900',
    secondary: disabled
      ? 'bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed'
      : 'bg-[#56CCF2] border-black text-black hover:bg-[#4AB8D9] cursor-pointer active:bg-[#3FA3C6]',
    white: disabled
      ? 'bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed'
      : 'bg-white border-black text-black hover:bg-gray-100 cursor-pointer active:bg-gray-200',
  };

  const sizeClasses = {
    small: 'px-2 py-1.5',
    medium: 'px-2 py-[9px]',
    large: 'px-3 py-[13px]',
  };

  const fontScales = {
    small: 1,
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
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] active:shadow-none ${className}`}
      title={title}
    >
      {leadingIcon && <PixelSymbol type={leadingIcon} />}
      {children && <PixelFont scale={fontScales[size]} children={children} />}
      {trailingIcon && <PixelSymbol type={trailingIcon} />}
    </button>
  );
}
