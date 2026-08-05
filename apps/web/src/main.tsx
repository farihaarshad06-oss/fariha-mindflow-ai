import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './i18n';
import './styles/index.css';

// Global error logging
console.log('[renderer] bootstrap:start');
void window.electronAPI?.getDiagnostics().then(() => {
  console.log('[renderer] electron bridge available');
}).catch((error) => {
  console.error('[renderer] electron bridge check failed', error);
});
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[window.onerror]', { message, source, lineno, colno, error });
  void window.electronAPI?.getDiagnostics().catch(() => undefined);
};
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledrejection]', event.reason);
});
window.addEventListener('error', (event) => {
  if (event.target instanceof HTMLLinkElement || event.target instanceof HTMLScriptElement || event.target instanceof HTMLImageElement) {
    console.error('[renderer] resource-load-failed', {
      tag: event.target.tagName,
      source: 'src' in event.target ? event.target.src : event.target.href,
    });
  }
}, true);

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

console.log('[main] Mounting React application');
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Renderer root element #root was not found');
}
const root = ReactDOM.createRoot(rootElement);

try {
  const Router = window.electronAPI ? HashRouter : BrowserRouter;
  root.render(
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
  console.log('[renderer] bootstrap:rendered');
} catch (error) {
  console.error('[renderer] bootstrap:failed', error);
  throw error;
}
