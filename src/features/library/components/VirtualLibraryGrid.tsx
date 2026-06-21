import React, { useState, useEffect, useRef, useMemo } from 'react';
import { List } from 'react-window';
const AnyList = List as React.ComponentType<any>;
import { Layers, FolderOpen, Edit3, Copy, Trash2 } from 'lucide-react';
import type { ProjectMeta } from '../../../services/projects/ProjectService';
import { timeAgo } from '../../../services/projects/ProjectService';
import { ProjectThumbnail } from '../LibraryPage';

interface VirtualLibraryGridProps {
  projects: ProjectMeta[];
  onSelectProject: (project: ProjectMeta) => void;
  onOpenProject: (filePath: string) => void;
  onRenameClick: (e: React.MouseEvent, project: ProjectMeta) => void;
  onDuplicate: (e: React.MouseEvent, filePath: string) => void;
  onDeleteClick: (e: React.MouseEvent, project: ProjectMeta) => void;
}

export const VirtualLibraryGrid: React.FC<VirtualLibraryGridProps> = ({
  projects,
  onSelectProject,
  onOpenProject,
  onRenameClick,
  onDuplicate,
  onDeleteClick
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });

  // Measure container width and height responsively
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

  const minCardWidth = 260;
  const gap = 16;

  // Calculate columns based on container width
  const columnsCount = useMemo(() => {
    const cols = Math.floor((dimensions.width + gap) / (minCardWidth + gap));
    return Math.max(1, cols);
  }, [dimensions.width]);

  // Distribute remaining width to match 1fr CSS Grid behavior
  const itemWidth = useMemo(() => {
    return Math.floor((dimensions.width - (columnsCount - 1) * gap - 8) / columnsCount);
  }, [dimensions.width, columnsCount]);

  // Recalculate aspect-ratio dynamic height for rows
  const rowHeight = useMemo(() => {
    const imageHeight = Math.floor(itemWidth * 0.75); // 4:3 aspect ratio
    const detailsHeight = 72; // Padding + title + meta
    return imageHeight + detailsHeight;
  }, [itemWidth]);

  const rowCount = Math.ceil(projects.length / columnsCount);

  // Virtual Row Renderer
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
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
          gap: `${gap}px`,
          paddingLeft: '4px',
          paddingRight: '4px',
          boxSizing: 'border-box',
        }}
      >
        {rowItems.map((project) => (
          <div
            key={project.filePath}
            className="asset-card source-card"
            style={{ width: `${itemWidth}px`, flexShrink: 0 }}
            onClick={() => onSelectProject(project)}
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
              <div className="asset-hover-actions" onClick={(e) => e.stopPropagation()}>
                <button className="asset-action-btn" onClick={() => onOpenProject(project.filePath)} title="Open Project">
                  <FolderOpen size={14} />
                </button>
                <button className="asset-action-btn" onClick={(e) => onRenameClick(e, project)} title="Rename">
                  <Edit3 size={14} />
                </button>
                <button className="asset-action-btn" onClick={(e) => onDuplicate(e, project.filePath)} title="Duplicate">
                  <Copy size={14} />
                </button>
                <button className="asset-action-btn danger" onClick={(e) => onDeleteClick(e, project)} title="Delete">
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
        ))}
      </div>
    );
  };



  return (
    <div
      ref={containerRef}
      className="virtual-library-grid-wrapper"
      style={{ width: '100%', height: 'calc(100vh - 160px)', minHeight: '300px' }}
    >
      {projects.length === 0 ? (
        <div className="library-empty">
          <h3>No projects found</h3>
        </div>
      ) : (
        <AnyList
          rowCount={rowCount}
          rowHeight={rowHeight + gap}
          rowComponent={Row}
          rowProps={{}}
          style={{ width: '100%', height: `${dimensions.height}px`, overflowX: 'hidden' }}
        />
      )}
    </div>
  );
};
