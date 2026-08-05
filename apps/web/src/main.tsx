import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './i18n';
import './styles/index.css';

// Global error logging
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[window.onerror]', { message, source, lineno, colno, error });
};
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledrejection]', event.reason);
});

// Register service worker for offline support (skipped inside Electron)
if ('serviceWorker' in navigator && !window.electronAPI) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed — app continues without offline cache
    });
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

// In a packaged Electron app the renderer is loaded via file:// which breaks
// BrowserRouter (the pathname is the full file-system path, not "/"). Use
// MemoryRouter instead so React Router works correctly in that environment.
const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
console.log('[main] Mounting React application, isElectron=' + String(isElectron));

const Router = isElectron ? MemoryRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <App />
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
