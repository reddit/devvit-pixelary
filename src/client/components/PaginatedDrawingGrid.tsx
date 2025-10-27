import { useState, useEffect } from 'react';
import { Drawing } from './Drawing';
import { IconButton } from './IconButton';
import { PixelFont } from './PixelFont';
import { DrawingData } from '../../shared/schema/drawing';

interface PaginatedDrawingGridProps {
  drawings: Array<{ postId: string; drawing: DrawingData }>;
  onDrawingClick: (postId: string) => void;
  isLoading?: boolean;
}

export function PaginatedDrawingGrid({
  drawings,
  onDrawingClick,
  isLoading = false,
}: PaginatedDrawingGridProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [tilesPerRow, setTilesPerRow] = useState(3);
  const [tilesPerPage, setTilesPerPage] = useState(12);

  // Calculate responsive layout
  useEffect(() => {
    const calculateLayout = () => {
      const width = window.innerWidth;
      const padding = 32; // 16px on each side
      const tileSize = 87;
      const gap = 12;

      // Calculate maximum tiles per row based on screen width
      const availableWidth = width - padding;
      const maxTilesPerRow = Math.floor(availableWidth / (tileSize + gap));
      setTilesPerRow(Math.max(1, maxTilesPerRow));

      // Calculate tiles per page based on available space
      // Use 4 rows as before, but allow fewer columns if needed
      setTilesPerPage(maxTilesPerRow * 4);
    };

    calculateLayout();
    window.addEventListener('resize', calculateLayout);
    return () => window.removeEventListener('resize', calculateLayout);
  }, [drawings.length]);

  // Reset to page 1 when drawings change
  useEffect(() => {
    setCurrentPage(1);
  }, [drawings.length]);

  if (isLoading) {
    return (
      <div className="flex w-full h-full flex-row gap-3 flex-wrap items-start justify-center">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="w-[87px] h-[87px] bg-gray-200 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (drawings.length === 0) {
    return null; // Empty state handled by parent
  }

  const totalPages = Math.ceil(drawings.length / tilesPerPage);
  const startIndex = (currentPage - 1) * tilesPerPage;
  const endIndex = Math.min(startIndex + tilesPerPage, drawings.length);
  const currentDrawings = drawings.slice(startIndex, endIndex);

  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  // Calculate actual columns needed for current page
  const actualColumns = Math.min(tilesPerRow, currentDrawings.length);
  const actualRows = Math.ceil(currentDrawings.length / tilesPerRow);

  return (
    <div className="flex flex-col h-full">
      {/* Drawing Tiles */}
      <div
        className="flex-1 flex flex-col gap-3 justify-center items-center"
        style={{
          minHeight: `${actualRows * (87 + 12) - 12}px`, // Account for gaps
        }}
      >
        <div
          className="grid gap-3 justify-center"
          style={{
            gridTemplateColumns: `repeat(${actualColumns}, 87px)`,
            gridTemplateRows: `repeat(${actualRows}, 87px)`,
          }}
        >
          {currentDrawings.map((drawing) => (
            <Drawing
              key={drawing.postId}
              data={drawing.drawing}
              size={87}
              onClick={() => onDrawingClick(drawing.postId)}
            />
          ))}
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="shrink-0 w-full flex items-center justify-between mt-4">
        {hasPrevPage ? (
          <IconButton
            symbol="arrow-left"
            onClick={() => setCurrentPage(currentPage - 1)}
            size="medium"
            variant="primary"
          />
        ) : (
          <div className="w-8 h-8" />
        )}

        <div className="flex items-center justify-center flex-1 text-secondary">
          <PixelFont>{`Page ${currentPage} of ${totalPages}`}</PixelFont>
        </div>

        {hasNextPage ? (
          <IconButton
            symbol="arrow-right"
            onClick={() => setCurrentPage(currentPage + 1)}
            size="medium"
            variant="primary"
          />
        ) : (
          <div className="w-8 h-8" />
        )}
      </div>
    </div>
  );
}
