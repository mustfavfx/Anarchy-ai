import React, { useState } from 'react';
import { 
  MoreHorizontal, Plus, Folder, Trash2, List, Sun, Sliders, 
  Scale, SplitSquareVertical, Camera, Layers, Grid3X3, 
  Mail, Contrast, TrendingUp, BarChart2, ShieldAlert
} from 'lucide-react';
import { useTranslation } from '../../../services/i18n';
import { useNotificationStore } from '../../../stores/notificationStore';

export interface PhotoshopAdjustmentsPanelProps {
  onInvertMask?: () => void;
  onOpenColorRange?: () => void;
  activeLayerId?: string;
}

export const PhotoshopAdjustmentsPanel: React.FC<PhotoshopAdjustmentsPanelProps> = ({
  onInvertMask,
  onOpenColorRange,
  activeLayerId,
}) => {
  const { isAr } = useTranslation();
  const [activeGroupTab, setActiveGroupTab] = useState<'adjustments' | 'libraries'>('adjustments');
  const [subTab, setSubTab] = useState<'presets' | 'single'>('single');

  const handleAdjustmentClick = (key: string, name: string) => {
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
      key: 'huesat',
      name: isAr ? 'تدرج / تشبع' : 'Hue/Saturation',
      icon: <Sliders size={20} />,
    },
    {
      key: 'colorbalance',
      name: isAr ? 'توازن اللون' : 'Color Balance',
      icon: <Scale size={20} />,
    },
    {
      key: 'blackwhite',
      name: isAr ? 'أبيض وأسود' : 'Black & White',
      icon: <SplitSquareVertical size={20} />,
    },
    {
      key: 'photofilter',
      name: isAr ? 'فلتر الصور' : 'Photo Filter',
      icon: <Camera size={20} />,
    },
    {
      key: 'channelmixer',
      name: isAr ? 'خالط القنوات' : 'Channel Mixer',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="9" cy="9" r="6" stroke="#ffffff" />
          <circle cx="15" cy="9" r="6" stroke="#ffffff" />
          <circle cx="12" cy="15" r="6" stroke="#ffffff" />
        </svg>
      ),
    },
    {
      key: 'colorlookup',
      name: isAr ? 'بحث الألوان (LUT)' : 'Color Lookup',
      icon: <Grid3X3 size={20} />,
    },
    {
      key: 'selectivecolor',
      name: isAr ? 'لون انتقائي' : 'Selective Color',
      icon: <Mail size={20} />,
    },
    {
      key: 'invert',
      name: isAr ? 'عكس الألوان' : 'Invert',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <polygon points="3,3 21,3 3,21" fill="currentColor" opacity="0.3" />
          <circle cx="12" cy="12" r="4" stroke="currentColor" fill="currentColor" />
        </svg>
      ),
    },
    {
      key: 'posterize',
      name: isAr ? 'تدرج لوني مجزأ' : 'Posterize',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
        </svg>
      ),
    },
    {
      key: 'threshold',
      name: isAr ? 'عتبة التباين' : 'Threshold',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M4 17 L12 17 L12 7 L20 7" stroke="#ffffff" strokeWidth="2" />
        </svg>
      ),
    },
    {
      key: 'gradientmap',
      name: isAr ? 'خريطة التدرج' : 'Gradient Map',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <defs>
            <linearGradient id="psGradMap" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#000000" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
          </defs>
          <rect x="3" y="5" width="18" height="14" rx="2" fill="url(#psGradMap)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        </svg>
      ),
    },
  ];

  return (
    <div className="ps-adjustments-panel">
      {/* Photoshop Tabs Header */}
      <div className="ps-dock-panel-tabs">
        <div className="ps-dock-tabs-list">
          <button
            type="button"
            className={`ps-dock-tab ${activeGroupTab === 'adjustments' ? 'active' : ''}`}
            onClick={() => setActiveGroupTab('adjustments')}
          >
            {isAr ? 'التعديلات' : 'Adjustments'}
          </button>
          <button
            type="button"
            className={`ps-dock-tab ${activeGroupTab === 'libraries' ? 'active' : ''}`}
            onClick={() => setActiveGroupTab('libraries')}
          >
            {isAr ? 'المكتبات' : 'Libraries'}
          </button>
        </div>
        <button type="button" className="ps-dock-tab-menu-btn" title="Panel Options">
          <MoreHorizontal size={13} />
        </button>
      </div>

      {activeGroupTab === 'adjustments' ? (
        <div className="ps-adjustments-content">
          {/* Sub Toolbar Row: + Folder Trash List */}
          <div className="ps-adj-sub-toolbar">
            <div className="ps-adj-tool-icons">
              <button type="button" className="ps-adj-icon-btn" title={isAr ? 'إضافة تعديل جديد' : 'New Adjustment'}>
                <Plus size={13} />
              </button>
              <button type="button" className="ps-adj-icon-btn" title={isAr ? 'مجلد جديد' : 'New Folder'}>
                <Folder size={12} />
              </button>
              <button type="button" className="ps-adj-icon-btn" title={isAr ? 'حذف' : 'Delete'}>
                <Trash2 size={12} />
              </button>
            </div>
            <button type="button" className="ps-adj-icon-btn" title={isAr ? 'طريقة العرض' : 'View Mode'}>
              <List size={13} />
            </button>
          </div>

          {/* Sub Tabs: Presets | Single adjustments */}
          <div className="ps-adj-mode-tabs">
            <button
              type="button"
              className={`ps-adj-mode-tab ${subTab === 'presets' ? 'active' : ''}`}
              onClick={() => setSubTab('presets')}
            >
              {isAr ? 'الإعدادات المسبقة' : 'Presets'}
            </button>
            <button
              type="button"
              className={`ps-adj-mode-tab ${subTab === 'single' ? 'active' : ''}`}
              onClick={() => setSubTab('single')}
            >
              {isAr ? 'التعديلات الفردية' : 'Single adjustments'}
            </button>
          </div>

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
      ) : (
        <div className="ps-empty-tab-note">
          <span>{isAr ? 'مكتبات الأصول السحابية' : 'Creative Cloud Libraries'}</span>
        </div>
      )}
    </div>
  );
};
