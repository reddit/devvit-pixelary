import { PixelSymbol } from '@components/PixelSymbol';
import { PixelFont } from '@components/PixelFont';
import { Button } from '@components/Button';
import { Modal } from '@components/Modal';
import { useActiveEffects } from '@hooks/useActiveEffects';
import {
  getConsumableConfig,
  getEffectDescription,
  getEffectIcon,
} from '@shared/consumables';
import { useState, useMemo, useCallback } from 'react';
import { chunkByPixelWidth } from '@client/utils/pixelText';
import { getStringWidth } from '@components/glyphs';
import {
  formatSecondsShort,
  formatSecondsTwoUnits,
} from '@shared/utils/numbers';

export { formatSecondsShort as formatRemaining } from '@shared/utils/numbers';
export { getEffectIcon as getIconForEffect } from '@shared/consumables';

export function ActiveEffectsBadge() {
  const { currentEffect, secondsRemaining } = useActiveEffects();
  const [isOpen, setIsOpen] = useState(false);
  const config = useMemo(
    () => (currentEffect ? getConsumableConfig(currentEffect.itemId) : null),
    [currentEffect?.itemId]
  );
  const onOpen = useCallback(() => setIsOpen(true), []);
  const onClose = useCallback(() => setIsOpen(false), []);
  const description = useMemo(
    () => (currentEffect ? getEffectDescription(currentEffect.effect) : ''),
    [currentEffect?.effect]
  );
  const descriptionScale = 2;
  const maxDisplayPx = 256;
  const maxBaseWidth = Math.floor(maxDisplayPx / descriptionScale);
  const descriptionLines = useMemo(
    () => chunkByPixelWidth(description, maxBaseWidth, 1, getStringWidth),
    [description, maxBaseWidth]
  );

  if (!currentEffect) return null;

  const icon = getEffectIcon(currentEffect.effect);
  const formatted = formatSecondsShort(secondsRemaining);
  const formattedLong = formatSecondsTwoUnits(secondsRemaining);

  return (
    <>
      <div
        className="absolute top-4 left-4 z-50 flex flex-col items-center cursor-pointer gap-1"
        onClick={onOpen}
        role="button"
        tabIndex={0}
        data-testid="active-effects-badge"
      >
        <PixelSymbol type={icon} scale={3} className="text-white" />
        <div data-testid="active-effects-timer" aria-label={formatted}>
          <PixelFont className="text-secondary">{formatted}</PixelFont>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={onClose}>
        <div className="flex flex-col items-center justify-center gap-6">
          <div
            className="flex flex-col items-center justify-center gap-1"
            aria-label={config?.label ?? ''}
          >
            <PixelFont scale={2.5} className="text-primary">
              {config?.label ?? ''}
            </PixelFont>
            <PixelFont className="text-tertiary">Active Effect</PixelFont>
          </div>

          <div
            className="flex flex-col items-center justify-center gap-1 text-secondary"
            aria-label={description}
            data-testid="active-effects-description"
          >
            {descriptionLines.map((line, idx) => (
              <PixelFont key={idx} className="text-secondary">
                {line}
              </PixelFont>
            ))}
          </div>

          <PixelFont className="text-tertiary">{`${formattedLong} left`}</PixelFont>

          <Button onClick={onClose}>Okay</Button>
        </div>
      </Modal>
    </>
  );
}

// getIconForEffect is re-exported above from shared
