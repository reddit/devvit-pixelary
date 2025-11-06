import React from 'react';
import ReactDOM from 'react-dom/client';

import { Providers } from '@components/Providers';
import { setupGlobalErrorHandlers } from '@utils/errors';

export function renderEntry(children: React.ReactNode): void {
  setupGlobalErrorHandlers();

  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element not found');
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Providers>{children}</Providers>
    </React.StrictMode>
  );
}
