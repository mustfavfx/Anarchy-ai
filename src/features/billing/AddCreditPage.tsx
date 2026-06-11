import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Check, ArrowLeft, Loader2, Coins, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { CREDIT_PACKAGES, getUserCredit, type CreditPackage } from '../../services/credit/creditService';
import { supabase, supabaseUrl } from '../../services/supabase/supabaseClient';
import { invoke } from '@tauri-apps/api/core';
import './AddCreditPage.css';

export const AddCreditPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage>(CREDIT_PACKAGES[0]); // Default $10
  const [customAmount, setCustomAmount] = useState<string>('5');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Check for Stripe return params
  useEffect(() => {
    const params = new URLSearchParams(globalThis.location.search);
    const sessionId = params.get('session_id');
    const canceled = params.get('canceled');
    
    if (sessionId) {
      // Payment successful - verify and refresh balance
      setShowSuccess(true);
      // Clear URL params
      globalThis.history.replaceState({}, '', globalThis.location.pathname);
      // Refresh balance after 2 seconds
      setTimeout(() => {
        if (user?.id) {
          getUserCredit(user.id).then(credit => {
            setCurrentBalance(credit?.balance || 0);
          });
        }
      }, 2000);
    } else if (canceled) {
      setPurchaseError('Payment was canceled. You can try again.');
      globalThis.history.replaceState({}, '', globalThis.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      getUserCredit(user.id)
        .then(credit => {
          setCurrentBalance(credit?.balance || 0);
        })
        .finally(() => setIsLoading(false));
    }
  }, [user]);

  const handlePackageSelect = (pkg: CreditPackage) => {
    setSelectedPackage(pkg);
    setShowSuccess(false);
  };

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

  const getPackageLabel = (pkg: CreditPackage): string => {
    if (pkg.id === 'custom') return '';
    const total = pkg.credits + pkg.bonus;
    if (pkg.amount >= 1000) return `~${total.toLocaleString()} generations`;
    if (pkg.amount >= 100)  return `~${total}+ generations`;
    return `~${total} generations`;
  };

  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const handlePurchase = async () => {
    if (!user?.id) return;
    setPurchaseError(null);
    setIsProcessing(true);

    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const body: Record<string, unknown> = { packageId: selectedPackage.id };
      if (selectedPackage.id === 'custom') {
        body.customAmountUsd = Number.parseFloat(customAmount) || 0;
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json() as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Failed to create checkout session');
      }

      // Open Stripe Checkout in the system browser (Tauri)
      await invoke('open_url', { url: data.url });

    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalCredits = selectedPackage.id === 'custom'
    ? calculateCustomCredits(Number.parseFloat(customAmount) || 0)
    : selectedPackage.credits + selectedPackage.bonus;

  if (isLoading) {
    return (
      <div className="add-credit-page loading">
        <Loader2 size={32} className="spin" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="add-credit-page">
      <div className="add-credit-page-inner">
      {/* Header */}
      <div className="credit-header">
        <button className="back-btn" onClick={() => navigate('/account')}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <h1 className="page-title">
          <span className="title-muted">Billing</span>
          <span className="title-separator">/</span>
          <span>Add Credit</span>
        </h1>
        <button
          className="btn-purchase header-purchase-btn"
          onClick={handlePurchase}
          disabled={isProcessing || (selectedPackage.id === 'custom' && (!customAmount || Number.parseFloat(customAmount) < 5))}
        >
          {isProcessing ? (
            <><Loader2 size={14} className="spin" />Processing...</>
          ) : (
            <><CreditCard size={14} />Buy ${selectedPackage.id === 'custom' ? (Number.parseFloat(customAmount) || 0).toFixed(2) : selectedPackage.amount.toFixed(2)}</>
          )}
        </button>
      </div>

      {/* Current Balance */}
      <div className="current-balance-card">
        <div className="balance-display">
          <div className="balance-icon">
            <Coins size={22} />
          </div>
          <div className="balance-info">
            <span className="balance-label">Current Balance</span>
            <span className="balance-amount">{currentBalance.toLocaleString()} Credits</span>
          </div>
        </div>
      </div>

      {/* Success Message - Cloudflare Style */}
      {showSuccess && (
        <div className="success-banner">
          <div className="success-icon">
            <Check size={14} />
          </div>
          <div className="success-content">
            <span className="success-title">Success!</span>
            <span className="success-desc">{totalCredits.toLocaleString()} credits added to your account</span>
          </div>
        </div>
      )}

      {/* Credit Amount Selection */}
      <div className="credit-section">
        <h3 className="section-title">Credit Amount</h3>

        <div className="packages-grid">
          {CREDIT_PACKAGES.map(pkg => {
            const total = pkg.credits + pkg.bonus;
            return (
              <button
                key={pkg.id}
                className={`package-card ${selectedPackage.id === pkg.id ? 'selected' : ''}`}
                onClick={() => handlePackageSelect(pkg)}
              >
                {pkg.id === 'custom' ? (
                  <span className="package-custom">Custom</span>
                ) : (
                  <>
                    <span className="package-amount">${pkg.amount.toLocaleString()}</span>
                    <span className="package-credits">
                      {total.toLocaleString()} Credits
                      {pkg.bonus > 0 && <span className="package-bonus"> +{pkg.bonus} bonus</span>}
                    </span>
                    <span className="package-desc">{getPackageLabel(pkg)}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Custom Amount Input */}
        {selectedPackage.id === 'custom' && (
          <div className="custom-amount-section">
            <label>Custom amount</label>
            <div className="custom-input-wrapper">
              <span className="currency">$</span>
              <input
                type="number"
                min="5"
                max="10000"
                placeholder="0"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="custom-amount-input"
              />
            </div>
            {(() => {
              const amt = Number.parseFloat(customAmount) || 0;
              if (amt < 5) return <p className="minimum-note">Minimum $5</p>;
              const base = Math.floor(amt * 10);
              const bonus = getCustomBonus(amt);
              const total = base + bonus;
              return (
                <div className="custom-credits-preview">
                  <span className="custom-credits-total">{total.toLocaleString()} Credits</span>
                  {bonus > 0 && <span className="custom-credits-bonus"> +{bonus} bonus included</span>}
                  <span className="custom-credits-rate">~{total} generations</span>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="credit-notes">
        <p><strong>Note:</strong> Credit may take up to 5 minutes to become available after purchase.</p>
        <p>Credit expires after 1 year from purchase date.</p>
      </div>

      {/* Cost Info */}
      <div className="cost-info">
        <div className="cost-row">
          <span>Amount</span>
          <span>${selectedPackage.id === 'custom' ? (Number.parseFloat(customAmount) || 0).toFixed(2) : selectedPackage.amount.toFixed(2)}</span>
        </div>
        <div className="cost-row">
          <span>Credits</span>
          <span>{totalCredits.toLocaleString()}</span>
        </div>
        <div className="cost-row highlight">
          <span>Total</span>
          <span>${selectedPackage.id === 'custom' ? (Number.parseFloat(customAmount) || 0).toFixed(2) : selectedPackage.amount.toFixed(2)}</span>
        </div>
      </div>

      {/* Error message */}
      {purchaseError && (
        <div className="purchase-error">
          <AlertCircle size={14} />
          <span>{purchaseError}</span>
        </div>
      )}

      {/* Action Buttons - Cloudflare Style */}
      <div className="credit-actions">
        <button
          className="btn-cancel"
          onClick={() => navigate('/account')}
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          className="btn-purchase"
          onClick={handlePurchase}
          disabled={isProcessing || (selectedPackage.id === 'custom' && (!customAmount || Number.parseFloat(customAmount) < 10))}
        >
          {isProcessing ? (
            <>
              <Loader2 size={16} className="spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard size={16} />
              Buy ${selectedPackage.id === 'custom' ? (Number.parseFloat(customAmount) || 0).toFixed(2) : selectedPackage.amount.toFixed(2)} Credit
            </>
          )}
        </button>
      </div>
      </div>
    </div>
  );
};
