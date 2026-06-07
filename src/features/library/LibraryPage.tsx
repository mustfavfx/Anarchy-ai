import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { 
  Search, FolderOpen, Loader2, X, 
  Trash2, Edit3, Copy, Layers, FileDown,
  Calendar, Clock, Image as ImageIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ConfirmModal } from '../../components/ConfirmModal';
import { 
  listProjects, 
  deleteProject, 
  duplicateProject, 
  renameProject, 
  timeAgo, 
  type ProjectMeta 
} from '../../services/projects/ProjectService';
import { SESSION_KEYS } from '../../utils/storageKeys';
import { exportImagesToPDFWithDialog } from '../../services/export';
import { useNotificationStore } from '../../stores/notificationStore';
import { invoke } from '@tauri-apps/api/core';
import { useResolvedImage } from '../../hooks/useResolvedImage';
import './LibraryPage.css';

type FilterType = 'all' | 'active' | 'draft';

interface ProjectThumbnailProps {
  url: string | undefined;
  alt: string;
  className?: string;
  large?: boolean;
}

const ProjectThumbnail: React.FC<ProjectThumbnailProps> = ({ url, alt, className, large }) => {
  const resolvedUrl = useResolvedImage(url);

  if (!resolvedUrl) {
    return (
      <div className={`project-placeholder ${large ? 'large' : ''}`}>
        <FolderOpen size={large ? 64 : 32} />
      </div>
    );
  }

  return (
    <img 
      src={resolvedUrl} 
      alt={alt} 
      loading="lazy"
      className={className}
    />
  );
};

