import { Icon } from '@components/PixelFont';

type ColorPickerButtonProps = {
  onClick: () => void;
};

export function ColorPickerButton(props: ColorPickerButtonProps) {
  const { onClick } = props;

  return (
    <button
      onClick={onClick}
      className="w-8 h-8 border-4 border-black cursor-pointer transition-all flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-pixel hover:shadow-pixel-sm active:shadow-none bg-gray-200"
    >
      <Icon type="plus" scale={2} color="currentColor" />
    </button>
  );
}
