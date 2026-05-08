import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './styles/theme.css';
import { AppShell } from './features/shell/AppShell';
import { MultiBuilderPage } from './features/builder/MultiBuilderPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ProjectsPage } from './features/projects/ProjectsPage';
import { GeneratePage } from './features/generate/GeneratePage';
import { LibraryPage } from './features/library/LibraryPage';
import { HistoryPage } from './features/history/HistoryPage';
import { IntegrationsPage } from './features/integrations/IntegrationsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { PrivacyPolicy } from './features/settings/PrivacyPolicy';
import { AccountPage } from './features/account/AccountPage';
import { AddCreditPage } from './features/billing/AddCreditPage';
import { LoraTrainingPage } from './features/lora/LoraTrainingPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedApp } from './features/auth/ProtectedApp';
import { UpdateNotification } from './features/updater/UpdateNotification';

function App() {
  return (
    <ErrorBoundary>
      <ProtectedApp>
        <Router>
          <AppShell>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/builder" element={<MultiBuilderPage />} />
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
          </AppShell>
        </Router>
      </ProtectedApp>
      <UpdateNotification />
    </ErrorBoundary>
  );
}

export default App;
