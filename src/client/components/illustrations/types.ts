import type { SVGProps } from 'react';

export type IllustrationProps = Omit<
  SVGProps<SVGSVGElement>,
  'width' | 'height'
> & {
  size?: number;
  className?: string;
  title?: string;
};
