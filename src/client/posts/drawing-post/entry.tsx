import React from 'react';
import ReactDOM from 'react-dom/client';

import { Background } from '@components/Background';
import { DrawingPost } from './DrawingPost';

import { Providers } from '@components/Providers';
import { setupGlobalErrorHandlers } from '@utils/errors';

setupGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <Background />
      <DrawingPost />
    </Providers>
  </React.StrictMode>
);
