import React, { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Plus, X, FileText, ShieldAlert, RotateCcw } from 'lucide-react';
import { BuilderContent } from './BuilderPage';
import { useMultiBuilderTabs } from './hooks/useMultiBuilderTabs';
import { AutoRecoveryService, type RecoverySnapshot } from '../../services/recovery/AutoRecoveryService';
import './MultiBuilderPage.css';

export const MultiBuilderPage: React.FC = () => {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    closeConfirm,
    setCloseConfirm,
    showAppCloseConfirm,
    setShowAppCloseConfirm,
    createNewTab,
    requestCloseTab,
    doCloseTab,
    updateTabTitle,
    updateTabDirty,
    updateTabProjectPath,
    handleTabDragStart,
    handleTabDragOver,
    handleTabDrop,
    handleAppDontSaveAndClose,
    handleAppSaveAndClose,
    restoreSnapshotTab,
  } = useMultiBuilderTabs();

  const [pendingRecovery, setPendingRecovery] = useState<RecoverySnapshot | null>(null);

  useEffect(() => {
    try {
      const list = AutoRecoveryService.getPendingRecoverySnapshots();
      if (list.length > 0) {
        const sorted = list.sort((a, b) => b.timestamp - a.timestamp);
        setPendingRecovery(sorted[0]);
      }
    } catch (err) {
      console.warn('[MultiBuilderPage] Recovery check error:', err);
    }
  }, []);

  return (
    <div className="multi-builder-container">
      {/* Auto-Recovery Crash Protection Banner */}
      {pendingRecovery && (
        <div className="builder-recovery-banner">
          <div className="recovery-banner-info">
            <ShieldAlert size={16} className="recovery-banner-icon" />
            <span>
              <strong>Unsaved Session Detected:</strong> Found an auto-recovery snapshot (<code>.ana.bak</code>) for <strong>"{pendingRecovery.title}"</strong> from {new Date(pendingRecovery.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Would you like to restore your last unsaved work?
            </span>
          </div>
          <div className="recovery-banner-btns">
            <button
              type="button"
              className="recovery-action-btn restore"
              onClick={() => {
                restoreSnapshotTab(pendingRecovery);
                AutoRecoveryService.clearRecoverySnapshot(pendingRecovery.tabId, pendingRecovery.projectPath).catch(() => {});
                setPendingRecovery(null);
              }}
            >
              <RotateCcw size={13} />
              Restore Session
            </button>
            <button
              type="button"
              className="recovery-action-btn discard"
              onClick={() => {
                AutoRecoveryService.discardAllSnapshots().catch(() => {});
                setPendingRecovery(null);
              }}
            >
              <X size={13} />
              Discard
            </button>
          </div>
        </div>
      )}
      {/* Tabs Bar */}
      <div className="builder-tabs-bar">
        <div className="builder-tabs-scroll">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              draggable
              className={`builder-tab ${activeTabId === tab.id ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
              onDragStart={(e) => handleTabDragStart(e, tab.id)}
              onDragOver={handleTabDragOver}
              onDrop={(e) => handleTabDrop(e, tab.id)}
            >
              <FileText size={14} />
              <span className="tab-title">{tab.title}</span>
              {tab.isDirty && <span className="dirty-indicator">●</span>}
              {tabs.length > 1 && (
                <button
                  type="button"
                  className="tab-close-btn"
                  onClick={(e) => { e.stopPropagation(); requestCloseTab(tab.id, e); }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
        
        {/* New Tab Button */}
        <div className="new-tab-wrapper">
          <button
            className="new-tab-btn"
            title="New Tab"
            onClick={createNewTab}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Tab Content — all tabs stay mounted to preserve canvas state */}
      <div className="builder-tabs-content">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-pane ${activeTabId === tab.id ? 'active' : ''}`}
          >
            <ReactFlowProvider>
              <BuilderContent
                tabId={tab.id}
                projectPath={tab.projectPath}
                initialWorkflow={tab.initialWorkflow}
                initialImage={tab.initialImage}
                onTitleChange={(title) => updateTabTitle(tab.id, title)}
                onDirtyChange={(dirty) => updateTabDirty(tab.id, dirty)}
                onProjectPathChange={(path) => updateTabProjectPath(tab.id, path)}
                isActive={activeTabId === tab.id}
              />
            </ReactFlowProvider>
          </div>
        ))}
      </div>

      {/* Close Confirmation Dialog */}
      {closeConfirm && (
        <div className="tab-close-overlay" onClick={() => setCloseConfirm(null)}>
          <div className="tab-close-dialog" onClick={e => e.stopPropagation()}>
            <div className="tab-close-dialog-title">Save before closing?</div>
            <div className="tab-close-dialog-msg">
              <strong>{closeConfirm.title}</strong> has unsaved changes.
            </div>
            <div className="tab-close-dialog-actions">
              <button
                className="tab-close-dialog-btn secondary"
                onClick={() => doCloseTab(closeConfirm.tabId)}
              >
                Don't Save
              </button>
              <button
                className="tab-close-dialog-btn secondary"
                onClick={() => setCloseConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="tab-close-dialog-btn primary"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('anarchy:trigger-save-tab', {
                    detail: { tabId: closeConfirm.tabId, closeAfterSave: true }
                  }));
                  setCloseConfirm(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App Close Confirmation Dialog */}
      {showAppCloseConfirm && (
        <div className="tab-close-overlay" onClick={() => setShowAppCloseConfirm(false)}>
          <div className="tab-close-dialog" onClick={e => e.stopPropagation()}>
            <div className="tab-close-dialog-title">Save changes before exiting?</div>
            <div className="tab-close-dialog-msg">
              You have unsaved changes in your tabs.
            </div>
            <div className="tab-close-dialog-actions">
              <button
                className="tab-close-dialog-btn secondary"
                onClick={handleAppDontSaveAndClose}
              >
                Don't Save
              </button>
              <button
                className="tab-close-dialog-btn secondary"
                onClick={() => setShowAppCloseConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="tab-close-dialog-btn primary"
                onClick={handleAppSaveAndClose}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
