import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { NavRail } from './NavRail';
import { TitleBar } from './TitleBar';
import { RightSidebar } from './RightSidebar';
import { SaveDialog } from './SaveDialog';
import { MultiBuilderPage } from '../builder/MultiBuilderPage';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { saveWorkflowAs } from '../../services/workflow';
import { EnlargedPreview } from './EnlargedPreview';
import { OnboardingModal } from '../../components/OnboardingModal';
import { ToastNotification } from './ToastNotification';
import './AppShell.css';
import { track } from '../../services/tracking/trackingService';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const location = useLocation();

  const isBuilderPage   = location.pathname === '/builder';
  const isEnlargedView  = useAIConfigStore(s => s.isEnlargedView);

  useEffect(() => {
    track({ event: 'page_viewed', properties: { page: location.pathname } }).catch(() => {});
  }, [location.pathname]);

  const handleCloseRequest = () => setShowSaveDialog(true);

  const handleSaveConfirm = async (filename: string) => {
    setShowSaveDialog(false);
    try {
      const { nodes, edges } = useAIConfigStore.getState().workflowSnapshot;
      if (nodes.length > 0) await saveWorkflowAs(nodes, edges, filename);
    } catch { /* Non-critical */ }
    await getCurrentWindow().close();
  };

  const handleDontSave = async () => {
    setShowSaveDialog(false);
    await getCurrentWindow().close();
  };

  const handleCancel = () => setShowSaveDialog(false);

  return (
    <div className="app-shell">
      <TitleBar onCloseRequest={handleCloseRequest} />
      <div className="app-body">
        <NavRail />

        {/* ── Builder layout: always mounted, hidden via CSS to preserve canvas state ── */}
        <main
          className={`app-content${isEnlargedView ? ' app-content--mini-canvas' : ''}`}
          style={isBuilderPage ? undefined : { display: 'none' }}
        >
          <MultiBuilderPage />
        </main>
        {isBuilderPage && (
          isEnlargedView ? (
            <div className="app-body-enlarged">
              <div className="app-enlarged-main">
                <EnlargedPreview />
              </div>
              <RightSidebar />
            </div>
          ) : (
            <RightSidebar />
          )
        )}

        {/* ── Non-builder pages ── */}
        {!isBuilderPage && (
          <main className="app-content">
            {children}
          </main>
        )}

      </div>
      {showSaveDialog && (
        <SaveDialog
          onSave={handleSaveConfirm}
          onDontSave={handleDontSave}
          onCancel={handleCancel}
        />
      )}

      {/* Onboarding for new users */}
      <OnboardingModal />

      {/* Global toast notifications */}
      <ToastNotification />
    </div>
  );
};
