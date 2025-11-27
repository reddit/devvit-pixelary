import { getEventCategory } from '../_utils';

type RawEventsViewProps = {
  telemetryData: Record<string, number> | undefined;
  viewMode: 'single' | 'trailing';
};

export function RawEventsView(props: RawEventsViewProps) {
  const { telemetryData, viewMode } = props;

  if (!telemetryData) return null;

  // Group telemetry data by post type and category
  const groupedData = Object.entries(telemetryData).reduce(
    (acc, [key, value]) => {
      const [postType, eventType] = key.split(':');
      if (!postType || !eventType) return acc;
      if (!acc[postType]) {
        acc[postType] = {};
      }
      const category = getEventCategory(eventType);
      if (!acc[postType][category]) {
        acc[postType][category] = [];
      }
      acc[postType][category].push({ eventType, count: value });
      return acc;
    },
    {} as Record<
      string,
      Record<string, Array<{ eventType: string; count: number }>>
    >
  );

  const totalEvents = Object.values(telemetryData).reduce(
    (sum, count) => sum + count,
    0
  );

  const allEventTypes = new Set(
    Object.keys(telemetryData)
      .map((key) => key.split(':')[1])
      .filter((et): et is string => Boolean(et))
  );

  return (
    <>
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Total Events: {totalEvents.toLocaleString()}
            </p>
            {viewMode === 'trailing' && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Aggregated over 30 days
              </p>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {allEventTypes.size} unique event types
          </p>
        </div>
      </div>

      {/* Grouped by Post Type */}
      {Object.entries(groupedData).map(([postType, categories]) => (
        <div
          key={postType}
          className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
        >
          <h2 className="text-xl font-semibold mb-4 capitalize text-gray-900 dark:text-gray-100">
            {postType}
          </h2>
          <div className="space-y-4">
            {Object.entries(categories)
              .sort(([catA], [catB]) => {
                const order = [
                  'View',
                  'Click',
                  'Toggle',
                  'Drawing',
                  'Post',
                  'Other',
                ];
                return order.indexOf(catA) - order.indexOf(catB);
              })
              .map(([category, events]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    {category} (
                    {events.reduce((sum, e) => sum + e.count, 0).toLocaleString()}
                    )
                  </h3>
                  <div className="space-y-1 pl-2">
                    {events
                      .sort((a, b) => b.count - a.count)
                      .map(({ eventType, count }) => (
                        <div
                          key={eventType}
                          className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-800 last:border-0"
                        >
                          <span className="text-sm capitalize text-gray-700 dark:text-gray-300">
                            {eventType.replace(/_/g, ' ')}
                          </span>
                          <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">
                            {count.toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </>
  );
}

