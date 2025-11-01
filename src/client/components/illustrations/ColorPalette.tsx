import type { IllustrationProps } from './types';

export function ColorPalette({
  size = 12,
  title = 'Color palette',
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
      xmlnsXlink="http://www.w3.org/1999/xlink"
      className={className}
      aria-label={title}
      role="img"
      {...props}
    >
      <path
        d="m9 2h1v1h1v5h-1v1h-1v1h-1v1h-5v-1h-1v-1h-1v-4h1v-3h2v-1h5zm-2 6h1v-1h-1z"
        fill="#faecd1"
      />
      <path d="m5 5h-2v-2h2z" fill="#eb5757" />
      <path d="m8 4h-2v-2h2z" fill="#27ae60" />
      <path d="m4 8h-2v-2h2z" fill="#f2c94c" />
      <path d="m11 5h-2v-2h2z" fill="#2f80ed" />
      <path
        d="m8 12h-5v-1h5zm-5-1h-1v-1h1zm6 0h-1v-1h1zm-7-1h-1v-1h1zm9 0h-2v-1h1v-1h1zm-10-1h-1v-4h1zm6-1h1v1h-2v-2h1zm2 0h-1v-1h-1v-1h2zm3 0h-1v-5h1zm-10-3h-1v-3h1zm9-2h-1v-1h1zm-7-1h-2v-1h2zm6 0h-1v-1h1zm-1-1h-5v-1h5z"
        fill="#000"
        fillOpacity=".8"
      />
      <path
        d="m8 11h-5v-1h5zm1-1h-1v-1h1zm1-1h-1v-1h1zm1-1h-1v-5h1z"
        fill="#000"
        fillOpacity=".3"
      />
      <path d="m3 5h-1v-3h2v1h-1zm3-3h-2v-1h2z" fill="#fff" fillOpacity=".5" />
    </svg>
  );
}
