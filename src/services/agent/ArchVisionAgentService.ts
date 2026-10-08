/**
 * ArchVision AI Agent Service
 * Integrates Anarchy AI directly with the Architectural AI Agent running in E:\Agent
 * Provides Gemini-powered Spatial Planning, Code Compliance, Prompt Synthesis,
 * 3D BIM (Speckle) interactive modeling, and AutoCAD 2D DXF floor plan generation.
 */

import type { SemanticClassification, SemanticCategory } from '../../features/builder/types';
import type { StructuredArchitecturalAnalysis } from './ArchitecturalUnderstanding';
import { geminiAgentService } from '../gemini/GeminiAgentService';
import { inspectImagePixels } from '../vision/clientVisualClassifier';

export interface AgentHealth {
  status: string;
  agent: string;
  brain: string;
  renderer: string;
  supported_engines: string[];
}

export interface EngineProfile {
  id: string;
  name: string;
  aspect_ratios: string;
  supports_negative: boolean;
}

export interface DesignTextRequest {
  user_query: string;
  site_area_sqm?: number;
  architectural_style?: string;
  target_engine?: string;
  auto_render?: boolean;
  client_id?: string;
}

export interface DesignResponseData {
  vision_analysis?: string;
  space_program?: string;
  compliance_report?: string;
  is_compliant?: boolean;
  enhanced_prompt?: string;
  negative_prompt?: string;
  render_parameters?: Record<string, any>;
  final_summary?: string;
  rendered_image_url?: string;
  rendered_image_path?: string;
  render_status?: string;
  recalled_memories?: Array<{ content: string; category: string }>;
}

export interface DesignResponse {
  success: boolean;
  engine?: string;
  data: DesignResponseData;
  error?: string;
}

export interface CadExportRequest {
  project_title?: string;
  plot_width?: number;
  plot_length?: number;
  front_setback?: number;
  side_setback?: number;
  rear_setback?: number;
}

export interface CadExportResponse {
  success: boolean;
  dxf_path: string;
  filename: string;
  download_url: string;
}

export interface BimExportRequest {
  project_title?: string;
  site_area_sqm?: number;
  speckle_token?: string;
  speckle_server?: string;
  stream_id?: string;
}

export interface BimExportResponse {
  success: boolean;
  data: {
    speckle_file_path?: string;
    viewer_html_path?: string;
    viewer_web_url?: string;
    speckle_stream_url?: string;
    speckle_viewer_url?: string;
    total_bua?: number;
    elements_count?: number;
    speckle_push_error?: string;
  };
}

export interface BoqExportRequest {
  project_title?: string;
  site_area?: number;
  ground_bua?: number;
  first_bua?: number;
}

export interface BoqExportResponse {
  success: boolean;
  excel_path: string;
  filename: string;
  download_url: string;
}

export interface SolarAnalysisRequest {
  city?: string;
}

export interface SolarAnalysisResponse {
  success: boolean;
  data: {
    city: string;
    solar_angles?: Record<string, any>;
    sun_path_summary?: string;
    facade_recommendations?: string[];
    passive_design_tips?: string[];
    [key: string]: any;
  };
}

export interface ZoningCalculationRequest {
  site_area_sqm: number;
  max_coverage_ratio?: number;
  far?: number;
  floors?: number;
}

export interface ZoningCalculationResponse {
  success: boolean;
  data: {
    site_area_sqm: number;
    max_coverage_ratio: number;
    max_ground_footprint_sqm: number;
    far: number;
    max_total_bua_sqm: number;
    floors: number;
    setbacks?: Record<string, number>;
    parking_spaces_required?: number;
    [key: string]: any;
  };
}

export interface PresentationExportRequest {
  project_title?: string;
  project_subtitle?: string;
  brief?: string;
  space_program?: string;
  compliance_report?: string;
  solar_recommendations?: string[];
  render_image_path?: string;
}

export interface PresentationExportResponse {
  success: boolean;
  pptx_path: string;
  filename: string;
  download_url: string;
}

