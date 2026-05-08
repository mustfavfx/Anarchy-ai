/**
 * Claude Architecture Skill
 * Specialized system prompt and response handling for architectural engineering
 */

export interface ArchitectureSkillConfig {
  expertise: 'conceptual' | 'technical' | 'code-compliance' | 'structural' | 'mep';
  outputFormat: 'structured' | 'detailed' | 'quick';
  includeCitations: boolean;
  language: 'en' | 'ar' | 'bilingual';
}

export interface ArchitectureResponse {
  summary: string;
  assumptions: string[];
  recommendations: {
    primary: string;
    alternatives?: string[];
  };
  technicalChecks: {
    codeCompliance: string[];
    structuralConsiderations?: string[];
    environmentalFactors?: string[];
  };
  nextSteps: string[];
  warnings?: string[];
  confidence: 'high' | 'medium' | 'low';
}

const EXPERTISE_PROMPTS: Record<ArchitectureSkillConfig['expertise'], string> = {
  conceptual: `You are a senior architectural designer with 20+ years experience in concept development. Focus on:
- Spatial relationships and flow
- Design principles and aesthetics
- Functionality and user experience
- Contextual integration
- Conceptual alternatives with pros/cons`,

  technical: `You are a technical architect specializing in construction documentation and detailing. Focus on:
- Material specifications and performance
- Construction methods and sequencing
- Detail resolution and waterproofing
- Thermal and acoustic performance
- Buildability and constructability`,

  'code-compliance': `You are a code consultant architect specializing in building regulations. Focus on:
- IBC/IRC/NFPA compliance
- Accessibility requirements (ADA/ANSI)
- Fire safety and egress
- Zoning and occupancy
- Local authority requirements`,

  structural: `You are a structural architect bridging architecture and engineering. Focus on:
- Structural systems selection
- Load paths and force distribution
- Foundation requirements
- Seismic/wind considerations
- Coordination with structural engineers`,

  mep: `You are an MEP-architect coordinator specializing in building systems integration. Focus on:
- HVAC zoning and equipment
- Electrical distribution
- Plumbing and drainage
- Energy efficiency
- Ceiling and vertical space coordination`
};

const OUTPUT_FORMAT_INSTRUCTIONS: Record<ArchitectureSkillConfig['outputFormat'], string> = {
  structured: `Respond in a structured format with clear sections:
1. EXECUTIVE SUMMARY (2-3 sentences)
2. KEY ASSUMPTIONS (bullet points)
3. PRIMARY RECOMMENDATION (detailed)
4. ALTERNATIVES (if applicable)
5. TECHNICAL CHECKS (code, structure, environment)
6. NEXT STEPS (actionable items)
7. CONFIDENCE LEVEL (high/medium/low with reasoning)`,

  detailed: `Provide a comprehensive detailed response with:
- In-depth analysis of each aspect
- Multiple scenario comparisons
- Technical specifications where relevant
- References to applicable codes/standards
- Risk assessments and mitigations`,

  quick: `Provide a concise, actionable response:
- Direct answer to the question
- Key 2-3 considerations
- Quick recommendation
- Any critical warnings or caveats`
};

export function buildArchitectureSystemPrompt(config: ArchitectureSkillConfig): string {
  const basePrompt = `You are an expert AI assistant embedded in Anarchy AI, an architectural design software. You represent the Claude Architecture Skill module.

${EXPERTISE_PROMPTS[config.expertise]}

${OUTPUT_FORMAT_INSTRUCTIONS[config.outputFormat]}

CRITICAL RULES:
1. ALWAYS state your assumptions explicitly
2. NEVER claim authority over licensed professionals
3. Include confidence level for each recommendation
4. Flag when specialist consultant input is needed
5. Use architectural terminology correctly
6. Consider climate, context, and local practices
7. Think about constructability, not just theory

${config.includeCitations ? '8. Cite relevant codes/standards when applicable' : ''}

${config.language === 'ar' ? 'Respond in Arabic only.' : config.language === 'bilingual' ? 'Provide bilingual response (English primary, Arabic summary).' : 'Respond in English only.'}

Remember: You are assisting architects and designers, not replacing them. Your role is to accelerate analysis and provide structured thinking.`;

  return basePrompt;
}

