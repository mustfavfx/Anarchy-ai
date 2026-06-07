/**
 * Documentation Service
 * Loads and manages markdown documentation files
 */

export interface DocFile {
  id: string;
  title: string;
  category?: string;
  path: string;
  content?: string;
  type: 'doc' | 'video';
  description?: string;
  duration?: string;
  thumbnail?: string;
}

export interface DocCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  items: DocFile[];
}

// Documentation structure
const DOC_STRUCTURE: DocCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics of Anarchy-AI and set up your first workflow',
    icon: 'BookOpen',
    items: [
      { id: 'intro', title: 'Introduction', path: 'getting-started/01-introduction.md', type: 'doc' },
      { id: 'installation', title: 'Installation & Setup', path: 'getting-started/02-installation.md', type: 'doc' },
      { id: 'first-project', title: 'Your First Project', path: 'getting-started/03-first-project.md', type: 'doc' },
      { id: 'interface', title: 'Interface Overview', path: 'getting-started/04-interface.md', type: 'doc' },
      { id: 'shortcuts', title: 'Keyboard Shortcuts', path: 'getting-started/05-shortcuts.md', type: 'doc' },
      { id: 'account', title: 'Creating a New Account', path: 'getting-started/06-account.md', type: 'doc' },
      { id: 'api', title: 'Connecting to Replicate API', path: 'getting-started/07-replicate-api.md', type: 'doc' },
    ],
  },
  {
    id: 'prompting',
    title: 'Prompting Guide',
    description: 'Master the art of writing effective prompts for AI',
    icon: 'Zap',
    items: [
      { id: 'basics', title: 'Prompt Engineering Basics', path: 'prompting/01-basics.md', type: 'doc' },
      { id: 'keywords', title: 'Architectural Keywords', path: 'prompting/02-architectural-keywords.md', type: 'doc' },
      { id: 'styles', title: 'Style & Material Descriptions', path: 'prompting/03-styles-materials.md', type: 'doc' },
      { id: 'lighting', title: 'Lighting & Atmosphere Tips', path: 'prompting/04-lighting.md', type: 'doc' },
      { id: 'camera', title: 'Camera Angles & Perspectives', path: 'prompting/05-camera.md', type: 'doc' },
      { id: 'negative', title: 'Negative Prompts Guide', path: 'prompting/06-negative-prompts.md', type: 'doc' },
    ],
  },
  {
    id: 'node-library',
    title: 'Node Library',
    description: 'Explore all available nodes and their configurations',
    icon: 'Layers',
    items: [
      { id: 'overview', title: 'Node Overview', path: 'nodes/01-overview.md', type: 'doc' },
      { id: 'ai-gen', title: 'AI Generation Nodes', path: 'nodes/02-ai-generation.md', type: 'doc' },
      { id: 'io', title: 'Input/Output Nodes', path: 'nodes/03-io-nodes.md', type: 'doc' },
      { id: 'processing', title: 'Processing Nodes', path: 'nodes/04-processing.md', type: 'doc' },
      { id: 'utility', title: 'Utility Nodes', path: 'nodes/05-utility.md', type: 'doc' },
      { id: 'source', title: 'Source Node Features', path: 'nodes/06-source.md', type: 'doc' },
      { id: 'result', title: 'Result Node Settings', path: 'nodes/07-result.md', type: 'doc' },
      { id: 'ghost', title: 'Ghost Node Workflows', path: 'nodes/08-ghost.md', type: 'doc' },
    ],
  },
  {
    id: 'workflows',
    title: 'Architectural Workflows',
    description: 'Step-by-step guides for common architectural tasks',
    icon: 'Workflow',
    items: [
      { id: 'concept', title: 'Concept Massing', path: 'workflows/01-concept.md', type: 'doc' },
      { id: 'facade', title: 'Facade Generation', path: 'workflows/02-facade.md', type: 'doc' },
      { id: 'interior', title: 'Interior Visualization', path: 'workflows/03-interior.md', type: 'doc' },
      { id: 'landscape', title: 'Landscape Design', path: 'workflows/04-landscape.md', type: 'doc' },
      { id: 'urban', title: 'Urban Planning Views', path: 'workflows/05-urban.md', type: 'doc' },
      { id: 'day-night', title: 'Day to Night Conversion', path: 'workflows/06-day-night.md', type: 'doc' },
      { id: 'people', title: 'People & Context Addition', path: 'workflows/07-people.md', type: 'doc' },
      { id: 'materials', title: 'Material Replacement', path: 'workflows/08-materials.md', type: 'doc' },
      { id: 'seasons', title: 'Seasonal Variations', path: 'workflows/09-seasons.md', type: 'doc' },
    ],
  },
  {
    id: 'ai-models',
    title: 'AI Models & Features',
    description: 'Learn about different AI models and capabilities',
    icon: 'Cpu',
    items: [
      { id: 'flux-pro', title: 'FLUX.1 Pro Model Guide', path: 'ai-models/01-flux-pro.md', type: 'doc' },
      { id: 'flux-real', title: 'FLUX.1 Realism Model', path: 'ai-models/02-flux-realism.md', type: 'doc' },
      { id: 'recraft', title: 'Recraft Model Comparison', path: 'ai-models/03-recraft.md', type: 'doc' },
      { id: 'topaz', title: 'Topaz Upscale Integration', path: 'ai-models/04-topaz.md', type: 'doc' },
      { id: 'watermark', title: 'Watermark Settings', path: 'ai-models/05-watermark.md', type: 'doc' },
      { id: 'resolution', title: 'Resolution & Aspect Ratios', path: 'ai-models/06-resolution.md', type: 'doc' },
    ],
  },
  {
    id: 'exporting',
    title: 'Exporting & Integrations',
    description: 'Export to professional CAD and BIM software',
    icon: 'Download',
    items: [
      { id: '3dsmax', title: '3ds Max Integration', path: 'exporting/01-3dsmax.md', type: 'doc' },
      { id: 'revit', title: 'Revit Plugin Guide', path: 'exporting/02-revit.md', type: 'doc' },
      { id: 'sketchup', title: 'SketchUp Export', path: 'exporting/03-sketchup.md', type: 'doc' },
      { id: 'rhino', title: 'Rhino/GH Workflow', path: 'exporting/04-rhino.md', type: 'doc' },
      { id: 'vray', title: 'V-Ray Render Settings', path: 'exporting/05-vray.md', type: 'doc' },
      { id: 'blender', title: 'Blender Integration', path: 'exporting/07-blender.md', type: 'doc' },
    ],
  },
  {
    id: 'history-library',
    title: 'History & Library',
    description: 'Manage your generated images and assets',
    icon: 'History',
    items: [
      { id: 'understanding', title: 'Understanding History View', path: 'history/01-understanding.md', type: 'doc' },
      { id: 'organization', title: 'Library Organization', path: 'history/02-organization.md', type: 'doc' },
      { id: 'exporting', title: 'Exporting Images', path: 'history/03-exporting.md', type: 'doc' },
      { id: 'bulk', title: 'Bulk Operations', path: 'history/04-bulk.md', type: 'doc' },
      { id: 'favorites', title: 'Starred Items & Favorites', path: 'history/05-favorites.md', type: 'doc' },
      { id: 'searching', title: 'Searching & Filtering', path: 'history/06-searching.md', type: 'doc' },
    ],
  },
  {
    id: 'advanced',
    title: 'Advanced Topics',
    description: 'Deep dive into advanced features and techniques',
    icon: 'Settings',
    items: [
      { id: 'custom-workflows', title: 'Custom Workflows', path: 'advanced/01-custom-workflows.md', type: 'doc' },
      { id: 'api-integration', title: 'API Integration', path: 'advanced/02-api-integration.md', type: 'doc' },
      { id: 'collaboration', title: 'Team Collaboration', path: 'advanced/03-collaboration.md', type: 'doc' },
      { id: 'optimization', title: 'Performance Optimization', path: 'advanced/04-optimization.md', type: 'doc' },
      { id: 'automation', title: 'Automation & Scripting', path: 'advanced/05-automation.md', type: 'doc' },
    ],
  },
];

