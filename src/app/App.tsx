import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './styles/theme.css';

// Layout & Infrastructure
import { AppShell } from '@/features/shell/AppShell';
import { ProtectedApp } from '@/features/auth/ProtectedApp';
import { UpdateNotification } from '@/features/updater/UpdateNotification';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

// Services
import { SettingsService } from '@/services/settings';

// Lazy-loaded Pages
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'));
const GeneratePage = lazy(() => import('@/pages/GeneratePage'));
const LoraTrainingPage = lazy(() => import('@/pages/LoraTrainingPage'));
const LibraryPage = lazy(() => import('@/pages/LibraryPage'));
const HistoryPage = lazy(() => import('@/pages/HistoryPage'));
const IntegrationsPage = lazy(() => import('@/pages/IntegrationsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const AccountPage = lazy(() => import('@/pages/AccountPage'));
const AddCreditPage = lazy(() => import('@/pages/AddCreditPage'));

// Aesthetically premium Page Loader component
const PageLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    width: '100%',
    backgroundColor: 'var(--bg-app, #09090b)',
    color: 'var(--text-primary, #f4f4f5)',
    fontFamily: 'Inter, sans-serif',
  }}>
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px'
    }}>
      <div className="page-spinner" style={{
        width: '40px',
        height: '40px',
        border: '3px solid rgba(255, 255, 255, 0.05)',
        borderTop: '3px solid var(--accent-red, #e11d48)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em', opacity: 0.8 }}>Loading Anarchy AI...</span>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  </div>
);

function App() {
  useEffect(() => {
    SettingsService.init()
      .then(() => {
        const current = SettingsService.getSettings();
        SettingsService.applyTheme(current.theme);
      })
      .catch((err) => {
        console.error('[App] Failed to initialize settings:', err);
      });
  }, []);

  return (
    <ErrorBoundary>
      <ProtectedApp>
        <Router>
          <AppShell>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/dashboard" element={<Navigate to="/" replace />} />
                <Route path="/builder" element={null} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/generate" element={<GeneratePage />} />
                <Route path="/lora" element={<LoraTrainingPage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/3d" element={<div style={{padding:'40px',color:'var(--text-primary)',textAlign:'center'}}>3D Generation — Coming Soon</div>} />
                <Route path="/integrations" element={<IntegrationsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/add-credit" element={<AddCreditPage />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
              </Routes>
            </Suspense>
          </AppShell>
        </Router>
      </ProtectedApp>
      <UpdateNotification />
    </ErrorBoundary>
  );
}

export default App;
