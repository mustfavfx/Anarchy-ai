import React, { useState, useEffect, useRef, useMemo } from 'react';
import { List } from 'react-window';
const AnyList = List as React.ComponentType<any>;
import { Pencil, Copy, Trash2, Loader2, Sparkles, Layers, Image as ImageIcon, Cpu, Network } from 'lucide-react';
import type { ProjectMeta } from '../../../services/projects/ProjectService';
import { timeAgo } from '../../../services/projects/ProjectService';
import { ProjectImage } from '../ProjectsPage';

interface VirtualProjectsViewProps {
  projects: ProjectMeta[];
  viewMode: 'grid' | 'list';
  deletingPath: string | null;
  onOpenProject: (project: ProjectMeta) => void;
  onRenameClick: (project: ProjectMeta) => void;
  onDuplicateClick: (e: React.MouseEvent, project: ProjectMeta) => void;
  onDeleteClick: (e: React.MouseEvent, project: ProjectMeta) => void;
}

export const VirtualProjectsView: React.FC<VirtualProjectsViewProps> = ({
  projects,
  viewMode,
  deletingPath,
  onOpenProject,
  onRenameClick,
  onDuplicateClick,
  onDeleteClick
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries && entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({
          width: width > 0 ? width : 1000,
          height: height > 0 ? height : 600,
        });
      }
    });

    resizeObserver.observe(el);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Grid Config
  const minCardWidth = 340;
  const gridGap = 24;

  const columnsCount = useMemo(() => {
    const cols = Math.floor((dimensions.width + gridGap) / (minCardWidth + gridGap));
    return Math.max(1, cols);
  }, [dimensions.width]);

  const itemWidth = useMemo(() => {
    return Math.floor((dimensions.width - (columnsCount - 1) * gridGap - 8) / columnsCount);
  }, [dimensions.width, columnsCount]);

  const gridRowHeight = useMemo(() => {
    const imageHeight = Math.floor(itemWidth * 10 / 16); // 16:10 aspect ratio
    const detailsHeight = 145;
    return imageHeight + detailsHeight;
  }, [itemWidth]);

  const listRowHeight = 96;

  const rowCount = viewMode === 'grid'
    ? Math.ceil(projects.length / columnsCount)
    : projects.length;

  const rowHeight = viewMode === 'grid'
    ? gridRowHeight + gridGap
    : listRowHeight;

  const ListRowComponent = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const project = projects[index];
    if (!project) return null;

    return (
      <div style={{ ...style, paddingBottom: '8px', boxSizing: 'border-box' }}>
        <div
          className="project-list-item"
          onClick={() => onOpenProject(project)}
        >
          <div className="list-item-thumb">
            {project.hasImage ? (
              <ProjectImage url={project.thumbnailUrl} alt={project.name} className="small" />
            ) : (
              <div className="project-no-image small blueprint-thumb">
                <Layers size={18} className="blueprint-icon" />
              </div>
            )}
          </div>
          <div className="list-item-info">
            <div className="title-row">
              <h3 className="project-display-title">{project.name}</h3>
              {project.modelTag && <span className="model-badge-mini">{project.modelTag}</span>}
            </div>
            <div className="project-metadata">
              <span>{project.sourceCount} inputs</span>
              <span>{project.outputCount} outputs</span>
              <span>{project.refCount} links</span>
              <span>{project.totalNodes || 1} nodes</span>
            </div>
          </div>
          <div className={`status-tag ${project.status}`}>{project.status}</div>
          <span className="updated-text">{timeAgo(project.updatedAt)}</span>
          <button
            className="project-action-btn"
            onClick={(e) => { e.stopPropagation(); onRenameClick(project); }}
            title="Rename"
          >
            <Pencil size={13} />
          </button>
          <button
            className="project-action-btn"
            onClick={(e) => onDuplicateClick(e, project)}
            title="Duplicate"
          >
            <Copy size={13} />
          </button>
          <button
            className="project-action-btn danger"
            onClick={(e) => onDeleteClick(e, project)}
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  };

  const GridRowComponent = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const startIndex = index * columnsCount;
    const rowItems: ProjectMeta[] = [];

    for (let i = 0; i < columnsCount; i++) {
      const itemIndex = startIndex + i;
      if (itemIndex < projects.length) {
        rowItems.push(projects[itemIndex]);
      }
    }

    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'flex-start',
          gap: `${gridGap}px`,
          paddingLeft: '4px',
          paddingRight: '4px',
          boxSizing: 'border-box',
        }}
      >
        {rowItems.map((project) => (
          <div
            key={project.filePath}
            className="project-display-card"
            style={{ width: `${itemWidth}px`, flexShrink: 0 }}
            onClick={() => onOpenProject(project)}
          >
            <div className="project-image-box">
              {project.hasImage ? (
                <ProjectImage url={project.thumbnailUrl} alt={project.name} />
              ) : (
                <div className="project-blueprint-preview">
                  <div className="blueprint-grid-overlay" />
                  <div className="blueprint-center-content">
                    <div className="blueprint-badge-glow">
                      <Sparkles size={22} className="sparkle-anim" />
                    </div>
                    {project.promptSnippet ? (
                      <p className="blueprint-prompt-quote">"{project.promptSnippet}"</p>
                    ) : (
                      <span className="blueprint-canvas-tag">AI Canvas Workflow</span>
                    )}
                  </div>
                </div>
              )}

              <div className={`status-tag ${project.status}`}>{project.status}</div>

              {project.modelTag && (
                <div className="project-model-pill">
                  <Cpu size={10} />
                  <span>{project.modelTag}</span>
                </div>
              )}

              <div className="project-card-actions">
                <button
                  className="project-action-btn"
                  onClick={(e) => { e.stopPropagation(); onRenameClick(project); }}
                  title="Rename"
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="project-action-btn"
                  onClick={(e) => onDuplicateClick(e, project)}
                  title="Duplicate"
                >
                  <Copy size={13} />
                </button>
                <button
                  className="project-action-btn danger"
                  onClick={(e) => onDeleteClick(e, project)}
                  title="Delete"
                >
                  {deletingPath === project.filePath
                    ? <Loader2 size={13} className="spin" />
                    : <Trash2 size={13} />}
                </button>
              </div>
            </div>
            <div className="project-details-box">
              <h3 className="project-display-title">{project.name}</h3>
              <div className="project-metadata">
                <span title="Input Sources">📷 {project.sourceCount} inputs</span>
                <span title="Generated Outputs">🎨 {project.outputCount} outputs</span>
                <span title="Node Connections">🔗 {project.refCount} links</span>
                <span title="Total Nodes">📦 {project.totalNodes || 1} nodes</span>
              </div>
              <div className="project-footer">
                <span className="updated-text">Updated {timeAgo(project.updatedAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const RowComponent = viewMode === 'list' ? ListRowComponent : GridRowComponent;


  return (
    <div
      ref={containerRef}
      className="virtual-projects-wrapper"
      style={{ width: '100%', height: 'calc(100vh - 180px)', minHeight: '300px' }}
    >
      {projects.length === 0 ? (
        <div className="projects-empty">
          <h3>No projects found</h3>
        </div>
      ) : (
        <AnyList
          rowCount={rowCount}
          rowHeight={rowHeight}
          rowComponent={RowComponent}
          rowProps={{}}
          style={{ width: '100%', height: `${dimensions.height}px`, overflowX: 'hidden' }}
        />
      )}
    </div>
  );
};
