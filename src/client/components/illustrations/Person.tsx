import type { IllustrationProps } from './types';

export function Person({
  size = 12,
  title = 'Person',
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
      <path d="m10 2h1v8h-1v1h-8v-1h-1v-8h1v-1h8z" fill="#f2c94c" />
      <path d="m8 9h-4v-1h4zm-4-1h-1v-1h1zm5 0h-1v-1h1zm-4-2h-2v-2h2zm4 0h-2v-2h2z" />
      <path
        d="m10 12h-8v-1h8zm-8-1h-1v-1h1zm9 0h-1v-1h1zm-10-1h-1v-8h1zm11 0h-1v-8h1zm-10-8h-1v-1h1zm9 0h-1v-1h1zm-1-1h-8v-1h8z"
        fillOpacity=".8"
        fill="#000"
      />
      <path d="m10 11h-8v-1h7v-1h1v-7h1v8h-1z" fillOpacity=".3" fill="#000" />
      <path d="m2 6h-1v-4h1zm2-4h-2v-1h2z" fill="#fff" fillOpacity=".5" />
    </svg>
  );
}
