import { useState, useMemo, useCallback } from 'react';
import type { ReplicateChatModel } from '../../../services/replicate/ReplicateService';
import { architectAgent, type ArchitectAgentRequest, type ArchitectAgentMessage } from '../../../services/agent/ArchitectAgentService';
import { useAuth } from '../../auth/AuthContext';
import { deductCredits, GENERATION_COST, DEV_MODE, refundCredits } from '../../../services/credit/creditService';
import { logger } from '../../../utils/logger';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

export type AgentMode = 'general' | 'prompt' | 'analysis' | 'guidance';

export const WELCOME_MESSAGE =
  'Hello. I am your Architect AI Agent. I specialize in architectural notes, professional prompt generation, design analysis, and style guidance.';

export const ARCHITECTURE_MODELS: { id: ReplicateChatModel; label: string; focus: string }[] = [
  { id: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet', focus: 'Best for architecture' },
  { id: 'deepseek-ai/deepseek-r1', label: 'DeepSeek R1', focus: 'Deep analysis' },
  { id: 'meta/meta-llama-3-70b-instruct', label: 'Llama 3 70B', focus: 'Balanced' },
];

export function useAgentChat() {
  const { user: authUser } = useAuth();
  const [selectedModel, setSelectedModel] = useState<ReplicateChatModel>('anthropic/claude-3.7-sonnet');
  const [selectedMode, setSelectedMode] = useState<AgentMode>('general');
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', text: WELCOME_MESSAGE },
  ]);

  const selectedModelInfo = useMemo(
    () => ARCHITECTURE_MODELS.find(model => model.id === selectedModel) || ARCHITECTURE_MODELS[0],
    [selectedModel]
  );

  const sendMessage = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || isSending) return;

    // Deduct credits
    const chatCost = GENERATION_COST.chat;
    if (authUser?.id && !DEV_MODE) {
      const deduct = await deductCredits(authUser.id, chatCost, `AI Agent: ${selectedMode}`);
      if (!deduct.success) {
        const errorMessage: ChatMessage = {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          text: `Insufficient credits. You need ${chatCost} credit for this request.`,
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: content,
    };

    setMessages(prev => [...prev, userMessage]);
    setDraft('');
    setIsSending(true);

    try {
      const conversationHistory: ArchitectAgentMessage[] = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.role,
          content: m.text,
        }));

      const request: ArchitectAgentRequest = {
        message: content,
        mode: selectedMode,
        model: selectedModel,
        conversationHistory,
      };

      const response = await architectAgent.generateResponse(request);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: response.response,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        text: error instanceof Error
          ? `Error: ${error.message}`
          : 'Failed to generate response',
      };
      setMessages(prev => [...prev, errorMessage]);

      // Refund credits
      if (authUser?.id && !DEV_MODE) {
        refundCredits(authUser.id, chatCost, `Refund: Failed agent query for ${selectedMode}`)
          .catch((err) => logger.error('[Credit] Refund failed:', err));
      }
    } finally {
      setIsSending(false);
    }
  }, [authUser, isSending, messages, selectedMode, selectedModel]);

  return {
    selectedModel,
    setSelectedModel,
    selectedMode,
    setSelectedMode,
    draft,
    setDraft,
    isSending,
    messages,
    selectedModelInfo,
    sendMessage,
  };
}
