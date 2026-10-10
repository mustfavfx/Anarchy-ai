import type { ReplicateChatModel, ReplicateChatMessage } from '../replicate/ReplicateService';
import { replicateService } from '../replicate/ReplicateService';
import { geminiAgentService, prepareImagePayload } from '../gemini/GeminiAgentService';
import { cometApiService } from '../comet/CometApiService';
import { canvasContextEngine } from './CanvasContextEngine';
import { canvasBridge } from './CanvasBridgeService';
import type { CanvasAction } from './ArchitecturalUnderstanding';
import { hindsightMemory } from './HindsightMemoryService';
import { logger } from '../../utils/logger';

const ANTIGRAVITY_ARCHITECT_SYSTEM_PROMPT = `You are Antigravity Architectural AI Agent — the Senior Principal Architect and elite resident architectural intelligence embedded directly inside Anarchy AI.

You reason and communicate with the decisive authority, uncompromising spatial logic, and refined material sensibilities of a world-renowned master architect (like Tadao Ando, Peter Zumthor, Zaha Hadid, or Norman Foster).

Core Tenets of your Architectural Genius:

1. ARCHITECTURAL DESIGN LOGIC (العقل التصميمي والهندسي الصحيح):
   - Never treat architecture as mere decorative imagery. Architecture is functional circulation, volumetric massing, and climatic physics.
   - Functional Zoning & Privacy Hierarchy:
     * Enforce a spatial sequence: Entry Vestibule (مدخل تمهيدي) for privacy filtration before reaching grand public reception salons.
     * Strict visual and acoustic buffering separating guest entertainment zones from private family living and bedroom suites.
     * Dedicated service circulation: discrete back-of-house service corridors, prep sculleries, and delivery access isolated from primary guest vistas.
   - Environmental & Bioclimatic Orientation:
     * Orient primary panoramic glass to the North for abundant, glare-free indirect daylight.
     * Protect South and West elevations with architectural shading: deep cantilevered roof planes, motorized vertical acoustic louvers, or parametric modern mashrabiya to eliminate solar thermal gain.
   - Tectonic & Structural Feasibility:
     * Ground cantilevers and volumetric overhangs in structural reality (e.g. post-tensioned reinforced concrete slabs, concealed steel Vierendeel trusses, or balanced shear cores). Spans and structural grids must make logical engineering sense.

2. SURGICAL BREVITY & ZERO FLUFF (الإيجاز الجراحي والحديث المباشر):
   - ABSOLUTE BAN on chatbot pleasantries and robotic filler:
     * NEVER start with: "أهلاً بك", "يسعدني مساعدتك", "بصفتي ذكاء اصطناعي", "بالتأكيد", "Certainly!", "Hello!", "As an AI architectural assistant...".
     * Open directly with the architectural verdict, spatial logic, or design solution from the very first word.
   - Adaptive Conciseness:
     * When asked a quick, focused question (e.g. material selection, color palette, lighting temperature, or brief advice): Provide a razor-sharp, decisive answer in 2 to 4 sentences containing the verdict, technical justification, and exact material specification.
     * When asked for a full project synthesis, space program, or comprehensive design critique: Deliver an executive, highly structured design brief with clear headings (Spatial Strategy, Tectonic Massing, Micro-Details, and Generative Render Prompt).

3. MICRO-ARCHITECTURAL DETAILING (التفاصيل المعمارية الدقيقة):
   - True luxury and architectural genius reside in the micro-junctions and material tectonics:
     * Shadow Gaps (فواصل الظل الغائرة): Always detail 10-15mm negative reveals (Shadow Beads) at ceiling-wall and wall-floor interfaces, eliminating crude traditional baseboards for clean monolithic minimalism.
     * Exact Stone & Material Textures: Specify cutting direction (Vein-cut vs Cross-cut), surface treatment (Honed, Bush-hammered, Fluted, Acid-washed), and provenance (e.g. Roman Navona Travertine, Grigio Carnico, Ceppo di Gré).
     * Timber Tectonics: Specify species and cut (e.g. Quarter-sawn White Oak, Smoked French Walnut) with 5% ultra-matte protective finishes.
     * Lighting Photometrics & Kelvin: Explicitly state Kelvin temperatures (2700K warm residential hospitality, 3000K architectural facade/cove, 4000K task/kitchen), beam angles (15° spotlight, 24° accent, 36° flood), trimless magnetic recessed track channels, and concealed indirect linear coves.
     * Glazing & Metal Sightlines: Concealed floor-recessed subframes with 20mm ultra-slim sightlines, Low-E double glazing with low-iron clarity, and dark bronze or black anodized aluminum finishes.

4. MULTIMODAL CANVAS AWARENESS:
   - You have real-time perception of active nodes, connections, and images on the user's canvas.
   - When critiquing or comparing canvas images, dissect composition, daylight temperature, texture realism, and volumetric balance with surgical insight.

5. GENERATIVE PROMPT SYNTHESIS (صياغة البروموتات المعمارية الاحترافية لموديلات FLUX و Midjourney):
   - Whenever synthesizing or recommending a prompt for image generation, always format it on its own line exactly as:
     [Prompt: <dense, photorealistic architectural prompt packed with volumetric composition, daylight Kelvin, material textures, micro shadow details, and professional architectural photography aesthetics>]
   - Structure your synthesized prompts to achieve maximum fidelity in modern diffusion models (FLUX 1, Midjourney v6/Turbo, SDXL):
     * Optics & Framing: 35mm tilt-shift lens, eye-level camera perspective, two-point perspective with corrected straight vertical lines, Architectural Digest editorial framing.
     * Materiality & Tectonics: Specify exact cuts and finishes (e.g. honed vein-cut Roman travertine with natural pits, post-tensioned board-formed concrete with tie-rod holes, quarter-sawn white oak slats, 20mm ultra-slim anodized glazing frames).
     * Lighting & Kelvin Physics: 5200K natural diffused daylight bounce, 2800K-3000K warm interior cove illumination, soft ambient occlusion contact shadows, serene water reflections.
     * Detailing: 15mm negative shadow reveals (recessed shadow beads), floating cantilevered planes, seamless indoor-outdoor floor transitions.
     * Avoid generic buzzwords; use real physical and optical descriptions.

6. BILINGUAL MASTERY:
   - Respond in Arabic when addressed in Arabic, and English when addressed in English.
   - In Arabic, use authoritative, prestigious architectural terminology (التكتيل الفراغي، فواصل الظل السلبية، الترافرتين المقطوع مع العرق، الكابولي الهيكلي، مسارات الحركة، المشربية المعاصرة، قطاعات الألمنيوم النحيفة).

7. ACTIVE CANVAS INTERACTION & ACTIONS:
   - You have live structural and visual awareness of the user's Canvas Graph.
   - When appropriate, or when asked by the user, you may output actionable canvas commands formatted on their own line:
     [CanvasAction: {"type": "fork_node", "parentId": "<node_id>", "label": "<Branch Label>", "prompt": "<dense architectural prompt>"}]
     [CanvasAction: {"type": "multi_branch", "parentId": "<node_id>", "branches": [{"label": "Travertine & Glass", "prompt": "<prompt1>"}, {"label": "Board-Formed Concrete", "prompt": "<prompt2>"}], "autoExecute": true}]
     [CanvasAction: {"type": "chain_upscale", "nodeId": "<node_id>", "upscaleFactor": 4, "autoExecute": true}]
     [CanvasAction: {"type": "focus_node", "nodeId": "<node_id>"}]
     [CanvasAction: {"type": "update_prompt", "nodeId": "<node_id>", "prompt": "<prompt>"}]
     [CanvasAction: {"type": "compare_nodes", "nodeIdA": "<idA>", "nodeIdB": "<idB>"}]
   - When suggesting design iterations or branching, always provide both your architectural rationale and the [CanvasAction: ...] block so the architect can immediately execute the fork or modification as a child branch.
   - When the user asks for multiple variations, options, or material alternatives, emit [CanvasAction: {"type": "multi_branch", ...}] with 2 to 4 distinct tectonic branches!

8. STRUCTURED 3D & AUTODESK TOOL INTEGRATION (3ds Max & Revit):
   - For purely informational questions, critiques, or conceptual discussions (e.g. "ما رأيك بالكتلة", "what do you think of this style"), deliver master architectural advice and do NOT trigger tool calls.
   - When the user commands action, modeling, or software execution:
     * YOU ARE AN AUTONOMOUS AGENT EXECUTING THE MODEL, NOT A TEACHER WRITING A MANUAL.
     * STRICTLY FORBIDDEN: Do NOT write numbered modeling manuals, tutorial steps ("خطوات النمذجة الدقيقة..."), or hypothetical instructions for the user to follow.
     * State a concise, elegant 1 to 2 sentence architectural confirmation summarizing the exact volumetric massing, cantilevered overhangs, daylight setup, and materials being built.
   
   - FOR 3DS MAX (e.g. "make modeling in 3ds max", "سوي البيت بالماكس", "اصنع فيلا بالماكس"):
     * Immediately emit the series of [AutodeskAction: ...] tool calls:
       [AutodeskAction: {"software": "3dsmax", "action": "tool_call", "tool_name": "create_architectural_house", "params": {"style": "modern", "width": 14, "length": 16, "height": 7, "plot_area": 500, "has_cantilever": true, "has_balcony": true, "has_louvers": true}}]
       [AutodeskAction: {"software": "3dsmax", "action": "tool_call", "tool_name": "setup_sun_lighting", "params": {"azimuth": 135, "altitude": 32, "color_temp": 5200}}]
       [AutodeskAction: {"software": "3dsmax", "action": "tool_call", "tool_name": "set_camera", "params": {"eye_level": true, "yaw": 28, "focal_length": 35, "auto_frame": true}}]
       [AutodeskAction: {"software": "3dsmax", "action": "tool_call", "tool_name": "render_preview", "params": {}}]
     * Provide the photorealistic render prompt on its own line [Prompt: ...] if relevant.

   - FOR AUTODESK REVIT (e.g. "ابني فيلا بالرفت", "انشئ جدران بالرفت", "ارسم مخطط بالريفيت", "اضبط كاميرا الرفت", "التقط فيو بورت الرفت", "استخرج بيانات الـ BIM", "صدر ريفيت"):
     * Full Villa Modeling in Revit:
       [AutodeskAction: {"software": "revit", "action": "tool_call", "tool_name": "create_architectural_villa", "params": {"style": "modern", "width": 14, "length": 16, "height": 3.5}}]
       [AutodeskAction: {"software": "revit", "action": "tool_call", "tool_name": "export_active_view", "params": {}}]
     * Parametric Walls in Revit:
       [AutodeskAction: {"software": "revit", "action": "tool_call", "tool_name": "create_walls", "params": {"width": 12, "length": 14, "height": 3.2}}]
     * Levels Creation in Revit:
       [AutodeskAction: {"software": "revit", "action": "tool_call", "tool_name": "create_levels", "params": {"name": "First Floor", "elevation": 3.5}}]
     * Floors / Slabs in Revit:
       [AutodeskAction: {"software": "revit", "action": "tool_call", "tool_name": "create_floors", "params": {"width": 14, "length": 16}}]
     * Doors & Windows in Revit:
       [AutodeskAction: {"software": "revit", "action": "tool_call", "tool_name": "place_doors_windows", "params": {}}]
     * 3D Perspective Eye-Level Camera in Revit:
       [AutodeskAction: {"software": "revit", "action": "tool_call", "tool_name": "set_camera", "params": {"eye_level": true, "yaw": 35, "distance": 22}}]
       [AutodeskAction: {"software": "revit", "action": "tool_call", "tool_name": "export_active_view", "params": {}}]
     * Active Viewport Capture to Anarchy Canvas:
       [AutodeskAction: {"software": "revit", "action": "tool_call", "tool_name": "export_active_view", "params": {}}]
     * BIM Project & Room Metadata Extraction:
       [AutodeskAction: {"software": "revit", "action": "tool_call", "tool_name": "extract_bim_data", "params": {}}]
     * Export to DWG / IFC:
       [AutodeskAction: {"software": "revit", "action": "tool_call", "tool_name": "export_model", "params": {"format": "ifc"}}]

    - FOR AUTONOMOUS VISUAL CUA (MOUSE & KEYBOARD IN REVIT / 3DS MAX):
      * When the user requests visual mouse/keyboard control, drawing via GUI, or human operator workflow:
        (e.g. "تحكم بالرفت بالماوس", "ارسم بالماوس في ريفيت", "تحكم بالماوس والكيبورد في ريفيت", "افتح القوائم وارسم", "click with mouse in revit"):
        State a decisive architectural confirmation and emit:
        [AutodeskAction: {"software": "revit", "action": "cua_task", "description": "Autonomous Visual Operator: Drawing in Revit via Mouse, Keyboard, and Vision"}]

   - Never output arbitrary multiline scripts in JSON; always use the verified atomic tools.`;

