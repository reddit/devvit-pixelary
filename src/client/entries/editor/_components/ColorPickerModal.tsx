import { Modal } from '@components/Modal';
import { ColorSwatch } from './ColorSwatch';
import { getAllAvailableColors } from '@client/constants';
import type { HEX } from '@shared/types';

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
          <ColorSwatch
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
