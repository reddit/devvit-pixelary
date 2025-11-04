import React from 'react';
import ReactDOM from 'react-dom/client';

import { Background } from '@components/Background';
import { DrawingPost } from './DrawingPost';

import { Providers } from '@components/Providers';
import { setupGlobalErrorHandlers } from '@utils/errors';

setupGlobalErrorHandlers();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Providers>
      <Background />
      <DrawingPost />
    </Providers>
  </React.StrictMode>
);
