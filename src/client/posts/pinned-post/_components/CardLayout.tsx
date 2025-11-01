import React from 'react';
import { Text } from '@components/PixelFont';
import { IconButton } from '@components/IconButton';

interface CardLayoutProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function CardLayout(props: CardLayoutProps) {
  const { title, onClose, children } = props;

  return (
    <main className="absolute inset-0 flex flex-col p-4 gap-4">
      {/* Header */}
      <header className="shrink-0 w-full flex flex-row items-center justify-between">
        <Text scale={2.5}>{title}</Text>

        <IconButton onClick={onClose} symbol="X" />
      </header>

      {/* Card */}
      <div className="flex-1 w-full h-full relative bg-white p-4 flex flex-col items-center justify-center shadow-pixel">
        {children}
      </div>
    </main>
  );
}