export interface CodeQueryRequest {
  query: string;
  n_results?: number;
}

export interface CodeQueryResponse {
  success: boolean;
  results: string[];
}

export interface SkillExecuteRequest {
  skill_name: string;
  parameters: Record<string, any>;
}

export interface SkillExecuteResponse {
  success: boolean;
  result?: any;
  error?: string;
}

export interface MemoryItem {
  id?: string;
  content: string;
  category?: string;
  metadata?: Record<string, any>;
}


class ArchVisionAgentService {
  private baseUrl: string = 'http://127.0.0.1:8000';
  // Must match ARCHVISION_API_KEY on the backend. Previously the frontend NEVER sent X-API-Key, so enabling
  // the key on the server broke the whole app - which is why it had to stay open.
  private apiKey: string | null = null;

  constructor() {
    try {
      const envKey = (import.meta as any)?.env?.VITE_ARCHVISION_API_KEY as string | undefined;
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('archvision_api_key') : null;
      this.apiKey = (envKey || stored || '').trim() || null;
    } catch {
      this.apiKey = null;
    }
  }

  public setApiKey(key: string | null): void {
    this.apiKey = key?.trim() || null;
    try {
      if (typeof localStorage !== 'undefined') {
        if (this.apiKey) localStorage.setItem('archvision_api_key', this.apiKey);
        else localStorage.removeItem('archvision_api_key');
      }
    } catch {
      /* storage unavailable - keep in memory only */
    }
  }

  private authHeaders(json: boolean = true): Record<string, string> {
    const h: Record<string, string> = {};
    if (json) h['Content-Type'] = 'application/json';
    if (this.apiKey) h['X-API-Key'] = this.apiKey;
    return h;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  /**
   * Checks if ArchVision Agent backend is active and responsive.
   */
  async checkHealth(): Promise<{ online: boolean; info?: AgentHealth; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const info = (await res.json()) as AgentHealth;
        return { online: true, info };
      }
      return { online: false, error: `HTTP ${res.status}` };
    } catch (err) {
      return {
        online: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }

  /**
   * Fetches the list of all supported rendering engines with aspect ratios.
   */
  async getEngines(): Promise<EngineProfile[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/engines`, { headers: this.authHeaders(false) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.engines || [];
    } catch (err) {
      console.warn('[ArchVision] Failed to fetch engines from server, using defaults:', err);
      return [
        {
          id: 'nano_banana_2',
          name: 'Nano Banana 2 (Gemini 3.1 Flash Image)',
          aspect_ratios: '16:9, 1:1, 3:2, 4:3, 21:9',
          supports_negative: false,
        },
        {
          id: 'flux_2_pro',
          name: 'FLUX 2 Pro (Black Forest Labs)',
          aspect_ratios: '16:9, 1:1, 4:3, 3:2',
          supports_negative: false,
        },
        {
          id: 'gpt_image_2_5',
          name: 'GPT Image 2.5 (OpenAI Flare / Sunburst)',
          aspect_ratios: '16:9, 1:1, 3:2, 4:3',
          supports_negative: false,
        },
        {
          id: 'seedream_5_pro',
          name: 'Seedream 5 Pro (ByteDance)',
          aspect_ratios: '16:9, 1:1, 4:3, 3:2, 21:9',
          supports_negative: false,
        },
      ];
    }
  }

  /**
   * Executes LangGraph architectural reasoning pipeline from text query.
   */
  async designFromText(params: DesignTextRequest): Promise<DesignResponse> {
    const res = await fetch(`${this.baseUrl}/api/design/text`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({
        user_query: params.user_query,
        site_area_sqm: params.site_area_sqm ?? 500.0,
        architectural_style: params.architectural_style ?? 'Modern Contemporary',
        target_engine: params.target_engine ?? 'nano_banana_2',
        auto_render: params.auto_render ?? false,
        client_id: params.client_id ?? 'default',
      }),
    });

    if (!res.ok) {
      let detail = `Error ${res.status}`;
      try {
        const errorJson = await res.json();
        detail = errorJson.detail || detail;
      } catch {
        // ignore
      }
      throw new Error(detail);
    }

    return (await res.json()) as DesignResponse;
  }

  /**
   * Executes multimodal design pipeline from an uploaded sketch, facade or plan image.
   */
  async designFromImage(
    file: File | Blob,
    filename: string,
    params: DesignTextRequest
  ): Promise<DesignResponse> {
    const formData = new FormData();
    formData.append('file', file, filename);
    formData.append('user_query', params.user_query);
    formData.append('site_area_sqm', String(params.site_area_sqm ?? 500.0));
    formData.append('architectural_style', params.architectural_style ?? 'Modern Contemporary');
    formData.append('target_engine', params.target_engine ?? 'nano_banana_2');
    formData.append('auto_render', String(params.auto_render ?? false));

    const res = await fetch(`${this.baseUrl}/api/design/upload-image`, {
      method: 'POST',
      headers: this.authHeaders(false), // no Content-Type: the browser must set the multipart boundary itself
      body: formData,
    });

    if (!res.ok) {
      let detail = `Error ${res.status}`;
      try {
        const errorJson = await res.json();
        detail = errorJson.detail || detail;
      } catch {
        // ignore
      }
      throw new Error(detail);
    }

    return (await res.json()) as DesignResponse;
  }

  /**
   * Ultra-Fast architectural prompt & vision synthesis (Sub-3s latency).
   * Designed specifically for interactive canvas prompt bar.
   */
  async refineFast(params: {
    user_query: string;
    image_base64?: string;
    architectural_style?: string;
    target_engine?: string;
  }): Promise<DesignResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${this.baseUrl}/api/design/refine-fast`, {
        method: 'POST',
        headers: this.authHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          user_query: params.user_query,
          image_base64: params.image_base64 || null,
          architectural_style: params.architectural_style || 'Modern Contemporary',
          target_engine: params.target_engine || 'nano_banana_2',
        }),
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        let detail = `Error ${res.status}`;
        try {
          const errorJson = await res.json();
          detail = errorJson.detail || detail;
        } catch {}
        throw new Error(detail);
      }