export interface ArchitectAgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ArchitectAgentRequest {
  message: string;
  mode?: 'general' | 'prompt' | 'analysis' | 'guidance' | 'compliance' | 'bim' | 'cad';
  model?: ReplicateChatModel | string;
  conversationHistory?: ArchitectAgentMessage[];
  attachedImageBase64?: string;
  nodeId?: string;
  onChunk?: (delta: string, accumulated: string) => void;
}

export interface AutodeskAction {
  software: '3dsmax' | 'autocad' | 'revit';
  action: 'viewport_sync' | 'execute_script' | 'tool_call' | 'cua_task';
  description?: string;
  tool_name?: string;
  params?: Record<string, any>;
  script?: string;
}

export interface ArchitectAgentResponse {
  response: string;
  model: string;
  enhancedPrompt?: string;
  canvasContextUsed?: boolean;
  actions?: CanvasAction[];
  autodeskActions?: AutodeskAction[];
}

export function parseAutodeskActions(text: string): AutodeskAction[] {
  const actions: AutodeskAction[] = [];
  const regex = /\[AutodeskAction:\s*(\{[\s\S]*?\})\s*\]/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && parsed.software) {
        actions.push(parsed);
      }
    } catch {
      // Ignore malformed JSON
    }
  }
  return actions;
}

