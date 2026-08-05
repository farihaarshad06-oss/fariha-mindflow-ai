import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './i18n';
import './styles/index.css';

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

// Use HashRouter when running inside Electron (file:// protocol) because
// BrowserRouter relies on history.pushState which doesn't work without a server.
const Router = window.electronAPI ? HashRouter : BrowserRouter;

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found in document');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <App />
      </Router>
    </QueryClientProvider>
  </React.StrictMode>,
);
