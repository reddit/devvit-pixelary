import { getTelemetryDateKey, formatDate } from '../_utils';

type ViewMode = 'single' | 'trailing';

type HeaderProps = {
  selectedDate: string;
  viewMode: ViewMode;
  onDateChange: (date: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onRefresh: () => void;
};

export function Header(props: HeaderProps) {
  const { selectedDate, viewMode, onDateChange, onViewModeChange, onRefresh } =
    props;
  const today = getTelemetryDateKey();

  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
        Analytics
      </h1>
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onViewModeChange('single');
            }}
            className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
              viewMode === 'single'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Single Day
          </button>
          <button
            onClick={() => {
              onViewModeChange('trailing');
            }}
            className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
              viewMode === 'trailing'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Last 30 Days
          </button>
        </div>
        <div className="flex items-center gap-4">
          {viewMode === 'single' && (
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => {
                const value = e.currentTarget.value;
                if (value) {
                  onDateChange(value);
                }
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-black dark:text-white"
            />
          )}
          {viewMode === 'trailing' && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {(() => {
                const endDate = new Date(selectedDate + 'T00:00:00');
                const startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - 29);
                return `${formatDate(getTelemetryDateKey(startDate))} - ${formatDate(selectedDate)}`;
              })()}
            </span>
          )}
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
