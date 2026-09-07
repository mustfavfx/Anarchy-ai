import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Play, Plus, FolderOpen, Folder,
  Layers, Image as ImageIcon, GitBranch, Clock,
  PenLine, Zap, History, Shield, RotateCw, Activity, Sparkles
} from 'lucide-react';
import { listProjects, timeAgo, type ProjectMeta } from '../../services/projects/ProjectService';
import { 
  getHistoryStats, 
  loadEntries, 
  loadThumbnail, 
  loadFullImage, 
  getLocalImageAsObjectURL, 
  revokeObjectUrl, 
  type HistoryEntry 
} from '../../services/history/HistoryService';
import { PRESET_PROMPTS, VIDEO_PRESET_PROMPTS } from '../builder/presetPrompts';
import { ChangelogModal } from './ChangelogModal';
import { PrivacyPolicyModal } from '../settings/SettingsModals';
import { SESSION_KEYS } from '../../utils/storageKeys';
import { useResolvedImage } from '../../hooks/useResolvedImage';
import { useHistoryRestore } from '../history/hooks/useHistoryRestore';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import './DashboardPage.css';
import '../settings/SettingsPage.css';

const ProjectImage: React.FC<{ url?: string; alt: string }> = ({ url, alt }) => {
  const resolved = useResolvedImage(url);
  if (!url || !resolved) {
    return (
      <div className="recent-project-no-img">
        <ImageIcon size={24} />
      </div>
    );
  }
  return <img src={resolved} alt={alt} />;
};

