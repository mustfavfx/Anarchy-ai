/**
 * ArchVision AI Agent Service
 * Integrates Anarchy AI directly with the Architectural AI Agent running in E:\Agent
 * Provides Gemini-powered Spatial Planning, Code Compliance, Prompt Synthesis,
 * 3D BIM (Speckle) interactive modeling, and AutoCAD 2D DXF floor plan generation.
 */

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

class ArchVisionAgentService {
  private baseUrl: string = 'http://127.0.0.1:8000';

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
      const res = await fetch(`${this.baseUrl}/api/engines`);
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
      headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to export 3D BIM Speckle model');
    }

    return (await res.json()) as BimExportResponse;
  }

  /**
   * Downloads a generated file by relative path.
   */
  getDownloadUrl(relativeUrl: string): string {
    if (relativeUrl.startsWith('http')) return relativeUrl;
    return `${this.baseUrl}${relativeUrl.startsWith('/') ? '' : '/'}${relativeUrl}`;
  }
}

export const archVisionAgent = new ArchVisionAgentService();
