import type { IllustrationProps } from './types';

export function Draw({
  size = 12,
  title = 'Draw',
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
        d="m9 3h1v1h-1v1h-1v1h-1v1h-1v-1h-1v-1h1v-1h1v-1h1v-1h1z"
        fill="#f2c94c"
      />
      <path d="m11 3h-1v-1h1zm-1-1h-1v-1h1z" fill="#eb5757" />
      <path
        d="m8 2h-1v1h-1v1h-1v1h-1v1h-1v3h3v-1h1v-1h1v-1h1v-1h1v-1h1v6h-1v1h-8v-1h-1v-8h1v-1h6zm-3 5h1v1h-2v-2h1z"
        fill="#faecd1"
      />
      <path
        d="m10 12h-8v-1h8zm-8-1h-1v-1h1zm9 0h-1v-1h1zm-10-1h-1v-8h1zm11 0h-1v-6h-1v-1h1v-1h1zm-8-2h2v1h-3v-3h1zm3 0h-1v-1h1zm-1-1h-1v-1h1zm2 0h-1v-1h1zm-3-1h-1v-1h1zm4 0h-1v-1h1zm-3-1h-1v-1h1zm4 0h-1v-1h1zm-3-1h-1v-1h1zm1-1h-1v-1h1zm2 0h-1v-1h1zm-8-1h-1v-1h1zm8-1h-1v1h-1v-1h-6v-1h8zm1 1h-1v-1h1z"
        fill="#000"
        fillOpacity=".8"
      />
      <path
        d="m10 11h-7v-1h6v-1h1v-5h1v6h-1zm-5-4h1v1h-2v-2h1zm2 0h-1v-1h1zm1-1h-1v-1h1zm1-1h-1v-1h1zm1-1h-1v-1h1zm1-1h-1v-1h1z"
        fill="#000"
        fillOpacity=".3"
      />
      <path d="m2 6h-1v-4h1zm2-4h-2v-1h2z" fill="#fff" fillOpacity=".5" />
    </svg>
  );
}
