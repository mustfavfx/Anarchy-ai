import React from 'react';
import {
  X, BookOpen, Search, Play, ArrowRight,
  Layers, Workflow, Download,
  FileText, Video, HelpCircle, ExternalLink
} from 'lucide-react';
import './DocumentationModal.css';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const categories = [
    {
      id: 'getting-started',
      icon: <BookOpen size={20} />,
      title: 'Getting Started',
      description: 'Learn the basics of Anarchy-AI and set up your first workflow',
      items: [
        { title: 'Installation & Setup', type: 'doc', link: '#' },
        { title: 'Your First Project', type: 'video', link: '#' },
        { title: 'Interface Overview', type: 'doc', link: '#' },
        { title: 'Keyboard Shortcuts', type: 'doc', link: '#' },
      ]
    },
    {
      id: 'node-library',
      icon: <Layers size={20} />,
      title: 'Node Library',
      description: 'Explore all available nodes and their configurations',
      items: [
        { title: 'AI Generation Nodes', type: 'doc', link: '#' },
        { title: 'Input/Output Nodes', type: 'doc', link: '#' },
        { title: 'Processing Nodes', type: 'doc', link: '#' },
        { title: 'Utility Nodes', type: 'doc', link: '#' },
      ]
    },
    {
      id: 'workflows',
      icon: <Workflow size={20} />,
      title: 'Architectural Workflows',
      description: 'Step-by-step guides for common architectural tasks',
      items: [
        { title: 'Concept Massing', type: 'video', link: '#' },
        { title: 'Facade Generation', type: 'video', link: '#' },
        { title: 'Interior Visualization', type: 'video', link: '#' },
        { title: 'Landscape Design', type: 'doc', link: '#' },
      ]
    },
    {
      id: 'exporting',
      icon: <Download size={20} />,
      title: 'Exporting & Integrations',
      description: 'Export to professional CAD and BIM software',
      items: [
        { title: '3ds Max Integration', type: 'doc', link: '#' },
        { title: 'Revit Plugin Guide', type: 'doc', link: '#' },
        { title: 'SketchUp Export', type: 'doc', link: '#' },
        { title: 'Rhino/GH Workflow', type: 'video', link: '#' },
      ]
    },
  ];

  const videoTutorials = [
    { title: 'Quick Start Guide', duration: '5:30', thumbnail: '🎬' },
    { title: 'Advanced Node Workflows', duration: '12:45', thumbnail: '🎬' },
    { title: 'Best Practices', duration: '8:20', thumbnail: '🎬' },
  ];

  return (
    <div className="doc-modal-overlay" onClick={onClose}>
      <div className="doc-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="doc-modal-header">
          <div className="doc-modal-title-section">
            <BookOpen size={28} className="doc-title-icon" />
            <div>
              <h2>Documentation</h2>
              <p>Complete guide to Anarchy-AI</p>
            </div>
          </div>
          <button className="doc-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="doc-search-section">
          <div className="doc-search-bar">
            <Search size={18} className="doc-search-icon" />
            <input
              type="text"
              placeholder="Search documentation, tutorials, or nodes..."
              className="doc-search-input"
            />
          </div>
        </div>

        {/* Content */}
        <div className="doc-modal-content">
          {/* Categories Grid */}
          <div className="doc-categories-grid">
            {categories.map((category) => (
              <div key={category.id} className="doc-category-card">
                <div className="doc-category-header">
                  <div className="doc-category-icon">{category.icon}</div>
                  <div className="doc-category-info">
                    <h3>{category.title}</h3>
                    <p>{category.description}</p>
                  </div>
                </div>
                <ul className="doc-category-items">
                  {category.items.map((item, index) => (
                    <li key={index}>
                      <a href={item.link} className="doc-item-link">
                        {item.type === 'video' ? (
                          <Play size={14} className="doc-item-icon video" />
                        ) : (
                          <FileText size={14} className="doc-item-icon doc" />
                        )}
                        <span>{item.title}</span>
                        <ArrowRight size={14} className="doc-item-arrow" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Video Tutorials Section */}
          <div className="doc-videos-section">
            <div className="doc-section-header">
              <Video size={20} />
              <h3>Video Tutorials</h3>
            </div>
            <div className="doc-videos-grid">
              {videoTutorials.map((video, index) => (
                <a key={index} href="#" className="doc-video-card">
                  <div className="doc-video-thumbnail">
                    <span className="doc-video-emoji">{video.thumbnail}</span>
                    <span className="doc-video-duration">{video.duration}</span>
                  </div>
                  <p className="doc-video-title">{video.title}</p>
                </a>
              ))}
            </div>
          </div>

          {/* Help Section */}
          <div className="doc-help-section">
            <div className="doc-help-card">
              <HelpCircle size={24} />
              <div>
                <h4>Need Help?</h4>
                <p>Contact support or join our community</p>
              </div>
              <a href="#" className="doc-help-link">
                Get Support <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
