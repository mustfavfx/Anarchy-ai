import type { ReplicateChatModel, ReplicateChatMessage } from '../replicate/ReplicateService';
import { replicateService } from '../replicate/ReplicateService';

const ARCHITECT_SYSTEM_PROMPT = `You are an expert AI Architect specialized in architectural design, building analysis, and professional prompt generation. Your expertise includes:
1. Architectural Analysis: Analyze building designs, styles, materials, and structural elements
2. Design Notes: Create detailed architectural notes and documentation
3. Prompt Engineering: Generate professional prompts for AI image generation focused on architecture
4. Style Guidance: Provide guidance on architectural styles (Modern, Gothic, Brutalist, etc.)
5. Material Recommendations: Suggest appropriate materials for different architectural concepts

When generating prompts for image generation:
- Be specific about architectural style, era, and influences
- Include details about materials, lighting, and atmosphere
- Mention camera angles and composition
- Consider environmental context and surroundings
- Use professional architectural terminology

Always be professional, detailed, and helpful.`;

export interface ArchitectAgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ArchitectAgentRequest {
  message: string;
  mode: 'general' | 'prompt' | 'analysis' | 'guidance';
  model?: ReplicateChatModel;
  conversationHistory?: ArchitectAgentMessage[];
}

export interface ArchitectAgentResponse {
  response: string;
  model: ReplicateChatModel;
}

class ArchitectAgentService {
  private defaultModel: ReplicateChatModel = 'anthropic/claude-3.7-sonnet';

  async generateResponse(request: ArchitectAgentRequest): Promise<ArchitectAgentResponse> {
    const model = request.model || this.defaultModel;
    const messages: ReplicateChatMessage[] = [
      { role: 'system', content: ARCHITECT_SYSTEM_PROMPT },
    ];

    if (request.conversationHistory) {
      messages.push(...request.conversationHistory);
    }
    messages.push({ role: 'user', content: request.message });

    try {
      const result = await replicateService.chatCompletion(messages, model);
      return { response: result.content, model: result.model };
    } catch (error) {
      throw new Error(`Agent failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
}

export const architectAgent = new ArchitectAgentService();