// Video tutorials data
const VIDEO_TUTORIALS: DocFile[] = [
  { id: 'quick-start', title: 'Quick Start Guide', duration: '5:30', thumbnail: '🎬', type: 'video' as const, path: 'tutorials/01-quick-start.md' },
  { id: 'advanced-nodes', title: 'Advanced Node Workflows', duration: '12:45', thumbnail: '🎬', type: 'video' as const, path: 'tutorials/02-advanced-nodes.md' },
  { id: 'best-practices', title: 'Best Practices', duration: '8:20', thumbnail: '🎬', type: 'video' as const, path: 'tutorials/03-best-practices.md' },
  { id: 'prompt-101', title: 'Prompt Engineering 101', duration: '15:00', thumbnail: '🎓', type: 'video' as const, path: 'tutorials/04-prompt-101.md' },
  { id: 'facade-tips', title: 'Facade Design Tips', duration: '10:30', thumbnail: '🏛️', type: 'video' as const, path: 'tutorials/05-facade.md' },
  { id: 'interior-rendering', title: 'Interior Rendering', duration: '9:45', thumbnail: '🛋️', type: 'video' as const, path: 'tutorials/06-interior.md' },
  { id: 'workflow-auto', title: 'Workflow Automation', duration: '14:20', thumbnail: '⚡', type: 'video' as const, path: 'tutorials/07-automation.md' },
  { id: 'export-3dsmax', title: 'Export to 3ds Max', duration: '11:15', thumbnail: '🎯', type: 'video' as const, path: 'tutorials/08-export-3dsmax.md' },
  { id: 'materials', title: 'Mastering Materials', duration: '13:50', thumbnail: '🎨', type: 'video' as const, path: 'tutorials/09-materials.md' },
];

