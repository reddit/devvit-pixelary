import type { IllustrationProps } from './types';

type TrophyVariant = 'gold' | 'silver' | 'bronze';

export function Trophy({
  variant = 'gold',
  size = 12,
  title,
  className = '',
  ...props
}: IllustrationProps & { variant?: TrophyVariant }) {
  // Metal colors
  const fillColors: Record<TrophyVariant, string> = {
    gold: '#f2c94c',
    silver: '#c0c0c0',
    bronze: '#cd7f32',
  };

  return (
    <svg
      fill="none"
      height={size}
      width={size}
      viewBox="0 0 12 12"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      className={className}
      aria-label={title ?? `${variant} trophy`}
      role="img"
      {...props}
    >
      <path
        d="m9 11h-6v-1h6zm-2-2h-2v-2h2zm2-4h-1v1h-4v-1h-1v-4h6zm-7-1h-1v-2h1zm9 0h-1v-2h1z"
        fill={fillColors[variant]}
      />
      <path
        d="m3 11h6v-1h1v2h-8v-2h1zm7-10h2v3h-1v-2h-1v2h1v1h-1v1h-1v1h-1v2h1v1h-6v-1h1v-2h-1v-1h-1v-1h-1v-1h1v-2h-1v2h-1v-3h2v-1h8zm-5 8h2v-2h-2zm-2-4h1v1h4v-1h1v-4h-6z"
        fill="#000"
        fillOpacity=".8"
      />
      <path d="m5 3h-1v-2h1z" fill="#fff" fillOpacity=".5" />
      <path
        d="m9 11h-2v-1h2zm-2-2h-1v-2h1zm1-3h-1v-1h1zm1-1h-1v-4h1zm2-1h-1v-2h1z"
        fill="#000"
        fillOpacity=".3"
      />
    </svg>
  );
}