      return (await res.json()) as DesignResponse;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Refinement request timed out. Please try again.');
      }
      throw err;
    }
  }

  /**
   * Generates a 2D AutoCAD architectural floor plan (.dxf).
   */
  async exportCad(params: CadExportRequest): Promise<CadExportResponse> {
    const res = await fetch(`${this.baseUrl}/api/cad/export`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to export AutoCAD DXF');
    }

    return (await res.json()) as CadExportResponse;
  }

  /**
   * Generates a 3D BIM model and interactive 3D WebGL viewer HTML page.
   */
  async exportBim(params: BimExportRequest): Promise<BimExportResponse> {
    const res = await fetch(`${this.baseUrl}/api/bim/speckle/export`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to export 3D BIM Speckle model');
    }

    return (await res.json()) as BimExportResponse;
  }

  /**
   * Generates an itemized Excel Bill of Quantities (BOQ).
   */
  async exportBoq(params: BoqExportRequest): Promise<BoqExportResponse> {
    const res = await fetch(`${this.baseUrl}/api/boq/export`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to export Excel BOQ');
    }

    return (await res.json()) as BoqExportResponse;
  }

  /**
   * Performs solar orientation, shadow path, and facade exposure analysis.
   */
  async analyzeSolar(params: SolarAnalysisRequest): Promise<SolarAnalysisResponse> {
    const res = await fetch(`${this.baseUrl}/api/solar/analyze`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to analyze solar orientation');
    }

    return (await res.json()) as SolarAnalysisResponse;
  }

  /**
   * Computes municipal urban zoning allowances, FAR, maximum footprints, and setbacks.
   */
  async calculateZoning(params: ZoningCalculationRequest): Promise<ZoningCalculationResponse> {
    const res = await fetch(`${this.baseUrl}/api/zoning/calculate`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to calculate zoning metrics');
    }

    return (await res.json()) as ZoningCalculationResponse;
  }

  /**
   * Generates a complete architectural PowerPoint (.pptx) client presentation.
   */
  async exportPresentation(params: PresentationExportRequest): Promise<PresentationExportResponse> {
    const res = await fetch(`${this.baseUrl}/api/presentation/export`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to export PowerPoint presentation');
    }

    return (await res.json()) as PresentationExportResponse;
  }

  /**
   * Queries building code compliance knowledge base using ChromaDB RAG vector search.
   */
  async queryCodes(params: CodeQueryRequest): Promise<CodeQueryResponse> {
    const res = await fetch(`${this.baseUrl}/api/codes/query`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to query building codes');
    }

    return (await res.json()) as CodeQueryResponse;
  }

  /**
   * Lists all available self-improving skills in the registry.
   */
  async listSkills(): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/skills`, { headers: this.authHeaders(false) });
      if (!res.ok) return [];
      const data = await res.json();
      return data.skills || [];
    } catch {
      return [];
    }
  }

  /**
   * Executes a registered skill (e.g. calculate_window_wall_ratio) dynamically.
   */
  async executeSkill(skillName: string, parameters: Record<string, any>): Promise<SkillExecuteResponse> {
    const res = await fetch(`${this.baseUrl}/api/skills/execute`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({ skill_name: skillName, parameters }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Failed to execute skill '${skillName}'`);
    }

    return (await res.json()) as SkillExecuteResponse;
  }

  /**
   * Fetches long-term architectural memories.
   */
  async getMemories(query?: string): Promise<MemoryItem[]> {
    try {
      const url = query ? `${this.baseUrl}/api/memory?query=${encodeURIComponent(query)}` : `${this.baseUrl}/api/memory`;
      const res = await fetch(url, { headers: this.authHeaders(false) });
      if (!res.ok) return [];
      const data = await res.json();
      return data.memories || [];
    } catch {
      return [];
    }
  }

  /**
   * Stores a new architectural memory or client preference.
   */
  async addMemory(content: string, category: string = 'general', metadata: Record<string, any> = {}): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/memory`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({ content, category, metadata }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to store memory');
    }

    return await res.json();
  }

  /**
   * Downloads a generated file by relative path.
   */
  getDownloadUrl(relativeUrl: string): string {
    if (relativeUrl.startsWith('http')) return relativeUrl;
    return `${this.baseUrl}${relativeUrl.startsWith('/') ? '' : '/'}${relativeUrl}`;
  }

  /**
   * Deep multi-dimensional architectural visual analysis inspired by Morpheus and AECV-Bench.
   * Utilizes Gemini Multimodal Vision API on the raw base64 image pixels.
   */
  async analyzeStructuredArchitecture(imageBase64: string, promptHint?: string): Promise<StructuredArchitecturalAnalysis> {
    // 1. Try Gemini Multimodal Vision on actual image pixels
    try {
      const geminiResult = await geminiAgentService.analyzeStructuredArchitecture(imageBase64, promptHint);
      if (geminiResult && geminiResult.category) {
        return {
          category: geminiResult.category,
          subTypology: geminiResult.label || geminiResult.subTypology || this.formatDefaultLabel(geminiResult.category),
          architecturalStyle: geminiResult.architecturalStyle,
          description: geminiResult.description || `AI Vision detected ${geminiResult.label || geminiResult.category}`,
          composition: geminiResult.composition || {
            framing: 'Balanced visual perspective',
            massing: 'Primary subject composition',
            focalPoint: geminiResult.label || 'Subject center',
            symmetry: 'balanced',
            spatialDepth: 'deep',
          },
          materials: geminiResult.materials || [],
          lighting: geminiResult.lighting || {
            timeOfDay: 'daylight',
            source: 'ambient',
            colorTempK: 5500,
            shadowQuality: 'natural',
          },
          aecElements: geminiResult.aecElements || {},
          critique: geminiResult.critique || {
            architecturalRealismScore: 0,
            materialFidelityScore: 0,
            lightingConsistencyScore: 0,
            overallScore: 0,
            strengths: [geminiResult.label || 'Detected visual subject'],
            weaknesses: ['Automated critique score unverified by vision model'],
            suggestedPromptRefinements: [],
          },
          tags: geminiResult.tags || [geminiResult.category],
          analyzedAt: Date.now(),
        } as StructuredArchitecturalAnalysis;
      }
    } catch (err) {
      console.debug('[ArchVisionAgentService] Gemini vision analysis deferred to fallback:', err);
    }

    // 2. Try local ArchVision backend at E:\Agent if active
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${this.baseUrl}/api/vision/analyze-structured`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({
          image: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
          prompt_hint: promptHint,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.category && json.composition) {
          return json as StructuredArchitecturalAnalysis;
        }
      }
    } catch {
      // Backend offline
    }

    // 3. Inspect image pixels directly in client (FaceDetector, skin tone clusters, nature)
    let visualCategory: SemanticCategory | undefined;
    try {
      const visualResult = await inspectImagePixels(imageBase64);
      if (visualResult && visualResult.confidence >= 0.70) {
        visualCategory = visualResult.category;
      }
    } catch (e) {
      console.debug('[ArchVisionAgentService] inspectImagePixels fallback:', e);
    }

    // 4. Fallback to comprehensive architectural decomposition heuristics
    return this.generateStructuredFallback(imageBase64, promptHint, visualCategory);
  }

  /**
   * Classifies an image into semantic categories with structured architectural context.
   */
  async classifyImage(imageBase64: string, promptHint?: string): Promise<SemanticClassification> {
    try {
      const structured = await this.analyzeStructuredArchitecture(imageBase64, promptHint);
      if (structured) {
        return {
          category: structured.category,
          label: structured.subTypology || this.formatDefaultLabel(structured.category),
          confidence: structured.critique.overallScore / 100,
          tags: structured.tags,
          description: structured.description,
          architecturalStyle: structured.architecturalStyle,
          lightingCondition: structured.lighting.timeOfDay,
          analyzedAt: structured.analyzedAt,
        };
      }
    } catch {
      // fallback
    }

    return this.inferSemanticFromHint(promptHint || '');
  }

  private inferSemanticFromHint(hint: string): SemanticClassification {
    const text = hint.toLowerCase();

    // Interior patterns
    if (
      text.includes('interior') ||
      text.includes('living room') ||
      text.includes('bedroom') ||
      text.includes('kitchen') ||
      text.includes('dining') ||
      text.includes('hallway') ||
      text.includes('sofa') ||
      text.includes('furniture') ||
      text.includes('decor') ||
      text.includes('ceiling') ||
      text.includes('corridor')
    ) {
      return {
        category: 'interior',
        label: 'Interior Design',
        confidence: 0.9,
        tags: ['interior', 'spatial', 'decor'],
        analyzedAt: Date.now(),
      };
    }

    // Person / Portrait patterns
    if (
      text.includes('person') ||
      text.includes('woman') ||
      text.includes('man') ||
      text.includes('girl') ||
      text.includes('boy') ||
      text.includes('portrait') ||
      text.includes('face') ||
      text.includes('human') ||
      text.includes('wearing') ||
      text.includes('character') ||
      text.includes('selfie') ||
      text.includes('model')
    ) {
      return {
        category: 'person',
        label: 'Human Subject',
        confidence: 0.92,
        tags: ['person', 'figure', 'character'],
        analyzedAt: Date.now(),
      };
    }

    // Architecture / Building patterns
    if (
      text.includes('building') ||
      text.includes('architecture') ||
      text.includes('villa') ||
      text.includes('facade') ||
      text.includes('tower') ||
      text.includes('exterior') ||
      text.includes('house') ||
      text.includes('residence') ||
      text.includes('skyscraper') ||
      text.includes('concrete') ||
      text.includes('pavilion') ||
      text.includes('hotel')
    ) {
      return {
        category: 'building',
        label: 'Architectural Building',
        confidence: 0.9,
        tags: ['building', 'facade', 'architecture'],
        analyzedAt: Date.now(),
      };
    }

    // Landscape / Nature patterns
    if (
      text.includes('landscape') ||
      text.includes('nature') ||
      text.includes('forest') ||
      text.includes('mountain') ||
      text.includes('garden') ||
      text.includes('trees') ||
      text.includes('park') ||
      text.includes('lake') ||
      text.includes('beach') ||
      text.includes('sunset') ||
      text.includes('desert')
    ) {
      return {
        category: 'landscape',
        label: 'Landscape & Nature',
        confidence: 0.88,
        tags: ['landscape', 'outdoor', 'environment'],
        analyzedAt: Date.now(),
      };
    }

    // Material / Texture patterns
    if (
      text.includes('material') ||
      text.includes('texture') ||
      text.includes('marble') ||
      text.includes('wood grain') ||
      text.includes('tiles') ||
      text.includes('fabric') ||
      text.includes('pattern') ||
      text.includes('metal sheet') ||
      text.includes('rough surface')
    ) {
      return {
        category: 'material',
        label: 'Material & Texture',
        confidence: 0.85,
        tags: ['material', 'texture', 'surface'],
        analyzedAt: Date.now(),
      };
    }

    // Default general classification
    return {
      category: 'building',
      label: 'Architectural Asset',
      confidence: 0.7,
      tags: ['asset'],
      analyzedAt: Date.now(),
    };
  }

  /**
   * Generates a rich, multi-dimensional architectural analysis fallback
   * structured according to Morpheus & AECV-Bench principles.
   */
  private generateStructuredFallback(
    imageBase64: string, 
    promptHint?: string, 
    visualOverride?: SemanticCategory
  ): StructuredArchitecturalAnalysis {
    const hint = (promptHint || '').toLowerCase();
    const semantic = this.inferSemanticFromHint(hint);
    const cat = visualOverride || (hint.trim().length > 0 ? semantic.category : 'building');

    if (cat === 'interior') {
      return {
        category: 'interior',
        subTypology: hint.includes('bedroom')
          ? 'Bedroom Space'
          : hint.includes('kitchen')
          ? 'Kitchen Space'
          : hint
          ? 'Interior Space'
          : 'Unclassified Interior',
        architecturalStyle: hint ? 'Provisional Interior Style (from hint)' : 'Unverified Interior Style',
        description: hint
          ? `Provisional interior inference from hint: "${hint}". Vision analysis offline.`
          : 'Interior features could not be verified by vision model.',
        composition: {
          framing: 'Uncalibrated interior perspective',
          massing: 'Unclassified joinery/interior volumes',
          focalPoint: 'Unidentified interior focal point',
          symmetry: 'unverified',
          spatialDepth: 'unverified',
        },
        materials: hint.includes('wood')
          ? [{ name: 'Timber / Wood Joinery', finish: 'Matte', location: 'Interior surfaces', reflectivity: 'matte' }]
          : [],
        lighting: {
          timeOfDay: hint.includes('night') ? 'night' : 'midday',
          source: 'ambient',
          colorTempK: 3500,
          shadowQuality: 'soft-ambient',
        },
        aecElements: {
          doorsCount: undefined,
          windowsCount: undefined,
          floorsEstimated: 1,
          curtainWallsPresent: false,
          cantileversPresent: false,
          vegetationContext: 'Unverified',
          scaleIndicator: 'furniture-scaled',
        },
        critique: {
          architecturalRealismScore: 0,
          materialFidelityScore: 0,
          lightingConsistencyScore: 0,
          overallScore: 0,
          strengths: [],
          weaknesses: ['Vision analysis unverified; metrics not confirmed.'],
          suggestedPromptRefinements: [],
        },
        tags: hint ? ['interior', 'unverified'] : ['unverified'],
        analyzedAt: Date.now(),
      };
    }

    if (cat === 'landscape') {
      return {
        category: 'landscape',
        subTypology: hint ? 'Landscape Setting' : 'Unclassified Landscape',
        architecturalStyle: 'Unverified Landscape Context',
        description: hint
          ? `Provisional landscape inference from hint: "${hint}". Vision analysis offline.`
          : 'Outdoor features could not be verified by vision model.',
        composition: {
          framing: 'Uncalibrated landscape view',
          massing: 'Unclassified terrain / vegetation canopy',
          focalPoint: 'Unidentified outdoor subject',
          symmetry: 'unverified',
          spatialDepth: 'unverified',
        },
        materials: [],
        lighting: {
          timeOfDay: 'midday',
          source: 'ambient',
          colorTempK: 5500,
          shadowQuality: 'soft-ambient',
        },
        aecElements: {
          curtainWallsPresent: false,
          cantileversPresent: false,
          vegetationContext: 'Unverified outdoor flora',
          scaleIndicator: 'ambiguous',
        },
        critique: {
          architecturalRealismScore: 0,
          materialFidelityScore: 0,
          lightingConsistencyScore: 0,
          overallScore: 0,
          strengths: [],
          weaknesses: ['Vision analysis unverified; landscape fidelity not measured.'],
          suggestedPromptRefinements: [],
        },
        tags: hint ? ['landscape', 'unverified'] : ['unverified'],
        analyzedAt: Date.now(),
      };
    }

    if (cat === 'object') {
      return {
        category: 'object',
        subTypology: hint ? 'Object / Graphic Asset' : 'Unclassified Object',
        architecturalStyle: 'Standalone Object / Graphic Presentation',
        description: hint
          ? `Provisional object inference from hint: "${hint}". Vision analysis offline.`
          : 'Object features could not be verified by vision model.',
        composition: {
          framing: 'Uncalibrated view',
          massing: 'Standalone subject / element',
          focalPoint: 'Subject center',
          symmetry: 'unverified',
          spatialDepth: 'unverified',
        },
        materials: [],
        lighting: {
          timeOfDay: 'midday',
          source: 'ambient',
          colorTempK: 6000,
          shadowQuality: 'soft-ambient',
        },
        aecElements: {
          curtainWallsPresent: false,
          cantileversPresent: false,
          vegetationContext: 'None',
          scaleIndicator: 'ambiguous',
        },
        critique: {
          architecturalRealismScore: 0,
          materialFidelityScore: 0,
          lightingConsistencyScore: 0,
          overallScore: 0,
          strengths: [],
          weaknesses: ['Vision analysis unverified.'],
          suggestedPromptRefinements: [],
        },
        tags: hint ? ['object', 'unverified'] : ['unverified'],
        analyzedAt: Date.now(),
      };
    }

    if (cat === 'art') {
      return {
        category: 'art',
        subTypology: hint ? 'Visual Artwork' : 'Unclassified Artwork',
        architecturalStyle: 'Visual Art / Illustration',
        description: hint
          ? `Provisional artwork inference from hint: "${hint}". Vision analysis offline.`
          : 'Artistic features could not be verified by vision model.',
        composition: {
          framing: 'Uncalibrated artistic framing',
          massing: 'Artistic composition',
          focalPoint: 'Artistic subject',
          symmetry: 'unverified',
          spatialDepth: 'unverified',
        },
        materials: [],
        lighting: {
          timeOfDay: 'midday',
          source: 'ambient',
          colorTempK: 5500,
          shadowQuality: 'soft-ambient',
        },
        aecElements: {
          curtainWallsPresent: false,
          cantileversPresent: false,
          vegetationContext: 'Artistic expression',
          scaleIndicator: 'ambiguous',
        },
        critique: {
          architecturalRealismScore: 0,
          materialFidelityScore: 0,
          lightingConsistencyScore: 0,
          overallScore: 0,
          strengths: [],
          weaknesses: ['Vision analysis unverified.'],
          suggestedPromptRefinements: [],
        },
        tags: hint ? ['art', 'unverified'] : ['unverified'],
        analyzedAt: Date.now(),
      };
    }

    if (cat === 'person') {
      return {
        category: 'person',
        subTypology: hint ? 'Human Figure / Entourage' : 'Unclassified Subject',
        architecturalStyle: 'Human Scale Entourage',
        description: hint
          ? `Provisional figure inference from hint: "${hint}". Vision analysis offline.`
          : 'Figure features could not be verified by vision model.',
        composition: {
          framing: 'Uncalibrated portrait / scale framing',
          massing: 'Human silhouette',
          focalPoint: 'Subject figure',
          symmetry: 'unverified',
          spatialDepth: 'unverified',
        },
        materials: [],
        lighting: {
          timeOfDay: 'midday',
          source: 'ambient',
          colorTempK: 4500,
          shadowQuality: 'soft-ambient',
        },
        aecElements: {
          curtainWallsPresent: false,
          cantileversPresent: false,
          vegetationContext: 'None',
          scaleIndicator: 'human-present',
        },
        critique: {
          architecturalRealismScore: 0,
          materialFidelityScore: 0,
          lightingConsistencyScore: 0,
          overallScore: 0,
          strengths: [],
          weaknesses: ['Vision analysis unverified; anatomical scale not measured.'],
          suggestedPromptRefinements: [],
        },
        tags: hint ? ['person', 'unverified'] : ['unverified'],
        analyzedAt: Date.now(),
      };
    }

    // Default: Architectural Building fallback when vision model is offline/unverified
    return {
      category: 'building',
      subTypology: hint.includes('tower')
        ? 'High-Rise Commercial Tower'
        : hint.includes('pavilion')
        ? 'Public Exhibition Pavilion'
        : hint.includes('hotel')
        ? 'Hospitality / Hotel Development'
        : hint
        ? 'Architectural Structure'
        : 'Unclassified Structure',
      architecturalStyle: hint.includes('brutalist')
        ? 'Brutalist Concrete'
        : hint.includes('parametric')
        ? 'Parametric Biophilic'
        : hint
        ? 'Provisional Style (from prompt hint)'
        : 'Unverified Architectural Style',
      description: hint
        ? `Visual analysis unverified by vision model; provisional inference from prompt: "${hint}"`
        : 'Visual structure could not be verified by vision model.',
      composition: {
        framing: 'Uncalibrated perspective',
        massing: 'Unclassified architectural massing',
        focalPoint: 'Unidentified subject',
        symmetry: 'unverified',
        spatialDepth: 'unverified',
      },
      materials: hint.includes('glass')
        ? [{ name: 'Architectural Glazing', finish: 'Reflective', location: 'Facade', reflectivity: 'specular' }]
        : [],
      lighting: {
        timeOfDay: hint.includes('night') ? 'night' : hint.includes('sunset') ? 'golden-hour' : 'midday',
        source: 'ambient',
        colorTempK: 5000,
        shadowQuality: 'soft-ambient',
      },
      aecElements: {
        doorsCount: undefined,
        windowsCount: undefined,
        floorsEstimated: undefined,
        curtainWallsPresent: false,
        cantileversPresent: false,
        vegetationContext: 'Unverified',
        scaleIndicator: 'ambiguous',
      },
      critique: {
        architecturalRealismScore: 0,
        materialFidelityScore: 0,
        lightingConsistencyScore: 0,
        overallScore: 0,
        strengths: [],
        weaknesses: ['Visual inspection offline or unverified; actual image features not measured.'],
        suggestedPromptRefinements: [],
      },
      tags: hint ? ['architecture', 'unverified'] : ['unverified'],
      analyzedAt: Date.now(),
    };
  }

  private formatDefaultLabel(category: string): string {
    switch (category) {
      case 'building': return 'Architectural Building';
      case 'interior': return 'Interior Design';
      case 'person': return 'Human Subject';
      case 'landscape': return 'Landscape & Nature';
      case 'material': return 'Material & Texture';
      case 'object': return 'Standalone Object';
      default: return 'Canvas Asset';
    }
  }
}

export const archVisionAgent = new ArchVisionAgentService();
