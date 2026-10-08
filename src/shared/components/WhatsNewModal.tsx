import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Layers,
  Building2,
  Zap,
  Palette,
  CheckCircle2,
  ArrowRight,
  Rocket
} from 'lucide-react';
import './WhatsNewModal.css';

export interface UpdateSlide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  graphicType: 'canvas' | 'layers' | 'agent' | 'rendering' | 'prompts';
  accentColor: string;
}

const UPDATE_SLIDES: UpdateSlide[] = [
  {
    id: 'archvision-studio-2',
    badge: 'تحديث رئيسي v0.3.96 | ArchVision AI Studio',
    title: 'استوديو الوكيل المعماري الذكي 2.0 وعارض الكتل ثلاثي الأبعاد WebGL',
    subtitle: 'بيئة استشارية متكاملة: عارض 3D تفاعلي، استدلال معماري عميق، وإدارة جلسات احترافية',
    description: 'ترقية كبرى لواجهة الوكيل المعماري (ArchVision Studio): إضافة عارض كتل ثلاثي الأبعاد تفاعلي مدمج بـ Three.js WebGL، وسلسلة استدلال معماري عميق (Deep Chain-of-Thought) من 5 مراحل تدقيقية، ونظام جلسات محادثة متطور (Multi-Session Sidebar) مع الحفظ التلقائي، وتحويل واجهة الوكيل بالكامل للغة الإنجليزية التخصصية مع مزامنة الكانفس وتنفيذ 3ds Max المباشر.',
    features: [
      'عارض كتل 3D تفاعلي مدمج (Three.js WebGL) مع إضاءة شمسية متحركة ووايرفريم ودوران سلس',
      'سلسلة استدلال وتدقيق معماري عميق (Deep Chain-of-Thought) تدقق الارتدادات والكود ومسار الشمس',
      'شريط جلسات جانبي احترافي (Sessions Sidebar) مع بحث فوري، إعادة تسمية، وتخزين محلي آمن',
      'تنفيذ مباشر لأوامر 3ds Max عبر CUA، تصدير مخططات AutoCAD DXF، وحساب جداول كميات BOQ Excel',
      'تحويل كامل لواجهة الوكيل المعماري إلى اللغة الإنجليزية المتخصصة مع تكامل فوري لعقد الكانفاس',
    ],
    graphicType: 'agent',
    accentColor: '#ec4899',
  },
  {
    id: 'studio-workspace',
    badge: 'الاستوديو المتكامل v0.07',
    title: 'مساحة العمل اللانهائية والذكاء المعماري',
    subtitle: 'بيئة تصميم تفاعلية مبنية بالكامل على النودات والذكاء البصري الفائق',
    description: 'تحكم لا محدود في بناء وتفريغ ومقارنة الأفكار المعمارية، مع نظام حفظ سحابي دائم عبر Cloudflare وSupabase Storage يمنع فقدان أو انكسار روابط الصور نهائياً.',
    features: [
      'كانفاس لا نهائي مع تسريع العتاد بالكامل (GPU Acceleration)',
      'تفريغ وتوليد النودات وتفرعاتها بضغطة زر واحدة',
      'حفظ الصور بشكل دائم ومباشر دون الاعتماد على روابط مؤقتة',
    ],
    graphicType: 'canvas',
    accentColor: '#e11d48',
  },
  {
    id: 'studio-canvas-layers',
    badge: 'استوديو الطبقات والعزل',
    title: 'محرر الاستوديو (Studio Canvas) فائق السرعة',
    subtitle: 'لوحة تحكم جانبية قابلة للطي مع أدوات احترافية لا تحجب مساحة العمل',
    description: 'تمت ترقية محرر الماسك والعزل ليعمل بسرعة فائقة (120 FPS)، مع لوحة تحكم مدمجة وقابلة للطي بنقرة واحدة، ومحرك تعديل لوني حي يدعم المنحنيات والمستويات.',
    features: [
      'لوحة استوديو مدمجة قابلة للطي (Collapsible Dock) لا تغطي الصورة أبداً',
      'تعديلات لونية حية: Levels، Curves، Exposure، وHue/Saturation',
      'رسم فوري بدون أي تأخير عبر تحسين نواة العرض المباشر',
    ],
    graphicType: 'layers',
    accentColor: '#38bdf8',
  },
  {
    id: 'architect-agent',
    badge: 'الوكيل المعماري المقيم',
    title: 'وكيل ذكاء معماري بنموذج فردي صارم',
    subtitle: 'تنفيذ ذكي للنموذج المختار فقط دون استهلاك غير مرغوب في الرصيد',
    description: 'تم حصر توجيه أوامر الوكيل المعماري في النموذج الذي تختاره أنت بدقة (مثل Claude Sonnet 5.5 أو Grok 4.1)، مع إلغاء حلقات التراجع التلقائي وتفعيل النمذجة المباشرة مع 3ds Max.',
    features: [
      'تنفيذ حصري لنموذجك المختار ومنع أي طلبات متوازية توفيراً للرصيد',
      'تدقيق كود البناء الحقيقي بالأرقام (السعودي، بغداد، ومسقط)',
      'تحكم مباشر ونمذجة ثلاثية الأبعاد متصلة ببرنامج 3ds Max',
    ],
    graphicType: 'agent',
    accentColor: '#a855f7',
  },
  {
    id: 'rendering-engines',
    badge: 'محركات الرندر الفائقة',
    title: 'FLUX 3 وميدجيرني تيربو (Midjourney Turbo)',
    subtitle: 'أعلى دقة تفاصيل معمارية ورفع جودة حقيقي وفوري',
    description: 'تم حل مشكلة تداخل الطلبات مع ريبليكيت وتفعيل محرك Midjourney Turbo Upscaler ليعمل عبر السيرفرات السريعة مع عرض النتائج فوراً داخل النود دون أي انكسار للصور.',
    features: [
      'بدء فوري بدقة Auto 1:1 في محرك FLUX 3 مع تحسين تلقائي',
      'رفع جودة فائق السرعة عبر Midjourney Turbo دون أي تحويل خارجي',
      'معالجة ذكية لتجاوز قيود Discord CDN والحفاظ على جودة الـ 8K',
    ],
    graphicType: 'rendering',
    accentColor: '#f59e0b',
  },
  {
    id: 'prompt-engineering',
    badge: 'هندسة البرومبتات',
    title: 'صياغة وهندسة برومبتات رندر فوتوغرافية معمارية',
    subtitle: 'تراكيب بصرية احترافية مبنية على أصول التصوير المعماري العالمي',
    description: 'تم تحديث مصفوفة توليد البرومبتات لتشمل مواصفات العدسات المعمارية (Tilt-Shift 35mm)، درجات حرارة الإضاءة بالكلفن (Kelvin Daylight & Coves)، وخامات حقيقية ملموسة.',
    features: [
      'توليد برومبتات معمارية تلقائية خالية من الحشو الروبوتي',
      'تحديد نوعية الحجر (ترافرتين مقطوع مع العرق، خشب البلوط، زجاج Low-E)',
      'توزيع واقعي للإضاءة النهارية وزوايا الظلال المعمارية',
    ],
    graphicType: 'prompts',
    accentColor: '#10b981',
  },
];

