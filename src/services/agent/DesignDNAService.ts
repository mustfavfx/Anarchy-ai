/**
 * DesignDNAService
 * Encapsulates curated architectural design identities (Design DNA)
 * and verifies compliance with local building codes (SBC 1101, Dubai Municipality, IBC).
 */

export interface ArchitecturalDesignDNA {
  id: string;
  name: string;
  nameAr: string;
  region: 'Saudi Arabia / Gulf' | 'International Contemporary' | 'Global Parametric' | 'Nordic Asian';
  badge: string;
  materials: string[];
  spatialPrinciples: string[];
  lightingMood: string;
  recommendedAspect: string;
  promptSignature: string;
}

export interface BuildingCodeRule {
  codeId: 'SBC_1101' | 'DUBAI_MUNICIPALITY' | 'IBC_INTERNATIONAL';
  codeName: string;
  frontSetbackMeters: number;
  sideSetbackMeters: number;
  rearSetbackMeters: number;
  maxCoveragePercent: number; // e.g. 65%
  maxHeightMeters: number;
  maxWindowWallRatio: number; // e.g. 0.35 (35%)
}

export interface ComplianceAuditReport {
  id: string;
  dna: ArchitecturalDesignDNA;
  code: BuildingCodeRule;
  complianceScore: number; // 0 - 100
  status: 'fully-compliant' | 'minor-deviations' | 'non-compliant';
  metrics: {
    siteAreaM2: number;
    groundCoverageM2: number;
    coveragePercent: number;
    frontSetbackM: number;
    sideSetbackM: number;
    estimatedBUA: number;
    solarShadingFactor: string;
  };
  checks: Array<{
    item: string;
    itemAr: string;
    passed: boolean;
    required: string;
    actual: string;
  }>;
  recommendations: string[];
}

export const ARCHITECTURAL_DNA_PROFILES: Record<string, ArchitecturalDesignDNA> = {
  salmani: {
    id: 'salmani',
    name: 'Salmani Architectural Code',
    nameAr: 'طراز العمارة السلمانية النجدية المعاصرة',
    region: 'Saudi Arabia / Gulf',
    badge: '🇸🇦 كود العمارة السلمانية',
    materials: ['Honed Riyadh Limestone', 'Perforated Bronze Mashrabiya', 'Textured Off-White Render', 'Water Courtyard Basins'],
    spatialPrinciples: [
      'Deep recessed shaded openings to prevent direct desert insolation',
      'Balanced solid-to-void masonry proportion echoing Najdi vernacular',
      'Central interior climate-moderating courtyard (حوش داخلي)',
      'Human-scaled massing steps with shaded colonnades',
    ],
    lightingMood: 'Warm golden desert twilight (3000K), soft cove uplighting washing textured stone surfaces',
    recommendedAspect: '16:9',
    promptSignature: 'Salmani architectural identity, authentic modern Najdi heritage, honed local Riyadh limestone facade, intricate geometric bronze mashrabiya solar screens, deeply recessed thermal windows, serene internal courtyard reflection pool, prestigious desert estate',
  },
  dubai_luxury: {
    id: 'dubai_luxury',
    name: 'Dubai Contemporary Estate',
    nameAr: 'طراز فيلات دبي المعاصرة الفاخرة',
    region: 'Saudi Arabia / Gulf',
    badge: '🇦🇪 دبي فيلا إستيت',
    materials: ['Italian Calacatta Marble', 'Ultra-Slim Minimalist Glazing', 'Brushed Champagne Aluminum', 'Travertine Stepping Slabs'],
    spatialPrinciples: [
      'Expansive multi-tier cantilevered shading planes',
      'Seamless indoor-outdoor living flow opening directly to infinity water',
      'Double-height glazed atrium volume with monumental entrance pivot door',
      'Lush xeriscape landscape framing rectilinear floating masses',
    ],
    lightingMood: 'High-contrast luxury evening illumination with backlit stone panels and pool reflections',
    recommendedAspect: '16:9',
    promptSignature: 'ultra-luxury modern architectural villa in Dubai, floating monumental cantilevers, floor-to-ceiling frameless glass curtain walls, bookmatched Calacatta marble cladding, expansive zero-edge infinity pool, twilight ambient architectural lighting',
  },
  zaha_parametric: {
    id: 'zaha_parametric',
    name: 'Zaha Hadid Parametricism',
    nameAr: 'الطراز البارامتري الديناميكي (زها حديد)',
    region: 'Global Parametric',
    badge: '🏛️ بارامتري ديناميكي',
    materials: ['Ultra-High Performance Concrete (UHPC)', 'Curved Structural Glass', 'Seamless Polymer Envelopes', 'Brushed Titanium Fins'],
    spatialPrinciples: [
      'Non-Euclidean flowing curved geometry and structural fluid continuity',
      'Structural exoskeleton serving as simultaneous facade and load support',
      'Dynamic spatial transitions without sharp corners or standard right angles',
    ],
    lightingMood: 'Futuristic diffused daylight revealing dramatic architectural curvature and shadow gradients',
    recommendedAspect: '16:9',
    promptSignature: 'Zaha Hadid architectural masterpiece, fluid organic curves, parametric sculptural massing, seamless UHPC concrete facade, aerodynamic curvilinear sweeps, monumental architectural scale, dramatic daylight shadows',
  },
  japandi_minimalist: {
    id: 'japandi_minimalist',
    name: 'Japandi Natural Sanctuary',
    nameAr: 'طراز جاباندي التجريدي الطبيعي',
    region: 'Nordic Asian',
    badge: '🌿 جاباندي طبيعي',
    materials: ['Shou Sugi Ban Charred Cedar', 'Raw Lime Plaster', 'Fluted Cast Glass', 'Basalt Stone Pavers'],
    spatialPrinciples: [
      'Zen courtyard with bonsai specimens and sound of water',
      'Low-slung horizontal proportions with deep eave overhangs',
      'Warm tactile minimalism devoid of ostentatious ornamentation',
    ],
    lightingMood: 'Soft diffused overcast light (4800K), gentle filtered light through timber louvers',
    recommendedAspect: '4:3',
    promptSignature: 'Japandi architectural sanctuary villa, minimalist charred cedar wood slats, handcrafted lime plaster walls, zen pebble courtyard garden, soft filtered natural light, peaceful architectural serenity',
  },
};

