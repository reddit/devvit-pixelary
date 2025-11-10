import type { HEX } from '@shared/types';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { useDrawingState } from '../_hooks/useDrawingState';

type ToolbarProps = {
  isReviewing?: boolean;
  currentColor: HEX;
};

export function Toolbar(props: ToolbarProps) {
  const { isReviewing = false, currentColor } = props;
  const { track } = useTelemetry();
  const {
    canUndo,
    undo,
    fill,
    brushSize,
    setBrushSize,
    mirrorV,
    setMirrorV,
    mirrorH,
    setMirrorH,
  } = useDrawingState();

  return (
    <div className="flex flex-row flex-nowrap gap-2 items-center justify-center overflow-x-auto px-3">
      <button
        aria-label="Undo"
        disabled={isReviewing || !canUndo}
        onClick={() => {
          void track('click_undo');
          undo();
        }}
        className={`px-3 h-8 border-4 border-black cursor-pointer transition-all flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-pixel hover:shadow-pixel-sm active:shadow-none bg-gray-200 ${
          isReviewing || !canUndo ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        Undo
      </button>
      <button
        aria-label="Fill"
        disabled={isReviewing}
        onClick={() => {
          void track('click_fill');
          fill(currentColor);
        }}
        className={`px-3 h-8 border-4 border-black cursor-pointer transition-all flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-pixel hover:shadow-pixel-sm active:shadow-none bg-gray-200 ${
          isReviewing ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        Fill
      </button>
      {/* Brush sizes */}
      <div className="flex items-center gap-1 ml-2">
        <button
          aria-label="Brush Small"
          aria-pressed={brushSize === 1}
          disabled={isReviewing}
          onClick={() => {
            void track('toggle_brush_size');
            setBrushSize(1);
          }}
          className={`w-8 h-8 border-4 border-black transition-all flex items-center justify-center shadow-pixel hover:shadow-pixel-sm active:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] ${
            brushSize === 1 ? 'bg-black text-white' : 'bg-white'
          } ${isReviewing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          S
        </button>
        <button
          aria-label="Brush Medium"
          aria-pressed={brushSize === 3}
          disabled={isReviewing}
          onClick={() => {
            void track('toggle_brush_size');
            setBrushSize(3);
          }}
          className={`w-8 h-8 border-4 border-black transition-all flex items-center justify-center shadow-pixel hover:shadow-pixel-sm active:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] ${
            brushSize === 3 ? 'bg-black text-white' : 'bg-white'
          } ${isReviewing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          M
        </button>
        <button
          aria-label="Brush Large"
          aria-pressed={brushSize === 5}
          disabled={isReviewing}
          onClick={() => {
            void track('toggle_brush_size');
            setBrushSize(5);
          }}
          className={`w-8 h-8 border-4 border-black transition-all flex items-center justify-center shadow-pixel hover:shadow-pixel-sm active:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] ${
            brushSize === 5 ? 'bg-black text-white' : 'bg-white'
          } ${isReviewing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          L
        </button>
      </div>
      {/* Symmetry toggles */}
      <div className="flex items-center gap-1 ml-2">
        <button
          aria-label="Mirror Vertical"
          aria-pressed={mirrorV}
          disabled={isReviewing}
          onClick={() => {
            void track('toggle_mirror_v');
            setMirrorV(!mirrorV);
          }}
          className={`w-10 h-8 border-4 border-black transition-all flex items-center justify-center shadow-pixel hover:shadow-pixel-sm active:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] ${
            mirrorV ? 'bg-black text-white' : 'bg-white'
          } ${isReviewing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          ↔
        </button>
        <button
          aria-label="Mirror Horizontal"
          aria-pressed={mirrorH}
          disabled={isReviewing}
          onClick={() => {
            void track('toggle_mirror_h');
            setMirrorH(!mirrorH);
          }}
          className={`w-10 h-8 border-4 border-black transition-all flex items-center justify-center shadow-pixel hover:shadow-pixel-sm active:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] ${
            mirrorH ? 'bg-black text-white' : 'bg-white'
          } ${isReviewing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          ↕
        </button>
      </div>
    </div>
  );
}
