export function Shimmer() {
  return (
    <div
      className="fixed inset-0 pointer-events-none animate-diagonal-shimmer"
      style={{
        background:
          'linear-gradient(-45deg, transparent 40%, rgba(255, 255, 255, 0.2) 50%, transparent 60%)',
        backgroundSize: '300%',
        backgroundPositionX: '100%',
      }}
    />
  );
}
