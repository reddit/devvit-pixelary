import { Icon } from '@components/PixelFont';
import { getContrastColor } from '@shared/utils/color';
import type { HEX } from '@shared/types';

export type ColorSwatchProps = {
  color: HEX;
  isSelected: boolean;
  onSelect: (color: HEX) => void;
  dataAttrKey?: string;
};

export function ColorSwatch(props: ColorSwatchProps) {
  const { color, isSelected, onSelect, dataAttrKey } = props;

  return (
    <button
      onClick={() => {
        onSelect(color);
      }}
      data-color={dataAttrKey}
      className="w-8 h-8 border-4 border-black cursor-pointer transition-all flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-pixel hover:shadow-pixel-sm active:shadow-none"
      style={{ backgroundColor: color }}
    >
      <Icon
        type="checkmark"
        scale={2}
        color={getContrastColor(color)}
        className={`mru-check transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}
      />
    </button>
  );
}