const ActivityItemThumbnail: React.FC<{ entry: HistoryEntry }> = ({ entry }) => {
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const fetchThumbnail = async () => {
      // 1. Try loading compressed thumbnail from IndexedDB (fastest & lowest memory)
      try {
        const url = await loadThumbnail(entry.id, 'output') || 
                    await loadThumbnail(entry.id, 'root_source') || 
                    await loadThumbnail(entry.id, 'input');
        if (active && url) {
          objectUrl = url;
          setThumbSrc(url);
          return;
        }
      } catch {}

      // 2. Try loading full image from IndexedDB
      try {
        const fullUrl = await loadFullImage(entry.id, 'output') || 
                        await loadFullImage(entry.id, 'root_source') || 
                        await loadFullImage(entry.id, 'input');
        if (active && fullUrl) {
          objectUrl = fullUrl;
          setThumbSrc(fullUrl);
          return;
        }
      } catch {}

      // 3. Fallback to direct URLs on entry if present
      const direct = entry.thumbnailUrl || entry.outputImage || entry.url || entry.rootSourceImage || entry.inputImage;
      if (direct) {
        if (direct.startsWith('idb://')) {
          try {
            const resolved = await getLocalImageAsObjectURL(direct);
            if (active && resolved) {
              objectUrl = resolved;
              setThumbSrc(resolved);
              return;
            }
          } catch {}
        } else if (active) {
          setThumbSrc(direct);
          return;
        }
      }
    };

    fetchThumbnail();

    return () => {
      active = false;
      if (objectUrl) {
        revokeObjectUrl(objectUrl);
      }
    };
  }, [entry.id]);

  if (!thumbSrc) {
    return (
      <div className="activity-icon-badge">
        <Sparkles size={16} />
      </div>
    );
  }

  return (
    <img
      src={thumbSrc}
      alt=""
      className="activity-thumb"
      onError={() => setThumbSrc(null)}
      loading="lazy"
    />
  );
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { restore: restoreWorkflow } = useHistoryRestore();
  const [quickPresets, setQuickPresets] = useState<{ label: string; text: string }[]>([]);

  const refreshPresets = useCallback(() => {
    const all = [
      ...PRESET_PROMPTS.flatMap(g => g.prompts),
      ...VIDEO_PRESET_PROMPTS.flatMap(g => g.prompts)
    ];
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    setQuickPresets(shuffled.slice(0, 10));
  }, []);

  useEffect(() => {
    refreshPresets();
  }, [refreshPresets]);
  const [recentProjects, setRecentProjects] = useState<ProjectMeta[]>([]);
  const [recentGenerations, setRecentGenerations] = useState<HistoryEntry[]>([]);
  const [totalProjectCount, setTotalProjectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      const all = await listProjects();
      setTotalProjectCount(all.length);
      setRecentProjects(all.slice(0, 4));
    } catch {
      // No projects yet — fine
    }

    try {
      const history = loadEntries();
      setRecentGenerations(history.slice(0, 6));
    } catch {
      // No history yet
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  const handlePresetClick = (promptText: string) => {
    sessionStorage.setItem(SESSION_KEYS.PRESET_PROMPT, promptText);
    navigate('/builder');
  };

  const historyStats = getHistoryStats();
  const totalOutputs = historyStats.total;
  const totalStarred = historyStats.starred;

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
          <button className="action-card" onClick={() => navigate('/history')}>
            <div className="action-icon"><History size={20} /></div>
            <div className="action-info">
              <span className="action-title">History</span>
              <span className="action-sub">View your generations</span>
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
        <section className="stats-row">
          <div className="stat-card" role="button" tabIndex={0} onClick={() => navigate('/projects')} onKeyDown={e => e.key === 'Enter' && navigate('/projects')}>
            <Folder size={18} className="stat-icon" />
            <div className="stat-value">{loading ? '—' : totalProjectCount}</div>
            <div className="stat-label">Projects</div>
          </div>
          <div className="stat-card" role="button" tabIndex={0} onClick={() => navigate('/library')} onKeyDown={e => e.key === 'Enter' && navigate('/library')}>
            <ImageIcon size={18} className="stat-icon" />
            <div className="stat-value">{totalOutputs}</div>
            <div className="stat-label">Total Generations</div>
          </div>
          <div className="stat-card" role="button" tabIndex={0} onClick={() => navigate('/history')} onKeyDown={e => e.key === 'Enter' && navigate('/history')}>
            <Zap size={18} className="stat-icon" />
            <div className="stat-value">{historyStats.todayCount}</div>
            <div className="stat-label">Today</div>
          </div>
          <div className="stat-card" role="button" tabIndex={0} onClick={() => navigate('/history')} onKeyDown={e => e.key === 'Enter' && navigate('/history')}>
            <GitBranch size={18} className="stat-icon" />
            <div className="stat-value">{totalStarred}</div>
            <div className="stat-label">Starred</div>
          </div>
        </section>

        {/* Recent Activity Panel */}
        <section className="dashboard-section recent-activity-section">
          <div className="section-header">
            <span className="header-with-icon">
              <Activity size={16} className="text-red" />
              <h3>Recent Activity</h3>
            </span>
            <button
              type="button"
              className="view-all"
              onClick={() => navigate('/history')}
            >
              View history <ChevronRight size={14} />
            </button>
          </div>

          {recentGenerations.length === 0 ? (
            <div className="dash-empty" style={{ padding: '24px' }}>
              <Activity size={28} style={{ opacity: 0.3 }} />
              <p>No activity yet. Start generating in Builder to see your live stream here.</p>
            </div>
          ) : (
            <div className="recent-activity-grid">
              {recentGenerations.map((item) => {
                const prompt = item.prompt || 'Generated architectural image';
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="activity-item-card"
                    onClick={async () => {
                      if (item.prompt) {
                        sessionStorage.setItem(SESSION_KEYS.PRESET_PROMPT, item.prompt);
                      }
                      if (item.model) {
                        useAIConfigStore.getState().setConfig(prev => ({ ...prev, model: item.model as any }));
                      }
                      await restoreWorkflow(item);
                    }}
                    title={prompt}
                  >
                    <ActivityItemThumbnail entry={item} />
                    <div className="activity-details">
                      <div className="activity-title">{prompt}</div>
                      <div className="activity-meta">
                        <span className="activity-badge">{item.model || 'AI Render'}</span>
                        <span>{timeAgo(item.timestamp)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick Presets */}
        <section className="dashboard-section">
          <div className="section-header">
            <span className="header-with-icon">
              <PenLine size={16} className="text-red" />
              <h3>Quick Presets</h3>
              <button
                type="button"
                className="presets-refresh-btn animate-spin-hover"
                onClick={refreshPresets}
                title="Shuffle/Change presets"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.4)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  marginLeft: '8px',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease'
                }}
              >
                <RotateCw size={13} />
              </button>
            </span>
            <button className="view-all" onClick={() => navigate('/builder')}>
              All presets <ChevronRight size={14} />
            </button>
          </div>
          <div className="presets-grid">
            {quickPresets.map((preset, idx) => (
              <button
                key={`${preset.label}-${idx}`}
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
          {(() => {
            if (loading) return <div className="dash-loading">Loading...</div>;
            if (recentProjects.length === 0) return (
              <div className="dash-empty">
                <ImageIcon size={32} />
                <p>No projects yet. Create one in the Builder!</p>
              </div>
            );
            return (
              <div className="recent-projects-grid">
                {recentProjects.map(project => {
                  const openProject = () => {
                    sessionStorage.setItem(SESSION_KEYS.OPEN_PROJECT_PATH, project.filePath);
                    navigate('/builder');
                  };
                  return (
                <button
                  key={project.filePath}
                  className="recent-project-card"
                  type="button"
                  onClick={openProject}
                >
                  <div className="recent-project-thumb">
                    <ProjectImage url={project.thumbnailUrl} alt={project.name} />
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
                </button>
                  );
                })}
              </div>
            );
          })()}
        </section>

        {/* Info Cards */}
        <section className="dashboard-section info-cards-section">
          <div className="info-cards-grid">
            <button className="info-card" onClick={() => setShowChangelog(true)}>
              <History size={24} className="info-card-icon" />
              <span className="info-card-title">Changelog</span>
            </button>
            <button className="info-card" onClick={() => setShowPrivacy(true)}>
              <Shield size={24} className="info-card-icon" />
              <span className="info-card-title">Privacy Policy</span>
            </button>
          </div>
        </section>

      </div>

      {/* Modals */}
      <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
      {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  );
};
