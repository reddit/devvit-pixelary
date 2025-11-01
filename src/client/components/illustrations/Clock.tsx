import type { IllustrationProps } from './types';

export function Clock({
  size = 12,
  title = 'Clock',
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
        d="m9 2h1v1h1v6h-1v1h-1v1h-6v-1h-1v-1h-1v-6h1v-1h1v-1h6z"
        fill="#faecd1"
      />
      <path
        d="m9 12h-6v-1h6zm-6-1h-1v-1h1zm7 0h-1v-1h1zm-8-1h-1v-1h1zm9 0h-1v-1h1zm-10-1h-1v-6h1zm11 0h-1v-6h1zm-6-3h2v1h-3v-5h1zm-4-3h-1v-1h1zm9 0h-1v-1h1zm-8-1h-1v-1h1zm7 0h-1v-1h1zm-1-1h-6v-1h6z"
        fill="#000"
        fillOpacity=".8"
      />
      <path
        d="m5 11h-2v-1h2zm4 0h-3v-1h3zm1-1h-1v-1h1zm1-1h-1v-2h1zm-9-2h-1v-1h1zm9-1h-1v-3h1z"
        fill="#000"
        fillOpacity=".3"
      />
      <path
        d="m2 5h-1v-2h1zm1-2h-1v-1h1zm2-1h-2v-1h2z"
        fill="#fff"
        fillOpacity=".5"
      />
    </svg>
  );
}
