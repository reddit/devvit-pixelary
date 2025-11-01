import type { IllustrationProps } from './types';

export function Stats({
  size = 12,
  title = 'Stats',
  className = '',
  ...props
}: IllustrationProps) {
  return (
    <svg
      fill="none"
      height={size}
      viewBox="0 0 12 12"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={title}
      role="img"
      {...props}
    >
      <path
        d="m11 12h-10v-6h3v-3h3v-3h4zm-6-1h2v-7h-2zm3 0h2v-10h-2zm-4-4h-2v4h2z"
        fill="#000"
        fillOpacity=".8"
      />
      <path d="m10 11h-2v-10h2z" fill="#f2c94c" />
      <path d="m7 11h-2v-7h2z" fill="#eb5757" />
      <path d="m4 11h-2v-4h2z" fill="#27ae60" />
      <path
        d="m4 11h-1v-4h1zm3 0h-1v-7h1zm3 0h-1v-10h1z"
        fill="#000"
        fillOpacity=".3"
      />
    </svg>
  );
}
