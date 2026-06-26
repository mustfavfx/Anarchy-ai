import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App.tsx'
import { AuthProvider } from './features/auth/AuthContext'
import './app/index.css'
import { ErrorReportingService } from './services/monitoring/ErrorReportingService'

// Initialize telemetry and error reporting
ErrorReportingService.init().catch(err => {
  console.error('[Main] Failed to initialize error reporting:', err);
});

// Disable DevTools shortcuts and context menu in production
if (!import.meta.env.DEV) {
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (
      e.code === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.code === 'KeyI' || e.code === 'KeyC' || e.code === 'KeyJ')) ||
      (e.ctrlKey && e.code === 'KeyU')
    ) {
      e.preventDefault();
    }
  });
}

const rootEl = document.getElementById('root') ?? document.body;
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
