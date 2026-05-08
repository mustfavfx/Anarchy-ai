import React from 'react';
import { Search, Bell } from 'lucide-react';
import './GlobalHeader.css';

export const GlobalHeader: React.FC = () => {
  return (
    <header className="global-header">
      <div className="header-left">
        {/* Title is usually handled inside the page component for the dashboard style */}
      </div>
      
      <div className="header-right">
        <div className="search-bar dashboard-search">
          <Search size={16} />
          <input type="text" placeholder="Search projects, assets..." />
          <div className="shortcut">⌘K</div>
        </div>
        <button className="header-icon-btn notifications-btn">
          <Bell size={18} />
          <span className="notification-dot" />
        </button>
      </div>
    </header>
  );
};
