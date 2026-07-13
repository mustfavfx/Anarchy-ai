import React, { useEffect, useRef, useState } from 'react';
import { logger } from '../../utils/logger';
import {
  User, Mail, Shield, LogOut, Check,
  Camera, Edit2, X, CreditCard, Lock,
  Sparkles, ArrowUpRight, Loader2,
  Plus, Minus, Calendar, AlertCircle, TrendingUp,
  ChevronRight, Trash2
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ConfirmModal } from '../../shared/components/ConfirmModal';
import {
  getUserCredit,
  type UserCredit,
  getTransactionHistory,
  type CreditTransaction,
  CREDIT_PACKAGES,
  type CreditPackage
} from '../../services/credit/creditService';
import { supabase, supabaseUrl, isSupabaseConfigured } from '../../services/supabase/supabaseClient';
import { invoke } from '@tauri-apps/api/core';
import './AccountPage.css';

interface AccountSettings {
  name: string;
  email: string;
  avatarUrl: string;
  createdAt: string;
  plan: string;
}

const DEFAULT_ACCOUNT: AccountSettings = {
  name: 'Anarchy User',
  email: 'user@anarchy.ai',
  avatarUrl: '',
  createdAt: '2024-01-15',
  plan: 'free',
};

export const AccountPage: React.FC = () => {
  const { user: authUser, signOut, updatePassword, deleteAccount } = useAuth();
  const [account, setAccount] = useState<AccountSettings>(DEFAULT_ACCOUNT);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(DEFAULT_ACCOUNT.name);

  // Security
  const [showSecurity, setShowSecurity] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  // Credits
  const [credit, setCredit] = useState<UserCredit | null>(null);
  const [isLoadingCredit, setIsLoadingCredit] = useState(false);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);

  // Purchase
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage>(CREDIT_PACKAGES[0]);
  const [customAmount, setCustomAmount] = useState<string>('5');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const rechargeRef = useRef<HTMLDivElement>(null);

  // Stripe return handler
  useEffect(() => {
    const params = new URLSearchParams(globalThis.location.search);
    const sessionId = params.get('session_id');
    const canceled = params.get('canceled');
    const action = params.get('action');

    if (sessionId) {
      setShowSuccess(true);
      globalThis.history.replaceState({}, '', globalThis.location.pathname);
      setTimeout(() => {
        if (authUser?.id) {
          getUserCredit(authUser.id).then(c => setCredit(c));
          getTransactionHistory(authUser.id).then(txs => setTransactions(txs));
        }
      }, 2000);
    } else if (canceled) {
      setPurchaseError('Payment was canceled. You can try again.');
      globalThis.history.replaceState({}, '', globalThis.location.pathname);
    } else if (action === 'add-credit') {
      globalThis.history.replaceState({}, '', globalThis.location.pathname);
      setTimeout(() => rechargeRef.current?.scrollIntoView({ behavior: 'smooth' }), 400);
    }
  }, [authUser]);

  // Load account
  useEffect(() => {
    const savedAccount = localStorage.getItem('anarchy_account');
    const authName = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || authUser?.email || DEFAULT_ACCOUNT.name;
    const authEmail = authUser?.email || DEFAULT_ACCOUNT.email;
    const authAvatarUrl = authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture || DEFAULT_ACCOUNT.avatarUrl;
    const authCreatedAt = authUser?.created_at ? new Date(authUser.created_at).toISOString().slice(0, 10) : DEFAULT_ACCOUNT.createdAt;

    if (savedAccount) {
      const parsed = { ...DEFAULT_ACCOUNT, ...JSON.parse(savedAccount), name: authName, email: authEmail, avatarUrl: authAvatarUrl, createdAt: authCreatedAt };
      setAccount(parsed);
      setTempName(parsed.name);
      return;
    }
    const next = { ...DEFAULT_ACCOUNT, name: authName, email: authEmail, avatarUrl: authAvatarUrl, createdAt: authCreatedAt };
    setAccount(next);
    setTempName(next.name);
  }, [authUser]);

  // Load credit
  useEffect(() => {
    if (!authUser?.id) return;
    setIsLoadingCredit(true);
    getUserCredit(authUser.id)
      .then(data => setCredit(data))
      .catch(err => logger.error('[Account] credit load failed:', err))
      .finally(() => setIsLoadingCredit(false));
    getTransactionHistory(authUser.id, 8).then(data => setTransactions(data)).catch(() => {});
  }, [authUser]);

  // Helpers
  const getCustomBonus = (amount: number): number => {
    const base = Math.floor(amount * 10);
    if (amount >= 100) return Math.floor(base * 0.15);
    if (amount >= 50)  return Math.floor(base * 0.10);
    if (amount >= 20)  return Math.floor(base * 0.075);
    if (amount >= 5)   return Math.floor(base * 0.05);
    return 0;
  };

  const calculateCustomCredits = (amount: number): number => {
    const base = Math.floor(amount * 10);
    return base + getCustomBonus(amount);
  };

  const totalCredits = selectedPackage.id === 'custom'
    ? calculateCustomCredits(Number.parseFloat(customAmount) || 0)
    : selectedPackage.credits + selectedPackage.bonus;

  const purchaseTotal = selectedPackage.id === 'custom'
    ? (Number.parseFloat(customAmount) || 0).toFixed(2)
    : selectedPackage.amount.toFixed(2);

  const handlePackageSelect = (pkg: CreditPackage) => { setSelectedPackage(pkg); setShowSuccess(false); };

  const handlePurchase = async () => {
    if (!authUser?.id) return;
    setPurchaseError(null);
    setIsProcessing(true);
    try {
      if (!isSupabaseConfigured) {
        await new Promise(r => setTimeout(r, 500));
        await invoke('open_checkout_window', { url: 'https://checkout.stripe.com/mock-session' });
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const body: Record<string, unknown> = { packageId: selectedPackage.id };
      if (selectedPackage.id === 'custom') body.customAmountUsd = Number.parseFloat(customAmount) || 0;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Failed to create checkout session');
      await invoke('open_checkout_window', { url: data.url });
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveName = () => {
    setAccount(prev => {
      const updated = { ...prev, name: tempName };
      localStorage.setItem('anarchy_account', JSON.stringify(updated));
      globalThis.dispatchEvent(new Event('anarchy-account-updated'));
      return updated;
    });
    setEditingName(false);
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const avatarUrl = typeof reader.result === 'string' ? reader.result : '';
      setAccount(prev => {
        const updated = { ...prev, avatarUrl };
        localStorage.setItem('anarchy_account', JSON.stringify(updated));
        globalThis.dispatchEvent(new Event('anarchy-account-updated'));
        return updated;
      });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleSignOut = async () => {
    try { await signOut(); } catch (e) { logger.error('[Account] signout error:', e); }
    finally {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') || k.includes('supabase') || k === 'user');
      keys.forEach(k => localStorage.removeItem(k));
      globalThis.dispatchEvent(new Event('anarchy-account-updated'));
    }
  };

  const handleDeleteAccount = () => setConfirmDeleteAccount(true);

  const doDeleteAccount = async () => {
    setConfirmDeleteAccount(false);
    setAccountStatus(null);
    setIsDeletingAccount(true);
    try {
      await deleteAccount();
      try { await signOut(); } catch (_) {}
      const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') || k.includes('supabase') || k === 'user' || k === 'anarchy_account');
      keys.forEach(k => localStorage.removeItem(k));
      globalThis.dispatchEvent(new Event('anarchy-account-updated'));
    } catch (error) {
      setAccountStatus(error instanceof Error ? `Deletion failed: ${error.message}` : 'Failed to delete account.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordStatus(null);
    if (newPassword.length < 6) { setPasswordStatus('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setPasswordStatus('Passwords do not match.'); return; }
    setIsUpdatingPassword(true);
    try {
      await updatePassword(newPassword);
      setNewPassword(''); setConfirmPassword('');
      setPasswordStatus('Password updated successfully.');
    } catch (e) {
      setPasswordStatus(e instanceof Error ? e.message : 'Failed to update password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="account-page sp-page">

      {/* ══════════════════════════════════════
          SECTION 1 — Stats Bar
          ══════════════════════════════════════ */}
      <div className="sp-stats-bar">
        <div className="sp-stat">
          <div className="sp-stat-icon-wrap credits">
            <CreditCard size={18} />
          </div>
          <div className="sp-stat-body">
            <span className="sp-stat-label">Credits Balance</span>
            <span className="sp-stat-value credits-value">
              {isLoadingCredit
                ? <Loader2 size={16} className="spin" />
                : (credit?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="sp-stat-divider" />

        <div className="sp-stat">
          <div className="sp-stat-icon-wrap date">
            <Calendar size={18} />
          </div>
          <div className="sp-stat-body">
            <span className="sp-stat-label">Member Since</span>
            <span className="sp-stat-value mono">{account.createdAt}</span>
          </div>
        </div>

        <div className="sp-stat-divider" />

        <div className="sp-stat">
          <div className="sp-stat-icon-wrap id">
            <User size={18} />
          </div>
          <div className="sp-stat-body">
            <span className="sp-stat-label">Account ID</span>
            <span className="sp-stat-value mono small">ANAR-{authUser?.id?.slice(0, 10).toUpperCase() ?? 'N/A'}</span>
          </div>
        </div>

        <button
          className="sp-add-credit-btn"
          onClick={() => rechargeRef.current?.scrollIntoView({ behavior: 'smooth' })}
        >
          <ArrowUpRight size={15} />
          Add Credit
        </button>
      </div>

      {/* ══════════════════════════════════════
          SECTION 2 — Recharge Credits
          ══════════════════════════════════════ */}
      <div className="sp-section" ref={rechargeRef}>
        <div className="sp-recharge-card">

          {/* Top row: packages + order summary */}
          <div className="sp-recharge-top">
            {/* Left: packages */}
            <div className="sp-packages-col">
              <div className="sp-section-header">
                <CreditCard size={16} className="sp-section-icon" />
                <span className="sp-section-title">Recharge Credits</span>
                <span className="sp-section-sub">Secure payment via Stripe</span>
              </div>

              {showSuccess && (
                <div className="sp-success-banner">
                  <Check size={16} />
                  <div>
                    <strong>Payment Successful!</strong>
                    <span>{totalCredits.toLocaleString()} credits added to your account</span>
                  </div>
                </div>
              )}

              <div className="sp-packages-grid">
                {CREDIT_PACKAGES.map(pkg => {
                  const total = pkg.credits + pkg.bonus;
                  const isSelected = selectedPackage.id === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      className={`sp-package-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handlePackageSelect(pkg)}
                    >
                      {pkg.id === 'custom' ? (
                        <span className="sp-pkg-custom">Custom<br /><span className="sp-pkg-sub">Enter amount</span></span>
                      ) : (
                        <>
                          <span className="sp-pkg-price">${pkg.amount.toLocaleString()}</span>
                          <span className="sp-pkg-credits">{total.toLocaleString()} <span className="sp-pkg-unit">cr</span></span>
                          {pkg.bonus > 0 && <span className="sp-pkg-bonus">+{pkg.bonus} bonus</span>}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedPackage.id === 'custom' && (
                <div className="sp-custom-row">
                  <label className="sp-custom-label">Custom amount (min $5)</label>
                  <div className="sp-custom-input-wrap">
                    <span className="sp-currency">$</span>
                    <input
                      type="number" min="5" max="10000"
                      value={customAmount}
                      onChange={e => setCustomAmount(e.target.value)}
                      className="sp-custom-input"
                      placeholder="0"
                    />
                  </div>
                  {(() => {
                    const amt = Number.parseFloat(customAmount) || 0;
                    if (amt < 5) return <p className="sp-min-note">Minimum $5</p>;
                    const bonus = getCustomBonus(amt);
                    return (
                      <div className="sp-custom-preview">
                        <span>{calculateCustomCredits(amt).toLocaleString()} Credits</span>
                        {bonus > 0 && <span className="sp-bonus-txt">+{bonus} bonus</span>}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Right: Order summary */}
            <div className="sp-order-summary">
              <div className="sp-order-header">
                <span className="sp-order-title">Order Summary</span>
              </div>

              <div className="sp-order-rows">
                <div className="sp-order-row">
                  <span>Package</span>
                  <span>{selectedPackage.id === 'custom' ? `Custom ($${purchaseTotal})` : `$${selectedPackage.amount} Package`}</span>
                </div>
                <div className="sp-order-row">
                  <span>Credits</span>
                  <span className="mono">{totalCredits.toLocaleString()}</span>
                </div>
                {selectedPackage.id !== 'custom' && selectedPackage.bonus > 0 && (
                  <div className="sp-order-row bonus">
                    <span>Bonus</span>
                    <span className="green">+{selectedPackage.bonus.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="sp-order-divider" />

              <div className="sp-order-total">
                <span>Total</span>
                <span className="sp-total-value">${purchaseTotal}</span>
              </div>

              <p className="sp-order-note">Credits may take up to 5 min after purchase. Expire after 1 year.</p>

              {purchaseError && (
                <div className="sp-purchase-error">
                  <AlertCircle size={13} />
                  <span>{purchaseError}</span>
                </div>
              )}

              <button
                className="sp-buy-btn"
                onClick={handlePurchase}
                disabled={isProcessing || (selectedPackage.id === 'custom' && (!customAmount || Number.parseFloat(customAmount) < 5))}
              >
                {isProcessing
                  ? <><Loader2 size={14} className="spin" />Processing…</>
                  : <><CreditCard size={14} />Purchase Now — ${purchaseTotal}</>}
              </button>

              <div className="sp-stripe-note">
                <Shield size={11} /> Secured by Stripe
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════
          SECTION 3 — Transactions (full width)
          ══════════════════════════════════════ */}
      <div className="sp-section">
        <div className="sp-card tx-card">
          <div className="sp-card-header">
            <TrendingUp size={16} className="sp-section-icon" />
            <span className="sp-card-title">Recent Transactions</span>
          </div>
          {transactions.length === 0 ? (
            <div className="sp-empty">No transactions yet</div>
          ) : (
            <div className="sp-tx-list sp-tx-grid">
              {transactions.slice(0, 6).map(tx => (
                <div key={tx.id} className={`sp-tx-row ${tx.type}`}>
                  <div className="sp-tx-icon">
                    {tx.type === 'purchase' ? <Plus size={12} /> : tx.type === 'bonus' ? <Sparkles size={12} /> : <Minus size={12} />}
                  </div>
                  <div className="sp-tx-info">
                    <span className="sp-tx-desc">{tx.description}</span>
                    <span className="sp-tx-date">
                      {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="sp-tx-amounts">
                    <span className={`sp-tx-amount ${tx.amount > 0 ? 'pos' : 'neg'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                    <span className="sp-tx-bal">Bal: {tx.balanceAfter.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          SECTION 4 — Account Details
          ══════════════════════════════════════ */}
      <div className="sp-section">
        <div className="sp-account-card">

          {/* Identity row */}
          <div className="sp-identity-row">
            <div className="sp-avatar-wrap">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="avatar-file-input"
                onChange={handleAvatarChange}
              />
              {account.avatarUrl
                ? <img src={account.avatarUrl} alt={account.name} className="sp-avatar-img" referrerPolicy="no-referrer" />
                : <div className="sp-avatar-placeholder"><User size={26} /></div>}
              <button className="sp-avatar-edit" onClick={() => avatarInputRef.current?.click()} title="Change avatar">
                <Camera size={11} />
              </button>
            </div>

            <div className="sp-identity-info">
              {editingName ? (
                <div className="name-edit-wrapper">
                  <input
                    type="text"
                    value={tempName}
                    onChange={e => setTempName(e.target.value)}
                    className="account-input name-input"
                    autoFocus
                  />
                  <button onClick={handleSaveName} className="icon-btn success"><Check size={15} /></button>
                  <button onClick={() => { setTempName(account.name); setEditingName(false); }} className="icon-btn"><X size={15} /></button>
                </div>
              ) : (
                <div className="name-display">
                  <span className="sp-identity-name">{account.name}</span>
                  <button onClick={() => setEditingName(true)} className="edit-btn"><Edit2 size={13} /></button>
                </div>
              )}
              <span className="sp-identity-email">{account.email}</span>
            </div>

            <button className="sp-signout-btn" onClick={handleSignOut}>
              <LogOut size={14} />
              Sign Out
            </button>
          </div>

          <div className="sp-account-divider" />

          {/* Security row */}
          <div
            className="sp-account-row clickable"
            role="button"
            tabIndex={0}
            onClick={() => setShowSecurity(!showSecurity)}
            onKeyDown={e => e.key === 'Enter' && setShowSecurity(!showSecurity)}
          >
            <div className="sp-account-row-icon"><Lock size={15} /></div>
            <div className="sp-account-row-body">
              <span className="sp-account-row-title">Account Security</span>
              <span className="sp-account-row-sub">Change password and manage authentication</span>
            </div>
            <ChevronRight size={16} className={`sp-row-chevron ${showSecurity ? 'open' : ''}`} />
          </div>

          {showSecurity && (
            <div className="sp-security-panel">
              <div className="sp-pwd-inputs">
                <input
                  type="password"
                  className="account-input"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password"
                />
                <input
                  type="password"
                  className="account-input"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                />
                <button
                  className="btn-primary sp-pwd-btn"
                  onClick={handlePasswordChange}
                  disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                >
                  {isUpdatingPassword ? 'Updating…' : 'Update Password'}
                </button>
              </div>
              {passwordStatus && (
                <div className={`account-note ${passwordStatus.includes('successfully') ? 'success' : ''}`}>
                  <Shield size={13} />
                  <p>{passwordStatus}</p>
                </div>
              )}
            </div>
          )}

          <div className="sp-account-divider" />

          {/* Danger row */}
          <div className="sp-account-row danger-row">
            <div className="sp-account-row-icon danger"><Trash2 size={15} /></div>
            <div className="sp-account-row-body">
              <span className="sp-account-row-title danger-title">Delete Account</span>
              <span className="sp-account-row-sub">Permanently remove all account data from this device</span>
            </div>
            <button className="sp-delete-btn" onClick={handleDeleteAccount} disabled={isDeletingAccount}>
              {isDeletingAccount ? 'Deleting…' : 'Delete'}
            </button>
          </div>

          {accountStatus && (
            <div className="account-note" style={{ margin: '8px 0 0' }}>
              <Shield size={13} />
              <p>{accountStatus}</p>
            </div>
          )}

        </div>
      </div>

      {/* Bottom trust bar */}
      <div className="sp-trust-bar">
        <div className="sp-trust-item">
          <Shield size={14} />
          <div>
            <strong>Credits never expire</strong>
            <span>Your credits will always be available.</span>
          </div>
        </div>
        <div className="sp-trust-item">
          <Lock size={14} />
          <div>
            <strong>Safe & secure payments</strong>
            <span>All transactions are encrypted via Stripe.</span>
          </div>
        </div>
        <div className="sp-trust-item">
          <Mail size={14} />
          <div>
            <strong>Enterprise Client?</strong>
            <span>Contact us for custom pricing.</span>
          </div>
        </div>
      </div>

      {/* Modals */}
      {confirmDeleteAccount && (
        <ConfirmModal
          title="Delete Account"
          message="Delete your account permanently? All your data will be lost and cannot be undone."
          confirmLabel="Delete Account"
          danger
          onConfirm={doDeleteAccount}
          onCancel={() => setConfirmDeleteAccount(false)}
        />
      )}

    </div>
  );
};
