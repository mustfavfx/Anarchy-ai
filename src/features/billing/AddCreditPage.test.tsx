import { describe, it, expect, vi } from 'vitest';

// Mock Tauri API at the very top to ensure hoisting
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

// Mock Supabase
vi.mock('../../services/supabase/supabaseClient', () => {
  const mockSubscription = { unsubscribe: vi.fn() };
  return {
    supabase: {
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: 'test-token', user: { id: 'test-user-id' } } } })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: mockSubscription } })),
      },
    },
    isSupabaseConfigured: true,
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key',
  };
});

// Mock credit service
vi.mock('../../services/credit/creditService', () => ({
  getUserCredit: vi.fn(() => Promise.resolve({ balance: 100 })),
  CREDIT_PACKAGES: [
    { id: 'p10', amount: 10, credits: 100, bonus: 5 },
    { id: 'p20', amount: 20, credits: 200, bonus: 15 },
    { id: 'custom', amount: 0, credits: 0, bonus: 0 },
  ],
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddCreditPage } from './AddCreditPage';
import { AuthProvider } from '../auth/AuthContext';
import { BrowserRouter } from 'react-router-dom';

describe('AddCreditPage', () => {
  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          {component}
        </AuthProvider>
      </BrowserRouter>
    );
  };

  it('should render loading state initially', () => {
    renderWithProviders(<AddCreditPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should display credit packages', async () => {
    renderWithProviders(<AddCreditPage />);
    
    await waitFor(() => {
      expect(screen.getByText('$10')).toBeInTheDocument();
    });
  });

  it('should allow selecting different packages', async () => {
    renderWithProviders(<AddCreditPage />);
    
    await waitFor(() => {
      const p10Button = screen.getByText('$10').closest('button');
      expect(p10Button).toBeInTheDocument();
      fireEvent.click(p10Button!);
      expect(p10Button).toHaveClass('selected');
    });
  });

  it('should show success message on return from Stripe', async () => {
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      search: '?session_id=test_session',
      pathname: '/add-credit',
    } as any;

    renderWithProviders(<AddCreditPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/credits added to your account/i)).toBeInTheDocument();
    });

    window.location = originalLocation as any;
  });

  it('should show error on canceled payment', async () => {
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      search: '?canceled=true',
      pathname: '/add-credit',
    } as any;

    renderWithProviders(<AddCreditPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/payment was canceled/i)).toBeInTheDocument();
    });

    window.location = originalLocation as any;
  });
});
