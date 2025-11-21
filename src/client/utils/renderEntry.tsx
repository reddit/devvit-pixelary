import React from 'react';
import ReactDOM from 'react-dom/client';
import type { VNode } from 'preact';

import { Providers } from '@components/Providers';
import { setupGlobalErrorHandlers } from '@utils/errors';
import { VersionGate } from '@components/VersionGate';

export function renderEntry(children: React.ReactNode | VNode): void {
  setupGlobalErrorHandlers();

  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element not found');
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Providers>
        <VersionGate>{children as React.ReactNode}</VersionGate>
      </Providers>
    </React.StrictMode>
  );
}
