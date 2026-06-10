import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, FileText, Building2, Lightbulb, Loader2, X, Copy, Check } from 'lucide-react';
import { architectAgent, type ArchitectAgentMessage, type ArchitectAgentRequest } from '../../services/agent/ArchitectAgentService';
import type { ReplicateChatModel } from '../../services/replicate/ReplicateService';
import { useAuth } from '../auth/AuthContext';
import { deductCredits, GENERATION_COST, DEV_MODE, refundCredits } from '../../services/credit/creditService';
import { logger } from '../../utils/logger';
import './ArchitectAgentPage.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type AgentMode = 'general' | 'prompt' | 'analysis' | 'guidance';

const MODES = [
  { id: 'general' as AgentMode, label: 'General', icon: Bot, description: 'General architectural assistance' },
  { id: 'prompt' as AgentMode, label: 'Prompt Generator', icon: Sparkles, description: 'Generate AI image prompts' },
  { id: 'analysis' as AgentMode, label: 'Analysis', icon: Building2, description: 'Analyze architectural designs' },
  { id: 'guidance' as AgentMode, label: 'Guidance', icon: Lightbulb, description: 'Style and material guidance' },
];

const MODELS: { id: ReplicateChatModel; label: string }[] = [
  { id: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet' },
  { id: 'deepseek-ai/deepseek-r1', label: 'DeepSeek R1' },
  { id: 'meta/meta-llama-3-70b-instruct', label: 'Llama 3 70B' },
];

export const ArchitectAgentPage: React.FC = () => {
  const { user: authUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<AgentMode>('general');
  const [selectedModel, setSelectedModel] = useState<ReplicateChatModel>('anthropic/claude-3.7-sonnet');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Deduct credits for agent usage (skip in DEV_MODE)
    const chatCost = GENERATION_COST.chat;
    if (authUser?.id && !DEV_MODE) {
      const deduct = await deductCredits(authUser.id, chatCost, `AI Agent: ${selectedMode}`);
      if (!deduct.success) {
        const errorMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Insufficient credits. You need ${chatCost} credit for this request.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const conversationHistory: ArchitectAgentMessage[] = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const request: ArchitectAgentRequest = {
        message: input,
        mode: selectedMode,
        model: selectedModel,
        conversationHistory,
      };

      const response = await architectAgent.generateResponse(request);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to generate response'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);

      // Refund credits
      if (authUser?.id && !DEV_MODE) {
        refundCredits(authUser.id, chatCost, `Refund: Failed agent query for ${selectedMode}`)
          .catch((err) => logger.error('[Credit] Refund failed:', err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="architect-agent-page">
      <div className="agent-header">
        <div className="agent-title">
          <div className="agent-icon">
            <Bot size={28} />
          </div>
          <div>
            <h1>Architect AI Agent</h1>
            <p>Professional architectural assistant & prompt generator</p>
          </div>
        </div>
        <button className="clear-btn" onClick={clearChat} title="Clear chat">
          <X size={18} />
          Clear
        </button>
      </div>

      <div className="agent-controls">
        <div className="mode-selector">
          {MODES.map(mode => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                className={`mode-btn ${selectedMode === mode.id ? 'active' : ''}`}
                onClick={() => setSelectedMode(mode.id)}
                title={mode.description}
              >
                <Icon size={18} />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        <div className="model-selector">
          <label>Model:</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as ReplicateChatModel)}
            className="model-select"
          >
            {MODELS.map(model => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="chat-container">
        <div className="messages-list">
          {messages.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} className="empty-icon" />
              <h3>Start a conversation</h3>
              <p>Ask me about architecture, design analysis, or generate professional prompts</p>
              <div className="suggestions">
                <button onClick={() => setInput('Generate a prompt for a modern glass skyscraper with sustainable design features')}>
                  Generate modern skyscraper prompt
                </button>
                <button onClick={() => setInput('Analyze the key elements of Gothic architecture')}>
                  Analyze Gothic architecture
                </button>
                <button onClick={() => setInput('Suggest materials for a minimalist beach house')}>
                  Suggest materials for beach house
                </button>
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="message-content">
                  <div className="message-header">
                    <span className="message-role">
                      {msg.role === 'user' ? 'You' : 'Architect AI'}
                    </span>
                    <span className="message-time">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="message-text">{msg.content}</div>
                  {msg.role === 'assistant' && (
                    <button
                      className="copy-btn"
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      title="Copy to clipboard"
                    >
                      {copiedId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="message assistant">
              <div className="message-content">
                <div className="message-header">
                  <span className="message-role">Architect AI</span>
                </div>
                <div className="message-text loading">
                  <Loader2 size={16} className="spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="input-area">
        <textarea
          ref={inputRef}
          className="message-input"
          placeholder="Ask about architecture, design, or request a prompt..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          disabled={isLoading}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? (
            <Loader2 size={18} className="spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </div>
  );
};
