import { trpc } from '@client/trpc/client';
import { useState } from 'react';

type WordsViewProps = {
  // No props needed, fetches its own data
};

export function WordsView(_props: WordsViewProps) {
  const [limit, setLimit] = useState(20);
  const { data, isLoading } = trpc.app.dictionary.getWordStats.useQuery(
    { limit },
    { enabled: true }
  );

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">
          No word data available
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Word Statistics
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">
            Show top:
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number.parseInt(e.target.value, 10))}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-black dark:text-white text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top words by score */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Top Words by Score
          </h3>
          <div className="space-y-2">
            {data.byScore.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-500">
                No words found
              </p>
            ) : (
              data.byScore.map((item, index) => (
                <div
                  key={item.word}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-gray-500 dark:text-gray-500 w-6">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.word}
                    </span>
                  </div>
                  <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {item.score.toFixed(4)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top words by uncertainty */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Top Words by Uncertainty
          </h3>
          <div className="space-y-2">
            {data.byUncertainty.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-500">
                No words found
              </p>
            ) : (
              data.byUncertainty.map((item, index) => (
                <div
                  key={item.word}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-gray-500 dark:text-gray-500 w-6">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.word}
                    </span>
                  </div>
                  <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {item.uncertainty.toFixed(4)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
