type DistributionChartProps = {
  values: number[];
  title: string;
  bins?: number;
  className?: string;
};

export function DistributionChart({
  values,
  title,
  bins = 20,
  className = '',
}: DistributionChartProps) {
  if (values.length === 0) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          No data available
        </p>
      </div>
    );
  }

  // Calculate bin boundaries
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const binWidth = range > 0 ? range / bins : 1;

  // Create bins
  const binCounts = new Array(bins).fill(0);
  if (range === 0) {
    // All values are the same - put them all in the first bin
    binCounts[0] = values.length;
  } else {
    for (const value of values) {
      let binIndex = Math.floor((value - min) / binWidth);
      // Handle edge case where value equals max
      if (binIndex >= bins) {
        binIndex = bins - 1;
      }
      binCounts[binIndex]++;
    }
  }

  const maxCount = Math.max(...binCounts);

  // SVG dimensions
  const width = 600;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate bin centers for x coordinates
  const binCenters = binCounts.map((_, i) => {
    const binStart = min + i * binWidth;
    return binStart + binWidth / 2;
  });

  // Convert to SVG coordinates
  const points = binCounts.map((count, i) => {
    const x =
      padding.left +
      (bins > 1 ? (i / (bins - 1)) * chartWidth : chartWidth / 2);
    const y =
      padding.top +
      chartHeight -
      (maxCount > 0 ? (count / maxCount) * chartHeight : 0);
    return { x, y, count, binCenter: binCenters[i] };
  });

  // Create path for the line
  const pathData = points
    .map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Format axis labels
  const formatLabel = (value: number): string => {
    if (value === 0) return '0';
    if (Math.abs(value) < 0.01) return value.toExponential(1);
    if (Math.abs(value) >= 1000) return value.toExponential(1);
    return value.toFixed(2);
  };

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues: number[] = [];
  for (let i = 0; i <= yTicks; i++) {
    yTickValues.push((maxCount / yTicks) * i);
  }

  // X-axis ticks (show min, max, and a few in between)
  const xTicks = 5;
  const xTickValues: number[] = [];
  for (let i = 0; i <= xTicks; i++) {
    xTickValues.push(min + (range / xTicks) * i);
  }

  return (
    <div className={className}>
      <h4 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">
        {title}
      </h4>
      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          className="w-full h-auto"
          viewBox={`0 0 ${width} ${height}`}
        >
          {/* Grid lines */}
          <g className="text-gray-300 dark:text-gray-700">
            {yTickValues.map((tick, i) => {
              const y =
                padding.top + chartHeight - (tick / maxCount) * chartHeight;
              return (
                <line
                  key={`grid-y-${i}`}
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              );
            })}
            {xTickValues.map((tick, i) => {
              const x =
                padding.left +
                (range > 0
                  ? ((tick - min) / range) * chartWidth
                  : chartWidth / 2);
              return (
                <line
                  key={`grid-x-${i}`}
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={height - padding.bottom}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              );
            })}
          </g>

          {/* Y-axis labels */}
          <g className="text-xs text-gray-600 dark:text-gray-400">
            {yTickValues.map((tick, i) => {
              const y =
                padding.top + chartHeight - (tick / maxCount) * chartHeight;
              return (
                <text
                  key={`y-label-${i}`}
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="currentColor"
                >
                  {Math.round(tick)}
                </text>
              );
            })}
          </g>

          {/* X-axis labels */}
          <g className="text-xs text-gray-600 dark:text-gray-400">
            {xTickValues.map((tick, i) => {
              const x =
                padding.left +
                (range > 0
                  ? ((tick - min) / range) * chartWidth
                  : chartWidth / 2);
              return (
                <text
                  key={`x-label-${i}`}
                  x={x}
                  y={height - padding.bottom + 20}
                  textAnchor="middle"
                  fill="currentColor"
                >
                  {formatLabel(tick)}
                </text>
              );
            })}
          </g>

          {/* Axes */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            stroke="currentColor"
            strokeWidth="2"
            className="text-gray-700 dark:text-gray-300"
          />
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="currentColor"
            strokeWidth="2"
            className="text-gray-700 dark:text-gray-300"
          />

          {/* Line path */}
          <path
            d={pathData}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-blue-500 dark:text-blue-400"
          />

          {/* Data points */}
          {points.map((point, i) => (
            <circle
              key={`point-${i}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="currentColor"
              className="text-blue-500 dark:text-blue-400"
            >
              <title>
                {formatLabel(point.binCenter)}: {point.count} values
              </title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
        Total: {values.length} | Min: {min.toFixed(4)} | Max: {max.toFixed(4)} |
        Mean: {(values.reduce((a, b) => a + b, 0) / values.length).toFixed(4)}
      </div>
    </div>
  );
}
