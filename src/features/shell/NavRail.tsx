import React, { useEffect, useState } from 'react';
import { LayoutGrid, FolderOpen, Hammer, Sparkles, Box, Library, History, Zap, Settings, User, ChevronLeft, ChevronRight, Bot, Wand2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAuth } from '../auth/AuthContext';
import './NavRail.css';

const NAV_ITEMS = [
  { icon: LayoutGrid, label: 'Dashboard', path: '/' },
  { icon: FolderOpen, label: 'Projects', path: '/projects' },
  { icon: Hammer, label: 'Builder', path: '/builder' },
  { icon: Bot, label: 'AI Agent', path: '/generate', disabled: true },
  { icon: Wand2, label: 'LoRA Training', path: '/lora', disabled: true },
  { icon: Box, label: '3D', path: '/3d', disabled: true },
  { icon: Library, label: 'Library', path: '/library' },
  { icon: History, label: 'History', path: '/history' },
  { icon: Zap, label: 'Integrations', path: '/integrations' },
];

export const NavRail: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState('');
  const avatarUrl = localAvatarUrl || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const accountTitle = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Account';

  useEffect(() => {
    const syncAvatar = () => {
      const savedAccount = localStorage.getItem('anarchy_account');
      if (!savedAccount) {
        setLocalAvatarUrl('');
        return;
      }

      try {
        const parsed = JSON.parse(savedAccount);
        setLocalAvatarUrl(parsed.avatarUrl || '');
      } catch {
        setLocalAvatarUrl('');
      }
    };

    syncAvatar();
    window.addEventListener('storage', syncAvatar);
    window.addEventListener('anarchy-account-updated', syncAvatar);

    return () => {
      window.removeEventListener('storage', syncAvatar);
      window.removeEventListener('anarchy-account-updated', syncAvatar);
    };
  }, []);

  return (
    <nav className={clsx('nav-rail', isCollapsed && 'collapsed')}>
      <div className="nav-rail-top">
        <div className="nav-logo">
          <div className="logo-box">A</div>
        </div>
        
        <div className="nav-items">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            if (item.disabled) {
              return (
                <div
                  key={item.path}
                  className="nav-item disabled"
                  title="Coming Soon"
                >
                  <Icon size={18} strokeWidth={2} />
                  <span className="nav-item-label">{item.label}</span>
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx('nav-item', isActive && 'active')}
                title={item.label}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span className="nav-item-label">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="nav-rail-bottom">
        <Link to="/settings" className={clsx('nav-item', location.pathname === '/settings' && 'active')} title="Settings">
          <Settings size={18} />
          <span className="nav-item-label">Settings</span>
        </Link>
        <Link to="/account" className={clsx('nav-avatar', location.pathname === '/account' && 'active')} title={accountTitle}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={accountTitle} className="nav-avatar-image" referrerPolicy="no-referrer" />
          ) : (
            <User size={16} />
          )}
          <span className="nav-item-label">Account</span>
        </Link>
      </div>

      {/* Collapse Toggle Button */}
      <button
        className="nav-collapse-btn"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand' : 'Collapse'}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </nav>
  );
};
