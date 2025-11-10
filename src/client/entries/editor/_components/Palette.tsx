import { useEffect, useMemo, useRef, useState } from 'react';
import type { HEX } from '@shared/types';
import { getAllAvailableColors } from '@client/constants';
import { useRecentColors } from '../_hooks/useRecentColors';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { ColorSwatch } from './ColorSwatch';
import { ColorPickerButton } from './ColorPickerButton';
import { ColorPickerModal } from './ColorPickerModal';
import { useFlipRecentTiles } from '../_hooks/useFlipRecentTiles';

type PaletteProps = {
  userLevel: number;
  isReviewing?: boolean;
  hasEntered: boolean;
  onColorChange: (color: HEX) => void;
};

export function Palette(props: PaletteProps) {
  const { userLevel, isReviewing = false, hasEntered, onColorChange } = props;

  const paletteRef = useRef<HTMLDivElement>(null);
  const {
    currentColor,
    setCurrentColor,
    recentColors,
    updateRecentWithDrama,
    isMRUAnimating,
    suppressInitialAnim,
  } = useRecentColors(paletteRef);
  const { track } = useTelemetry();

  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const handleOpenColorPicker = () => {
    void track('click_color_picker_plus');
    setIsColorPickerOpen(true);
  };
  const handleCloseColorPicker = () => {
    setIsColorPickerOpen(false);
  };
  const handleSelectExtendedColor = (color: HEX) => {
    void track('select_extended_color');
    setCurrentColor(color);
    setIsColorPickerOpen(false);
    updateRecentWithDrama(color);
  };

  // Notify parent when current color changes
  useEffect(() => {
    onColorChange(currentColor);
  }, [currentColor, onColorChange]);

  const allowedColorsSet = useMemo(
    () => new Set(getAllAvailableColors(userLevel)),
    [userLevel]
  );

  // Activate FLIP for the recent palette (depends on recentColors array content)
  useFlipRecentTiles(
    paletteRef,
    [recentColors, userLevel, currentColor, suppressInitialAnim],
    {
      selectedKey: currentColor,
      suppress: suppressInitialAnim,
    }
  );

  // Close picker if review mode toggles on
  useEffect(() => {
    if (isReviewing) {
      setIsColorPickerOpen(false);
    }
  }, [isReviewing]);

  return (
    <div
      className={`fixed bottom-6 left-0 right-0 z-20 flex flex-col items-center gap-2 transition-all duration-300 ease-out delay-150 ${
        isReviewing
          ? '-translate-y-4 opacity-0'
          : hasEntered
            ? 'translate-y-0 opacity-100'
            : 'translate-y-2 opacity-0'
      }`}
      ref={paletteRef}
    >
      {/* Color Palette */}
      <div
        className="flex flex-row gap-2 items-center justify-center"
        data-mru-row
      >
        {recentColors
          .filter((color) => allowedColorsSet.has(color))
          .map((color, idx) => (
            <ColorSwatch
              key={color}
              dataAttrKey={color}
              onSelect={() => {
                void track('click_color_swatch');
                setCurrentColor(color);
                updateRecentWithDrama(color);
              }}
              color={color}
              isSelected={
                idx === 0 && currentColor === color && !isMRUAnimating
              }
            />
          ))}
        <ColorPickerButton onClick={handleOpenColorPicker} />
      </div>
      {/* Color Picker Modal */}
      <ColorPickerModal
        isOpen={isColorPickerOpen}
        onClose={handleCloseColorPicker}
        onSelectColor={handleSelectExtendedColor}
        currentColor={currentColor}
        userLevel={userLevel}
      />
    </div>
  );
}
