import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { LoginPage } from './LoginPage';
import './ProtectedApp.css';

export const ProtectedApp: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-card">
          <div className="auth-loading-logo">A</div>
          <Loader2 size={22} className="auth-spinner" />
          <span>Loading secure session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <>{children}</>;
};