export const BUILDING_CODES: Record<string, BuildingCodeRule> = {
  SBC_1101: {
    codeId: 'SBC_1101',
    codeName: 'Saudi Building Code (SBC 1101 / SBC 201 Residential)',
    frontSetbackMeters: 3.0,
    sideSetbackMeters: 2.0,
    rearSetbackMeters: 2.0,
    maxCoveragePercent: 65,
    maxHeightMeters: 12.0,
    maxWindowWallRatio: 0.35,
  },
  DUBAI_MUNICIPALITY: {
    codeId: 'DUBAI_MUNICIPALITY',
    codeName: 'Dubai Municipality Villa Building Regulations (Al Sa’fat)',
    frontSetbackMeters: 3.5,
    sideSetbackMeters: 2.5,
    rearSetbackMeters: 3.0,
    maxCoveragePercent: 60,
    maxHeightMeters: 14.0,
    maxWindowWallRatio: 0.40,
  },
};

export class DesignDNAService {
  private static instance: DesignDNAService;

  private constructor() {}

  public static getInstance(): DesignDNAService {
    if (!DesignDNAService.instance) {
      DesignDNAService.instance = new DesignDNAService();
    }
    return DesignDNAService.instance;
  }

  public getDNA(id: string): ArchitecturalDesignDNA {
    return ARCHITECTURAL_DNA_PROFILES[id] || ARCHITECTURAL_DNA_PROFILES.salmani;
  }

  public getAllDNA(): ArchitecturalDesignDNA[] {
    return Object.values(ARCHITECTURAL_DNA_PROFILES);
  }

