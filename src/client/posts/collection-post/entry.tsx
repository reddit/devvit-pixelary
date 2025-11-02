import React from 'react';
import ReactDOM from 'react-dom/client';

import { Background } from '@components/Background';
import { CollectionPost } from './CollectionPost';

import { Providers } from '@components/Providers';
import { setupGlobalErrorHandlers } from '@utils/errors';

setupGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <Background />
      <CollectionPost />
    </Providers>
  </React.StrictMode>
);
