import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

// ── Service Worker update handler ─────────────────────────────────────────────
// When a new SW activates (skipWaiting fires) the browser emits 'controllerchange'.
// Reloading here ensures users immediately run the latest JS bundle instead of
// a stale cached version — this is critical for keeping Firestore sync logic
// up-to-date without requiring a manual cache clear.
// The `refreshing` flag prevents an infinite reload loop on first-time install.
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
