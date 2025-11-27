import { trpc } from '@client/trpc/client';
import { useState } from 'react';
import { getTelemetryDateKey } from './_utils';
import { Header } from './_components/Header';
import { Tabs } from './_components/Tabs';
import { RawEventsView } from './_components/RawEventsView';
import { EditorFunnelView } from './_components/EditorFunnelView';
import { DrawingCTRView } from './_components/DrawingCTRView';
import { WordsView } from './_components/WordsView';

type Tab = 'raw' | 'editor-funnel' | 'drawing-ctr' | 'words';
type ViewMode = 'single' | 'trailing';

export function Analytics() {
  const [selectedDate, setSelectedDate] = useState(() => getTelemetryDateKey());
  const [activeTab, setActiveTab] = useState<Tab>('raw');
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const {
    data: telemetryData,
    isLoading,
    refetch,
  } = trpc.app.telemetry.getStats.useQuery(
    {
      date: selectedDate,
      days: viewMode === 'trailing' ? 30 : undefined,
    },
    { enabled: true }
  );

  const totalEvents = telemetryData
    ? Object.values(telemetryData).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <main className="absolute inset-0 flex flex-col items-center overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-4xl space-y-6 px-4 py-8">
        <Header
          selectedDate={selectedDate}
          viewMode={viewMode}
          onDateChange={setSelectedDate}
          onViewModeChange={setViewMode}
          onRefresh={() => void refetch()}
        />

        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Content */}
        {activeTab === 'words' ? (
          <WordsView />
        ) : isLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        ) : totalEvents === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">
              No telemetry data for this date
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'raw' && (
              <RawEventsView
                telemetryData={telemetryData}
                viewMode={viewMode}
              />
            )}

            {activeTab === 'editor-funnel' && (
              <EditorFunnelView telemetryData={telemetryData} />
            )}

            {activeTab === 'drawing-ctr' && (
              <DrawingCTRView telemetryData={telemetryData} />
            )}
          </>
        )}
      </div>
    </main>
  );
}
