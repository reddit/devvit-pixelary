import { Text, Icon } from './PixelFont';
import { type SupportedGlyph } from './PixelFont';
import { useTelemetry } from '@client/hooks/useTelemetry';
import type { TelemetryEventType } from '@shared/types';

type ButtonProps = {
  children?: string;
  onClick?: (e: MouseEvent) => void;
  variant?: 'primary' | 'secondary' | 'white' | 'success';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  leadingIcon?: SupportedGlyph;
  trailingIcon?: SupportedGlyph;
  className?: string;
  title?: string;
  telemetryEvent?: TelemetryEventType;
};

export function Button({
  children,
  onClick,
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
    success: disabled
      ? 'bg-gray-300 text-gray-500 cursor-not-allowed border-transparent'
      : 'bg-success-background text-white hover:bg-success-background/90 cursor-pointer active:bg-success-background/80 border-transparent',
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

  const handleClick = (e: MouseEvent) => {
    // Track telemetry if provided
    if (telemetryEvent) {
      void track(telemetryEvent);
    }
    onClick?.(e);
  };

  return (
    <button
      onClick={disabled ? undefined : handleClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-pixel hover:shadow-pixel-sm active:shadow-none ${className}`}
      title={title}
    >
      {leadingIcon && <Icon type={leadingIcon} />}
      {children && <Text scale={fontScales[size]} children={children} />}
      {trailingIcon && <Icon type={trailingIcon} />}
    </button>
  );
}
