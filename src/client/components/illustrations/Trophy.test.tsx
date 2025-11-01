import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Trophy } from './Trophy';

describe('Trophy illustration', () => {
  it('renders gold variant with correct primary fill', () => {
    const { container } = render(<Trophy variant="gold" />);
    const goldPath = container.querySelector('path[fill="#f2c94c"]');
    expect(goldPath).toBeTruthy();
  });

  it('renders silver variant with correct primary fill', () => {
    const { container } = render(<Trophy variant="silver" />);
    const silverPath = container.querySelector('path[fill="#c0c0c0"]');
    expect(silverPath).toBeTruthy();
  });

  it('renders bronze variant with correct primary fill', () => {
    const { container } = render(<Trophy variant="bronze" />);
    const bronzePath = container.querySelector('path[fill="#cd7f32"]');
    expect(bronzePath).toBeTruthy();
  });
});
