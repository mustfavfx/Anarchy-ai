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

const rootEl = document.getElementById('root') ?? document.body;
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
