import { useState } from 'react';
import { PixelFont } from '../../../components/PixelFont';
import { Button } from '../../../components/Button';
import { PixelSymbol } from '../../../components/PixelSymbol';
import { trpc } from '../../../trpc/client';
import type { WordReport } from '../../../../shared/schema/pixelary';

type ReportedWordsProps = {
  onClose: () => void;
};

export function ReportedWords(props: ReportedWordsProps) {
  const { onClose } = props;
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  const { data: reportedWords = [], refetch } =
    trpc.app.dictionary.getReportedWords.useQuery({
      limit: 50,
    });

  const { data: wordMetadata } = trpc.app.dictionary.getWordMetadata.useQuery(
    { word: selectedWord || '' },
    { enabled: !!selectedWord }
  );

  const clearReportsMutation = trpc.app.dictionary.clearReports.useMutation({
    onSuccess: () => {
      void refetch();
      setSelectedWord(null);
    },
  });

  const denyWordMutation = trpc.app.dictionary.denyWord.useMutation({
    onSuccess: () => {
      void refetch();
      setSelectedWord(null);
    },
  });

  const handleClearReports = (word: string) => {
    clearReportsMutation.mutate({ word });
  };

  const handleDenyWord = (word: string) => {
    denyWordMutation.mutate({ word });
  };

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-start min-h-screen px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-4xl mb-6">
        <button
          onClick={onClose}
          className="flex items-center gap-2 hover:opacity-70 transition-opacity"
        >
          <PixelSymbol type="arrow-left" scale={2} />
          <PixelFont scale={2}>Back</PixelFont>
        </button>
        <PixelFont scale={3}>Reported Words</PixelFont>
        <div className="w-20" /> {/* Spacer for centering */}
      </div>

      {/* Content */}
      <div className="flex gap-6 w-full max-w-4xl">
        {/* Left Panel - Reported Words List */}
        <div className="flex-1 bg-[var(--color-surface-secondary)] rounded-lg p-4">
          <PixelFont scale={2} className="mb-4">
            {`Words with Reports (${reportedWords.length})`}
          </PixelFont>

          {reportedWords.length === 0 ? (
            <div className="text-center py-8">
              <PixelFont scale={1}>No reported words</PixelFont>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {reportedWords.map(
                (item: { word: string; reportCount: number }) => (
                  <div
                    key={item.word}
                    className={`p-3 rounded cursor-pointer transition-colors ${
                      selectedWord === item.word
                        ? 'bg-[var(--color-brand-primary)] text-white'
                        : 'bg-[var(--color-surface-primary)] hover:bg-[var(--color-surface-tertiary)]'
                    }`}
                    onClick={() => setSelectedWord(item.word)}
                  >
                    <div className="flex justify-between items-center">
                      <PixelFont scale={1}>{item.word}</PixelFont>
                      <PixelFont scale={1} className="opacity-70">
                        {`${item.reportCount} report${item.reportCount !== 1 ? 's' : ''}`}
                      </PixelFont>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Word Details & Actions */}
        <div className="flex-1 bg-[var(--color-surface-secondary)] rounded-lg p-4">
          {selectedWord ? (
            <div>
              <PixelFont scale={2} className="mb-4">
                {selectedWord}
              </PixelFont>

              {wordMetadata ? (
                <div className="space-y-4">
                  {/* Word Info */}
                  <div className="bg-[var(--color-surface-primary)] rounded p-3">
                    <PixelFont scale={1} className="mb-2">
                      Word Information
                    </PixelFont>
                    <div className="space-y-1 text-sm">
                      <div>Added by: u/{wordMetadata.addedBy}</div>
                      <div>
                        Added on:{' '}
                        {new Date(wordMetadata.addedAt).toLocaleDateString()}
                      </div>
                      <div>Reports: {wordMetadata.reports.length}</div>
                    </div>
                  </div>

                  {/* Reports */}
                  {wordMetadata.reports.length > 0 && (
                    <div className="bg-[var(--color-surface-primary)] rounded p-3">
                      <PixelFont scale={1} className="mb-2">
                        Reports
                      </PixelFont>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {wordMetadata.reports.map(
                          (report: WordReport, index: number) => (
                            <div
                              key={index}
                              className="text-sm border-l-2 border-[var(--color-brand-primary)] pl-2"
                            >
                              <div>u/{report.username}</div>
                              {report.reason && (
                                <div className="opacity-70">
                                  "{report.reason}"
                                </div>
                              )}
                              <div className="opacity-50 text-xs">
                                {new Date(report.timestamp).toLocaleString()}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="bg-[var(--color-surface-primary)] rounded p-3">
                    <PixelFont scale={1} className="mb-2">
                      Usage Stats
                    </PixelFont>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Exposures: {wordMetadata.stats.exposures}</div>
                      <div>Picks: {wordMetadata.stats.picks}</div>
                      <div>Submissions: {wordMetadata.stats.submissions}</div>
                      <div>Guesses: {wordMetadata.stats.guesses}</div>
                      <div>Solves: {wordMetadata.stats.solves}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleClearReports(selectedWord)}
                      size="small"
                      variant="secondary"
                      disabled={clearReportsMutation.isPending}
                    >
                      Clear Reports
                    </Button>
                    <Button
                      onClick={() => handleDenyWord(selectedWord)}
                      size="small"
                      variant="secondary"
                      disabled={denyWordMutation.isPending}
                    >
                      Deny Word
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <PixelFont scale={1}>Loading word metadata...</PixelFont>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <PixelFont scale={1}>Select a word to view details</PixelFont>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
