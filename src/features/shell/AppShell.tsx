import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavRail } from './NavRail';
import { TitleBar } from './TitleBar';
import { RightSidebar } from './RightSidebar';
import { MultiBuilderPage } from '../builder/MultiBuilderPage';
import { listen } from '@tauri-apps/api/event';
import { logger } from '../../utils/logger';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { EnlargedPreview } from './EnlargedPreview';
import { OnboardingModal } from '../../components/OnboardingModal';
import { ToastNotification } from './ToastNotification';
import { NotificationCenter } from './NotificationCenter';
import './AppShell.css';
import { track } from '../../services/tracking/trackingService';

interface AppShellProps {
  children: React.ReactNode;
}

const checkHasDirtyTabs = (): boolean => {
  try {
    const raw = localStorage.getItem('anarchy_builder_tabs');
    if (raw) {
      const tabs = JSON.parse(raw);
      if (Array.isArray(tabs)) {
        return tabs.some((t: any) => t.isDirty);
      }
    }
  } catch {}
  return false;
};

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isBuilderPage   = location.pathname === '/builder';
  const isEnlargedView  = useAIConfigStore(s => s.isEnlargedView);

  useEffect(() => {
    track({ event: 'page_viewed', properties: { page: location.pathname } }).catch(() => {});
  }, [location.pathname]);

  // Tauri close request interceptor
  useEffect(() => {
    let active = true;
    let disposeFn: (() => void) | undefined;

    const setupCloseInterceptor = async () => {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const appWindow = getCurrentWebviewWindow();
        
        const dispose = await appWindow.onCloseRequested((event) => {
          if ((window as any).__anarchy_force_close) {
            return;
          }

          event.preventDefault();

          const hasDirty = checkHasDirtyTabs();
          if (hasDirty) {
            navigate('/builder');
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('anarchy:trigger-app-close'));
            }, 100);
          } else {
            import('@tauri-apps/api/core').then(({ invoke }) => {
              invoke('exit_app').catch(() => {
                appWindow.destroy().catch(() => {});
              });
            });
          }
        });

        if (!active) {
          dispose();
        } else {
          disposeFn = dispose;
        }
      } catch (err) {
        logger.warn('[AppShell] Failed to register onCloseRequested handler:', err);
      }
    };

    setupCloseInterceptor();

    return () => {
      active = false;
      if (disposeFn) disposeFn();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let disposeFn: (() => void) | undefined;
    
    listen<{ image: string; source: string }>('anarchy://external-image', (event) => {
      const image = event.payload?.image;
      if (!image) return;
      
      logger.log('[AppShell] Global external-image event received from:', event.payload?.source);
      
      window.dispatchEvent(new CustomEvent('anarchy:external-image-global', {
        detail: {
          image,
          source: event.payload?.source || ''
        }
      }));
    }).then((dispose) => {
      if (!active) {
        dispose();
      } else {
        disposeFn = dispose;
      }
    }).catch((err) => {
      logger.warn('[AppShell] Failed to subscribe to external-image event:', err);
    });

    return () => {
      active = false;
      if (disposeFn) {
        disposeFn();
      }
    };
  }, []);

  return (
    <div className="app-shell">
      <TitleBar />
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

      {/* Onboarding for new users */}
      <OnboardingModal />

      {/* Global toast notifications */}
      <ToastNotification />
      {/* Notification center panel */}
      <NotificationCenter />
    </div>
  );
};
