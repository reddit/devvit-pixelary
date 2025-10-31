export function Shimmer() {
  return (
    <div
      className="absolute inset-0 pointer-events-none animate-diagonal-shimmer"
      style={{
        background:
          'linear-gradient(-45deg, transparent 40%, var(--color-shimmer) 50%, transparent 60%)',
        backgroundSize: '300%',
        backgroundPositionX: '100%',
      }}
    />
  );
}
