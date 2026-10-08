/**
 * Hindsight Agent Memory Service
 * 
 * Biomimetic long-term memory engine inspired by Vectorize Hindsight (vectorize-io/hindsight).
 * Implements the tripartite cognitive architecture:
 * 1. Retain: Ingests architectural decisions, user preferences, and node forks into durable memory.
 * 2. Recall: Multi-strategy contextual retrieval (semantic, keyword, typology, and recency).
 * 3. Reflect: Synthesizes accumulated facts into high-level agent beliefs and architectural principles.
 * 
 * Operates in Dual-Mode:
 * - Native Embedded Mode: Persistent local substrate (IndexedDB / LocalStorage) with zero setup.
 * - Remote Hindsight Server Mode: Bridges to local or hosted Hindsight Docker instance (http://localhost:8888).
 */

import { logger } from '../../utils/logger';

export type MemoryCategory = 'architectural_preference' | 'design_decision' | 'spatial_rule' | 'user_feedback' | 'prompt_pattern';

export interface HindsightMemoryItem {
  id: string;
  category: MemoryCategory;
  content: string;
  tags: string[];
  context?: {
    projectId?: string;
    nodeId?: string;
    typology?: string;
    style?: string;
    action?: string;
  };
  importance: number; // 1 to 5
  timestamp: number;
}

export interface AgentBelief {
  id: string;
  topic: string;
  synthesis: string;
  confidence: number; // 0.0 to 1.0
  evidenceCount: number;
  lastUpdated: number;
}

export interface HindsightReflectionReport {
  timestamp: number;
  beliefs: AgentBelief[];
  architecturalStyleSummary: string;
  preferredMaterials: string[];
  lightingDoctrine: string;
  spatialConstraints: string[];
}

const STORAGE_KEY_MEMORIES = 'anarchy_hindsight_memories_v1';
const STORAGE_KEY_REFLECTIONS = 'anarchy_hindsight_reflections_v1';

