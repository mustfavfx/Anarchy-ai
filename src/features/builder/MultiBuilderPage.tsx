import React, { useState, useCallback, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Plus, X, FileText, FolderOpen } from 'lucide-react';
import { BuilderContent } from './BuilderPage';
import { listProjects, type ProjectMeta } from '../../services/projects/ProjectService';
import { SESSION_KEYS } from '../../utils/storageKeys';
import './MultiBuilderPage.css';

interface Tab {
  id: string;
  title: string;
  projectPath: string | null;
  isDirty: boolean;
}

const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const MultiBuilderPage: React.FC = () => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showNewTabMenu, setShowNewTabMenu] = useState(false);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);

  // Load projects for the new tab menu
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const all = await listProjects();
        setProjects(all);
      } catch {
        // No projects yet
      }
    };
    loadProjects();
  }, []);

  // Create initial tab or load from sessionStorage
  useEffect(() => {
    const projectPath = sessionStorage.getItem(SESSION_KEYS.OPEN_PROJECT_PATH);
    if (projectPath) {
      sessionStorage.removeItem(SESSION_KEYS.OPEN_PROJECT_PATH);
      const newTab: Tab = {
        id: generateTabId(),
        title: 'Loading...',
        projectPath: projectPath,
        isDirty: false,
      };
      setTabs([newTab]);
      setActiveTabId(newTab.id);
    } else if (tabs.length === 0) {
      // Create empty tab
      const newTab: Tab = {
        id: generateTabId(),
        title: 'Untitled',
        projectPath: null,
        isDirty: false,
      };
      setTabs([newTab]);
      setActiveTabId(newTab.id);
    }
  }, []);

  const createNewTab = useCallback(() => {
    const newTab: Tab = {
      id: generateTabId(),
      title: 'Untitled',
      projectPath: null,
      isDirty: false,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setShowNewTabMenu(false);
  }, []);

  const createTabFromProject = useCallback((project: ProjectMeta) => {
    const newTab: Tab = {
      id: generateTabId(),
      title: project.name,
      projectPath: project.filePath,
      isDirty: false,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setShowNewTabMenu(false);
  }, []);

  const closeTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      } else if (newTabs.length === 0) {
        // Create empty tab if all closed
        const emptyTab: Tab = {
          id: generateTabId(),
          title: 'Untitled',
          projectPath: null,
          isDirty: false,
        };
        setActiveTabId(emptyTab.id);
        return [emptyTab];
      }
      return newTabs;
    });
  }, [activeTabId]);

  const updateTabTitle = useCallback((tabId: string, title: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, title } : tab
    ));
  }, []);

  return (
    <div className="multi-builder-container">
      {/* Tabs Bar */}
      <div className="builder-tabs-bar">
        <div className="builder-tabs-scroll">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`builder-tab ${activeTabId === tab.id ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <FileText size={14} />
              <span className="tab-title">{tab.title}</span>
              {tab.isDirty && <span className="dirty-indicator">●</span>}
              <button
                className="tab-close-btn"
                onClick={(e) => closeTab(tab.id, e)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        
        {/* New Tab Button */}
        <div className="new-tab-wrapper">
          <button
            className="new-tab-btn"
            onClick={() => setShowNewTabMenu(!showNewTabMenu)}
          >
            <Plus size={16} />
          </button>
          
          {/* New Tab Menu */}
          {showNewTabMenu && (
            <div className="new-tab-menu">
              <div className="new-tab-header">Open Project</div>
              <button className="new-tab-option" onClick={createNewTab}>
                <FileText size={14} />
                <span>New Empty Tab</span>
              </button>
              {projects.length > 0 && (
                <>
                  <div className="new-tab-divider" />
                  <div className="new-tab-projects">
                    {projects.slice(0, 10).map(project => (
                      <button
                        key={project.filePath}
                        className="new-tab-project-item"
                        onClick={() => createTabFromProject(project)}
                      >
                        <FolderOpen size={14} />
                        <span>{project.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="builder-tabs-content">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-pane ${activeTabId === tab.id ? 'active' : ''}`}
          >
            {activeTabId === tab.id && (
              <ReactFlowProvider>
                <BuilderContent 
                  tabId={tab.id}
                  projectPath={tab.projectPath}
                  onTitleChange={(title) => updateTabTitle(tab.id, title)}
                />
              </ReactFlowProvider>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
