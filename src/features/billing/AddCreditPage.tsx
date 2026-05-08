import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Check, ArrowLeft, Loader2, Coins } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { CREDIT_PACKAGES, addCredits, getUserCredit, type CreditPackage } from '../../services/credit/creditService';
import './AddCreditPage.css';

export const AddCreditPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage>(CREDIT_PACKAGES[1]); // Default $10
  const [customAmount, setCustomAmount] = useState<string>('25');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

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

  const calculateCustomCredits = (amount: number): number => {
    // $1 = 10 credits base rate, with bonus for larger amounts
    let baseCredits = amount * 10;
    let bonus = 0;
    if (amount >= 25) bonus = amount * 1.5; // 15% bonus
    if (amount >= 50) bonus = amount * 2.5; // 25% bonus
    if (amount >= 100) bonus = amount * 4;  // 40% bonus
    return Math.floor(baseCredits + bonus);
  };

  const handlePurchase = async () => {
    if (!user?.id) return;

    setIsProcessing(true);

    // Simulate payment processing (replace with Stripe/PayPal integration)
    await new Promise(resolve => setTimeout(resolve, 2000));

    const credits = selectedPackage.id === 'custom'
      ? calculateCustomCredits(parseFloat(customAmount) || 0)
      : selectedPackage.credits + selectedPackage.bonus;

    const amountUsd = selectedPackage.id === 'custom'
      ? parseFloat(customAmount) || 0
      : selectedPackage.amount;

    const success = await addCredits(user.id, credits, amountUsd, `demo_payment_${Date.now()}`);

    if (success) {
      setCurrentBalance(prev => prev + credits);
      setShowSuccess(true);
    }

    setIsProcessing(false);
  };

  const totalCredits = selectedPackage.id === 'custom'
    ? calculateCustomCredits(parseFloat(customAmount) || 0)
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
          {CREDIT_PACKAGES.map(pkg => (
            <button
              key={pkg.id}
              className={`package-card ${selectedPackage.id === pkg.id ? 'selected' : ''}`}
              onClick={() => handlePackageSelect(pkg)}
            >
              {pkg.id === 'custom' ? (
                <span className="package-custom">Custom</span>
              ) : (
                <span className="package-amount">${pkg.amount.toLocaleString()}</span>
              )}
            </button>
          ))}
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
            <p className="minimum-note">Minimum $5</p>
          </div>
        )}
      </div>

      {/* Payment Method */}
      <div className="credit-section">
        <h3 className="section-title">Payment Method</h3>
        <div className="payment-method-card">
          <CreditCard size={20} />
          <span>Default payment method will be used</span>
          <button className="manage-payment-link">Manage payment methods</button>
        </div>
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
          <span>${selectedPackage.id === 'custom' ? (parseFloat(customAmount) || 0).toFixed(2) : selectedPackage.amount.toFixed(2)}</span>
        </div>
        <div className="cost-row">
          <span>Credits</span>
          <span>{totalCredits.toLocaleString()}</span>
        </div>
        <div className="cost-row highlight">
          <span>Total</span>
          <span>${selectedPackage.id === 'custom' ? (parseFloat(customAmount) || 0).toFixed(2) : selectedPackage.amount.toFixed(2)}</span>
        </div>
      </div>

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
          disabled={isProcessing || (selectedPackage.id === 'custom' && (!customAmount || parseFloat(customAmount) < 5))}
        >
          {isProcessing ? (
            <>
              <Loader2 size={16} className="spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard size={16} />
              Buy ${selectedPackage.id === 'custom' ? (parseFloat(customAmount) || 0).toFixed(2) : selectedPackage.amount.toFixed(2)} Credit
            </>
          )}
        </button>
      </div>
      </div>
    </div>
  );
};
