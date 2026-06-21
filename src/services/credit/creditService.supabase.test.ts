/**
 * Credit Service – Supabase Integration Tests
 * Provides full coverage for all Supabase‑dependent functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getUserCredit,
  addCredits,
  deductCredits,
  checkCreditBalance,
  getTransactionHistory,
  refundCredits,
  cacheCreditBalance,
  getCachedCreditBalance,
} from './creditService';

// ---------------------------------------------------------------------------
// Mock Supabase client – we need a chainable query builder that can be
// configured per test. The mock is created inside the factory to avoid hoisting
// issues (Vitest hoists vi.mock calls to the top of the file).
// ---------------------------------------------------------------------------

vi.mock('../supabase/supabaseClient', () => {
  // Shared mock builder with chainable methods and async terminal calls
  const mockBuilder: any = {};
  mockBuilder._resolvedQueue = [];
  mockBuilder.mockResolvedValueOnce = (val: any) => {
    mockBuilder._resolvedQueue.push(val);
    return mockBuilder;
  };
  mockBuilder.select = vi.fn(() => mockBuilder);
  mockBuilder.insert = vi.fn(() => mockBuilder);
  mockBuilder.update = vi.fn(() => mockBuilder);
  mockBuilder.eq = vi.fn(() => mockBuilder);
  mockBuilder.order = vi.fn(() => mockBuilder);
  // .limit is terminal async call (used in getTransactionHistory)
  mockBuilder.limit = vi.fn().mockResolvedValue({ data: null, error: null });
  // .single is terminal async call (used in getUserCredit etc.)
  mockBuilder.single = vi.fn().mockResolvedValue({ data: null, error: null });
  // maybeSingle also async
  mockBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  
  // Implement thenable interface for awaited builders
  mockBuilder.then = vi.fn((onFulfilled: any) => {
    const nextVal = mockBuilder._resolvedQueue.shift() ?? { data: null, error: null };
    return Promise.resolve(nextVal).then(onFulfilled);
  });

  const mockFrom = vi.fn(() => mockBuilder);
  const mockRpc = vi.fn();
  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
    } as any,
    isSupabaseConfigured: true,
  };
});

import { supabase } from '../supabase/supabaseClient';

// Helper to generate a mock DB row representing a credit record.
const mockDbRow = (overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  user_id: 'user-123',
  balance: 100,
  total_purchased: 200,
  total_used: 100,
  last_purchase_at: null,
  expires_at: null,
  ...overrides,
});

// Helper to generate a mock transaction row.
const mockTransaction = (overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  id: 'tx-1',
  user_id: 'user-123',
  type: 'purchase',
  amount: 100,
  balance_after: 200,
  description: 'Mock transaction',
  created_at: '2024-01-01T00:00:00Z',
  metadata: {},
  ...overrides,
});

// Reset mocks before each test.
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();

  const builder = supabase.from('any') as any;
  builder._resolvedQueue = [];
  builder.select.mockReset().mockReturnValue(builder);
  builder.insert.mockReset().mockReturnValue(builder);
  builder.update.mockReset().mockReturnValue(builder);
  builder.eq.mockReset().mockReturnValue(builder);
  builder.order.mockReset().mockReturnValue(builder);
  builder.limit.mockReset().mockResolvedValue({ data: null, error: null });
  builder.single.mockReset().mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
  
  builder.then.mockReset().mockImplementation((onFulfilled: any) => {
    const nextVal = builder._resolvedQueue.shift() ?? { data: null, error: null };
    return Promise.resolve(nextVal).then(onFulfilled);
  });
  
  if (typeof (supabase.rpc as any).mockReset === 'function') {
    (supabase.rpc as any).mockReset();
  }
});

// ---------------------------------------------------------------------------
// getUserCredit
// ---------------------------------------------------------------------------

describe('getUserCredit', () => {
  it('returns a credit record when found', async () => {
    const query: any = supabase.from('user_credits');
    query.single.mockResolvedValueOnce({ data: mockDbRow(), error: null });

    const credit = await getUserCredit('user-123');
    expect(credit).not.toBeNull();
    expect(credit?.userId).toBe('user-123');
    expect(credit?.balance).toBe(100);
  });

  it('creates a credit record when none exists (PGRST116)', async () => {
    const query: any = supabase.from('user_credits');
    // First call – no record
    query.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    // Second call – create (insert -> select -> single)
    query.single.mockResolvedValueOnce({ data: mockDbRow({ balance: 0, total_purchased: 0, total_used: 0 }), error: null });

    const credit = await getUserCredit('user-123');
    expect(credit).not.toBeNull();
    expect(credit?.balance).toBe(0);
  });

  it('returns null on generic error', async () => {
    const query: any = supabase.from('user_credits');
    query.single.mockResolvedValueOnce({ data: null, error: { code: 'NETWORK_ERROR' } });
    const credit = await getUserCredit('user-123');
    expect(credit).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// addCredits
// ---------------------------------------------------------------------------

describe('addCredits', () => {
  it('uses RPC when it succeeds', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ error: null });

    const result = await addCredits('user-123', 50, 5);
    expect(result).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('add_credits', {
      p_user_id: 'user-123',
      p_credits: 50,
      p_description: 'Purchased 50 credits for $5',
    });
  });

  it('returns false when RPC fails', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ error: { message: 'fail' } });
    const result = await addCredits('user-123', 30, 3);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deductCredits
// ---------------------------------------------------------------------------

describe('deductCredits', () => {
  it('deducts credits when sufficient balance (via RPC)', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: 60, error: null });

    const result = await deductCredits('user-123', 40, 'Generate image');
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(60);
    expect(supabase.rpc).toHaveBeenCalledWith('deduct_credits', {
      p_user_id: 'user-123',
      p_amount: 40,
      p_description: 'Generate image',
    });
  });

  it('returns failure when RPC fails', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: null, error: { message: 'RPC not found' } });
    const result = await deductCredits('user-123', 40, 'Generate image');
    expect(result.success).toBe(false);
    expect(result.error).toBe('RPC not found');
  });
});

// ---------------------------------------------------------------------------
// checkCreditBalance
// ---------------------------------------------------------------------------

describe('checkCreditBalance', () => {
  it('reports enough when balance >= cost', async () => {
    const query: any = supabase.from('user_credits');
    query.single.mockResolvedValueOnce({ data: mockDbRow({ balance: 100 }), error: null });
    const res = await checkCreditBalance('user-123', 50);
    expect(res.hasEnough).toBe(true);
    expect(res.balance).toBe(100);
  });

  it('reports not enough when balance < cost', async () => {
    const query: any = supabase.from('user_credits');
    query.single.mockResolvedValueOnce({ data: mockDbRow({ balance: 20 }), error: null });
    const res = await checkCreditBalance('user-123', 50);
    expect(res.hasEnough).toBe(false);
  });

  it('defaults to standard generation cost when cost omitted', async () => {
    const query: any = supabase.from('user_credits');
    query.single.mockResolvedValueOnce({ data: mockDbRow({ balance: 5 }), error: null });
    const res = await checkCreditBalance('user-123');
    expect(res.hasEnough).toBe(true);
    expect(res.needed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// cacheCreditBalance / getCachedCreditBalance
// ---------------------------------------------------------------------------

describe('cacheCreditBalance & getCachedCreditBalance', () => {
  it('caches and retrieves a fresh balance', () => {
    cacheCreditBalance(200);
    const retrieved = getCachedCreditBalance();
    expect(retrieved).toBe(200);
  });

  it('returns null when cache is stale', () => {
    const stale = { balance: 100, timestamp: Date.now() - 6 * 60 * 1000 }; // 6 minutes
    localStorage.setItem('anarchy_credit_cache', JSON.stringify(stale));
    expect(getCachedCreditBalance()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getTransactionHistory
// ---------------------------------------------------------------------------

describe('getTransactionHistory', () => {
  it('returns mapped transactions', async () => {
    const query: any = supabase.from('credit_transactions');
    query.limit.mockResolvedValueOnce({ data: [mockTransaction()], error: null });
    const history = await getTransactionHistory('user-123');
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe('tx-1');
  });

  it('returns empty array on error', async () => {
    const query: any = supabase.from('credit_transactions');
    query.limit.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });
    const history = await getTransactionHistory('user-123');
    expect(history).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// refundCredits
// ---------------------------------------------------------------------------

describe('refundCredits', () => {
  it('uses RPC when successful', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: 130, error: null });
    const result = await refundCredits('user-123', 30, 'Refund');
    expect(result).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('refund_credits', {
      p_user_id: 'user-123',
      p_amount: 30,
      p_description: 'Refund',
    });
  });
});