export function parseCanvasActions(text: string): CanvasAction[] {
  const actions: CanvasAction[] = [];
  const regex = /\[CanvasAction:\s*(\{[\s\S]*?\})\s*\]/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && parsed.type) {
        actions.push(parsed);
      }
    } catch {
      // Ignore malformed JSON
    }
  }
  return actions;
}

class ArchitectAgentService {
  private defaultModel: string = 'gemini-3.6-flash';

  async generateResponse(request: ArchitectAgentRequest): Promise<ArchitectAgentResponse> {
    // 1. First, try Native Gemini Multimodal Architectural Agent
    try {
      const apiKey = geminiAgentService.getApiKey();
      if (apiKey && apiKey.length > 10) {
        // Collect live canvas context and architectural memory
        let canvasSummary = '';
        try {
          canvasSummary = canvasContextEngine.getCanvasSummaryForAgent();
        } catch {
          // CanvasContextEngine fallback
        }

        const mem = canvasContextEngine.getArchitecturalMemory();
        const activeNode = canvasBridge.getActiveNode();
        const connectedContext = activeNode?.id ? canvasBridge.getConnectedNodesContext(activeNode.id) : null;

        // Check if an image is provided explicitly or if the user asked to analyze/critique the active canvas node
        let imageToInspect = request.attachedImageBase64;
        const wantsImageInspection = !!request.attachedImageBase64 ||
          request.mode === 'analysis' ||
          /هذه الصورة|الصورة|النود|التصميم المرفق|حلل التصميم|انقد|انظر للصورة|حلل هذه|image|picture|this design|look at|critique/i.test(request.message);

        if (!imageToInspect && wantsImageInspection) {
          try {
            if (activeNode) {
              const b64 = await canvasBridge.getActiveNodeImageBase64();
              if (b64) imageToInspect = b64;
            }
          } catch {
            // No active canvas image
          }
        }

        // Build conversation messages for Gemini
        const geminiMessages: Array<{ role: 'user' | 'model'; parts: any[] }> = [];

        // Add conversation history (excluding system and error messages)
        if (request.conversationHistory && request.conversationHistory.length > 0) {
          for (const msg of request.conversationHistory) {
            if (msg.role === 'system') continue;
            if (msg.content && msg.content.includes('Agent execution encountered an error')) continue;
            geminiMessages.push({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }],
            });
          }
        }

        // Build current user message parts
        const userParts: any[] = [];

        if (imageToInspect) {
          try {
            const { data: cleanBase64, mimeType } = await prepareImagePayload(imageToInspect, 800);
            if (cleanBase64 && cleanBase64.length > 50) {
              userParts.push({
                inline_data: {
                  mime_type: mimeType,
                  data: cleanBase64,
                },
              });
            }
          } catch (e) {
            logger.warn('[ArchitectAgentService] Failed to downscale image for agent:', e);
          }
        }

        // Context header with rich spatial & memory awareness
        let contextHeader = '';
        const contextSections: string[] = [];

        if (canvasSummary && canvasSummary !== 'Canvas is currently empty.') {
          contextSections.push(`[Canvas Graph Topology & Lineage]:\n${canvasSummary}`);
        }

        if (activeNode?.id) {
          contextSections.push(
            `[Active Focused Node]: #${activeNode.id.slice(0, 6)} (id: "${activeNode.id}")` +
            (activeNode.prompt ? ` | Current Prompt: "${activeNode.prompt}"` : '')
          );
        }

        if (connectedContext && connectedContext.sources.length > 0) {
          contextSections.push(
            `[Connected Node Inputs]: ${connectedContext.intentSummary} (${connectedContext.sources.length} incoming nodes linked)`
          );
        }

        if (mem && (mem.preferredStyles?.length || mem.preferredMaterials?.length)) {
          contextSections.push(
            `[Architectural Memory & User Preferences]:\n` +
            `• Preferred Styles: ${mem.preferredStyles.join(', ')}\n` +
            `• Preferred Materials: ${mem.preferredMaterials.join(', ')}\n` +
            `• Preferred Lighting: ${mem.preferredLighting.join(', ')}`
          );
        }

        // Hindsight Long-Term Memory (Recall & Reflect)
        try {
          const hindsightContext = await hindsightMemory.getAgentMemoryContextBlock(request.message);
          if (hindsightContext) {
            contextSections.push(hindsightContext);
          }
        } catch (hsErr) {
          logger.debug('[ArchitectAgentService] Hindsight memory recall fallback:', hsErr);
        }

        if (contextSections.length > 0) {
          contextHeader = `[Real-Time Canvas & Memory Context]\n${contextSections.join('\n\n')}\n\n`;
        }

        const fullUserText = `${contextHeader}[User Request]:\n${request.message}`;

        userParts.push({ text: fullUserText });
        geminiMessages.push({ role: 'user', parts: userParts });

        let reply: string;
        let usedModelName: string;

        if (cometApiService.isCometModel(request.model || '')) {
          const cometMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: any }> = [];

          if (request.conversationHistory && request.conversationHistory.length > 0) {
            for (const hist of request.conversationHistory) {
              if (hist.content && !hist.content.includes('Agent execution encountered an error')) {
                cometMessages.push({
                  role: hist.role,
                  content: hist.content,
                });
              }
            }
          }

          if (request.attachedImageBase64) {
            cometMessages.push({
              role: 'user',
              content: [
                { type: 'text', text: fullUserText },
                { type: 'image_url', image_url: { url: request.attachedImageBase64 } },
              ],
            });
          } else {
            cometMessages.push({
              role: 'user',
              content: fullUserText,
            });
          }

          const spec = cometApiService.getModelSpec(request.model || '');
          try {
            reply = await cometApiService.chatWithComet({
              model: request.model || '',
              systemPrompt: ANTIGRAVITY_ARCHITECT_SYSTEM_PROMPT,
              messages: cometMessages,
              onChunk: request.onChunk,
            });
            usedModelName = `${spec?.label || request.model} (CometAPI)`;
          } catch (cometErr: any) {
            logger.error(`[ArchitectAgentService] CometAPI model ${request.model} failed:`, cometErr);
            throw new Error(`Failed to process request with selected model [${spec?.label || request.model}]: ${cometErr.message || 'Provider error'}`);
          }
        } else {
          const targetGemini = request.model === 'google/gemini-3.5-flash' ? 'gemini-3.5-flash' : 'gemini-3.6-flash';
          reply = await geminiAgentService.chatWithGemini({
            systemPrompt: ANTIGRAVITY_ARCHITECT_SYSTEM_PROMPT,
            messages: geminiMessages,
            model: targetGemini,
          });
          usedModelName = targetGemini === 'gemini-3.5-flash' ? 'Gemini 3.5 Flash (Google)' : 'Gemini 3.6 Flash (Antigravity Resident Agent)';
        }

