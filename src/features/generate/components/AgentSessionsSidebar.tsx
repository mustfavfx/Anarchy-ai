import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { AgentSession } from '../hooks/useAgentChat';

interface AgentSessionsSidebarProps {
  sessions: AgentSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
  onClearAllSessions: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const AgentSessionsSidebar: React.FC<AgentSessionsSidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  onClearAllSessions,
  isOpen,
  onToggle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  // Group sessions by time
  const groupedSessions = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const today: AgentSession[] = [];
    const yesterday: AgentSession[] = [];
    const last7Days: AgentSession[] = [];
    const older: AgentSession[] = [];

    filteredSessions.forEach((session) => {
      const diff = now - (session.updatedAt || session.createdAt || now);
      if (diff < oneDay) {
        today.push(session);
      } else if (diff < 2 * oneDay) {
        yesterday.push(session);
      } else if (diff < 7 * oneDay) {
        last7Days.push(session);
      } else {
        older.push(session);
      }
    });

    return [
      { label: 'Today', items: today },
      { label: 'Yesterday', items: yesterday },
      { label: 'Last 7 Days', items: last7Days },
      { label: 'Older', items: older },
    ].filter((g) => g.items.length > 0);
  }, [filteredSessions]);

  const handleStartRename = (e: React.MouseEvent, session: AgentSession) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleSaveRename = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editingSessionId && editingTitle.trim()) {
      onRenameSession(editingSessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
  };

  const handleCancelRename = () => {
    setEditingSessionId(null);
  };

  if (!isOpen) {
    return (
      <div className="agent-sessions-collapsed-strip" title="Open Sessions Sidebar">
        <button
          type="button"
          className="sessions-collapse-toggle-btn"
          onClick={onToggle}
          title="Show Sessions"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          className="sessions-mini-new-btn"
          onClick={onNewSession}
          title="New Session"
        >
          <Plus size={16} />
        </button>
        <span className="sessions-vertical-tag">SESSIONS</span>
      </div>
    );
  }

  return (
    <aside className="agent-sessions-sidebar">
      {/* Top Header & New Chat */}
      <div className="sessions-sidebar-header">
        <div className="sessions-header-row">
          <div className="sessions-header-title">
            <MessageSquare size={15} className="sessions-icon-glow" />
            <span>Architectural Sessions</span>
            <span className="sessions-count-pill">{sessions.length}</span>
          </div>
          <button
            type="button"
            className="sessions-close-toggle-btn"
            onClick={onToggle}
            title="Collapse Sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <button
          type="button"
          className="sessions-new-chat-btn"
          onClick={onNewSession}
          title="Start new architectural session"
        >
          <Plus size={16} />
          <span>New Session</span>
          <span className="sessions-shortcut-badge">New</span>
        </button>

        {/* Search Input */}
        <div className="sessions-search-wrapper">
          <Search size={13} className="sessions-search-icon" />
          <input
            type="text"
            className="sessions-search-input"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="sessions-search-clear"
              onClick={() => setSearchQuery('')}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Sessions Scroll List */}
      <div className="sessions-list-scroll">
        {groupedSessions.length === 0 ? (
          <div className="sessions-empty-state">
            <Clock size={20} className="empty-clock-icon" />
            <p>No matching sessions</p>
          </div>
        ) : (
          groupedSessions.map((group) => (
            <div key={group.label} className="sessions-time-group">
              <div className="sessions-group-label">{group.label}</div>
              <div className="sessions-group-items">
                {group.items.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const isEditing = editingSessionId === session.id;

                  return (
                    <div
                      key={session.id}
                      className={`session-card-item ${isActive ? 'active' : ''}`}
                      onClick={() => onSelectSession(session.id)}
                    >
                      <div className="session-card-indicator" />

                      {isEditing ? (
                        <form
                          className="session-rename-form"
                          onSubmit={handleSaveRename}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            autoFocus
                            className="session-rename-input"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                          />
                          <button
                            type="submit"
                            className="rename-action-btn check"
                            title="Save"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            className="rename-action-btn cancel"
                            onClick={handleCancelRename}
                            title="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="session-card-content">
                            <span className="session-card-title" title={session.title}>
                              {session.title || 'Architectural Session'}
                            </span>
                            <div className="session-card-meta">
                              <span className="session-msg-badge">
                                {session.messages?.length || 0} messages
                              </span>
                              {session.typology && (
                                <span className="session-tag-badge">{session.typology}</span>
                              )}
                            </div>
                          </div>

                          <div className="session-actions-overlay">
                            <button
                              type="button"
                              className="session-action-btn"
                              onClick={(e) => handleStartRename(e, session)}
                              title="Rename session"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              className="session-action-btn delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSession(session.id);
                              }}
                              title="Delete session"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="sessions-sidebar-footer">
        <div className="sessions-footer-agent-info">
          <Sparkles size={13} className="footer-glow-icon" />
          <span>Conversations saved locally</span>
        </div>
        {sessions.length > 1 && (
          <button
            type="button"
            className="sessions-clear-all-btn"
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all sessions and start fresh?')) {
                onClearAllSessions();
              }
            }}
          >
            Clear all sessions
          </button>
        )}
      </div>
    </aside>
  );
};
