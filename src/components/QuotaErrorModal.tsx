import React from 'react';
import { X, Crown, ArrowUpRight, Sparkles } from 'lucide-react';
import type { QuotaError } from '../services/usage/usageService';
import { getPlan, type PlanType } from '../services/plans/plansConfig';
import './QuotaErrorModal.css';

interface QuotaErrorModalProps {
  error: QuotaError;
  onClose: () => void;
  onUpgrade: (plan: PlanType) => void;
}

export const QuotaErrorModal: React.FC<QuotaErrorModalProps> = ({
  error,
  onClose,
  onUpgrade,
}) => {
  const upgradePlan = getPlan(error.upgradePlan);

  return (
    <div className="quota-error-overlay" onClick={onClose}>
      <div className="quota-error-modal" onClick={e => e.stopPropagation()}>
        <button className="quota-error-close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="quota-error-header">
          <div className="quota-error-icon">
            <Sparkles size={32} />
          </div>
          <h2>تم بلوغ الحد</h2>
          <p className="quota-error-message">{error.messageAr}</p>
        </div>

        <div className="quota-error-details">
          <div className="quota-stat">
            <span className="quota-stat-label">الاستخدام الحالي</span>
            <span className="quota-stat-value">{error.current}</span>
          </div>
          <div className="quota-stat">
            <span className="quota-stat-label">الحد المسموح</span>
            <span className="quota-stat-value">{error.limit === -1 ? '∞' : error.limit}</span>
          </div>
        </div>

        <div className="quota-upgrade-card">
          <div className="upgrade-header">
            <Crown size={24} />
            <h3>ترقية إلى {upgradePlan.nameAr}</h3>
          </div>
          <p className="upgrade-desc">احصل على المزيد من التوليدات والمميزات المتقدمة</p>

          <ul className="upgrade-features">
            {upgradePlan.featuresAr.slice(0, 4).map((feature, idx) => (
              <li key={idx}>
                <span className="feature-check">✓</span>
                {feature}
              </li>
            ))}
          </ul>

          <div className="upgrade-price">{upgradePlan.priceAr}</div>

          <button
            className="btn-upgrade-now"
            onClick={() => onUpgrade(error.upgradePlan)}
          >
            <ArrowUpRight size={18} />
            ترقية الآن
          </button>
        </div>

        <button className="btn-continue-free" onClick={onClose}>
          متابعة بالخطة المجانية
        </button>
      </div>
    </div>
  );
};