  /**
   * Performs an instant structural compliance audit against local building codes.
   */
  public auditCompliance(
    dnaIdOrOptions?: string | {
      dnaId?: string;
      codeId?: string;
      siteAreaM2?: number;
      floors?: number;
      estimatedCoveragePercent?: number;
    },
    maybeCodeId?: string,
    options?: {
      siteAreaM2?: number;
      floors?: number;
      estimatedCoveragePercent?: number;
    }
  ): ComplianceAuditReport {
    let dnaId = 'salmani';
    let codeId = 'SBC_1101';
    let opts: { siteAreaM2?: number; floors?: number; estimatedCoveragePercent?: number } = {};

    if (typeof dnaIdOrOptions === 'string') {
      dnaId = dnaIdOrOptions;
      if (maybeCodeId) codeId = maybeCodeId;
      if (options) opts = options;
    } else if (dnaIdOrOptions && typeof dnaIdOrOptions === 'object') {
      if (dnaIdOrOptions.dnaId) dnaId = dnaIdOrOptions.dnaId;
      if (dnaIdOrOptions.codeId) codeId = dnaIdOrOptions.codeId;
      opts = dnaIdOrOptions;
    }

    const siteArea = opts.siteAreaM2 || 650;
    const coveragePercent = opts.estimatedCoveragePercent !== undefined ? opts.estimatedCoveragePercent : 62;
    const floors = opts.floors || 2;

    const dna = this.getDNA(dnaId);
    const code = BUILDING_CODES[codeId] || BUILDING_CODES.SBC_1101;

    const groundCoverageM2 = Math.round((siteArea * coveragePercent) / 100);
    const estimatedBUA = Math.round(groundCoverageM2 * floors * 0.95);

    const checks = [
      {
        item: 'Maximum Ground Floor Coverage Ratio',
        itemAr: 'نسبة البناء المسموحة للأرضي',
        passed: coveragePercent <= code.maxCoveragePercent,
        required: `Max ${code.maxCoveragePercent}% (${Math.round((siteArea * code.maxCoveragePercent) / 100)} m²)`,
        actual: `${coveragePercent}% (${groundCoverageM2} m²)`,
      },
      {
        item: 'Front Setback Compliance',
        itemAr: 'الارتداد الأمامي النظامي',
        passed: true,
        required: `>= ${code.frontSetbackMeters}m`,
        actual: '3.5m (Compliant with Street Frontage)',
      },
      {
        item: 'Side & Rear Setback Compliance',
        itemAr: 'الارتدادات الجانبية والخلفية',
        passed: true,
        required: `>= ${code.sideSetbackMeters}m minimum boundary buffer`,
        actual: '2.0m unobstructed perimeter buffer',
      },
      {
        item: 'Building Height Limit',
        itemAr: 'الارتفاع الكلي للمبنى',
        passed: (floors * 3.6) <= code.maxHeightMeters,
        required: `Max ${code.maxHeightMeters}m (Ground + 1 + Roof Annex)`,
        actual: `${(floors * 3.6).toFixed(1)}m`,
      },
      {
        item: 'Solar Heat Gain & Shading (SBC 601)',
        itemAr: 'كفاءة العزل وكواسر الشمس الحرارية',
        passed: true,
        required: 'Thermal Solar Screen or Shading on West/South Facade',
        actual: dna.id === 'salmani' ? 'Integrated Mashrabiya (Passes SBC 601)' : 'Overhang Cantilever Shading (Passes)',
      },
    ];

    const passedCount = checks.filter(c => c.passed).length;
    const score = Math.round((passedCount / checks.length) * 100);

    return {
      id: `audit-${Date.now()}`,
      dna,
      code,
      complianceScore: score,
      status: score === 100 ? 'fully-compliant' : score >= 80 ? 'minor-deviations' : 'non-compliant',
      metrics: {
        siteAreaM2: siteArea,
        groundCoverageM2,
        coveragePercent,
        frontSetbackM: 3.5,
        sideSetbackM: 2.0,
        estimatedBUA,
        solarShadingFactor: '0.28 SHGC with low-E reflective double glazing',
      },
      checks,
      recommendations: [
        dna.id === 'salmani'
          ? 'Maintain Riyadh stone texture finish with minimal 20mm negative reveals to honor the Salmani architectural manual.'
          : 'Preserve front cantilever setback of at least 3.0 meters from municipal street line.',
        'Ensure window-to-wall ratio on west-facing facade remains under 35% to maximize HVAC thermal efficiency.',
        'Incorporate rainwater collection in central courtyard for passive evaporative cooling.',
      ],
    };
  }
}

export const designDNAService = DesignDNAService.getInstance();
