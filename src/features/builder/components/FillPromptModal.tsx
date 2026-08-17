import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Sparkles, Dices, RotateCcw, ChevronDown, Check, Palette, 
  Copy, Building2, MapPin, Layers, Box, Shapes, Hammer, 
  Home, Crown, Wand2, FileText, LayoutGrid
} from 'lucide-react';
import './FillPromptModal.css';

interface FillPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPrompt: (promptText: string) => void;
  isArabic?: boolean;
}

// Custom Branded Dropdown Component matching Anarchy AI Identity
interface CustomSelectProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: string[];
  onChange: (val: string) => void;
  isArabic?: boolean;
  extraAction?: React.ReactNode;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  label,
  icon,
  value,
  options,
  onChange,
  isArabic = false,
  extraAction
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="fill-prompt-field" ref={dropdownRef}>
      <label className="fill-prompt-label">
        {icon}
        <span>{label}</span>
      </label>

      <div className="fill-prompt-select-row">
        <div className="fill-prompt-select-wrap">
          <button
            type="button"
            className={`fill-prompt-custom-trigger ${isOpen ? 'active' : ''} ${value ? 'has-value' : ''}`}
            onClick={() => setIsOpen(prev => !prev)}
          >
            <span className="trigger-value">{value || `-- ${isArabic ? 'اختر' : 'Select'} --`}</span>
            <ChevronDown size={15} className={`trigger-arrow ${isOpen ? 'open' : ''}`} />
          </button>

          {isOpen && (
            <div className="fill-prompt-custom-dropdown">
              <div 
                className={`dropdown-option ${!value ? 'selected' : ''}`}
                onClick={() => { onChange(''); setIsOpen(false); }}
              >
                <span>-- {isArabic ? 'إلغاء التحديد' : 'Clear selection'} --</span>
              </div>
              {options.map((opt) => {
                const isSelected = opt === value;
                return (
                  <div
                    key={opt}
                    className={`dropdown-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                    }}
                  >
                    <span className="option-text">{opt}</span>
                    {isSelected && <Check size={14} className="option-check" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {extraAction}
      </div>
    </div>
  );
};

// Popular RAL Architectural Colors
const RAL_COLORS = [
  { code: 'RAL 9016', name: 'Traffic White', hex: '#F6F6F6' },
  { code: 'RAL 7016', name: 'Anthracite Grey', hex: '#383E42' },
  { code: 'RAL 9005', name: 'Jet Black', hex: '#0A0A0A' },
  { code: 'RAL 8028', name: 'Terra Brown', hex: '#4E3B31' },
  { code: 'RAL 7035', name: 'Light Grey', hex: '#CBD2D0' },
  { code: 'RAL 1036', name: 'Pearl Gold', hex: '#7E683D' },
  { code: 'RAL 9007', name: 'Grey Aluminium', hex: '#8F8F8F' },
  { code: 'RAL 3009', name: 'Oxide Red', hex: '#6D342D' },
  { code: 'RAL 6003', name: 'Olive Green', hex: '#52573B' },
  { code: 'RAL 5011', name: 'Steel Blue', hex: '#232C3F' },
];

export const FillPromptModal: React.FC<FillPromptModalProps> = ({
  isOpen,
  onClose,
  onApplyPrompt,
  isArabic = false,
}) => {
  // Option fields state
  const [buildingType, setBuildingType] = useState('Modern Residential Villa');
  const [locationContext, setLocationContext] = useState('Coastal Cliff Overlooking Ocean');
  const [architecturalStyle, setArchitecturalStyle] = useState('Parametric Organic');
  const [floors, setFloors] = useState('Low-Rise (2-3 Floors)');
  const [massing, setMassing] = useState('Cantilevered Interlocking Cubes');
  const [geometry, setGeometry] = useState('Sharp Angular Lines with Structural Diagrid');
  const [primaryMaterial, setPrimaryMaterial] = useState('Exposed Board-Marked Concrete');
  const [facadeColor, setFacadeColor] = useState('Warm Charcoal & Bronze');
  const [roof, setRoof] = useState('Extensive Green Sky Garden Roof');
  const [signatureElement, setSignatureElement] = useState('Vertical Forest Balconies');
  
  const [showRalPicker, setShowRalPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [previewViewMode, setPreviewViewMode] = useState<'chips' | 'text'>('chips');

  if (!isOpen) return null;

  const BUILDING_TYPES = [
    'Modern Residential Villa',
    'Commercial Skyscraper / Tower',
    'Cultural Center & Museum',
    'Luxury Waterfront Resort',
    'Eco-Friendly Pavilion',
    'Residential Apartment Complex',
    'Mixed-Use City Tower',
    'Boutique Hotel',
    'Educational Campus'
  ];

  const LOCATION_CONTEXTS = [
    'Coastal Cliff Overlooking Ocean',
    'Dense Urban Downtown Skyline',
    'Alpine Forest & Mountain Range',
    'Arid Desert Oasis',
    'Riverfront Promenade',
    'Suburban Green Hillside',
    'Tropical Rainforest Edge'
  ];

  const ARCHITECTURAL_STYLES = [
    'Parametric Organic',
    'Minimalist Concrete & Glass',
    'Brutalist Sculptural Modernism',
    'Biophilic Green Architecture',
    'High-Tech Structural Expressionism',
    'Neo-Islamic Contemporary',
    'Deconstructivist Dynamic',
    'Scandinavian Modern'
  ];

  const FLOORS_OPTIONS = [
    'Single Story Pavilion',
    'Low-Rise (2-3 Floors)',
    'Mid-Rise (5-8 Floors)',
    'High-Rise (15-30 Floors)',
    'Supertall Skyscraper (50+ Floors)'
  ];

  const MASSING_OPTIONS = [
    'Cantilevered Interlocking Cubes',
    'Stepped Terraces with Sky Gardens',
    'Curvilinear Fluid Ribbon Shell',
    'Monolithic Solid Block with Atrium Cutouts',
    'Modular Stacked Volumes'
  ];

  const GEOMETRY_OPTIONS = [
    'Sharp Angular Lines with Structural Diagrid',
    'Smooth Curvilinear Sweep',
    'Orthogonal Grid Pattern',
    'Voronoi Tessellation Façade',
    'Fractured Dynamic Angles'
  ];

  const MATERIAL_OPTIONS = [
    'Exposed Board-Marked Concrete',
    'Ultra-Clear Structural Triple Glass',
    'Thermo-Treated Timber Battens',
    'Bronze Anodized Aluminum Panels',
    'Natural Travertine Stone Slabs',
    'Weathered Cor-Ten Steel'
  ];

  const COLOR_OPTIONS = [
    'Warm Charcoal & Bronze',
    'Pure Matte White',
    'Raw Concrete Grey',
    'Terracotta Earth',
    'Deep Obsidian Black',
    'Champagne Gold Metallic',
    'RAL 9016 Traffic White',
    'RAL 7016 Anthracite Grey',
    'RAL 9005 Jet Black'
  ];

  const ROOF_OPTIONS = [
    'Extensive Green Sky Garden Roof',
    'Cantilevered Flat Concrete Slab',
    'Dynamic Slanted Photovoltaic Canopy',
    'Sculptural Vaulted Shell',
    'Rooftop Infinity Pool Terrace'
  ];

  const SIGNATURE_ELEMENTS = [
    'Vertical Forest Balconies',
    'Kinetic Solar-Tracking Louvers',
    'Double-Height Glazed Light Atrium',
    'Water Mirror Reflecting Pool',
    'Cantilevered Floating Skybox'
  ];

  const handleRandomize = () => {
    setIsRandomizing(true);
    setTimeout(() => setIsRandomizing(false), 400);

    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    setBuildingType(pick(BUILDING_TYPES));
    setLocationContext(pick(LOCATION_CONTEXTS));
    setArchitecturalStyle(pick(ARCHITECTURAL_STYLES));
    setFloors(pick(FLOORS_OPTIONS));
    setMassing(pick(MASSING_OPTIONS));
    setGeometry(pick(GEOMETRY_OPTIONS));
    setPrimaryMaterial(pick(MATERIAL_OPTIONS));
    setFacadeColor(pick(COLOR_OPTIONS));
    setRoof(pick(ROOF_OPTIONS));
    setSignatureElement(pick(SIGNATURE_ELEMENTS));
  };

  const handleClearAll = () => {
    setBuildingType('');
    setLocationContext('');
    setArchitecturalStyle('');
    setFloors('');
    setMassing('');
    setGeometry('');
    setPrimaryMaterial('');
    setFacadeColor('');
    setRoof('');
    setSignatureElement('');
  };

  const constructPrompt = () => {
    const parts = [
      'Create an original architectural design using the following parameters:'
    ];
    if (buildingType) parts.push(`Building type: ${buildingType}.`);
    if (locationContext) parts.push(`Location context: ${locationContext}.`);
    if (architecturalStyle) parts.push(`Architectural style: ${architecturalStyle}.`);
    if (floors) parts.push(`Floors: ${floors}.`);
    if (massing) parts.push(`Massing: ${massing}.`);
    if (geometry) parts.push(`Geometry: ${geometry}.`);
    if (primaryMaterial) parts.push(`Primary material: ${primaryMaterial}.`);
    if (facadeColor) parts.push(`Facade color: ${facadeColor}.`);
    if (roof) parts.push(`Roof: ${roof}.`);
    if (signatureElement) parts.push(`Signature element: ${signatureElement}.`);
    parts.push('High-end architectural photography, 8k resolution, dramatic volumetric lighting.');
    return parts.join(' ');
  };

  const handleCopyPrompt = () => {
    const promptText = constructPrompt();
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUse = () => {
    onApplyPrompt(constructPrompt());
    onClose();
  };

  const activeParameters = [
    { label: 'Type', value: buildingType, color: '#fb7185' },
    { label: 'Location', value: locationContext, color: '#f59e0b' },
    { label: 'Style', value: architecturalStyle, color: '#38bdf8' },
    { label: 'Floors', value: floors, color: '#c084fc' },
    { label: 'Massing', value: massing, color: '#34d399' },
    { label: 'Geometry', value: geometry, color: '#60a5fa' },
    { label: 'Material', value: primaryMaterial, color: '#f472b6' },
    { label: 'Color', value: facadeColor, color: '#fb923c' },
    { label: 'Roof', value: roof, color: '#a7f3d0' },
    { label: 'Signature', value: signatureElement, color: '#e879f9' }
  ].filter(p => !!p.value);

  return (
    <div className="fill-prompt-overlay" onClick={onClose}>
      <div 
        className="fill-prompt-modal" 
        onClick={(e) => e.stopPropagation()} 
        style={{ direction: isArabic ? 'rtl' : 'ltr' }}
      >
        {/* Header */}
        <div className="fill-prompt-header">
          <div className="fill-prompt-header-title">
            <div className="fill-prompt-header-icon-badge">
              <Wand2 size={18} className="fill-prompt-sparkle" />
            </div>
            <div className="fill-prompt-header-text">
              <span className="fill-prompt-main-title">{isArabic ? 'تركيب البروموت المعماري' : 'Fill Prompt Generator'}</span>
              <span className="fill-prompt-sub-title">{isArabic ? 'مولد المعايير المعمارية التفاعلي' : 'Interactive Architectural Parameter Synthesizer'}</span>
            </div>
          </div>

          <div className="fill-prompt-header-actions">
            <span className="fill-prompt-counter-badge">
              {activeParameters.length}/10 {isArabic ? 'معيار نشط' : 'Active'}
            </span>
            <button className="fill-prompt-close-btn" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="fill-prompt-body">
          {/* Cyber-Glass Compact Live Preview Card */}
          <div className="fill-prompt-preview-card">
            <div className="fill-prompt-preview-header">
              <div className="fill-prompt-preview-live-tag">
                <span className="fill-prompt-live-dot" />
                <span>{isArabic ? 'معاينة مباشرة' : 'LIVE PROMPT PREVIEW'}</span>
              </div>

              <div className="fill-prompt-preview-controls">
                {/* View Mode Toggle */}
                <div className="fill-prompt-view-toggle">
                  <button 
                    type="button" 
                    className={`view-toggle-btn ${previewViewMode === 'chips' ? 'active' : ''}`}
                    onClick={() => setPreviewViewMode('chips')}
                    title="Compact Parameter Chips View"
                  >
                    <LayoutGrid size={12} />
                    <span>Chips</span>
                  </button>
                  <button 
                    type="button" 
                    className={`view-toggle-btn ${previewViewMode === 'text' ? 'active' : ''}`}
                    onClick={() => setPreviewViewMode('text')}
                    title="Raw Prompt Text View"
                  >
                    <FileText size={12} />
                    <span>Text</span>
                  </button>
                </div>

                <button 
                  type="button" 
                  className="fill-prompt-preview-copy-btn" 
                  onClick={handleCopyPrompt}
                  title="Copy prompt text"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copied ? (isArabic ? 'تم النسخ!' : 'Copied!') : (isArabic ? 'نسخ' : 'Copy')}</span>
                </button>
              </div>
            </div>
            
            <div className="fill-prompt-preview-content">
              {previewViewMode === 'chips' ? (
                <div className="fill-prompt-chips-flow">
                  {activeParameters.map((p) => (
                    <div key={p.label} className="fill-prompt-chip-badge" style={{ borderColor: `${p.color}40`, backgroundColor: `${p.color}12` }}>
                      <span className="chip-key" style={{ color: p.color }}>{p.label}:</span>
                      <span className="chip-val">{p.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="fill-prompt-raw-text">
                  {constructPrompt()}
                </div>
              )}
            </div>
          </div>

          {/* Section 1: Core Architectural Structure */}
          <div className="fill-prompt-section-divider">
            <div className="fill-prompt-section-tag">
              <Building2 size={13} style={{ color: '#fb7185' }} />
              <span>{isArabic ? 'التكتل والمعايير الهيكلية' : 'Core Architecture & Volume'}</span>
            </div>
            <div className="fill-prompt-section-line" />
          </div>

          {/* Form Fields Grid — Category 1 */}
          <div className="fill-prompt-grid">
            <CustomSelect
              label={isArabic ? 'نوع المبنى' : 'Building type'}
              icon={<Building2 size={13} style={{ color: '#fb7185' }} />}
              value={buildingType}
              options={BUILDING_TYPES}
              onChange={setBuildingType}
              isArabic={isArabic}
            />

            <CustomSelect
              label={isArabic ? 'سياق الموقع' : 'Location context'}
              icon={<MapPin size={13} style={{ color: '#f59e0b' }} />}
              value={locationContext}
              options={LOCATION_CONTEXTS}
              onChange={setLocationContext}
              isArabic={isArabic}
            />

            <CustomSelect
              label={isArabic ? 'النمط المعماري' : 'Architectural style'}
              icon={<Sparkles size={13} style={{ color: '#38bdf8' }} />}
              value={architecturalStyle}
              options={ARCHITECTURAL_STYLES}
              onChange={setArchitecturalStyle}
              isArabic={isArabic}
            />

            <CustomSelect
              label={isArabic ? 'عدد الطوابق' : 'Floors'}
              icon={<Layers size={13} style={{ color: '#c084fc' }} />}
              value={floors}
              options={FLOORS_OPTIONS}
              onChange={setFloors}
              isArabic={isArabic}
            />

            <CustomSelect
              label={isArabic ? 'التكتل المعماري' : 'Massing'}
              icon={<Box size={13} style={{ color: '#34d399' }} />}
              value={massing}
              options={MASSING_OPTIONS}
              onChange={setMassing}
              isArabic={isArabic}
            />

            <CustomSelect
              label={isArabic ? 'الهندسة والتشكيل' : 'Geometry'}
              icon={<Shapes size={13} style={{ color: '#60a5fa' }} />}
              value={geometry}
              options={GEOMETRY_OPTIONS}
              onChange={setGeometry}
              isArabic={isArabic}
            />
          </div>

          {/* Section 2: Materials & Envelope */}
          <div className="fill-prompt-section-divider">
            <div className="fill-prompt-section-tag">
              <Palette size={13} style={{ color: '#fb923c' }} />
              <span>{isArabic ? 'الخامات والتشطيبات والواجهة' : 'Materials, Facade & Envelope'}</span>
            </div>
            <div className="fill-prompt-section-line" />
          </div>

          {/* Form Fields Grid — Category 2 */}
          <div className="fill-prompt-grid">
            <CustomSelect
              label={isArabic ? 'الخامة الأساسية' : 'Primary material'}
              icon={<Hammer size={13} style={{ color: '#f472b6' }} />}
              value={primaryMaterial}
              options={MATERIAL_OPTIONS}
              onChange={setPrimaryMaterial}
              isArabic={isArabic}
            />

            <CustomSelect
              label={isArabic ? 'لون الواجهة' : 'Facade color'}
              icon={<Palette size={13} style={{ color: '#fb923c' }} />}
              value={facadeColor}
              options={COLOR_OPTIONS}
              onChange={setFacadeColor}
              isArabic={isArabic}
              extraAction={
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className={`fill-prompt-ral-btn ${showRalPicker ? 'active' : ''}`}
                    onClick={() => setShowRalPicker(prev => !prev)}
                    title="Select RAL color code"
                  >
                    <Palette size={14} />
                    <span>Choose RAL</span>
                  </button>

                  {showRalPicker && (
                    <div className="ral-picker-popup">
                      <div className="ral-picker-title">{isArabic ? 'ألوان RAL المعمارية القياسية' : 'Standard Architectural RAL Swatches'}</div>
                      <div className="ral-grid">
                        {RAL_COLORS.map((c) => (
                          <div
                            key={c.code}
                            className="ral-chip"
                            style={{ backgroundColor: c.hex }}
                            onClick={() => {
                              setFacadeColor(`${c.code} ${c.name}`);
                              setShowRalPicker(false);
                            }}
                            title={`${c.code} ${c.name}`}
                          >
                            <span className="ral-chip-code">{c.code}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              }
            />

            <CustomSelect
              label={isArabic ? 'السقف والغلاف' : 'Roof'}
              icon={<Home size={13} style={{ color: '#a7f3d0' }} />}
              value={roof}
              options={ROOF_OPTIONS}
              onChange={setRoof}
              isArabic={isArabic}
            />

            <CustomSelect
              label={isArabic ? 'العنصر المميز البصري' : 'Signature element'}
              icon={<Crown size={13} style={{ color: '#e879f9' }} />}
              value={signatureElement}
              options={SIGNATURE_ELEMENTS}
              onChange={setSignatureElement}
              isArabic={isArabic}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="fill-prompt-footer">
          <div className="fill-prompt-left-actions">
            <button className="fill-prompt-btn-secondary" onClick={handleClearAll} title="Clear all fields">
              <RotateCcw size={13} />
              <span>{isArabic ? 'تفريغ' : 'Clear'}</span>
            </button>
            <button 
              className={`fill-prompt-btn-secondary ${isRandomizing ? 'spinning' : ''}`} 
              onClick={handleRandomize} 
              title="Randomize all fields"
            >
              <Dices size={13} className={isRandomizing ? 'animate-spin' : ''} />
              <span>{isArabic ? 'توليد عشوائي' : 'Randomize'}</span>
            </button>
          </div>
          <button className="fill-prompt-btn-primary" onClick={handleUse}>
            <Check size={16} />
            <span>{isArabic ? 'تطبيق واستخدام البروموت' : 'Use Prompt'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
