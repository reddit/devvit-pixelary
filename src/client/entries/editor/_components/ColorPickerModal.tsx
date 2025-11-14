import { Modal } from '@components/Modal';
import { getAllAvailableColors } from '@client/constants';
import type { HEX } from '@shared/types';
import { Icon } from '@components/PixelFont';
import { getContrastColor } from '@shared/utils/color';
import { PaintSwatch } from '@client/components/illustrations/PaintSwatch';

type ColorPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectColor: (color: HEX) => void;
  currentColor: HEX;
  userLevel: number;
};

export function ColorPickerModal(props: ColorPickerModalProps) {
  const { isOpen, onClose, onSelectColor, currentColor, userLevel } = props;
  const availableColors = getAllAvailableColors(userLevel);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select a color">
      <div className="grid grid-cols-7 gap-2">
        {availableColors.map((color) => (
          <PickerSwatch
            key={color}
            color={color}
            isSelected={currentColor === color}
            onSelect={onSelectColor}
          />
        ))}
      </div>
    </Modal>
  );
}

type PickerSwatchProps = {
  color: HEX;
  isSelected: boolean;
  onSelect: (color: HEX) => void;
};

function PickerSwatch(props: PickerSwatchProps) {
  const { color, isSelected, onSelect } = props;
  return (
    <button
      onClick={() => {
        onSelect(color);
      }}
      className="w-8 h-8 border-4 border-black hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-pixel hover:shadow-pixel-sm active:shadow-none cursor-pointer transition-all flex items-center justify-center relative"
      style={{ backgroundColor: color }}
    >
      <Icon
        type="checkmark"
        scale={2}
        color={getContrastColor(color)}
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
      />
    </button>
  );
}