/**
 * Load markdown content from file
 * In a real app, this would use fetch or fs
 * For now, we return a placeholder with instructions
 */
export async function loadDocContent(path: string): Promise<string> {
  // In production, this would:
  // return await fetch(`/docs/${path}`).then(r => r.text());
  
  // For now, return a message about the content
  return `## ${path}

📄 This documentation file is available at:
**src/docs/${path}**

To view the full content, open this file in the project explorer or integrate with a markdown loader.

---

💡 **Tip**: The documentation modal should be updated to display markdown content with proper rendering.
`;
}

/**
 * Get all documentation categories
 */
export function getDocCategories(): DocCategory[] {
  return DOC_STRUCTURE;
}

/**
 * Get all video tutorials
 */
export function getVideoTutorials() {
  return VIDEO_TUTORIALS;
}

/**
 * Search documentation
 */
export function searchDocs(query: string): { categories: DocCategory[]; videos: typeof VIDEO_TUTORIALS } {
  const lowerQuery = query.toLowerCase();
  
  const filteredCategories = DOC_STRUCTURE.map(cat => ({
    ...cat,
    items: cat.items.filter(item => 
      item.title.toLowerCase().includes(lowerQuery)
    ),
  })).filter(cat => 
    cat.items.length > 0 || 
    cat.title.toLowerCase().includes(lowerQuery) ||
    cat.description.toLowerCase().includes(lowerQuery)
  );
  
  const filteredVideos = VIDEO_TUTORIALS.filter(vid =>
    vid.title.toLowerCase().includes(lowerQuery)
  );
  
  return { categories: filteredCategories, videos: filteredVideos };
}

/**
 * Get doc file by ID
 */
export function getDocById(id: string): DocFile | undefined {
  for (const cat of DOC_STRUCTURE) {
    const item = cat.items.find(i => i.id === id);
    if (item) return { ...item, category: cat.id };
  }
  return undefined;
}