export function parseArchitectureResponse(rawText: string): ArchitectureResponse {
  // Attempt to extract structured data from Claude's response
  const sections = {
    summary: extractSection(rawText, ['EXECUTIVE SUMMARY', 'SUMMARY', 'OVERVIEW']),
    assumptions: extractList(rawText, ['KEY ASSUMPTIONS', 'ASSUMPTIONS']),
    primaryRec: extractSection(rawText, ['PRIMARY RECOMMENDATION', 'RECOMMENDATION', 'PRIMARY']),
    alternatives: extractList(rawText, ['ALTERNATIVES', 'ALTERNATIVE OPTIONS']),
    codeCompliance: extractList(rawText, ['CODE COMPLIANCE', 'CODES', 'TECHNICAL CHECKS']),
    structural: extractList(rawText, ['STRUCTURAL CONSIDERATIONS', 'STRUCTURAL']),
    environmental: extractList(rawText, ['ENVIRONMENTAL FACTORS', 'ENVIRONMENTAL']),
    nextSteps: extractList(rawText, ['NEXT STEPS', 'ACTION ITEMS', 'NEXT']),
    warnings: extractList(rawText, ['WARNINGS', 'CAVEATS', 'IMPORTANT NOTES']),
    confidence: extractConfidence(rawText)
  };

  return {
    summary: sections.summary || rawText.slice(0, 500),
    assumptions: sections.assumptions || [],
    recommendations: {
      primary: sections.primaryRec || 'See full response',
      alternatives: sections.alternatives.length > 0 ? sections.alternatives : undefined
    },
    technicalChecks: {
      codeCompliance: sections.codeCompliance || [],
      structuralConsiderations: sections.structural.length > 0 ? sections.structural : undefined,
      environmentalFactors: sections.environmental.length > 0 ? sections.environmental : undefined
    },
    nextSteps: sections.nextSteps || [],
    warnings: sections.warnings.length > 0 ? sections.warnings : undefined,
    confidence: sections.confidence
  };
}

function extractSection(text: string, headers: string[]): string {
  for (const header of headers) {
    const regex = new RegExp(`${header}[:\s]*\n?([^\n#]*(?:\n(?![#\d]\s)[^\n#]*)*)`, 'i');
    const match = text.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return '';
}

function extractList(text: string, headers: string[]): string[] {
  const section = extractSection(text, headers);
  if (!section) return [];
  
  // Split by bullet points or numbered items
  return section
    .split(/\n/)
    .map(line => line.replace(/^[\s•\-\*\d.)]+/, '').trim())
    .filter(line => line.length > 3);
}

function extractConfidence(text: string): 'high' | 'medium' | 'low' {
  const lower = text.toLowerCase();
  if (lower.includes('confidence: high') || lower.includes('high confidence')) return 'high';
  if (lower.includes('confidence: medium') || lower.includes('medium confidence')) return 'medium';
  if (lower.includes('confidence: low') || lower.includes('low confidence')) return 'low';
  return 'medium'; // default
}

// Skill presets for common use cases
export const SKILL_PRESETS = {
  conceptDesign: {
    expertise: 'conceptual' as const,
    outputFormat: 'structured' as const,
    includeCitations: false,
    language: 'en' as const
  },
  
  technicalReview: {
    expertise: 'technical' as const,
    outputFormat: 'detailed' as const,
    includeCitations: true,
    language: 'en' as const
  },
  
  codeCheck: {
    expertise: 'code-compliance' as const,
    outputFormat: 'structured' as const,
    includeCitations: true,
    language: 'en' as const
  },
  
  structuralCoordination: {
    expertise: 'structural' as const,
    outputFormat: 'structured' as const,
    includeCitations: true,
    language: 'en' as const
  },
  
  mepReview: {
    expertise: 'mep' as const,
    outputFormat: 'structured' as const,
    includeCitations: true,
    language: 'en' as const
  },
  
  quickAdvice: {
    expertise: 'conceptual' as const,
    outputFormat: 'quick' as const,
    includeCitations: false,
    language: 'en' as const
  }
};
