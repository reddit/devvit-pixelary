import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Multiplier } from './Multiplier';

describe('Multiplier illustration', () => {
  it('renders double (2x) variant with gold highlight', () => {
    const { container } = render(<Multiplier variant="double" />);
    const gold = container.querySelector('path[fill="#F2C94C"]');
    expect(gold).toBeTruthy();
  });

  it('renders triple (3x) variant with red highlight', () => {
    const { container } = render(<Multiplier variant="triple" />);
    const red = container.querySelector('path[fill="#EB5757"]');
    expect(red).toBeTruthy();
  });
});