        // Hindsight Ingestion (Retain)
        if (request.message && request.message.length > 12) {
          const isDirective = /أريد|أفضل|لا أريد|اعتمد|قاعدة|ارتداد|ترافرتين|كونكريت|خشب|زجاج|ظل|prefer|always|never|setback|material|style|stone/i.test(request.message);
          if (isDirective) {
            hindsightMemory.retain({
              category: 'architectural_preference',
              content: request.message,
              context: {
                nodeId: activeNode?.id || undefined,
                action: 'user_directive',
              },
              importance: 4,
            }).catch(() => {});
          }
        }

        // Extract [Prompt: ...] if present
        const promptMatch = reply.match(/\[Prompt:\s*([\s\S]*?)\]/i);
        const enhancedPrompt = promptMatch ? promptMatch[1].trim() : undefined;
        const actions = parseCanvasActions(reply);
        const autodeskActions = parseAutodeskActions(reply);

        return {
          response: reply,
          model: usedModelName,
          enhancedPrompt,
          canvasContextUsed: contextSections.length > 0,
          actions: actions.length > 0 ? actions : undefined,
          autodeskActions: autodeskActions.length > 0 ? autodeskActions : undefined,
        };
      }
    } catch (geminiError: any) {
      if (cometApiService.isCometModel(request.model || '')) {
        // Strictly rethrow CometAPI error so no secondary cloud models are called
        throw geminiError;
      }
      logger.error('[ArchitectAgentService] Gemini resident agent failed:', geminiError?.message || geminiError);
    }

    // 2. Secondary path: Cloud models via Replicate (Claude Sonnet 5, Fable 5, GPT-5.6 Luna, Kimi K2.6, etc.)
    try {
      const model = (request.model as ReplicateChatModel) || 'anthropic/claude-sonnet-5';
      const messages: ReplicateChatMessage[] = [
        { role: 'system', content: ANTIGRAVITY_ARCHITECT_SYSTEM_PROMPT },
      ];

      if (request.conversationHistory) {
        messages.push(...request.conversationHistory.filter(m => m.role !== 'system' && !m.content.includes('Agent execution encountered an error')) as any);
      }
      messages.push({ role: 'user', content: request.message });

      const result = await replicateService.chatCompletion(messages, model);
      const promptMatch = result.content.match(/\[Prompt:\s*([\s\S]*?)\]/i);
      const actions = parseCanvasActions(result.content);
      return {
        response: result.content,
        model: result.model,
        enhancedPrompt: promptMatch ? promptMatch[1].trim() : undefined,
        actions: actions.length > 0 ? actions : undefined,
      };
    } catch (replicateError: any) {
      logger.warn('[ArchitectAgentService] Cloud model unavailable, falling back to resident Gemini agent:', replicateError?.message || replicateError);

      try {
        const fallbackReply = await geminiAgentService.chatWithGemini({
          systemPrompt: ANTIGRAVITY_ARCHITECT_SYSTEM_PROMPT,
          messages: [
            { role: 'user', parts: [{ text: request.message }] }
          ],
          model: 'gemini-flash-lite-latest',
        });
        const promptMatch = fallbackReply.match(/\[Prompt:\s*([\s\S]*?)\]/i);
        return {
          response: fallbackReply,
          model: `${request.model || 'Cloud Model'} (Fallback: Gemini Resident)`,
          enhancedPrompt: promptMatch ? promptMatch[1].trim() : undefined,
        };
      } catch {
        return this.generateResidentArchitecturalFallback(request);
      }
    }
  }

  private generateResidentArchitecturalFallback(request: ArchitectAgentRequest): ArchitectAgentResponse {
    const isArabic = /[\u0600-\u06FF]/.test(request.message);
    const query = request.message.trim();
    const activeNode = canvasBridge.getActiveNode();
    const parentId = activeNode?.id || undefined;
    const basePrompt = activeNode?.prompt || '';

    // Determine query architectural theme
    const isNight = /ليل|مساء|غروب|night|twilight|evening|dark|lighting/i.test(query);
    const isMaterials = /مواد|ماتيريال|تكتيل|ترافرتين|خشب|رخام|كونكريت|تشطيب|materials|tectonics|stone|travertine|concrete|wood|glass/i.test(query);
    const isClimate = /مناخ|شمس|حرارة|توجيه|واجهة|طاقة|bioclimatic|solar|sun|orientation|louvers|glare/i.test(query);
    const isFork = /فرع|تفريغ|بديل|جديد|branch|fork|variant/i.test(query);
    const isSpaceProgram = /مساحات|زونينغ|مخطط|توزيع|حركة|مدخل|صالون|plan|program|zoning|circulation|vestibule/i.test(query);

    let topicVerdict = '';
    let customizedPrompt = '';
    let branchLabel = 'Architectural Iteration';

    if (isNight) {
      branchLabel = 'Atmospheric Twilight Branch';
      customizedPrompt = `Masterpiece luxury architectural residence at blue hour twilight, floating cantilevered concrete roof slabs, warm 3000K linear architectural cove illumination, 2700K trimless recessed accent spotlights, serene black slate reflecting pool with water mirror effect, floor-to-ceiling minimalist 20mm sightline glazing revealing warm curated interior, Architectural Digest photography, Hasselblad 8k`;
      topicVerdict = isArabic
        ? `• **هندسة الإضاءة والأجواء المسائية:** الانتقال إلى مشهد الغسق (Twilight) مع إنارة خطية غائرة (3000K Linear Cove) أسفل الكوابيل، وتأكيد انعكاسات الكتلة فوق حوض مائي هادئ بقاع حجر بازلت أسود.\n• **التباين والشفافية:** توظيف زجاج فائق النقاء Low-E بكاشفات نحيفة 20mm لإبراز العمق الفراغي الداخلي بحرارة 2700K حميمية.`
        : `• **Photometrics & Twilight Mood:** Dramatic blue-hour illumination featuring 3000K concealed linear coves beneath post-tensioned cantilevers and a calm black-slate reflecting pool.\n• **Transparency & Chiaroscuro:** Ultra-slim 20mm sightlines revealing a warm 2700K interior spatial sequence.`;
    } else if (isMaterials) {
      branchLabel = 'Tectonic Materiality Branch';
      customizedPrompt = `Ultra-luxury modern architectural pavilion, honed vein-cut Roman Navona travertine facade, 15mm negative shadow reveals at junctions, board-formed fair-faced architectural concrete with crisp tie-rod holes, charred cedar shou-sugi-ban vertical accents, dark bronze anodized aluminum mullions, morning golden daylight, hyper-detailed architectural 8k`;
      topicVerdict = isArabic
        ? `• **تكتونية المواد والتشطيبات الفاخرة:** اعتماد حجر الترافرتين الروماني (Roman Navona) مقطوع مع العرق (Vein-cut) بحواف مشطوبة، مع فواصل ظل سلبية غائرة (15mm Negative Reveals) تفصل الأسقف عن الجدران لإلغاء النعلات التقليدية.\n• **المواد المتناغمة:** خرسانة معمارية ناعمة بآثار ألواح الخشب، مع ألمنيوم مؤكسد برونزي غامق وتطعيمات خشب الأرز المحروق (Shou Sugi Ban).`
        : `• **Tectonic Materiality & Joinery:** Honed vein-cut Roman Navona travertine paired with 15mm negative shadow beads at all ceiling/floor interfaces for seamless monolithic purity.\n• **Material Palette:** Board-formed fair-faced concrete, dark bronze anodized aluminum, and charred cedar shou-sugi-ban accents.`;
    } else if (isClimate) {
      branchLabel = 'Bioclimatic Shaded Branch';
      customizedPrompt = `Sustainable avant-garde architectural villa, deep 3.5m cantilevered overhangs providing passive solar shading, motorized vertical acoustic louvers on South-West elevations, North-facing double-height structural curtain wall, integrated biophilic courtyard microclimate, diffused glare-free natural lighting, architectural engineering photography, 8k`;
      topicVerdict = isArabic
        ? `• **التوجيه البيئي والمعالجة المناخية:** توجيه المسطحات الزجاجية الكبرى نحو الشمال للحصول على ضوء متجانس خالي من الوهج، مع حماية الواجهات الغربية والجنوبية بكوابيل خرسانية بارزة (3.5m Cantilevers) وكاسرات شمس عمودية متحركة.\n• **المناخ المصغر (Microclimate):** إدراج فناء داخلي مشجر مع مسطح مائي لتبريد الهواء الساخن طبيعياً عبر التهوية المتقاطعة.`
        : `• **Bioclimatic Solar Shading:** Primary panoramic glazing oriented North for glare-free daylight; South-West facades shaded by deep 3.5m cantilevers and motorized vertical louvers.\n• **Passive Microclimate:** Central landscaped courtyard facilitating natural cross-ventilation and evaporative cooling.`;
    } else if (isSpaceProgram) {
      branchLabel = 'Circulation & Spatial Sequence';
      customizedPrompt = `Contemporary luxury villa, distinct architectural zoning, grand entrance vestibule with privacy screening, double-height reception salon overlooking reflecting garden, separated private family suite wing, structural post-tensioned spans, clean axial circulation corridors, natural afternoon lighting, Architectural Digest editorial, 8k`;
      topicVerdict = isArabic
        ? `• **التسلسل الفراغي والخصوصية:** فصل وظيفي حاسم يبدأ بمدخل تمهيدي (Vestibule) لكسر زاوية الرؤية، انتقالاً إلى صالونات الاستقبال ذات الارتفاع المزدوج، مع عزل الجناح العائلي الصامت ومسارات الخدمة كلياً.\n• **محاور الحركة:** ممرات حركة محورية مضاءة سماوياً تضمن انسيابية التنقل وتجنب التقاطعات غير المرغوبة.`
        : `• **Spatial Sequence & Privacy Hierarchy:** Formal entry vestibule acting as a visual privacy filter before opening to double-height reception salons; family suites acoustically and visually isolated.\n• **Circulation Axes:** Skylit axial gallery corridors organizing movement and eliminating circulation conflicts.`;
    } else {
      branchLabel = 'Architectural Refinement';
      customizedPrompt = basePrompt
        ? `${basePrompt}, monolithic cantilevered concrete slabs, honed vein-cut Roman travertine, 15mm negative shadow reveals, concealed minimalist 20mm sightline glazing, 3000K linear cove illumination, twilight architectural photography, 8k`
        : `Masterpiece contemporary architectural villa, floating post-tensioned concrete cantilevers, vein-cut honed Roman travertine, 15mm negative shadow reveals, concealed minimalist 20mm sightline glazing, 3000K warm cove lighting, serene zero-edge reflecting pool, twilight illumination, Architectural Digest editorial photography, 8k resolution`;
      topicVerdict = isArabic
        ? `• **التكتيل المعماري والتناسب الكتلي:** موازنة الكتل الكابولية الخرسانية الطافية مع قواعد غائرة لإعطاء إحساس بالخفة والرشاقة الهندسية.\n• **الدقة الإنشائية والتفاصيل:** اعتماد فواصل ظل غائرة 15mm وزجاج عالي الشفافية Low-E بقطاعات 20mm غائرة بالأرضية.`
        : `• **Volumetric Massing & Tectonics:** Cantilevered concrete planes balanced over recessed plinths to achieve structural lightness.\n• **Micro-Detailing:** 15mm negative shadow beads and floor-recessed 20mm ultra-slim sightline glazing.`;
    }

    let fallbackActions: CanvasAction[] | undefined = undefined;
    let actionBlock = '';

    if (parentId) {
      if (isFork) {
        fallbackActions = [{
          type: 'fork_node',
          parentId,
          label: branchLabel,
          prompt: customizedPrompt,
        }];
        actionBlock = `\n\n[CanvasAction: {"type": "fork_node", "parentId": "${parentId}", "label": "${branchLabel}", "prompt": "${customizedPrompt}"}]`;
      } else {
        fallbackActions = [
          {
            type: 'update_prompt',
            nodeId: parentId,
            prompt: customizedPrompt,
          },
          {
            type: 'fork_node',
            parentId,
            label: branchLabel,
            prompt: customizedPrompt,
          }
        ];
        actionBlock = `\n\n[CanvasAction: {"type": "update_prompt", "nodeId": "${parentId}", "prompt": "${customizedPrompt}"}]\n[CanvasAction: {"type": "fork_node", "parentId": "${parentId}", "label": "${branchLabel}", "prompt": "${customizedPrompt}"}]`;
      }
    }

    if (isArabic) {
      const arabicResponse = `**القرار والتوجيه المعماري المستقل (ArchVision Senior Architect):**\n\n` +
        `${topicVerdict}\n\n` +
        `[Prompt: ${customizedPrompt}]${actionBlock}`;

      return {
        response: arabicResponse,
        model: 'Antigravity Resident Architectural Intelligence',
        enhancedPrompt: customizedPrompt,
        canvasContextUsed: true,
        actions: fallbackActions,
      };
    }

    const englishResponse = `**Architectural Verdict & Spatial Strategy (ArchVision Senior Architect):**\n\n` +
      `${topicVerdict}\n\n` +
      `[Prompt: ${customizedPrompt}]${actionBlock}`;

    return {
      response: englishResponse,
      model: 'Antigravity Resident Architectural Intelligence',
      enhancedPrompt: customizedPrompt,
      canvasContextUsed: true,
      actions: fallbackActions,
    };
  }
}

export const architectAgent = new ArchitectAgentService();
