import React, { useState } from 'react';
import { AlertCircle, Check, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { useAuth } from './AuthContext';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, error, clearError, isConfigured } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, fullName);
        setMessage('Account created. Check your email if confirmation is enabled.');
      }
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async () => {
    clearError();
    setLoading(true);
    try {
      await signInWithGoogle();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-ambient login-ambient-one" />
      <div className="login-ambient login-ambient-two" />

      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">A</div>
          <div>
            <h1>Anarchy AI</h1>
            <p>Sign in to continue to your workspace</p>
          </div>
        </div>

        {!isConfigured && (
          <div className="login-warning">
            <AlertCircle size={16} />
            <span>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to enable real login.</span>
          </div>
        )}

        <div className="login-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Login
          </button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
            Create Account
          </button>
        </div>

        <button className="google-btn" onClick={googleLogin} disabled={loading || !isConfigured}>
          <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z" />
          </svg>
          Continue with Google
        </button>

        <button
          type="button"
          onClick={async () => {
            // Only clear Supabase auth data, preserve user data
            const keysToRemove = Object.keys(localStorage).filter(key => 
              key.startsWith('sb-') || key.includes('supabase') || key === 'user'
            );
            keysToRemove.forEach(key => localStorage.removeItem(key));
            
            // Sign out from Supabase to clear session
            const { supabase } = await import('../../services/supabase/supabaseClient');
            await supabase.auth.signOut();
            
            window.location.reload();
          }}
          className="clear-session-btn"
        >
          Sign in with different account
        </button>

        <div className="login-divider">
          <span>or use email</span>
        </div>

        <form onSubmit={submit} className="login-form">
          {mode === 'signup' && (
            <label className="login-field">
              <span>Full Name</span>
              <div className="login-input-wrap">
                <User size={16} />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
            </label>
          )}

          <label className="login-field">
            <span>Email</span>
            <div className="login-input-wrap">
              <Mail size={16} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
          </label>

          <label className="login-field">
            <span>Password</span>
            <div className="login-input-wrap">
              <Lock size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(prev => !prev)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {error && (
            <div className="login-error">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {message && (
            <div className="login-success">
              <Check size={15} />
              {message}
            </div>
          )}

          <button className="login-submit" type="submit" disabled={loading || !isConfigured}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};
