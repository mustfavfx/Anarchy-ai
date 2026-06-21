import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

// Mock tracking service
vi.mock('../../services/tracking/trackingService', () => ({
  track: vi.fn(() => Promise.resolve()),
}));

// Mock Supabase
vi.mock('../../services/supabase/supabaseClient', () => {
  const mockAuth = {
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => {
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithPassword: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    signUp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    signInWithOAuth: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    updateUser: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    setSession: vi.fn(() => Promise.resolve({ data: { session: {} }, error: null })),
  };

  const mockRpc = vi.fn(() => Promise.resolve({ data: null, error: null }));

  return {
    supabase: {
      auth: mockAuth,
      rpc: mockRpc,
    },
    isSupabaseConfigured: true,
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key',
  };
});

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { track } from '../../services/tracking/trackingService';
import { supabase } from '../../services/supabase/supabaseClient';
import { AuthProvider, useAuth } from './AuthContext';

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset implementations and default resolves
    vi.mocked(invoke).mockReset().mockResolvedValue(null);
    vi.mocked(listen).mockReset().mockResolvedValue(() => {});
    vi.mocked(track).mockReset().mockResolvedValue();

    vi.mocked(supabase.auth.getSession).mockReset().mockResolvedValue({ data: { session: null }, error: null });
    vi.mocked(supabase.auth.onAuthStateChange).mockReset().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } } as any);
    vi.mocked(supabase.auth.signInWithPassword).mockReset().mockResolvedValue({ data: { user: {} as any, session: {} as any }, error: null } as any);
    vi.mocked(supabase.auth.signUp).mockReset().mockResolvedValue({ data: { user: {} as any, session: {} as any }, error: null } as any);
    vi.mocked(supabase.auth.signInWithOAuth).mockReset().mockResolvedValue({ data: { provider: 'google' as any, url: 'https://oauth.url' }, error: null } as any);
    vi.mocked(supabase.auth.updateUser).mockReset().mockResolvedValue({ data: { user: {} as any }, error: null } as any);
    vi.mocked(supabase.auth.signOut).mockReset().mockResolvedValue({ error: null } as any);
    vi.mocked(supabase.auth.setSession).mockReset().mockResolvedValue({ data: { session: { user: { id: 'user-123' } } } as any, error: null } as any);
    vi.mocked(supabase.rpc).mockReset().mockResolvedValue({ data: null, error: null } as any);
  });

  it('should throw error when used outside AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used inside AuthProvider');
    consoleError.mockRestore();
  });

  it('should fetch session and set up subscription on mount', async () => {
    const session = { user: { id: 'user-123', email: 'test@example.com' } };
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session }, error: null } as any);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    let hookResult: any;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    expect(supabase.auth.getSession).toHaveBeenCalled();
    expect(supabase.auth.onAuthStateChange).toHaveBeenCalled();
    expect(hookResult.current.session).toEqual(session);
    expect(hookResult.current.user).toEqual(session.user);
    expect(hookResult.current.loading).toBe(false);
  });

  it('should handle signInWithEmail success and error', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    let hookResult: any;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    // Success
    await act(async () => {
      await hookResult.current.signInWithEmail('test@test.com', 'pwd');
    });
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'pwd',
    });
    expect(hookResult.current.error).toBeNull();

    // Failure
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: {},
      error: { message: 'Invalid credentials' } as any,
    } as any);

    await act(async () => {
      await expect(hookResult.current.signInWithEmail('test@test.com', 'wrong'))
        .rejects.toEqual({ message: 'Invalid credentials' });
    });
    expect(hookResult.current.error).toBe('Invalid credentials');
  });

  it('should handle signUpWithEmail success and error', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    let hookResult: any;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    // Success
    await act(async () => {
      await hookResult.current.signUpWithEmail('new@test.com', 'pwd', 'Full Name');
    });
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'new@test.com',
      password: 'pwd',
      options: {
        data: { full_name: 'Full Name' },
      },
    });
    expect(hookResult.current.error).toBeNull();

    // Failure
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: {},
      error: { message: 'Email already exists' } as any,
    } as any);

    await act(async () => {
      await expect(hookResult.current.signUpWithEmail('new@test.com', 'pwd', 'Full Name'))
        .rejects.toEqual({ message: 'Email already exists' });
    });
    expect(hookResult.current.error).toBe('Email already exists');
  });

  it('should handle signInWithGoogle and invoke open_url', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    let hookResult: any;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await act(async () => {
      await hookResult.current.signInWithGoogle();
    });

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://anarchy.lat/auth-callback.html',
        skipBrowserRedirect: true,
      },
    });
    expect(invoke).toHaveBeenCalledWith('open_url', { url: 'https://oauth.url' });
  });

  it('should handle updatePassword', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    let hookResult: any;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await act(async () => {
      await hookResult.current.updatePassword('newsecurepwd');
    });

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newsecurepwd' });
  });

  it('should handle deleteAccount', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    let hookResult: any;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await act(async () => {
      await hookResult.current.deleteAccount();
    });

    expect(supabase.rpc).toHaveBeenCalledWith('delete_current_user');
  });

  it('should handle signOut', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    let hookResult: any;
    await act(async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      hookResult = result;
    });

    await act(async () => {
      await hookResult.current.signOut();
    });

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('should track SIGNED_IN event', async () => {
    let authStateCallback: ((event: any, session: any) => void) | null = null;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementationOnce((callback: any) => {
      authStateCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } } as any;
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    await act(async () => {
      renderHook(() => useAuth(), { wrapper });
    });

    expect(authStateCallback).toBeTypeOf('function');
    
    const userSession = { user: { id: 'user-789' } };
    await act(async () => {
      if (authStateCallback) {
        authStateCallback('SIGNED_IN', userSession);
      }
    });

    expect(track).toHaveBeenCalledWith({
      event: 'session_start',
      userId: 'user-789',
    });
  });

  it('should handle initial deep links', async () => {
    const deepLinkUrl = 'anarchy-ai://auth#access_token=foo&refresh_token=bar';
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === 'get_deep_link') return deepLinkUrl;
      return null;
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    await act(async () => {
      renderHook(() => useAuth(), { wrapper });
    });

    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'foo',
      refresh_token: 'bar',
    });
  });

  it('should listen for subsequent deep links', async () => {
    let registeredCallback: ((event: { payload: string }) => void) | null = null;
    vi.mocked(listen).mockImplementation(async (event, callback: any) => {
      if (event === 'deep-link') {
        registeredCallback = callback;
      }
      return () => {};
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    await act(async () => {
      renderHook(() => useAuth(), { wrapper });
    });

    expect(listen).toHaveBeenCalledWith('deep-link', expect.any(Function));
    
    await act(async () => {
      if (registeredCallback) {
        registeredCallback({ payload: 'anarchy-ai://auth#access_token=abc&refresh_token=xyz' });
      }
    });

    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'abc',
      refresh_token: 'xyz',
    });
  });
});
