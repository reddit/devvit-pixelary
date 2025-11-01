import type { IllustrationProps } from './types';

export function Drawings({
  size = 12,
  title = 'Drawings',
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
        d="m9 10v-1h1v-6h-1v-1h-6v1h-1v6h1v1zm1 1h-8v-1h-1v-8h1v-1h8v1h1v8h-1z"
        fill="#faecd1"
      />
      <path d="m9 4h-2v-1h2z" fill="#e1bb48" />
      <path
        d="m10 12h-8v-1h8zm-8-1h-1v-1h1zm9 0h-1v-1h1zm-10-1h-1v-8h1zm8 0h-6v-1h6zm3 0h-1v-8h1zm-9-4h1v1h-1v2h-1v-6h1zm7 3h-1v-1h-1v-1h1v-4h1zm-2-2h-1v-1h1zm-3-1h-1v-1h1zm2 0h-1v-1h1zm-1-1h-1v-1h1zm3-2h-6v-1h6zm-7-1h-1v-1h1zm9 0h-1v-1h1zm-1-1h-8v-1h8z"
        fill="#000"
        fillOpacity=".8"
      />
      <path d="m6 6h1v1h1v1h1v1h-6v-2h1v-1h1v-1h1z" fill="#27ae60" />
      <path d="m7 4h2v3h-1v-1h-1v-1h-1v-1h-1v1h-1v1h-1v-3h4z" fill="#2f80ed" />
      <path
        d="m2 2v-1h2v1h-1v1h-1v3h-1v-4zm7 4h-1v-1h1zm-5-2h-1v-1h1z"
        fill="#fff"
        fillOpacity=".5"
      />
      <path
        d="m11 10h-1v1h-8v-2h1v1h6v-1h1v-6h-1v-1h2zm-2-1h-1v-1h1zm-1-1h-1v-1h1zm-1-1h-1v-1h1zm-1-1h-1v-1h1z"
        fill="#000"
        fillOpacity=".3"
      />
    </svg>
  );
}
