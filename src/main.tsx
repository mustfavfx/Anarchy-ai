import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App.tsx'
import { AuthProvider } from './features/auth/AuthContext'
import './app/index.css'

const rootEl = document.getElementById('root') ?? document.body;
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
