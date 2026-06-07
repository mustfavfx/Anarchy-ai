import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

describe('AuthContext', () => {
  it('should throw error when used outside AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
    
    consoleError.mockRestore();
  });
  
  it('should provide auth context within AuthProvider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    
    // Check methods exist
    expect(typeof result.current.signInWithEmail).toBe('function');
    expect(typeof result.current.signUpWithEmail).toBe('function');
    expect(typeof result.current.signInWithGoogle).toBe('function');
    expect(typeof result.current.signOut).toBe('function');
    expect(typeof result.current.updatePassword).toBe('function');
    expect(typeof result.current.deleteAccount).toBe('function');
  });
});
