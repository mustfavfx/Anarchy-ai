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
  getLocalTrialCredit,
  deductLocalTrialCredit,
  TRIAL_CREDITS_AMOUNT,
  TRIAL_DURATION_DAYS,
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

  it('defaults to standard generation cost when cost omitted for trial user', async () => {
    const query: any = supabase.from('user_credits');
    query.single.mockResolvedValueOnce({ data: mockDbRow({ balance: 5, total_purchased: 0 }), error: null });
    const res = await checkCreditBalance('user-123');
    expect(res.hasEnough).toBe(true);
    expect(res.needed).toBe(1);
  });

  it('defaults to standard generation cost when cost omitted for paid user', async () => {
    const query: any = supabase.from('user_credits');
    query.single.mockResolvedValueOnce({ data: mockDbRow({ balance: 5, total_purchased: 200 }), error: null });
    const res = await checkCreditBalance('user-123');
    expect(res.hasEnough).toBe(true);
    expect(res.needed).toBe(0.91);
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

// ---------------------------------------------------------------------------
// 7-Day Free Trial (20 credits) & Automatic Expiration Tests
// ---------------------------------------------------------------------------

describe('7-Day Free Trial Credits (20 credits) and Expiration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes local guest user with 20 free trial credits valid for 7 days', () => {
    expect(TRIAL_CREDITS_AMOUNT).toBe(20);
    expect(TRIAL_DURATION_DAYS).toBe(7);

    const credit = getLocalTrialCredit('guest-architect-id');
    expect(credit.balance).toBe(20);
    expect(credit.totalPurchased).toBe(0);
    expect(credit.expiresAt).toBeDefined();

    const expiryTime = new Date(credit.expiresAt!).getTime();
    const now = Date.now();
    const diffDays = Math.round((expiryTime - now) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(7);
  });

  it('expires unconsumed local trial credits to 0 if 7 days have passed', () => {
    // Simulate trial granted 8 days ago (unconsumed)
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem('anarchy_trial_credit_guest-test', JSON.stringify({
      userId: 'guest-test',
      balance: 20,
      totalPurchased: 0,
      totalUsed: 0,
      lastPurchaseAt: eightDaysAgo,
      expiresAt: oneDayAgo,
    }));

    const credit = getLocalTrialCredit('guest-test');
    expect(credit.balance).toBe(0); // Unconsumed credits disappeared!
  });

  it('rejects credit deduction when 7-day trial has expired', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    localStorage.setItem('anarchy_trial_credit_guest-test', JSON.stringify({
      userId: 'guest-test',
      balance: 15,
      totalPurchased: 0,
      totalUsed: 5,
      expiresAt: pastDate,
    }));

    const result = deductLocalTrialCredit('guest-test', 2);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.error).toMatch(/(?:expired after 7 days|انتهت صلاحية الـ 20 رصيد)/);
  });

  it('allows deduction when trial is within the 7-day window', () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem('anarchy_trial_credit_guest-test', JSON.stringify({
      userId: 'guest-test',
      balance: 20,
      totalPurchased: 0,
      totalUsed: 0,
      expiresAt: futureDate,
    }));

    const result = deductLocalTrialCredit('guest-test', 3);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(17);
  });

  it('zeros out unconsumed trial credits in Supabase getUserCredit when expires_at has passed', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const query: any = supabase.from('user_credits');
    query.single.mockResolvedValueOnce({
      data: mockDbRow({
        user_id: 'user-trial-expired',
        balance: 20,
        total_purchased: 0,
        total_used: 0,
        expires_at: pastDate,
      }),
      error: null,
    });

    const credit = await getUserCredit('user-trial-expired');
    expect(credit).not.toBeNull();
    expect(credit?.balance).toBe(0); // Disappeared!
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ balance: 0 }));
  });
});
