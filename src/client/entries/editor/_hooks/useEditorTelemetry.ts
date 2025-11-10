import { useEffect } from 'react';
import { useTelemetry } from '@client/hooks/useTelemetry';

export function useEditorTelemetry() {
  const { track } = useTelemetry();
  useEffect(() => {
    void track('view_editor');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
