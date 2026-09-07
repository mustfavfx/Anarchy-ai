/**
 * Internationalization (i18n) Service
 * Supports English (en, default) and Arabic (ar)
 */

import { useState, useEffect, useCallback } from 'react';

export type Language = 'en' | 'ar';

export const LANGUAGE_STORAGE_KEY = 'anarchy_language';

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // General
    'app.title': 'Anarchy AI',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.save': 'Save',
    'common.saved': 'Saved!',
    'common.reset': 'Reset',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.search': 'Search...',
    'common.loading': 'Loading...',
    'common.view': 'View',
    'common.copy': 'Copy',
    'common.download': 'Download',
    'common.clear': 'Clear',

    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language / اللغة',
    'settings.languageDesc': 'Select your preferred interface language',
    'settings.clearCache': 'Clear Local Cache & Preferences',
    'settings.clearCacheDesc': 'Clears local preferences, session cache, and resets settings to defaults. Project files (.ana) on disk remain untouched.',
    'settings.clearCacheBtn': 'Clear Cache',
    'settings.clearCacheConfirmTitle': 'Clear Local Cache & Preferences',
    'settings.clearCacheConfirmMsg': 'This will reset your local UI preferences, stored cache, and settings to defaults. Your project files (.ana) and generated assets on disk will NOT be deleted.',

    // Builder
    'builder.autoArrange': 'Auto Arrange Nodes (Grid Layout)',
    'builder.deleteGroup': 'Delete Group',
    'builder.cancelProcessing': 'Cancel Processing',
    'builder.rearrangeGraph': 'Rearrange Graph',
    'builder.copyFrameRef': 'Click to copy frame reference',
    'builder.generatingMask': 'Generating mask...',
    'builder.tempNode': 'Temporary generation node',
    'builder.aiProcessing': 'AI Processing...',
    'builder.completed': 'Completed',
    'builder.applyCrop': 'Apply Crop',
    'builder.cancelCrop': 'Cancel Crop',
    'builder.moveHandle': 'Click and drag to move control point',

    // Navigation & Terminology
    'nav.dashboard': 'Dashboard',
    'nav.projects': 'Projects',
    'nav.projectsDesc': 'Manage workflow files and canvases (.ana)',
    'nav.library': 'Library',
    'nav.libraryDesc': 'Browse image assets and generated renders',
    'nav.history': 'History',
    'nav.settings': 'Settings',

    // Command Palette
    'search.placeholder': 'Search projects, assets, presets, commands (Ctrl+K)...',
    'search.projects': 'Projects',
    'search.assets': 'Library Assets',
    'search.history': 'Generation History',
    'search.presets': 'AI Presets',
    'search.commands': 'Commands',
    'search.noResults': 'No matching results found',
  },
  ar: {
    // General
    'app.title': 'Anarchy AI',
    'common.confirm': 'تأكيد',
    'common.cancel': 'إلغاء',
    'common.close': 'إغلاق',
    'common.save': 'حفظ',
    'common.saved': 'تم الحفظ!',
    'common.reset': 'إعادة ضبط',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.search': 'بحث...',
    'common.loading': 'جارِ التحميل...',
    'common.view': 'عرض',
    'common.copy': 'نسخ',
    'common.download': 'تحميل',
    'common.clear': 'مسح',

    // Settings
    'settings.title': 'الإعدادات',
    'settings.language': 'اللغة / Language',
    'settings.languageDesc': 'اختر لغة الواجهة المفضلة',
    'settings.clearCache': 'مسح التخزين المؤقت والتفضيلات المحلية',
    'settings.clearCacheDesc': 'يمسح التفضيلات المحلية والذاكرة المؤقتة ويعيد الإعدادات للوضع الافتراضي. ملفات المشاريع (.ana) على القرص تبقى آمنة دون حذف.',
    'settings.clearCacheBtn': 'مسح التخزين المؤقت',
    'settings.clearCacheConfirmTitle': 'مسح التخزين المؤقت والتفضيلات المحلية',
    'settings.clearCacheConfirmMsg': 'سيؤدي هذا إلى إعادة ضبط تفضيلات الواجهة المحلية والتخزين المؤقت والإعدادات. ملفات المشاريع (.ana) والوسائط على القرص لن يتم حذفها.',

    // Builder
    'builder.autoArrange': 'ترتيب تلقائي للنودات (شبكة)',
    'builder.deleteGroup': 'حذف المجموعة',
    'builder.cancelProcessing': 'إلغاء المعالجة',
    'builder.rearrangeGraph': 'إعادة ترتيب المخطط',
    'builder.copyFrameRef': 'انقر لنسخ مرجع الإطار',
    'builder.generatingMask': 'جارِ توليد الماسك...',
    'builder.tempNode': 'نود توليد مؤقتة',
    'builder.aiProcessing': 'جارِ المعالجة بالذكاء الاصطناعي...',
    'builder.completed': 'مكتمل',
    'builder.applyCrop': 'تأكيد القص',
    'builder.cancelCrop': 'إلغاء القص',
    'builder.moveHandle': 'انقر واسحب لتحريك نقطة التحكم',

    // Navigation & Terminology
    'nav.dashboard': 'لوحة التحكم',
    'nav.projects': 'المشاريع',
    'nav.projectsDesc': 'إدارة ملفات ومخططات العمل (.ana)',
    'nav.library': 'المكتبة',
    'nav.libraryDesc': 'استعراض أصول الصور والمخرجات والتوليدات',
    'nav.history': 'السجل',
    'nav.settings': 'الإعدادات',

    // Command Palette
    'search.placeholder': 'ابحث في المشاريع، الأصول، الـ Presets، والأوامر (Ctrl+K)...',
    'search.projects': 'المشاريع',
    'search.assets': 'أصول المكتبة والصور',
    'search.history': 'سجل التوليد',
    'search.presets': 'النماذج الجاهزة (Presets)',
    'search.commands': 'الأوامر',
    'search.noResults': 'لا توجد نتائج مطابقة',
  }
};

// One-time automatic migration of any legacy 'ar' settings to English
try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ar') {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
  }
} catch {}

let currentLanguage: Language = 'en';

export function getLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
    if (saved === 'en' || saved === 'ar') {
      currentLanguage = saved;
      return saved;
    }
  } catch {}
  return currentLanguage;
}

export function setLanguage(lang: Language) {
  currentLanguage = lang;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    window.dispatchEvent(new CustomEvent('anarchy:language-changed', { detail: lang }));
  } catch {}
}

export function t(key: string, fallback?: string): string {
  const lang = getLanguage();
  return translations[lang]?.[key] || translations.en?.[key] || fallback || key;
}

export function useTranslation() {
  const [lang, setLangState] = useState<Language>(() => getLanguage());

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<Language>;
      if (customEvent.detail) {
        setLangState(customEvent.detail);
      }
    };
    window.addEventListener('anarchy:language-changed', handler);
    return () => window.removeEventListener('anarchy:language-changed', handler);
  }, []);

  const changeLanguage = useCallback((newLang: Language) => {
    setLanguage(newLang);
    setLangState(newLang);
  }, []);

  const translate = useCallback((key: string, fallback?: string) => {
    return translations[lang]?.[key] || translations.en?.[key] || fallback || key;
  }, [lang]);

  return {
    t: translate,
    language: lang,
    setLanguage: changeLanguage,
    isRTL: lang === 'ar',
    isAr: lang === 'ar',
  };
}
