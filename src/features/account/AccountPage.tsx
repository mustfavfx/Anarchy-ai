import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Shield, LogOut, Check,
  Camera, Edit2, X, CreditCard, Lock,
  Sparkles, ArrowUpRight, Loader2, Info, ChevronDown
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ConfirmModal } from '../../components/ConfirmModal';
import { getUserCredit, type UserCredit, getTransactionHistory, type CreditTransaction } from '../../services/credit/creditService';
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
  const navigate = useNavigate();
  const { user: authUser, signOut, updatePassword, deleteAccount } = useAuth();
  const [account, setAccount] = useState<AccountSettings>(DEFAULT_ACCOUNT);
  const [activeTab, setActiveTab] = useState<'profile' | 'billing'>('profile');
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(DEFAULT_ACCOUNT.name);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [credit, setCredit] = useState<UserCredit | null>(null);
  const [isLoadingCredit, setIsLoadingCredit] = useState(false);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [showPricingDetails, setShowPricingDetails] = useState(false);
  const [isCostsExpanded, setIsCostsExpanded] = useState(true);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedAccount = localStorage.getItem('anarchy_account');
    const authName = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || authUser?.email || DEFAULT_ACCOUNT.name;
    const authEmail = authUser?.email || DEFAULT_ACCOUNT.email;
    const authAvatarUrl = authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture || DEFAULT_ACCOUNT.avatarUrl;
    const authCreatedAt = authUser?.created_at ? new Date(authUser.created_at).toISOString().slice(0, 10) : DEFAULT_ACCOUNT.createdAt;

    if (savedAccount) {
      const parsed = {
        ...DEFAULT_ACCOUNT,
        ...JSON.parse(savedAccount),
        name: authName,
        email: authEmail,
        avatarUrl: authAvatarUrl,
        createdAt: authCreatedAt,
      };
      setAccount(parsed);
      setTempName(parsed.name);
      return;
    }

    const nextAccount = {
      ...DEFAULT_ACCOUNT,
      name: authName,
      email: authEmail,
      avatarUrl: authAvatarUrl,
      createdAt: authCreatedAt,
    };
    setAccount(nextAccount);
    setTempName(nextAccount.name);
  }, [authUser]);

  // Load user credit data
  useEffect(() => {
    if (!authUser?.id) return;

    setIsLoadingCredit(true);
    getUserCredit(authUser.id)
      .then(data => {
        setCredit(data);
      })
      .catch(err => console.error('[Account] Failed to load credit:', err))
      .finally(() => setIsLoadingCredit(false));

    // Load transaction history
    getTransactionHistory(authUser.id, 10)
      .then(data => setTransactions(data))
      .catch(() => {});
  }, [authUser]);

  const handleSaveName = () => {
    setAccount(prev => {
      const updated = { ...prev, name: tempName };
      localStorage.setItem('anarchy_account', JSON.stringify(updated));
      window.dispatchEvent(new Event('anarchy-account-updated'));
      return updated;
    });
    setEditingName(false);
  };

  const handleCancelName = () => {
    setTempName(account.name);
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
        window.dispatchEvent(new Event('anarchy-account-updated'));
        return updated;
      });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const updateAccount = <K extends keyof AccountSettings>(key: K, value: AccountSettings[K]) => {
    setAccount(prev => ({ ...prev, [key]: value }));
  };

  const handleSignOut = async () => {
    // Only clear auth data, preserve all user data (history, workflows, settings)
    const keysToRemove = Object.keys(localStorage).filter(key => 
      key.startsWith('sb-') || key.includes('supabase') || key === 'user'
    );
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    window.dispatchEvent(new Event('anarchy-account-updated'));
    await signOut();
  };

  const handleSwitchAccount = async () => {
    // Same as sign out but ensures clean auth state for different account
    await handleSignOut();
  };

  const handleDeleteAccount = () => setConfirmDeleteAccount(true);

  const doDeleteAccount = async () => {
    setConfirmDeleteAccount(false);
    setAccountStatus(null);
    setIsDeletingAccount(true);

    try {
      await deleteAccount();
      // Clear only auth data, preserve user workflows/history
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.startsWith('sb-') || key.includes('supabase') || key === 'user' || key === 'anarchy_account'
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));
      window.dispatchEvent(new Event('anarchy-account-updated'));
      await signOut();
    } catch (error) {
      setAccountStatus(
        error instanceof Error
          ? `Account deletion requires Supabase RPC setup: ${error.message}`
          : 'Failed to delete account.'
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordStatus(null);

    if (newPassword.length < 6) {
      setPasswordStatus('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus('Passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);

    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus('Password updated successfully.');
    } catch (error) {
      setPasswordStatus(error instanceof Error ? error.message : 'Failed to update password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="account-page">
      <div className="account-header">
        <div className="account-title-row">
          <User size={22} className="account-icon" />
          <h1 className="page-title">Account</h1>
        </div>
      </div>

      <div className="account-layout">
        <div className="account-sidebar">
          {[
            { id: 'profile', label: 'Profile', icon: <User size={16} /> },
            { id: 'billing', label: 'Billing', icon: <CreditCard size={16} /> },
          ].map(tab => (
            <button
              key={tab.id}
              className={`account-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as 'profile' | 'billing')}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="account-content">
          {activeTab === 'profile' && (
            <>
              <div className="account-card">
                <div className="account-card-header">
                  <User size={18} className="card-icon" />
                  <h3>Profile Information</h3>
                </div>

                <div className="profile-row">
                  <div className="avatar-wrapper">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="avatar-file-input"
                      onChange={handleAvatarChange}
                    />
                    {account.avatarUrl ? (
                      <img src={account.avatarUrl} alt={account.name} className="avatar-image" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="avatar-placeholder">
                        <User size={32} />
                      </div>
                    )}
                    <button
                      className="avatar-edit-btn"
                      title="Change avatar"
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Camera size={16} />
                    </button>
                  </div>

                  <div className="profile-summary">
                    {editingName ? (
                      <div className="name-edit-wrapper">
                        <input
                          type="text"
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          className="account-input name-input"
                          autoFocus
                        />
                        <button onClick={handleSaveName} className="icon-btn success">
                          <Check size={16} />
                        </button>
                        <button onClick={handleCancelName} className="icon-btn">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="name-display">
                        <span className="name-text">{account.name}</span>
                        <button onClick={() => setEditingName(true)} className="edit-btn">
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                    <span className="account-muted">{account.email}</span>
                  </div>
                </div>

                <div className="account-setting-item">
                  <div className="account-setting-content">
                    <label>Email Address</label>
                    <span className="account-desc">Used for notifications and account recovery</span>
                  </div>
                  <div className="account-input-group">
                    <Mail size={14} />
                    <input
                      className="account-input"
                      value={account.email}
                      onChange={(e) => updateAccount('email', e.target.value)}
                    />
                  </div>
                </div>

                <div className="account-setting-item">
                  <div className="account-setting-content">
                    <label>Member Since</label>
                    <span className="account-desc">Account creation date</span>
                  </div>
                  <span className="account-value">{account.createdAt}</span>
                </div>
              </div>

              <div className="account-card">
                <div className="account-card-header">
                  <Lock size={18} className="card-icon" />
                  <h3>Password & Protection</h3>
                </div>

                <div className="account-setting-item password-change-item">
                  <div className="account-setting-content">
                    <label>Change Password</label>
                    <span className="account-desc">Update your login password without exposing any API credentials</span>
                  </div>
                  <div className="password-change-group">
                    <input
                      type="password"
                      className="account-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                    />
                    <input
                      type="password"
                      className="account-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                    />
                    <button
                      className="btn-secondary compact"
                      onClick={handlePasswordChange}
                      disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                    >
                      {isUpdatingPassword ? 'Updating...' : 'Update'}
                    </button>
                  </div>
                </div>
                {passwordStatus && (
                  <div className={`account-note ${passwordStatus.includes('successfully') ? 'success' : ''}`}>
                    <Shield size={14} />
                    <p>{passwordStatus}</p>
                  </div>
                )}
              </div>
              <div className="account-danger-zone">
                <div className="account-danger-header">
                  <Shield size={16} />
                  <h4>Account Management</h4>
                </div>
                <div className="account-danger-item">
                  <div className="account-setting-content">
                    <label className="danger-label">Sign Out</label>
                    <span className="account-desc">End the current session. Your data will be preserved.</span>
                  </div>
                  <button className="btn-danger" onClick={handleSignOut}>
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>

                <div className="account-danger-item">
                  <div className="account-setting-content">
                    <label className="danger-label">Switch Account</label>
                    <span className="account-desc">Sign in with a different email. Your data will be preserved.</span>
                  </div>
                  <button className="btn-secondary" onClick={handleSwitchAccount}>
                    <User size={14} />
                    Switch Account
                  </button>
                </div>
                <div className="account-danger-item">
                  <div className="account-setting-content">
                    <label className="danger-label">Delete Account</label>
                    <span className="account-desc">Permanently remove account data from this device</span>
                  </div>
                  <button className="btn-danger" onClick={handleDeleteAccount} disabled={isDeletingAccount}>
                    {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
                  </button>
                </div>
                {accountStatus && (
                  <div className="account-note">
                    <Shield size={14} />
                    <p>{accountStatus}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'billing' && (
            <>
              {/* Credit Balance Card */}
              <div className="account-card credit-card">
                <div className="account-card-header">
                  <div className="credit-icon-large">
                    <Sparkles size={28} />
                  </div>
                  <div className="credit-header-text">
                    <h3>Available Credits</h3>
                    <span className="credit-balance-large">
                      {isLoadingCredit ? (
                        <Loader2 size={24} className="spin" />
                      ) : (
                        <>{(credit?.balance || 0).toLocaleString()} Credits</>
                      )}
                    </span>
                  </div>
                  <button
                    className="btn-add-credit"
                    onClick={() => navigate('/add-credit')}
                  >
                    <ArrowUpRight size={16} />
                    Add Credit
                  </button>
                </div>

                <div className="credit-stats">
                  <div className="credit-stat-item">
                    <span className="stat-label">Total Purchased</span>
                    <span className="stat-value">{(credit?.totalPurchased || 0).toLocaleString()}</span>
                  </div>
                  <div className="credit-stat-item">
                    <span className="stat-label">Total Used</span>
                    <span className="stat-value">{(credit?.totalUsed || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Cost Info */}
              <div className="account-card">
                <div 
                  className="account-card-header collapsible"
                  onClick={() => setIsCostsExpanded(!isCostsExpanded)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="header-left">
                    <CreditCard size={18} className="card-icon" />
                    <h3>Generation Costs</h3>
                  </div>
                  <div className="header-right">
                    <button 
                      className="pricing-info-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPricingDetails(true);
                      }}
                      title="View detailed pricing information"
                    >
                      <Info size={16} />
                      Details
                    </button>
                    <ChevronDown 
                      size={20} 
                      className={`chevron-icon ${isCostsExpanded ? 'expanded' : ''}`}
                    />
                  </div>
                </div>

                <div className={`cost-breakdown ${isCostsExpanded ? 'expanded' : 'collapsed'}`}>
                  <div className="cost-item">
                    <span className="cost-name">Standard (flux-schnell)</span>
                    <span className="cost-value">3 Credits</span>
                  </div>
                  <div className="cost-item">
                    <span className="cost-name">HD (flux-dev)</span>
                    <span className="cost-value">25 Credits</span>
                  </div>
                  <div className="cost-item">
                    <span className="cost-name">4K (flux-1.1-pro)</span>
                    <span className="cost-value">40 Credits</span>
                  </div>
                  <div className="cost-item">
                    <span className="cost-name">Video 480p (per sec)</span>
                    <span className="cost-value">90 Credits</span>
                  </div>
                  <div className="cost-item">
                    <span className="cost-name">Video 720p (per sec)</span>
                    <span className="cost-value">250 Credits</span>
                  </div>
                  <div className="cost-item">
                    <span className="cost-name">Upscale</span>
                    <span className="cost-value">5 Credits</span>
                  </div>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="account-card">
                <div className="account-card-header">
                  <CreditCard size={18} className="card-icon" />
                  <h3>Recent Transactions</h3>
                </div>

                {transactions.length === 0 ? (
                  <div className="no-transactions">No recent transactions</div>
                ) : (
                  <div className="transactions-list">
                    {transactions.slice(0, 5).map(tx => (
                      <div key={tx.id} className={`transaction-item ${tx.type}`}>
                        <div className="transaction-info">
                          <span className="transaction-desc">{tx.description}</span>
                          <span className="transaction-date">
                            {new Date(tx.createdAt).toLocaleDateString('en-US')}
                          </span>
                        </div>
                        <div className="transaction-amount">
                          <span className={tx.amount > 0 ? 'positive' : 'negative'}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                          </span>
                          <span className="balance-after">Balance: {tx.balanceAfter}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {confirmDeleteAccount && (
        <ConfirmModal
          title="Delete Account"
          message="Delete your account permanently? All your data will be lost and this cannot be undone."
          confirmLabel="Delete Account"
          danger
          onConfirm={doDeleteAccount}
          onCancel={() => setConfirmDeleteAccount(false)}
        />
      )}

      {/* Pricing Details Modal */}
      {showPricingDetails && (
        <div className="modal-overlay" onClick={() => setShowPricingDetails(false)}>
          <div className="pricing-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pricing-modal-header">
              <h2>Detailed Pricing Information</h2>
              <button className="close-btn" onClick={() => setShowPricingDetails(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="pricing-modal-content">
              <div className="pricing-section">
                <h3>Credit Value</h3>
                <p className="pricing-highlight">1 Credit = $0.01 USD</p>
                <p>$1 = 100 Credits</p>
              </div>

              <div className="pricing-section">
                <h3>Image Models</h3>
                <table className="pricing-table">
                  <thead>
                    <tr><th>Model</th><th>Price</th><th>Notes</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>google/nano-banana-2</td><td>~$0.045 - $0.151</td><td>Based on quality (512px to 4K)</td></tr>
                    <tr><td>google/nano-banana-pro</td><td>~$0.09 - $0.15</td><td>2K-4K generation</td></tr>
                    <tr><td>black-forest-labs/flux-1.1-pro</td><td>$0.04 / image</td><td>Best quality</td></tr>
                    <tr><td>black-forest-labs/flux-dev</td><td>$0.025 / image</td><td>12B parameters</td></tr>
                    <tr><td>black-forest-labs/flux-schnell</td><td>$0.003 / image</td><td>Fastest</td></tr>
                    <tr><td>recraft-ai/recraft-v3</td><td>$0.04 / image</td><td>SOTA model</td></tr>
                    <tr><td>bytedance/seedream-4.5</td><td>~$0.05</td><td>ByteDance</td></tr>
                    <tr><td>openai/gpt-image-2</td><td>~$0.10</td><td>OpenAI</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="pricing-section">
                <h3>Video Models (per second)</h3>
                <table className="pricing-table">
                  <thead>
                    <tr><th>Model</th><th>Price</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>wavespeedai/wan-2.1-i2v-480p</td><td>$0.09 / second</td></tr>
                    <tr><td>wavespeedai/wan-2.1-i2v-720p</td><td>$0.25 / second</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="pricing-section">
                <h3>Chat Models</h3>
                <table className="pricing-table">
                  <thead>
                    <tr><th>Model</th><th>Price</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>anthropic/claude-3.7-sonnet</td><td>Based on usage</td></tr>
                    <tr><td>deepseek-ai/deepseek-r1</td><td>$0.01 / 1K tokens</td></tr>
                    <tr><td>meta/meta-llama-3-70b-instruct</td><td>~$0.0005 / 1K tokens</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="pricing-section">
                <h3>Upscale Models</h3>
                <table className="pricing-table">
                  <thead>
                    <tr><th>Model</th><th>Price</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>nightmareai/real-esrgan</td><td>~$0.002 - $0.005</td></tr>
                    <tr><td>philz1337x/clarity-upscaler</td><td>~$0.01</td></tr>
                    <tr><td>topazlabs/image-upscale</td><td>~$0.05</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="pricing-section">
                <h3>In-App Generation Costs (Credits)</h3>
                <table className="pricing-table">
                  <thead>
                    <tr><th>Type</th><th>Model</th><th>Credits</th><th>~USD</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Standard</td><td>flux-schnell</td><td>3</td><td>$0.03</td></tr>
                    <tr><td>HD</td><td>flux-dev</td><td>25</td><td>$0.25</td></tr>
                    <tr><td>4K</td><td>flux-1.1-pro</td><td>40</td><td>$0.40</td></tr>
                    <tr><td>Video 480p</td><td>wan-2.1-i2v-480p</td><td>90 / sec</td><td>$0.90</td></tr>
                    <tr><td>Video 720p</td><td>wan-2.1-i2v-720p</td><td>250 / sec</td><td>$2.50</td></tr>
                    <tr><td>Upscale</td><td>real-esrgan</td><td>5</td><td>$0.05</td></tr>
                    <tr><td>Chat</td><td>Per 1K tokens</td><td>1</td><td>$0.01</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="pricing-section">
                <h3>Credit Packages</h3>
                <table className="pricing-table">
                  <thead>
                    <tr><th>Package</th><th>Price</th><th>Credits + Bonus</th><th>Value</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>$10</td><td>$10</td><td>1,050 credits</td><td>+5%</td></tr>
                    <tr><td>$20</td><td>$20</td><td>2,150 credits</td><td>+7.5%</td></tr>
                    <tr><td>$50</td><td>$50</td><td>5,500 credits</td><td>+10%</td></tr>
                    <tr><td>$100</td><td>$100</td><td>11,500 credits</td><td>+15%</td></tr>
                    <tr><td>$1,000</td><td>$1,000</td><td>125,000 credits</td><td>+25%</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="pricing-section">
                <h3>What does $5 get you?</h3>
                <p className="pricing-subtitle">$5 = 500 credits</p>
                <table className="pricing-table">
                  <thead>
                    <tr><th>Operation</th><th>Generations</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Standard (3 cr)</td><td>~166 images</td></tr>
                    <tr><td>HD (25 cr)</td><td>~20 images</td></tr>
                    <tr><td>4K (40 cr)</td><td>~12 images</td></tr>
                    <tr><td>Premium (90 cr)</td><td>~5 images</td></tr>
                    <tr><td>Video 480p 5 sec</td><td>~1 video</td></tr>
                    <tr><td>Upscale</td><td>~100 upscales</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="pricing-section notes">
                <h3>Important Notes</h3>
                <ul>
                  <li>All prices are based on Replicate API costs</li>
                  <li>Failed generations are not charged</li>
                  <li>Credits expire after 1 year from purchase date</li>
                  <li>Larger packages include bonus credits</li>
                  <li>Video costs are calculated per second of output</li>
                  <li>Chat costs are per 1,000 tokens</li>
                  <li>Nano Banana models vary by resolution (512px to 4K)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
