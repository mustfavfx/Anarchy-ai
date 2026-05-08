import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Play, Plus, FolderOpen, Folder,
  Layers, Image as ImageIcon, GitBranch, Clock,
  Sparkles, PenLine, Zap, FileText, History, Shield
} from 'lucide-react';
import { listProjects, timeAgo, type ProjectMeta } from '../../services/projects/ProjectService';
import { PRESET_PROMPTS } from '../builder/presetPrompts';
import { DocumentationModal } from './DocumentationModal';
import { ChangelogModal } from './ChangelogModal';
import { SESSION_KEYS } from '../../utils/storageKeys';
import './DashboardPage.css';

// Pick a curated set of quick presets from the library
const QUICK_PRESETS = PRESET_PROMPTS.flatMap(g => g.prompts).slice(0, 12);

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [recentProjects, setRecentProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const all = await listProjects();
      setRecentProjects(all.slice(0, 4));
    } catch {
      // No projects yet — fine
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handlePresetClick = (promptText: string) => {
    sessionStorage.setItem(SESSION_KEYS.PRESET_PROMPT, promptText);
    navigate('/builder');
  };

  const totalSources = recentProjects.reduce((s, p) => s + p.sourceCount, 0);
  const totalOutputs = recentProjects.reduce((s, p) => s + p.outputCount, 0);
  const totalRefs = recentProjects.reduce((s, p) => s + p.refCount, 0);

  return (
    <div className="dashboard-page">
      <div className="dashboard-content">

        {/* Hero Card */}
        <section className="hero-section">
          <div className="hero-card">
            <div className="hero-glow" />
            <div className="hero-text">
              <h2>Welcome to <span className="text-red">ANARCHY</span></h2>
              <p>Your architectural AI workstation. Continue where you left off or start a new Builder session.</p>
            </div>
            <div className="hero-actions">
              <button className="open-builder-btn" onClick={() => navigate('/builder')}>
                <Play size={16} fill="currentColor" />
                <span>Open Builder</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>

        {/* Quick Actions Row */}
        <section className="quick-actions">
          <button className="action-card" onClick={() => navigate('/builder')}>
            <div className="action-icon"><Plus size={20} /></div>
            <div className="action-info">
              <span className="action-title">New Project</span>
              <span className="action-sub">Start from scratch</span>
            </div>
          </button>
          <button className="action-card" onClick={() => navigate('/projects')}>
            <div className="action-icon"><FolderOpen size={20} /></div>
            <div className="action-info">
              <span className="action-title">Open Project</span>
              <span className="action-sub">Resume your work</span>
            </div>
          </button>
          <button className="action-card" onClick={() => navigate('/generate')}>
            <div className="action-icon"><Sparkles size={20} /></div>
            <div className="action-info">
              <span className="action-title">Quick Generate</span>
              <span className="action-sub">AI image generation</span>
            </div>
          </button>
          <button className="action-card" onClick={() => navigate('/library')}>
            <div className="action-icon"><Layers size={20} /></div>
            <div className="action-info">
              <span className="action-title">Library</span>
              <span className="action-sub">Browse your assets</span>
            </div>
          </button>
        </section>

        {/* Stats Row */}
        {recentProjects.length > 0 && (
          <section className="stats-row">
            <div className="stat-card">
              <Folder size={18} className="stat-icon" />
              <div className="stat-value">{recentProjects.length}</div>
              <div className="stat-label">Projects</div>
            </div>
            <div className="stat-card">
              <ImageIcon size={18} className="stat-icon" />
              <div className="stat-value">{totalSources}</div>
              <div className="stat-label">Sources</div>
            </div>
            <div className="stat-card">
              <Zap size={18} className="stat-icon" />
              <div className="stat-value">{totalOutputs}</div>
              <div className="stat-label">Outputs</div>
            </div>
            <div className="stat-card">
              <GitBranch size={18} className="stat-icon" />
              <div className="stat-value">{totalRefs}</div>
              <div className="stat-label">Connections</div>
            </div>
          </section>
        )}

        {/* Quick Presets */}
        <section className="dashboard-section">
          <div className="section-header">
            <span className="header-with-icon">
              <PenLine size={16} className="text-red" />
              <h3>Quick Presets</h3>
            </span>
            <button className="view-all" onClick={() => navigate('/builder')}>
              All presets <ChevronRight size={14} />
            </button>
          </div>
          <div className="presets-grid">
            {QUICK_PRESETS.map(preset => (
              <button
                key={preset.label}
                className="preset-chip"
                onClick={() => handlePresetClick(preset.text)}
                title={preset.text}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        {/* Recent Projects */}
        <section className="dashboard-section">
          <div className="section-header">
            <span className="header-with-icon">
              <Clock size={16} className="text-red" />
              <h3>Recent Projects</h3>
            </span>
            <button className="view-all" onClick={() => navigate('/projects')}>
              View all <ChevronRight size={14} />
            </button>
          </div>
          {loading ? (
            <div className="dash-loading">Loading...</div>
          ) : recentProjects.length === 0 ? (
            <div className="dash-empty">
              <ImageIcon size={32} />
              <p>No projects yet. Create one in the Builder!</p>
            </div>
          ) : (
            <div className="recent-projects-grid">
              {recentProjects.map(project => (
                <div
                  key={project.filePath}
                  className="recent-project-card"
                  onClick={() => {
                    sessionStorage.setItem(SESSION_KEYS.OPEN_PROJECT_PATH, project.filePath);
                    navigate('/builder');
                  }}
                >
                  <div className="recent-project-thumb">
                    {project.thumbnailUrl ? (
                      <img src={project.thumbnailUrl} alt={project.name} />
                    ) : (
                      <div className="recent-project-no-img">
                        <ImageIcon size={24} />
                      </div>
                    )}
                    <div className={`recent-status ${project.status}`}>{project.status}</div>
                  </div>
                  <div className="recent-project-info">
                    <h4>{project.name}</h4>
                    <div className="recent-project-meta">
                      <span>{project.sourceCount} sources</span>
                      <span>{project.outputCount} outputs</span>
                    </div>
                    <span className="recent-project-time">{timeAgo(project.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Info Cards */}
        <section className="dashboard-section info-cards-section">
          <div className="info-cards-grid">
            <button className="info-card" onClick={() => setShowDocumentation(true)}>
              <FileText size={24} className="info-card-icon" />
              <span className="info-card-title">Documentation</span>
            </button>
            <button className="info-card" onClick={() => setShowChangelog(true)}>
              <History size={24} className="info-card-icon" />
              <span className="info-card-title">Changelog</span>
            </button>
            <button className="info-card" onClick={() => navigate('/settings')}>
              <Shield size={24} className="info-card-icon" />
              <span className="info-card-title">Privacy Policy</span>
            </button>
          </div>
        </section>

      </div>

      {/* Modals */}
      <DocumentationModal isOpen={showDocumentation} onClose={() => setShowDocumentation(false)} />
      <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
    </div>
  );
};
