import { getEventCount } from '../_utils';

type EditorFunnelViewProps = {
  telemetryData: Record<string, number> | undefined;
};

type FunnelStep = {
  step: string;
  count: number;
  conversion: number;
};

export function EditorFunnelView(props: EditorFunnelViewProps) {
  const { telemetryData } = props;

  if (!telemetryData) return null;

  // Calculate editor funnel metrics
  const calculateEditorFunnel = (): FunnelStep[] => {
    const pinned = 'pinned';

    const viewEditor = getEventCount(telemetryData, pinned, 'view_editor');
    const viewWordStep = getEventCount(telemetryData, pinned, 'view_word_step');
    const viewDrawStep = getEventCount(telemetryData, pinned, 'view_draw_step');
    const drawingStart = getEventCount(telemetryData, pinned, 'drawing_start');
    const drawingDoneManual = getEventCount(
      telemetryData,
      pinned,
      'drawing_done_manual'
    );
    const drawingDoneAuto = getEventCount(
      telemetryData,
      pinned,
      'drawing_done_auto'
    );
    const viewReviewStep = getEventCount(
      telemetryData,
      pinned,
      'view_review_step'
    );
    const clickPostDrawing = getEventCount(
      telemetryData,
      pinned,
      'click_post_drawing'
    );
    const clickCancelDrawing = getEventCount(
      telemetryData,
      pinned,
      'click_cancel_drawing'
    );

    const drawingDone = drawingDoneManual + drawingDoneAuto;

    return [
      {
        step: 'View Editor',
        count: viewEditor,
        conversion: 100,
      },
      {
        step: 'Word Step',
        count: viewWordStep,
        conversion: viewEditor > 0 ? (viewWordStep / viewEditor) * 100 : 0,
      },
      {
        step: 'Draw Step',
        count: viewDrawStep,
        conversion: viewWordStep > 0 ? (viewDrawStep / viewWordStep) * 100 : 0,
      },
      {
        step: 'Drawing Started',
        count: drawingStart,
        conversion: viewDrawStep > 0 ? (drawingStart / viewDrawStep) * 100 : 0,
      },
      {
        step: 'Drawing Completed',
        count: drawingDone,
        conversion: drawingStart > 0 ? (drawingDone / drawingStart) * 100 : 0,
      },
      {
        step: 'Review Step',
        count: viewReviewStep,
        conversion: drawingDone > 0 ? (viewReviewStep / drawingDone) * 100 : 0,
      },
      {
        step: 'Posted Drawing',
        count: clickPostDrawing,
        conversion:
          viewReviewStep > 0 ? (clickPostDrawing / viewReviewStep) * 100 : 0,
      },
      {
        step: 'Cancelled',
        count: clickCancelDrawing,
        conversion:
          viewEditor > 0 ? (clickCancelDrawing / viewEditor) * 100 : 0,
      },
    ];
  };

  const funnel = calculateEditorFunnel();
  const mainSteps = funnel.filter((s) => s.step !== 'Cancelled');
  const cancelledStep = funnel.find((s) => s.step === 'Cancelled');

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-gray-100">
        Editor Funnel
      </h2>
      <div className="space-y-4">
        {mainSteps.map((step, index) => {
          const prevStep = index > 0 ? mainSteps[index - 1] : null;
          const dropoff =
            prevStep && prevStep.count > 0 ? prevStep.count - step.count : 0;
          const dropoffPercent =
            prevStep && prevStep.count > 0
              ? (dropoff / prevStep.count) * 100
              : 0;

          return (
            <div key={step.step} className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 text-white font-semibold text-base">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {step.step}
                      </h3>
                      {prevStep && dropoff > 0 && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                          {dropoff.toLocaleString()} dropped off (
                          {dropoffPercent.toFixed(1)}%)
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {step.count.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        users
                      </p>
                    </div>
                    <div className="text-right w-24">
                      <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                        {step.conversion.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        conversion
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {cancelledStep && cancelledStep.count > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500 text-white font-semibold text-lg">
                    ×
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Cancelled
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Users who cancelled the editor
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {cancelledStep.count.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {cancelledStep.conversion.toFixed(1)}% of total
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
