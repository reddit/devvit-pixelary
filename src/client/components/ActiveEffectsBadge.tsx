import { PixelSymbol } from '@components/PixelSymbol';
import { PixelFont } from '@components/PixelFont';
import { useActiveEffects } from '@hooks/useActiveEffects';
import type { ConsumableEffect } from '@shared/consumables';

export function formatRemaining(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
}

export function ActiveEffectsBadge() {
  const { currentEffect, secondsRemaining } = useActiveEffects();

  if (!currentEffect) return null;

  const icon = getIconForEffect(currentEffect.effect);
  const formatted = formatRemaining(secondsRemaining);

  return (
    <div className="absolute top-4 left-4 z-50 flex flex-col items-center">
      <PixelSymbol type={icon} scale={3} className="text-white" />
      <div data-testid="active-effects-timer" aria-label={formatted}>
        <PixelFont scale={1.75} className="text-secondary mt-1">
          {formatted}
        </PixelFont>
      </div>
    </div>
  );
}

export function getIconForEffect(effect: ConsumableEffect): 'star' | 'clock' {
  return effect.kind === 'score_multiplier' ? 'star' : 'clock';
}
