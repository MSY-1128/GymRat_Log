import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { createQueryClient } from './api/queryClient';
import { App } from './App';
import { initTheme } from './lib/theme';
import './styles/global.css';

initTheme();
const queryClient = createQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
