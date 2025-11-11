import { ColorPalette } from '@client/components/illustrations';

type ColorPickerButtonProps = {
  onClick: () => void;
};

export function ColorPickerButton(props: ColorPickerButtonProps) {
  const { onClick } = props;

  return (
    <button
      onClick={onClick}
      className="w-8 h-8 cursor-pointer flex items-center justify-center"
    >
      <ColorPalette size={24} />
    </button>
  );
}