const STORAGE_KEY = 'anarchy_whats_new_v0.3.96_seen';

export interface WhatsNewModalProps {
  forceOpen?: boolean;
  onCloseManual?: () => void;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({
  forceOpen = false,
  onCloseManual,
}) => {
  const [isOpen, setIsOpen] = useState(forceOpen);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setActiveIndex(0);
    };
    window.addEventListener('anarchy:open-whats-new', handleOpen);
    return () => window.removeEventListener('anarchy:open-whats-new', handleOpen);
  }, []);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const timer = setTimeout(() => setIsOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, [forceOpen]);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, 'true');
    if (onCloseManual) onCloseManual();
  };

  const handleNext = () => {
    if (activeIndex < UPDATE_SLIDES.length - 1) {
      setActiveIndex((prev) => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      setActiveIndex((prev) => prev - 1);
    }
  };

  // Keyboard navigation (Escape, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') handleNext();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex]);

  if (!isOpen) return null;

  const currentSlide = UPDATE_SLIDES[activeIndex];

  return (
    <div className="anarchy-wn-backdrop" onClick={handleClose}>
      <div className="anarchy-wn-card" onClick={(e) => e.stopPropagation()}>
        {/* Glow halo */}
        <div
          className="anarchy-wn-glow-orb"
          style={{ background: currentSlide.accentColor }}
        />

        {/* Header */}
        <div className="anarchy-wn-header">
          <div className="anarchy-wn-brand">
            <div className="anarchy-wn-logo-badge">A</div>
            <div>
              <div className="anarchy-wn-app-title">Anarchy AI Studio</div>
              <div className="anarchy-wn-version-tag">تحديثات الإصدار 0.07</div>
            </div>
          </div>
          <button
            type="button"
            className="anarchy-wn-close-btn"
            onClick={handleClose}
            title="إغلاق النافذة (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="anarchy-wn-body">
          {/* Left: Interactive Graphic Illustration */}
          <div className="anarchy-wn-graphic-panel">
            <div className="anarchy-wn-graphic-canvas">
              {currentSlide.graphicType === 'canvas' && (
                <svg viewBox="0 0 320 240" className="anarchy-wn-svg-illu">
                  <defs>
                    <linearGradient id="gradNode1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#e11d48" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#881337" stopOpacity="0.4" />
                    </linearGradient>
                    <linearGradient id="gradNode2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#0369a1" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>
                  {/* Grid Lines */}
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  </pattern>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  {/* Connection Curve */}
                  <path
                    d="M 90 90 C 140 90, 150 150, 210 150"
                    fill="none"
                    stroke="#e11d48"
                    strokeWidth="3"
                    strokeDasharray="6 4"
                    className="anarchy-wn-pulse-line"
                  />
                  {/* Node 1 */}
                  <rect x="30" y="55" width="85" height="70" rx="10" fill="url(#gradNode1)" stroke="#e11d48" strokeWidth="1.5" />
                  <rect x="40" y="65" width="65" height="36" rx="4" fill="rgba(0,0,0,0.5)" />
                  <circle cx="72" cy="83" r="10" fill="#e11d48" opacity="0.8" />
                  <rect x="40" y="108" width="45" height="6" rx="3" fill="#ffffff" opacity="0.7" />
                  {/* Node 2 */}
                  <rect x="200" y="115" width="95" height="80" rx="10" fill="url(#gradNode2)" stroke="#38bdf8" strokeWidth="1.5" />
                  <rect x="210" y="125" width="75" height="44" rx="4" fill="rgba(0,0,0,0.5)" />
                  <rect x="210" y="176" width="55" height="6" rx="3" fill="#38bdf8" opacity="0.8" />
                </svg>
              )}

              {currentSlide.graphicType === 'layers' && (
                <svg viewBox="0 0 320 240" className="anarchy-wn-svg-illu">
                  <defs>
                    <linearGradient id="gradCurve" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                  {/* Background Board */}
                  <rect x="40" y="30" width="240" height="180" rx="12" fill="#18181b" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                  {/* Histogram Bars */}
                  <g opacity="0.25">
                    {[15, 35, 60, 90, 110, 80, 50, 40, 25, 10].map((h, i) => (
                      <rect key={i} x={60 + i * 20} y={190 - h} width="16" height={h} fill="#38bdf8" rx="2" />
                    ))}
                  </g>
                  {/* Curves Grid */}
                  <line x1="60" y1="190" x2="260" y2="190" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <line x1="60" y1="50" x2="60" y2="190" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <path
                    d="M 60 190 Q 130 180, 160 120 T 260 50"
                    fill="none"
                    stroke="url(#gradCurve)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  {/* Control Points */}
                  <circle cx="60" cy="190" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="160" cy="120" r="6" fill="#a855f7" stroke="#ffffff" strokeWidth="2.5" />
                  <circle cx="260" cy="50" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
                  {/* Mask Brush Laser Ring */}
                  <circle cx="210" cy="140" r="22" fill="rgba(225,29,72,0.2)" stroke="#e11d48" strokeWidth="2" strokeDasharray="4 2" />
                  <circle cx="210" cy="140" r="2" fill="#ffffff" />
                </svg>
              )}

              {currentSlide.graphicType === 'agent' && (
                <svg viewBox="0 0 320 240" className="anarchy-wn-svg-illu">
                  <defs>
                    <linearGradient id="gradBlueprint" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1e1b4b" />
                      <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>
                  </defs>
                  <rect x="30" y="30" width="260" height="180" rx="12" fill="url(#gradBlueprint)" stroke="#6366f1" strokeWidth="1.5" />
                  {/* Architectural Blueprint Isometric House */}
                  <g transform="translate(160, 120)" stroke="#a855f7" strokeWidth="2" fill="none" strokeLinejoin="round">
                    {/* Main Mass */}
                    <path d="M 0 -50 L 60 -20 L 0 10 L -60 -20 Z" fill="rgba(168,85,247,0.15)" />
                    <path d="M -60 -20 L 0 10 L 0 60 L -60 30 Z" fill="rgba(99,102,241,0.2)" />
                    <path d="M 0 10 L 60 -20 L 60 30 L 0 60 Z" fill="rgba(147,51,234,0.3)" />
                    {/* Cantilever Box */}
                    <path d="M -20 -30 L 40 0 L 40 25 L -20 -5 Z" fill="rgba(56,189,248,0.3)" stroke="#38bdf8" />
                    {/* Dimension Lines */}
                    <line x1="-70" y1="-20" x2="-70" y2="30" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1="-60" y1="40" x2="0" y2="70" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" />
                  </g>
                  {/* Badge */}
                  <rect x="45" y="45" width="85" height="22" rx="11" fill="rgba(168,85,247,0.25)" stroke="#a855f7" strokeWidth="1" />
                  <text x="87" y="60" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">3ds Max • BIM</text>
                </svg>
              )}

              {currentSlide.graphicType === 'rendering' && (
                <svg viewBox="0 0 320 240" className="anarchy-wn-svg-illu">
                  <defs>
                    <linearGradient id="gradFlame" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#b45309" />
                    </linearGradient>
                  </defs>
                  {/* Outer Frame */}
                  <rect x="40" y="30" width="240" height="180" rx="12" fill="#18181b" stroke="#f59e0b" strokeWidth="1.5" />
                  {/* Lightning / Turbo Speed */}
                  <path
                    d="M 170 45 L 125 125 L 160 125 L 140 195 L 205 110 L 165 110 Z"
                    fill="url(#gradFlame)"
                    filter="drop-shadow(0 0 14px rgba(245,158,11,0.6))"
                  />
                  {/* Super-Resolution Grid overlay */}
                  <g opacity="0.3" stroke="#f59e0b" strokeWidth="1">
                    <line x1="60" y1="70" x2="100" y2="70" />
                    <line x1="60" y1="90" x2="110" y2="90" />
                    <line x1="220" y1="150" x2="260" y2="150" />
                    <line x1="210" y1="170" x2="260" y2="170" />
                  </g>
                  <rect x="185" y="45" width="80" height="22" rx="11" fill="rgba(245,158,11,0.2)" stroke="#f59e0b" strokeWidth="1" />
                  <text x="225" y="60" textAnchor="middle" fill="#fef08a" fontSize="10" fontWeight="bold">MJ Turbo ⚡</text>
                </svg>
              )}

              {currentSlide.graphicType === 'prompts' && (
                <svg viewBox="0 0 320 240" className="anarchy-wn-svg-illu">
                  <defs>
                    <linearGradient id="gradAperture" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#047857" />
                    </linearGradient>
                  </defs>
                  <rect x="40" y="30" width="240" height="180" rx="12" fill="#064e3b" stroke="#10b981" strokeWidth="1.5" opacity="0.4" />
                  {/* Camera Aperture / Lens Rings */}
                  <circle cx="160" cy="120" r="55" fill="none" stroke="#10b981" strokeWidth="2.5" />
                  <circle cx="160" cy="120" r="42" fill="none" stroke="#34d399" strokeWidth="1.5" strokeDasharray="6 3" />
                  <circle cx="160" cy="120" r="24" fill="rgba(16,185,129,0.3)" stroke="#10b981" strokeWidth="2" />
                  {/* Crosshair */}
                  <line x1="160" y1="50" x2="160" y2="190" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <line x1="90" y1="120" x2="230" y2="120" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <text x="160" y="195" textAnchor="middle" fill="#6ee7b7" fontSize="10" fontWeight="bold">35mm • Tilt-Shift • 3200K</text>
                </svg>
              )}
            </div>

            {/* Slide Index Pill */}
            <div className="anarchy-wn-step-indicator">
              صفحة {activeIndex + 1} من {UPDATE_SLIDES.length}
            </div>
          </div>

          {/* Right: Text Details & Feature Highlights */}
          <div className="anarchy-wn-text-panel">
            <div
              className="anarchy-wn-badge-chip"
              style={{
                color: currentSlide.accentColor,
                borderColor: `${currentSlide.accentColor}55`,
                background: `${currentSlide.accentColor}18`,
              }}
            >
              <Sparkles size={13} />
              <span>{currentSlide.badge}</span>
            </div>

            <h2 className="anarchy-wn-slide-title">{currentSlide.title}</h2>
            <h4 className="anarchy-wn-slide-subtitle">{currentSlide.subtitle}</h4>
            <p className="anarchy-wn-slide-desc">{currentSlide.description}</p>

            <div className="anarchy-wn-features-list">
              {currentSlide.features.map((feat, i) => (
                <div key={i} className="anarchy-wn-feature-item">
                  <CheckCircle2
                    size={16}
                    style={{ color: currentSlide.accentColor, flexShrink: 0, marginTop: '2px' }}
                  />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="anarchy-wn-footer">
          {/* Dots Indicator */}
          <div className="anarchy-wn-dots">
            {UPDATE_SLIDES.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                className={`anarchy-wn-dot ${i === activeIndex ? 'active' : ''}`}
                style={{
                  background: i === activeIndex ? slide.accentColor : undefined,
                }}
                onClick={() => setActiveIndex(i)}
                title={slide.title}
              />
            ))}
          </div>

          {/* Buttons Group */}
          <div className="anarchy-wn-btn-group">
            {activeIndex > 0 && (
              <button
                type="button"
                className="anarchy-wn-prev-btn"
                onClick={handlePrev}
              >
                <ChevronRight size={16} />
                <span>السابق</span>
              </button>
            )}

            <button
              type="button"
              className="anarchy-wn-next-btn"
              style={{
                background: currentSlide.accentColor,
                boxShadow: `0 4px 20px ${currentSlide.accentColor}55`,
              }}
              onClick={handleNext}
            >
              <span>{activeIndex === UPDATE_SLIDES.length - 1 ? 'بدء العمل الآن' : 'التالي'}</span>
              {activeIndex === UPDATE_SLIDES.length - 1 ? (
                <Rocket size={16} />
              ) : (
                <ChevronLeft size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
