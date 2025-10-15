import { Drawing } from './Drawing';
import { DrawingData } from '@shared/schema/drawing';

export interface DrawingTileProps {
  drawing: {
    id: string;
    data: DrawingData;
    word?: string;
    author?: string;
  };
  size?: number;
  onClick?: () => void;
  className?: string;
}

export function DrawingTile({
  drawing,
  size = 144,
  onClick,
  className = '',
}: DrawingTileProps) {
  return (
    <div
      className={`cursor-pointer hover:opacity-70 transition-opacity ${className}`}
      onClick={onClick}
    >
      <Drawing data={drawing.data} size={size} />

      {/* Optional metadata */}
      {(drawing.word || drawing.author) && (
        <div className="mt-2 text-center">
          {drawing.word && (
            <div className="text-sm font-medium text-gray-700">
              "{drawing.word}"
            </div>
          )}
          {drawing.author && (
            <div className="text-xs text-gray-500">by {drawing.author}</div>
          )}
        </div>
      )}
    </div>
  );
}
