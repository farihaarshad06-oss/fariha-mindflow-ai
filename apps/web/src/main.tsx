import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
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

// In Electron the renderer loads via file:// which is incompatible with
// BrowserRouter's History API (navigating to "/dashboard" would try to open
// file:///dashboard, a path that does not exist on disk → white screen).
// HashRouter keeps the route in the URL hash so file:// always serves the
// same index.html regardless of the current route.
const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
const Router = isElectron ? HashRouter : BrowserRouter;

console.log('[main] Mounting React application (router=%s)', isElectron ? 'HashRouter' : 'BrowserRouter');

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