export const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const addNotification = useNotificationStore(state => state.addNotification);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectMeta | null>(null);
  
  // Dialog/Modal states
  const [renamingProject, setRenamingProject] = useState<ProjectMeta | null>(null);
  const [newName, setNewName] = useState('');
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string>('');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listProjects();
      setProjects(list);
      
      // Update selected project metadata if it is open
      if (selectedProject) {
        const updated = list.find(p => p.filePath === selectedProject.filePath);
        if (updated) {
          setSelectedProject(updated);
        } else {
          setSelectedProject(null);
        }
      }
    } catch (err) {
      logger.error('[Library] Failed to load projects:', err);
    }
    setLoading(false);
  }, [selectedProject]);

  useEffect(() => {
    loadProjects();
  }, []);

  // Filter projects by search query and category tab
  const filteredProjects = projects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'active' && p.status !== 'active') return false;
    if (filter === 'draft' && p.status !== 'draft') return false;
    return true;
  });

  // Action handlers
  const handleOpenProject = async (filePath: string) => {
    try {
      sessionStorage.setItem(SESSION_KEYS.OPEN_PROJECT_PATH, filePath);
      navigate('/builder');
    } catch (err) {
      logger.error('[Library] Open project failed:', err);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, filePath: string) => {
    e.stopPropagation();
    try {
      await duplicateProject(filePath);
      loadProjects();
    } catch (err) {
      logger.error('[Library] Duplicate project failed:', err);
    }
  };

  const handleRenameClick = (e: React.MouseEvent, project: ProjectMeta) => {
    e.stopPropagation();
    setRenamingProject(project);
    setNewName(project.name);
  };

  const handleRenameConfirm = async () => {
    if (renamingProject && newName.trim()) {
      try {
        await renameProject(renamingProject.filePath, newName.trim());
        setRenamingProject(null);
        setNewName('');
        loadProjects();
      } catch (err) {
        logger.error('[Library] Rename project failed:', err);
      }
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, project: ProjectMeta) => {
    e.stopPropagation();
    setConfirmDeletePath(project.filePath);
    setConfirmDeleteName(project.name);
  };

  const handleDeleteConfirm = async () => {
    if (confirmDeletePath) {
      try {
        await deleteProject(confirmDeletePath);
        setConfirmDeletePath(null);
        setSelectedProject(null);
        loadProjects();
      } catch (err) {
        logger.error('[Library] Delete project failed:', err);
      }
    }
  };

  const handleExportPDF = async (e: React.MouseEvent, project: ProjectMeta) => {
    e.stopPropagation();
    try {
      const contents = await invoke<string>('load_file', { path: project.filePath });
      const wf = JSON.parse(contents);
      const outputNodes = wf.nodes.filter((n: any) => n.data?.image || n.data?.outputData?.image);
      const images = outputNodes
        .map((n: any) => {
          const img = n.data?.image || n.data?.outputData?.image;
          return { url: img, name: n.data?.label || 'Render', prompt: n.data?.prompt };
        })
        .filter((img: any) => !!img.url);

      if (images.length > 0) {
        const filePath = await exportImagesToPDFWithDialog(images, { 
          title: `Anarchy AI — Project Export: ${project.name}`,
          author: 'Anarchy AI',
          subject: 'AI Generated Images from Library'
        });
        if (filePath) {
          addNotification({ 
            type: 'success', 
            title: 'PDF Exported', 
            message: `Saved to: ${filePath.split(/[\\/]/).pop()}` 
          });
        }
      } else {
        addNotification({
          type: 'warning',
          title: 'Export Failed',
          message: 'No render outputs found in this project to export.'
        });
      }
    } catch (err: any) {
      logger.error('[Library] PDF export failed:', err);
      addNotification({ 
        type: 'error', 
        title: 'PDF Export Failed', 
        message: err?.message || 'Failed to export PDF' 
      });
    }
  };

  return (
    <div className="library-page">
      {/* Control bar */}
      <div className="library-controls">
        <div className="header-left-group">
          <h1 className="page-title">Library</h1>
          <div className="library-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="library-filter-group">
          <button 
            className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({projects.length})
          </button>
          <button 
            className={`filter-chip ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active ({projects.filter(p => p.status === 'active').length})
          </button>
          <button 
            className={`filter-chip ${filter === 'draft' ? 'active' : ''}`}
            onClick={() => setFilter('draft')}
          >
            Drafts ({projects.filter(p => p.status === 'draft').length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="library-loading">
          <Loader2 size={24} className="spin" />
          <span>Scanning saved projects...</span>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="library-empty">
          <ImageIcon size={40} />
          <h3>{search || filter !== 'all' ? 'No matching projects' : 'No saved projects yet'}</h3>
          <p>
            {search || filter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create a design on the Builder Canvas and save it to see your projects here'}
          </p>
        </div>
      ) : (
        <div className="assets-grid">
          {filteredProjects.map(project => {
            return (
              <div
                key={project.filePath}
                className="asset-card source-card"
                onClick={() => setSelectedProject(project)}
              >
                <div className="asset-image-box">
                  <ProjectThumbnail url={project.thumbnailUrl} alt={project.name} />

                  <div className={`project-status-badge ${project.status}`}>
                    {project.status === 'active' ? 'Active' : 'Draft'}
                  </div>

                  <div className="result-count-badge">
                    <Layers size={12} />
                    <span>{project.outputCount} outputs</span>
                  </div>

                  {/* Actions overlay */}
                  <div className="asset-hover-actions" onClick={e => e.stopPropagation()}>
                    <button className="asset-action-btn" onClick={() => handleOpenProject(project.filePath)} title="Open Project">
                      <FolderOpen size={14} />
                    </button>
                    <button className="asset-action-btn" onClick={(e) => handleRenameClick(e, project)} title="Rename">
                      <Edit3 size={14} />
                    </button>
                    <button className="asset-action-btn" onClick={(e) => handleDuplicate(e, project.filePath)} title="Duplicate">
                      <Copy size={14} />
                    </button>
                    <button className="asset-action-btn danger" onClick={(e) => handleDeleteClick(e, project)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="asset-details">
                  <h4 className="asset-name" title={project.name}>{project.name}</h4>
                  <div className="project-meta-row">
                    <span className="project-node-count">{project.sourceCount} nodes</span>
                    <span className="project-time-badge">{timeAgo(project.updatedAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project Details Modal */}
      {selectedProject && (
        <div className="library-preview-overlay" onClick={() => setSelectedProject(null)}>
          <div className="library-preview-modal results-modal" onClick={e => e.stopPropagation()}>
            <button className="preview-close" onClick={() => setSelectedProject(null)}>
              <X size={18} />
            </button>
            
            {/* Modal Left: Preview Image */}
            <div className="source-section">
              <h3 className="section-title">Project Thumbnail</h3>
              <div className="source-image-wrap project-preview-img-wrap">
                <ProjectThumbnail url={selectedProject.thumbnailUrl} alt={selectedProject.name} large />
              </div>
              <div className="source-actions flex-wrap" style={{ gap: 8 }}>
                <button className="preview-download-btn w-full" onClick={() => handleOpenProject(selectedProject.filePath)}>
                  <FolderOpen size={14} />
                  <span>Open in Builder</span>
                </button>
                <button className="preview-download-btn secondary flex-1" onClick={(e) => handleRenameClick(e, selectedProject)}>
                  <Edit3 size={14} />
                  <span>Rename</span>
                </button>
                <button className="preview-download-btn secondary flex-1" onClick={(e) => handleDuplicate(e, selectedProject.filePath)}>
                  <Copy size={14} />
                  <span>Duplicate</span>
                </button>
                {selectedProject.outputCount > 0 && (
                  <button className="preview-download-btn secondary w-full" onClick={(e) => handleExportPDF(e, selectedProject)} title="Export all renders to PDF">
                    <FileDown size={14} />
                    <span>Export Project to PDF</span>
                  </button>
                )}
                <button className="preview-download-btn danger w-full" onClick={(e) => handleDeleteClick(e, selectedProject)}>
                  <Trash2 size={14} />
                  <span>Delete Project</span>
                </button>
              </div>
            </div>
            
            {/* Modal Right: Details / Specs */}
            <div className="results-section project-details-section">
              <h3 className="section-title">Project Details</h3>
              
              <div className="project-spec-card">
                <h2 className="project-spec-title">{selectedProject.name}</h2>
                <span className={`project-status-tag ${selectedProject.status}`}>{selectedProject.status}</span>
                
                <div className="project-stats-grid">
                  <div className="stat-box">
                    <span className="stat-label">Source Images</span>
                    <span className="stat-value">{selectedProject.sourceCount}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Render Outputs</span>
                    <span className="stat-value">{selectedProject.outputCount}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Workflow Connections</span>
                    <span className="stat-value">{selectedProject.refCount}</span>
                  </div>
                </div>

                <div className="project-spec-list">
                  <div className="spec-item">
                    <Calendar size={13} />
                    <span className="spec-label">Created:</span>
                    <span className="spec-value">{new Date(selectedProject.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                  <div className="spec-item">
                    <Clock size={13} />
                    <span className="spec-label">Modified:</span>
                    <span className="spec-value">{new Date(selectedProject.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                  <div className="spec-item file-path-item" title={selectedProject.filePath}>
                    <FolderOpen size={13} />
                    <span className="spec-label">Location:</span>
                    <span className="spec-value file-path-text">{selectedProject.filePath}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename Dialog Modal */}
      {renamingProject && (
        <div className="library-preview-overlay rename-overlay" onClick={() => setRenamingProject(null)}>
          <div className="library-preview-modal rename-modal" onClick={e => e.stopPropagation()}>
            <h3>Rename Project</h3>
            <p className="modal-subtext">Enter a new name for your project file.</p>
            <input
              className="col-new-input"
              style={{ width: '100%', marginBottom: 20 }}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Project name..."
              onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); }}
              autoFocus
            />
            <div className="rename-dialog-actions">
              <button className="send-option-cancel" onClick={() => setRenamingProject(null)}>Cancel</button>
              <button className="col-create-btn" onClick={handleRenameConfirm} disabled={!newName.trim()}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeletePath && (
        <ConfirmModal
          title="Delete Project"
          message={`Delete project "${confirmDeleteName}"? This will permanently delete the project file from disk.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDeletePath(null)}
        />
      )}
    </div>
  );
};
