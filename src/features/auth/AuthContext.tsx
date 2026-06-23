import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isSupabaseConfigured, supabase } from '../../services/supabase/supabaseClient';
import { track } from '../../services/tracking/trackingService';
import { ErrorReportingService } from '../../services/monitoring/ErrorReportingService';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const handleDeepLink = async (url: string) => {
      try {
        console.log('Received deep link:', url);
        // Replace custom protocol prefix with a standard URL format to parse easily
        const parsedUrl = new URL(url.replace('anarchy-ai://', 'http://localhost/'));
        const hash = parsedUrl.hash ? parsedUrl.hash.substring(1) : '';
        const query = parsedUrl.search ? parsedUrl.search.substring(1) : '';
        const params = new URLSearchParams(hash || query);

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          setLoading(true);
          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!mounted) return;
          if (setSessionError) {
            setError(setSessionError.message);
          } else {
            setSession(data.session);
          }
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Failed to parse deep link:', err);
        setError(err?.toString() ?? 'Error processing authentication link');
      }
    };

    // 1. Fetch current session
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setLoading(false);
    });

    // 2. Set up normal auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (event === 'SIGNED_IN' && nextSession?.user) {
        track({ event: 'session_start', userId: nextSession.user.id }).catch(() => {});
      }
    });

    // 3. Check for initial startup deep link parameter
    invoke<string | null>('get_deep_link')
      .then((url) => {
        if (url && mounted) {
          handleDeepLink(url);
        }
      })
      .catch((err) => console.error('Failed to get initial deep link:', err));

    // 4. Register listener for subsequent deep links (single-instance callback events)
    const unsubPromise = listen<string>('deep-link', (event) => {
      if (mounted && event.payload) {
        handleDeepLink(event.payload);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      unsubPromise.then((unsub) => unsub()).catch((err) => console.error(err));
    };
  }, []);
  useEffect(() => {
    if (isSupabaseConfigured) {
      ErrorReportingService.setUser(session?.user?.id ?? null).catch((err) => {
        console.error('[AuthContext] Failed to set Sentry user context:', err);
      });
    } else {
      ErrorReportingService.setUser('mock-user-id').catch(() => {});
    }
  }, [session]);

  const signInWithEmail = async (email: string, password: string) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }
  };

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    setError(null);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    if (signUpError) {
      setError(signUpError.message);
      throw signUpError;
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    try {
      const { data, error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://anarchy.lat/auth-callback.html',
          skipBrowserRedirect: true,
        },
      });
      if (googleError) {
        setError(googleError.message);
        throw googleError;
      }
      if (data?.url) {
        await invoke('open_url', { url: data.url });
      } else {
        throw new Error('Unable to retrieve Google login URL');
      }
    } catch (err: any) {
      setError(err?.message ?? err?.toString() ?? 'Failed to start Google sign-in');
      throw err;
    }
  };

  const updatePassword = async (password: string) => {
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      throw updateError;
    }
  };

  const deleteAccount = async () => {
    setError(null);
    const { error: deleteError } = await supabase.rpc('delete_current_user');
    if (deleteError) {
      setError(deleteError.message);
      throw deleteError;
    }
  };

  const signOut = async () => {
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      throw signOutError;
    }
  };

  const value = useMemo<AuthContextValue>(() => {
    const mockUser: User = {
      id: 'mock-user-id',
      email: 'mock@example.com',
      user_metadata: { full_name: 'Mock User' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString()
    } as any;

    const actualUser = isSupabaseConfigured ? (session?.user ?? null) : mockUser;
    const actualSession = isSupabaseConfigured ? session : ({ user: mockUser } as any);

    return {
      user: actualUser,
      session: actualSession,
      loading: isSupabaseConfigured ? loading : false,
      error,
      isConfigured: isSupabaseConfigured,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      updatePassword,
      deleteAccount,
      signOut,
      clearError: () => setError(null),
    };
  }, [session, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
};
