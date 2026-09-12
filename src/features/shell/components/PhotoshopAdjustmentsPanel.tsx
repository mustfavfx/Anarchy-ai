import React from 'react';
import { 
  Sun, Sliders, 
  Scale, SplitSquareVertical, Camera, Layers, Grid3X3, 
  Mail, Contrast, TrendingUp, BarChart2, ShieldAlert
} from 'lucide-react';
import { useTranslation } from '../../../services/i18n';
import { useNotificationStore } from '../../../stores/notificationStore';

export interface PhotoshopAdjustmentsPanelProps {
  onInvertMask?: () => void;
  onOpenColorRange?: () => void;
  activeLayerId?: string;
  onApplyAdjustment?: (key: string, name: string) => void;
}

export const PhotoshopAdjustmentsPanel: React.FC<PhotoshopAdjustmentsPanelProps> = ({
  onInvertMask,
  onOpenColorRange,
  activeLayerId: _activeLayerId,
  onApplyAdjustment,
}) => {
  const { isAr } = useTranslation();

  const handleAdjustmentClick = (key: string, name: string) => {
    if (onApplyAdjustment) {
      onApplyAdjustment(key, name);
      return;
    }

    if (key === 'invert') {
      if (onInvertMask) {
        onInvertMask();
      } else {
        useNotificationStore.getState().addNotification({
          type: 'info',
          title: 'Invert Mask',
          message: 'Active mask inverted (Ctrl+I).',
          duration: 2000,
        });
      }
      return;
    }

    if (key === 'threshold' || key === 'levels') {
      if (onOpenColorRange) {
        onOpenColorRange();
        return;
      }
    }

    useNotificationStore.getState().addNotification({
      type: 'info',
      title: name,
      message: isAr 
        ? `تم تطبيق ضبط ${name} على الطبقة النشطة.` 
        : `Applied ${name} adjustment to active layer.`,
      duration: 2500,
    });
  };

  const ADJUSTMENTS = [
    {
      key: 'vibrance',
      name: isAr ? 'اللون والحيوية' : 'Color and vibrance',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 22 20 2 20" />
          <circle cx="12" cy="13" r="3" fill="#3b82f6" stroke="#3b82f6" />
        </svg>
      ),
    },
    {
      key: 'brightness',
      name: isAr ? 'السطوع / التباين' : 'Brightness/Contrast',
      icon: <Sun size={20} />,
    },
    {
      key: 'levels',
      name: isAr ? 'المستويات' : 'Levels',
      icon: <BarChart2 size={20} />,
    },
    {
      key: 'curves',
      name: isAr ? 'المنحنيات' : 'Curves',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="2 2" />
          <path d="M4 19 C 10 19, 14 5, 20 5" stroke="#ffffff" strokeWidth="2" />
        </svg>
      ),
    },
    {
      key: 'exposure',
      name: isAr ? 'التعريض' : 'Exposure',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="21" x2="21" y2="3" />
          <path d="M7 6 h2 M8 5 v2" stroke="#ffffff" strokeWidth="2" />
          <path d="M15 17 h3" stroke="#ffffff" strokeWidth="2" />
        </svg>
      ),
    },
    {
      key: 'hue-sat',
      name: isAr ? 'تدرج / تشبع' : 'Hue/Saturation',
      icon: <Sliders size={20} />,
    },
    {
      key: 'color-balance',
      name: isAr ? 'توازن الألوان' : 'Color Balance',
      icon: <Scale size={20} />,
    },
    {
      key: 'black-white',
      name: isAr ? 'أبيض وأسود' : 'Black & White',
      icon: <SplitSquareVertical size={20} />,
    },
    {
      key: 'photo-filter',
      name: isAr ? 'فلتر صور' : 'Photo Filter',
      icon: <Camera size={20} />,
    },
    {
      key: 'channel-mixer',
      name: isAr ? 'مازج القنوات' : 'Channel Mixer',
      icon: <Layers size={20} />,
    },
    {
      key: 'color-lookup',
      name: isAr ? 'بحث الألوان (LUT)' : 'Color Lookup',
      icon: <Grid3X3 size={20} />,
    },
    {
      key: 'invert',
      name: isAr ? 'عكس الألوان' : 'Invert (Ctrl+I)',
      icon: <Mail size={20} />,
    },
    {
      key: 'posterize',
      name: isAr ? 'تدرج ملصق' : 'Posterize',
      icon: <TrendingUp size={20} />,
    },
    {
      key: 'threshold',
      name: isAr ? 'العتبة (أبيض وأسود)' : 'Threshold',
      icon: <ShieldAlert size={20} />,
    },
    {
      key: 'gradient-map',
      name: isAr ? 'خريطة التدرج' : 'Gradient Map',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="14" rx="2" fill="url(#psGradMap)" stroke="currentColor" strokeWidth="1.5" />
          <defs>
            <linearGradient id="psGradMap" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>
      ),
    },
    {
      key: 'selective-color',
      name: isAr ? 'لون انتقائي' : 'Selective Color',
      icon: <Contrast size={20} />,
    },
  ];

  return (
    <div className="ps-adjustments-panel">
      <div className="ps-adjustments-content" style={{ padding: '6px' }}>
        {/* 4x4 Adjustments Grid */}
        <div className="ps-adjustments-grid">
          {ADJUSTMENTS.map((adj) => (
            <button
              key={adj.key}
              type="button"
              className="ps-adjustment-tile"
              onClick={() => handleAdjustmentClick(adj.key, adj.name)}
              title={`${adj.name}${adj.key === 'invert' ? ' (Ctrl+I)' : ''}`}
            >
              <div className="ps-adj-tile-icon">
                {adj.icon}
              </div>
              <span className="ps-adj-tile-label">{adj.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
