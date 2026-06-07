import React, { useState, useEffect } from 'react';
import {
  X, BookOpen, Search, Play, ArrowRight,
  Layers, Workflow, Download,
  FileText, Video, HelpCircle, ExternalLink,
  Zap, Cpu, History, Settings, Loader2
} from 'lucide-react';
import './DocumentationModal.css';
import { 
  getDocCategories, 
  getVideoTutorials, 
  searchDocs, 
  loadDocContent,
  type DocCategory,
  type DocFile 
} from '../../services/docs';
import { DocViewer } from '../../components/DocViewer';
import { SupportModal } from './SupportModal';

// ── Data (outside component for reference stability) ────────────────────────

// ── Icon mapping ───────────────────────────────────────────────────────────

const iconMap: Record<string, React.ReactNode> = {
  'BookOpen': <BookOpen size={20} />,
  'Zap': <Zap size={20} />,
  'Layers': <Layers size={20} />,
  'Workflow': <Workflow size={20} />,
  'Cpu': <Cpu size={20} />,
  'Download': <Download size={20} />,
  'History': <History size={20} />,
  'Settings': <Settings size={20} />,
};

// ── Component ───────────────────────────────────────────────────────────────

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriesData, setCategoriesData] = useState<DocCategory[]>([]);
  const [videoTutorialsData, setVideoTutorialsData] = useState<DocFile[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<DocCategory[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<DocFile[]>([]);
  const [showSupport, setShowSupport] = useState(false);
  
  // Viewer state
  const [activeDoc, setActiveDoc] = useState<{ title: string; content: string } | null>(null);

  // Load documentation data
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      const categories = getDocCategories();
      const videos = getVideoTutorials();
      setCategoriesData(categories);
      setVideoTutorialsData(videos);
      setFilteredCategories(categories);
      setFilteredVideos(videos);
      const timer = setTimeout(() => setIsLoading(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Filter content based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCategories(categoriesData);
      setFilteredVideos(videoTutorialsData);
      return;
    }
    
    const { categories, videos } = searchDocs(searchQuery);
    setFilteredCategories(categories);
    setFilteredVideos(videos);
  }, [searchQuery, categoriesData, videoTutorialsData]);
  
  // Handle doc click
  const handleDocClick = async (doc: DocFile) => {
    if (doc.type === 'doc') {
      setIsLoading(true);
      const content = await loadDocContent(doc.path);
      setActiveDoc({ title: doc.title, content });
      setIsLoading(false);
    }
  };
  
  // Handle back from viewer
  const handleBackFromViewer = () => {
    setActiveDoc(null);
  };

  if (!isOpen) return null;

  return (
    <>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="doc-search-clear" 
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="doc-loading">
            <Loader2 size={32} className="doc-loading-spinner" />
            <p>Loading documentation...</p>
          </div>
        )}

        {/* Doc Viewer */}
        {activeDoc && (
          <DocViewer 
            title={activeDoc.title}
            content={activeDoc.content}
            onBack={handleBackFromViewer}
          />
        )}

        {/* Content */}
        {!isLoading && !activeDoc && (
        <div className="doc-modal-content">
          {/* Empty State */}
          {filteredCategories.length === 0 && filteredVideos.length === 0 && (
            <div className="doc-empty-state">
              <Search size={48} />
              <p>No results found for "{searchQuery}"</p>
              <button onClick={() => setSearchQuery('')}>Clear search</button>
            </div>
          )}

          {/* Categories Grid */}
          {filteredCategories.length > 0 && (
          <div className="doc-categories-grid">
            {filteredCategories.map((category) => (
              <div key={category.id} className="doc-category-card">
                <div className="doc-category-header">
                  <div className="doc-category-icon">{iconMap[category.icon] || <BookOpen size={20} />}</div>
                  <div className="doc-category-info">
                    <h3>{category.title}</h3>
                    <p>{category.description}</p>
                  </div>
                </div>
                <ul className="doc-category-items">
                  {category.items.map((item, index) => (
                    <li key={index}>
                      <button 
                        className="doc-item-link" 
                        onClick={() => handleDocClick(item)}
                      >
                        {item.type === 'video' ? (
                          <Play size={14} className="doc-item-icon video" />
                        ) : (
                          <FileText size={14} className="doc-item-icon doc" />
                        )}
                        <span>{item.title}</span>
                        <ArrowRight size={14} className="doc-item-arrow" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          )}

          {/* Video Tutorials Section */}
          {filteredVideos.length > 0 && (
          <div className="doc-videos-section">
            <div className="doc-section-header">
              <Video size={20} />
              <h3>Video Tutorials</h3>
            </div>
            <div className="doc-videos-grid">
              {filteredVideos.map((video, index) => (
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
          )}

          {/* Help Section */}
          <div className="doc-help-section">
            <div className="doc-help-card">
              <HelpCircle size={24} />
              <div>
                <h4>Need Help?</h4>
                <p>Contact support or join our community</p>
              </div>
              <button className="doc-help-link" onClick={() => setShowSupport(true)}>
                Get Support <ExternalLink size={14} />
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
    <SupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} />
    </>
  );
};
