import React from 'react';
import { Button } from './Button';
import { DrawingTile } from './DrawingTile';
import { DrawingData } from '../../shared/schema/drawing';

export interface PaginatedDrawingsProps {
  drawings: Array<{
    id: string;
    data: DrawingData;
    word?: string;
    author?: string;
  }>;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDrawingClick?: (drawingId: string) => void;
  ctaButton?: React.ReactNode;
  className?: string;
}

export function PaginatedDrawings({
  drawings,
  currentPage,
  totalPages,
  onPageChange,
  onDrawingClick,
  ctaButton,
  className = '',
}: PaginatedDrawingsProps) {
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Drawings Grid */}
      <div className="grid grid-cols-2 gap-4">
        {drawings.map((drawing) => (
          <DrawingTile
            key={drawing.id}
            drawing={drawing}
            onClick={() => onDrawingClick?.(drawing.id)}
          />
        ))}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrevPage}
          size="small"
          leadingIcon="arrow-left"
        >
          Previous
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <Button
          variant="secondary"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage}
          size="small"
          trailingIcon="arrow-right"
        >
          Next
        </Button>
      </div>

      {/* CTA Button */}
      {ctaButton && <div className="text-center">{ctaButton}</div>}

      {/* Cutoff Indicator */}
      {hasNextPage && (
        <div className="text-center">
          <span className="font-pixel text-pixel-text-scale-1 text-brand-weak">
            ...and more
          </span>
        </div>
      )}
    </div>
  );
}
