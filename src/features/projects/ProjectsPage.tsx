import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { useNavigate } from 'react-router-dom';
import { Search, Grid, List as ListIcon, Plus, Trash2, FolderOpen, Image as ImageIcon, Loader2, Copy, Pencil, ArrowUpDown } from 'lucide-react';
import { listProjects, deleteProject, renameProject, duplicateProject, timeAgo, type ProjectMeta } from '../../services/projects/ProjectService';
import { loadWorkflow } from '../../services/workflow';
import { ConfirmModal } from '../../components/ConfirmModal';
import { SESSION_KEYS } from '../../utils/storageKeys';
import './ProjectsPage.css';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectMeta | null>(null);
  const [renameTarget, setRenameTarget] = useState<ProjectMeta | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listProjects();
      setProjects(list);
    } catch (err) {
      logger.error('[Projects] Failed to list:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleNewProject = () => {
    navigate('/builder');
  };

  const handleOpenProject = async (project: ProjectMeta) => {
    // Navigate to builder — the load happens there via the workflow service
    // We store the path in sessionStorage so BuilderPage can pick it up
    sessionStorage.setItem(SESSION_KEYS.OPEN_PROJECT_PATH, project.filePath);
    navigate('/builder');
  };

  const handleDelete = (e: React.MouseEvent, project: ProjectMeta) => {
    e.stopPropagation();
    setConfirmDelete(project);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const project = confirmDelete;
    setConfirmDelete(null);
    setDeletingPath(project.filePath);
    try {
      await deleteProject(project.filePath);
      setProjects(prev => prev.filter(p => p.filePath !== project.filePath));
    } catch (err) {
      logger.error('[Projects] Delete failed:', err);
    }
    setDeletingPath(null);
  };

  const handleImportFile = async () => {
    try {
      const result = await loadWorkflow();
      if (result) {
        const payload = {
          nodes: result.nodes,
          edges: result.edges,
          name: result.name || 'Imported Project',
        };
        sessionStorage.setItem(SESSION_KEYS.LOADED_WORKFLOW, JSON.stringify(payload));
        navigate('/builder');
      }
    } catch (err) {
      logger.error('[Projects] Import failed:', err);
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await renameProject(renameTarget.filePath, renameValue.trim());
      await refresh();
    } catch (err) {
      logger.error('[Projects] Rename failed:', err);
    }
    setRenameTarget(null);
    setRenameValue('');
  };

  const handleDuplicate = async (e: React.MouseEvent, project: ProjectMeta) => {
    e.stopPropagation();
    try {
      await duplicateProject(project.filePath);
      await refresh();
    } catch (err) {
      logger.error('[Projects] Duplicate failed:', err);
    }
  };

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortOrder === 'name') return a.name.localeCompare(b.name);
    if (sortOrder === 'oldest') return a.updatedAt - b.updatedAt;
    return b.updatedAt - a.updatedAt;
  });

  const filtered = sortedProjects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="projects-page">
      <div className="projects-header">
        <div className="header-left-group">
          <h1 className="page-title">Projects</h1>
          <div className="projects-search-bar">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={14} />
            </button>
            <button
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <ListIcon size={14} />
            </button>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="import-btn"
            title={sortOrder === 'newest' ? 'Sorted: Newest' : sortOrder === 'oldest' ? 'Sorted: Oldest' : 'Sorted: Name'}
            onClick={() => setSortOrder(o => o === 'newest' ? 'oldest' : o === 'oldest' ? 'name' : 'newest')}
          >
            <ArrowUpDown size={14} />
            <span>{sortOrder === 'newest' ? 'Newest' : sortOrder === 'oldest' ? 'Oldest' : 'Name'}</span>
          </button>
          <button className="import-btn" onClick={handleImportFile}>
            <FolderOpen size={16} />
            <span>Open File</span>
          </button>
          <button className="new-project-btn" onClick={handleNewProject}>
            <Plus size={18} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="projects-loading">
          <Loader2 size={24} className="spin" />
          <span>Loading projects...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="projects-empty">
          {search ? (
            <>
              <Search size={40} />
              <h3>No projects match "{search}"</h3>
              <p>Try a different search term</p>
            </>
          ) : (
            <>
              <ImageIcon size={40} />
              <h3>No projects yet</h3>
              <p>Create a new project or open an existing .ana file</p>
              <button className="new-project-btn" onClick={handleNewProject}>
                <Plus size={18} />
                <span>New Project</span>
              </button>
            </>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="projects-grid">
          {filtered.map((project) => (
            <div
              key={project.filePath}
              className="project-display-card"
              onClick={() => handleOpenProject(project)}
            >
              <div className="project-image-box">
                {project.thumbnailUrl ? (
                  <img src={project.thumbnailUrl} alt={project.name} />
                ) : (
                  <div className="project-no-image">
                    <ImageIcon size={32} />
                  </div>
                )}
                <div className={`status-tag ${project.status}`}>
                  {project.status}
                </div>
                <div className="project-card-actions">
                  <button
                    className="project-action-btn"
                    onClick={(e) => { e.stopPropagation(); setRenameTarget(project); setRenameValue(project.name); }}
                    title="Rename"
                  ><Pencil size={13} /></button>
                  <button
                    className="project-action-btn"
                    onClick={(e) => handleDuplicate(e, project)}
                    title="Duplicate"
                  ><Copy size={13} /></button>
                  <button
                    className="project-action-btn danger"
                    onClick={(e) => handleDelete(e, project)}
                    title="Delete"
                  >
                    {deletingPath === project.filePath ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
              <div className="project-details-box">
                <h3 className="project-display-title">{project.name}</h3>
                <div className="project-metadata">
                  <span>{project.sourceCount} sources</span>
                  <span>{project.outputCount} outputs</span>
                  <span>{project.refCount} refs</span>
                </div>
                <div className="project-path-text" title={project.filePath}>
                  {project.filePath}
                </div>
                <div className="project-footer">
                  <span className="updated-text">Updated {timeAgo(project.updatedAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="projects-list">
          {filtered.map((project) => (
            <div
              key={project.filePath}
              className="project-list-item"
              onClick={() => handleOpenProject(project)}
            >
              <div className="list-item-thumb">
                {project.thumbnailUrl ? (
                  <img src={project.thumbnailUrl} alt={project.name} />
                ) : (
                  <div className="project-no-image small">
                    <ImageIcon size={18} />
                  </div>
                )}
              </div>
              <div className="list-item-info">
                <h3 className="project-display-title">{project.name}</h3>
                <div className="project-metadata">
                  <span>{project.sourceCount} sources</span>
                  <span>{project.outputCount} outputs</span>
                  <span>{project.refCount} refs</span>
                </div>
                <div className="project-path-text list-path" title={project.filePath}>
                  {project.filePath}
                </div>
              </div>
              <div className={`status-tag ${project.status}`}>{project.status}</div>
              <span className="updated-text">{timeAgo(project.updatedAt)}</span>
              <button
                className="project-action-btn"
                onClick={(e) => { e.stopPropagation(); setRenameTarget(project); setRenameValue(project.name); }}
                title="Rename"
              ><Pencil size={13} /></button>
              <button
                className="project-action-btn"
                onClick={(e) => handleDuplicate(e, project)}
                title="Duplicate"
              ><Copy size={13} /></button>
              <button
                className="project-action-btn danger"
                onClick={(e) => handleDelete(e, project)}
                title="Delete"
              ><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete Project"
          message={`Delete "${confirmDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {renameTarget && (
        <div className="rename-overlay" onClick={() => setRenameTarget(null)}>
          <div className="rename-modal" onClick={e => e.stopPropagation()}>
            <h3>Rename Project</h3>
            <input
              className="rename-input"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenameTarget(null); }}
              autoFocus
            />
            <div className="rename-actions">
              <button className="btn-secondary" onClick={() => setRenameTarget(null)}>Cancel</button>
              <button className="new-project-btn" onClick={handleRename}>Rename</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