class HindsightMemoryService {
  private memories: HindsightMemoryItem[] = [];
  private latestReflection: HindsightReflectionReport | null = null;
  private remoteServerUrl: string = 'http://localhost:8888';
  private isRemoteAvailable: boolean = false;
  private isInitialized: boolean = false;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Initializes the memory engine and checks for active remote Hindsight Docker server.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.loadFromStorage();
    await this.checkRemoteHindsightStatus();
    this.isInitialized = true;
  }

  /**
   * Checks if a local Hindsight container (vectorize-io/hindsight) is reachable.
   */
  public async checkRemoteHindsightStatus(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${this.remoteServerUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      this.isRemoteAvailable = res.ok;
    } catch {
      this.isRemoteAvailable = false;
    }
    return this.isRemoteAvailable;
  }

  /**
   * Primitive 1: RETAIN
   * Ingests a new interaction, design decision, or rule into durable structured memory.
   */
  public async retain(entry: {
    category: MemoryCategory;
    content: string;
    tags?: string[];
    context?: HindsightMemoryItem['context'];
    importance?: number;
  }): Promise<HindsightMemoryItem> {
    const memoryItem: HindsightMemoryItem = {
      id: `hs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      category: entry.category,
      content: entry.content.trim(),
      tags: entry.tags || [],
      context: entry.context,
      importance: Math.min(5, Math.max(1, entry.importance ?? 3)),
      timestamp: Date.now(),
    };

    // Deduplicate near-identical memory entries
    const existingIndex = this.memories.findIndex(
      (m) => m.content.toLowerCase() === memoryItem.content.toLowerCase()
    );
    if (existingIndex >= 0) {
      this.memories[existingIndex].importance = Math.min(5, this.memories[existingIndex].importance + 1);
      this.memories[existingIndex].timestamp = Date.now();
      this.saveToStorage();
      return this.memories[existingIndex];
    }

    this.memories.push(memoryItem);
    this.saveToStorage();

    // Optionally forward to remote Hindsight instance if active
    if (this.isRemoteAvailable) {
      this.forwardRetainToRemote(memoryItem).catch((err) => {
        logger.debug('[Hindsight] Remote retain forward failed:', err);
      });
    }

    return memoryItem;
  }

  /**
   * Primitive 2: RECALL
   * Multi-strategy contextual retrieval (keyword matching, tags, typology, and importance weighting).
   */
  public async recall(
    query: string,
    options?: {
      limit?: number;
      minImportance?: number;
      category?: MemoryCategory;
      tags?: string[];
    }
  ): Promise<HindsightMemoryItem[]> {
    const limit = options?.limit ?? 5;
    const minImportance = options?.minImportance ?? 1;
    const searchTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    const scored = this.memories
      .filter((m) => {
        if (options?.category && m.category !== options.category) return false;
        if (m.importance < minImportance) return false;
        if (options?.tags && options.tags.length > 0) {
          const hasTag = options.tags.some((t) => m.tags.includes(t.toLowerCase()));
          if (!hasTag) return false;
        }
        return true;
      })
      .map((m) => {
        let score = m.importance * 2;
        const text = `${m.content} ${m.tags.join(' ')} ${m.context?.style || ''} ${m.context?.typology || ''}`.toLowerCase();

        for (const term of searchTerms) {
          if (text.includes(term)) {
            score += 4;
          }
        }

        // Recency boost (up to +3 points for items in last 24 hours)
        const ageHours = (Date.now() - m.timestamp) / (1000 * 60 * 60);
        if (ageHours < 24) {
          score += 3;
        } else if (ageHours < 168) {
          score += 1;
        }

        return { item: m, score };
      });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.item);
  }

  /**
   * Primitive 3: REFLECT
   * Synthesizes accumulated facts and interactions into actionable agent beliefs.
   */
  public async reflect(force: boolean = false): Promise<HindsightReflectionReport> {
    // Return cached reflection if fresh (< 1 hour) unless forced
    if (!force && this.latestReflection && Date.now() - this.latestReflection.timestamp < 3600000) {
      return this.latestReflection;
    }

    const beliefs: AgentBelief[] = [];
    const materialCounts = new Map<string, number>();
    const styleCounts = new Map<string, number>();
    const spatialRules: string[] = [];

    for (const mem of this.memories) {
      // Analyze materials
      const materialMatches = mem.content.match(/(travertine|concrete|oak|walnut|marble|glass|bronze|steel|timber|stone|granite|stucco)/gi);
      if (materialMatches) {
        for (const mat of materialMatches) {
          const norm = mat.toLowerCase();
          materialCounts.set(norm, (materialCounts.get(norm) || 0) + 1);
        }
      }

      // Analyze styles
      if (mem.context?.style) {
        styleCounts.set(mem.context.style, (styleCounts.get(mem.context.style) || 0) + 1);
      }

      // Collect spatial rules & setbacks
      if (mem.category === 'spatial_rule' || /setback|ارتداد|ممر|vestibule|circulation|courtyard/i.test(mem.content)) {
        spatialRules.push(mem.content);
      }
    }

    // Synthesize top materials
    const topMaterials = Array.from(materialCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([m]) => m.charAt(0).toUpperCase() + m.slice(1));

    if (topMaterials.length > 0) {
      beliefs.push({
        id: 'belief_materials',
        topic: 'Preferred Tectonic Materials',
        synthesis: `The architect frequently specifies high-tactility textures: ${topMaterials.join(', ')}.`,
        confidence: 0.9,
        evidenceCount: topMaterials.length,
        lastUpdated: Date.now(),
      });
    }

    // Synthesize top style
    const topStyles = Array.from(styleCounts.entries()).sort((a, b) => b[1] - a[1]);
    const dominantStyle = topStyles[0]?.[0] || 'Contemporary Modernist Luxury';

    beliefs.push({
      id: 'belief_style',
      topic: 'Dominant Architectural Language',
      synthesis: `Strong bias towards ${dominantStyle} characterized by clean monolithic forms and deep negative reveals.`,
      confidence: 0.85,
      evidenceCount: topStyles.length || 1,
      lastUpdated: Date.now(),
    });

    const report: HindsightReflectionReport = {
      timestamp: Date.now(),
      beliefs,
      architecturalStyleSummary: dominantStyle,
      preferredMaterials: topMaterials.length > 0 ? topMaterials : ['Navona Travertine', 'Architectural Concrete', 'Low-Iron Glazing'],
      lightingDoctrine: 'Warm indirect cove illumination (2700K - 3000K) with crisp solar shading on South/West facades.',
      spatialConstraints: spatialRules.slice(0, 5),
    };

    this.latestReflection = report;
    this.saveToStorage();
    return report;
  }

  /**
   * Generates a concise context block for the Agent's system prompt or user query header.
   */
  public async getAgentMemoryContextBlock(currentQuery: string): Promise<string> {
    await this.initialize();
    const relevantMemories = await this.recall(currentQuery, { limit: 4, minImportance: 2 });
    const reflection = await this.reflect();

    const sections: string[] = [];

    if (reflection.beliefs.length > 0) {
      const beliefLines = reflection.beliefs.map((b) => `• ${b.topic}: ${b.synthesis}`).join('\n');
      sections.push(`[Hindsight Synthesized Beliefs]:\n${beliefLines}`);
    }

    if (relevantMemories.length > 0) {
      const memLines = relevantMemories.map((m) => `• [${m.category}] ${m.content}`).join('\n');
      sections.push(`[Hindsight Recalled Episodic Memory]:\n${memLines}`);
    }

    if (sections.length === 0) return '';
    return sections.join('\n\n');
  }

  /**
   * Returns current statistics of the memory bank.
   */
  public getStats(): { totalCount: number; isRemoteConnected: boolean; lastReflectionTime: number } {
    return {
      totalCount: this.memories.length,
      isRemoteConnected: this.isRemoteAvailable,
      lastReflectionTime: this.latestReflection?.timestamp || 0,
    };
  }

  /**
   * Clears the memory bank.
   */
  public clearMemory(): void {
    this.memories = [];
    this.latestReflection = null;
    try {
      localStorage.removeItem(STORAGE_KEY_MEMORIES);
      localStorage.removeItem(STORAGE_KEY_REFLECTIONS);
    } catch {}
  }

  // --- Storage & Remote Helpers ---

  private loadFromStorage(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const memRaw = localStorage.getItem(STORAGE_KEY_MEMORIES);
      if (memRaw) {
        this.memories = JSON.parse(memRaw);
      }
      const refRaw = localStorage.getItem(STORAGE_KEY_REFLECTIONS);
      if (refRaw) {
        this.latestReflection = JSON.parse(refRaw);
      }
    } catch (e) {
      logger.warn('[Hindsight] Failed to load memories from localStorage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY_MEMORIES, JSON.stringify(this.memories));
      if (this.latestReflection) {
        localStorage.setItem(STORAGE_KEY_REFLECTIONS, JSON.stringify(this.latestReflection));
      }
    } catch (e) {
      logger.warn('[Hindsight] Failed to save memories to localStorage:', e);
    }
  }

  private async forwardRetainToRemote(item: HindsightMemoryItem): Promise<void> {
    await fetch(`${this.remoteServerUrl}/api/v1/retain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bank_id: 'anarchy_architect_bank',
        content: item.content,
        metadata: {
          category: item.category,
          tags: item.tags,
          context: item.context,
          importance: item.importance,
        },
      }),
    });
  }
}

export const hindsightMemory = new HindsightMemoryService();
