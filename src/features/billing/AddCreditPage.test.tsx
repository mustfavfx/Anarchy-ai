import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddCreditPage } from './AddCreditPage';
import { AuthProvider } from '../auth/AuthContext';
import { BrowserRouter } from 'react-router-dom';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock Supabase
vi.mock('../../services/supabase/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: 'test-token' } } })),
    },
  },
}));

// Mock credit service
vi.mock('../../services/credit/creditService', () => ({
  getUserCredit: vi.fn(() => Promise.resolve({ balance: 100 })),
  CREDIT_PACKAGES: [
    { id: 'p10', amount: 10, credits: 100, bonus: 5 },
    { id: 'p20', amount: 20, credits: 200, bonus: 15 },
    { id: 'custom', amount: 0, credits: 0, bonus: 0 },
  ],
}));

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
      expect(screen.getByText('$10 Package')).toBeInTheDocument();
    });
  });

  it('should allow selecting different packages', async () => {
    renderWithProviders(<AddCreditPage />);
    
    await waitFor(() => {
      const p10Button = screen.getByText('$10 Package');
      fireEvent.click(p10Button);
      expect(p10Button).toHaveClass('selected');
    });
  });

  it('should show success message on return from Stripe', async () => {
    // Mock URL with session_id
    Object.defineProperty(globalThis, 'location', {
      value: { search: '?session_id=test_session', pathname: '/add-credit' },
      writable: true,
    });

    renderWithProviders(<AddCreditPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/payment successful/i)).toBeInTheDocument();
    });
  });

  it('should show error on canceled payment', async () => {
    // Mock URL with canceled
    Object.defineProperty(globalThis, 'location', {
      value: { search: '?canceled=true', pathname: '/add-credit' },
      writable: true,
    });

    renderWithProviders(<AddCreditPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/payment was canceled/i)).toBeInTheDocument();
    });
  });
});
