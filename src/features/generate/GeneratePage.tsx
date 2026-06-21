import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, Building2, Ruler, DraftingCompass, ChevronDown, Check } from 'lucide-react';
import { useAgentChat, ARCHITECTURE_MODELS } from './hooks/useAgentChat';
import type { AgentMode } from './hooks/useAgentChat';
import './GeneratePage.css';

const MODE_OPTIONS: { id: AgentMode; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'General', icon: <Bot size={13} /> },
  { id: 'prompt', label: 'Prompt Generator', icon: <Building2 size={13} /> },
  { id: 'analysis', label: 'Analysis', icon: <Ruler size={13} /> },
  { id: 'guidance', label: 'Guidance', icon: <DraftingCompass size={13} /> },
];

const QUICK_PROMPTS = [
  'Generate a prompt for modern glass skyscraper',
  'Analyze this facade design for sustainability',
  'Suggest materials for luxury villa interior',
  'Guide me on lighting for north-facing room',
];

export const GeneratePage: React.FC = () => {
  const {
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
  } = useAgentChat();

  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!modelDropdownRef.current?.contains(target)) {
        setShowModelDropdown(false);
      }
      if (!modeDropdownRef.current?.contains(target)) {
        setShowModeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, []);

  return (
    <div className="generate-page">
      <div className="generate-container">
        <div className="chat-layout">
          <div className="chat-shell chat-main">
            <div className="chat-main-header">
              <h1>Architect AI Agent</h1>
              <p>Specialized in architectural notes, prompt generation, analysis, and guidance.</p>
            </div>

            <div className="chat-thread">
              {messages.map(message => (
                <div key={message.id} className={`chat-bubble ${message.role}`}>
                  {message.role === 'assistant' && (
                    <div className="bubble-avatar">
                      <Bot size={14} />
                    </div>
                  )}
                  <div className="bubble-content">{message.text}</div>
                </div>
              ))}
            </div>

            <div className="chat-input-wrap">
              <input
                type="text"
                className="chat-input"
                placeholder="Ask about layouts, facade systems, material specs, structure, or code constraints..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage(draft);
                  }
                }}
              />
              <div className="chat-input-actions">
                <button className="send-btn" onClick={() => sendMessage(draft)} disabled={isSending}>
                  <Send size={14} />
                  {isSending ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>

          <aside className="chat-side-panel">
            <div className="skill-selector-wrap" ref={modeDropdownRef}>
              <label>Mode</label>
              <div
                className="skill-selector-trigger"
                onClick={() => setShowModeDropdown(!showModeDropdown)}
              >
                <span>{MODE_OPTIONS.find(s => s.id === selectedMode)?.label}</span>
                <ChevronDown size={16} className={`dropdown-arrow ${showModeDropdown ? 'open' : ''}`} />
              </div>

              {showModeDropdown && (
                <div className="skill-menu">
                  {MODE_OPTIONS.map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      className={`skill-option ${selectedMode === mode.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedMode(mode.id);
                        setShowModeDropdown(false);
                      }}
                    >
                      {mode.icon}
                      <span>{mode.label}</span>
                      {selectedMode === mode.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="model-selector-wrap" ref={modelDropdownRef}>
              <label>Model</label>
              <div
                className="model-selector-trigger"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
              >
                <span>{selectedModelInfo.label}</span>
                <ChevronDown size={16} className={`dropdown-arrow ${showModelDropdown ? 'open' : ''}`} />
              </div>

              {showModelDropdown && (
                <div className="model-menu">
                  {ARCHITECTURE_MODELS.map(model => (
                    <button
                      key={model.id}
                      type="button"
                      className={`model-option ${selectedModel === model.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setShowModelDropdown(false);
                      }}
                    >
                      <span>{model.label}</span>
                      {selectedModel === model.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
              <span className="model-focus">{selectedModelInfo.focus}</span>
            </div>

            <div className="chat-pills">
              <div className="pill"><Building2 size={13} /> Space planning</div>
              <div className="pill"><Ruler size={13} /> Codes & dimensions</div>
              <div className="pill"><DraftingCompass size={13} /> Structural logic</div>
            </div>

            <div className="quick-prompts">
              {QUICK_PROMPTS.map(prompt => (
                <button key={prompt} className="quick-chip" onClick={() => sendMessage(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
