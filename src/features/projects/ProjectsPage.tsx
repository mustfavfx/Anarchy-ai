import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Grid, List as ListIcon, Plus, Trash2, FolderOpen, Image as ImageIcon, Loader2 } from 'lucide-react';
import { listProjects, deleteProject, timeAgo, type ProjectMeta } from '../../services/projects/ProjectService';
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listProjects();
      setProjects(list);
    } catch (err) {
      console.error('[Projects] Failed to list:', err);
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
      console.error('[Projects] Delete failed:', err);
    }
    setDeletingPath(null);
  };

  const handleImportFile = async () => {
    try {
      const result = await loadWorkflow();
      if (result) {
        sessionStorage.setItem(SESSION_KEYS.LOADED_WORKFLOW, JSON.stringify(result));
        navigate('/builder');
      }
    } catch (err) {
      console.error('[Projects] Import failed:', err);
    }
  };

  const filtered = projects.filter(p =>
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
                <button
                  className="project-delete-btn"
                  onClick={(e) => handleDelete(e, project)}
                  title="Delete project"
                >
                  {deletingPath === project.filePath ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
              <div className="project-details-box">
                <h3 className="project-display-title">{project.name}</h3>
                <div className="project-metadata">
                  <span>{project.sourceCount} sources</span>
                  <span>{project.outputCount} outputs</span>
                  <span>{project.refCount} refs</span>
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
              </div>
              <div className={`status-tag ${project.status}`}>{project.status}</div>
              <span className="updated-text">{timeAgo(project.updatedAt)}</span>
              <button
                className="project-delete-btn inline"
                onClick={(e) => handleDelete(e, project)}
                title="Delete project"
              >
                <Trash2 size={14} />
              </button>
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
    </div>
  );
};
