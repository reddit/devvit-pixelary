import { getEventCount } from '../_utils';

type DrawingCTRViewProps = {
  telemetryData: Record<string, number> | undefined;
};

export function DrawingCTRView(props: DrawingCTRViewProps) {
  const { telemetryData } = props;

  if (!telemetryData) return null;

  const drawing = 'drawing';

  // Impressions = views of the guess screen (where users can engage)
  const impressions = getEventCount(telemetryData, drawing, 'post_impression');
  // Results views = views of the results screen (after solving/skipping)
  const resultsViews = getEventCount(telemetryData, drawing, 'view_results');
  const guesses = getEventCount(telemetryData, drawing, 'post_guess');
  const solves = getEventCount(telemetryData, drawing, 'post_solve');
  const skips = getEventCount(telemetryData, drawing, 'post_skip');

  const totalEngagements = guesses + solves + skips;
  const ctr = impressions > 0 ? (totalEngagements / impressions) * 100 : 0;
  const solveRate = impressions > 0 ? (solves / impressions) * 100 : 0;
  const guessRate = impressions > 0 ? (guesses / impressions) * 100 : 0;
  const skipRate = impressions > 0 ? (skips / impressions) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Drawing Engagement Metrics
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Guess Screen Views
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {impressions.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                (impressions)
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Results Views
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {resultsViews.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                (after solve/skip)
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Total Engagements
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {totalEngagements.toLocaleString()}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Click-Through Rate (CTR)
            </p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {ctr.toFixed(2)}%
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Guesses
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {guesses.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {guessRate.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Solves
              </p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                {solves.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {solveRate.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Skips
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {skips.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {skipRate.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
