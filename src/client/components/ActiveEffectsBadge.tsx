import { Text } from '@components/PixelFont';
import { Button } from '@components/Button';
import { Modal } from '@components/Modal';
import { useActiveEffects } from '@hooks/useActiveEffects';
import { getConsumableConfig } from '@shared/consumables';
import { useState, useMemo, useCallback } from 'react';
import {
  formatSecondsShort,
  formatSecondsTwoUnits,
} from '@shared/utils/numbers';
import { Multiplier } from './illustrations';

export function ActiveEffectsBadge() {
  const { currentEffect, secondsRemaining } = useActiveEffects();
  const [isOpen, setIsOpen] = useState(false);
  const config = useMemo(
    () => (currentEffect ? getConsumableConfig(currentEffect.itemId) : null),
    [currentEffect]
  );
  const onOpen = useCallback(() => {
    setIsOpen(true);
  }, []);
  const onClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  if (!currentEffect) return null;

  const formatted = formatSecondsShort(secondsRemaining);
  const formattedLong = formatSecondsTwoUnits(secondsRemaining);

  const badge = (
    <div
      className="absolute top-4 left-4 z-50 flex flex-col items-center cursor-pointer gap-1 animate-slide-up-fade-in"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      data-testid="active-effects-badge"
    >
      <Multiplier
        size={24}
        variant={
          currentEffect.effect.kind === 'score_multiplier' &&
          currentEffect.effect.multiplier >= 3
            ? 'triple'
            : 'double'
        }
      />
      <div data-testid="active-effects-timer" aria-label={formatted}>
        <Text className="text-tertiary">{formatted}</Text>
      </div>
    </div>
  );

  const modal = (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col items-center justify-center gap-6">
        <Multiplier
          size={48}
          variant={
            currentEffect.effect.kind === 'score_multiplier' &&
            currentEffect.effect.multiplier >= 3
              ? 'triple'
              : 'double'
          }
        />

        <div className="flex flex-col items-center justify-center gap-2">
          <Text className="text-primary">{config?.label ?? ''}</Text>
          <Text className="text-tertiary">{`${formattedLong} left`}</Text>
        </div>

        <Button onClick={onClose}>Okay</Button>
      </div>
    </Modal>
  );

  return (
    <>
      {badge}
      {modal}
    </>
  );
}
