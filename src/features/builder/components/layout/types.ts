/**
 * Layout Editor Types & Constants
 */

export interface LayoutRegion {
  label: string;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  prompt?: string;
  region_type?: string;
}

export interface LayoutData {
  width?: number;
  height?: number;
  regions: LayoutRegion[];
}

export interface TextOverlay {
  id: string;
  x: number;
  y: number;
  text: string;
  font: string;
  size: number;
  color: string;
  opacity: number;
}

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface ImageAdjustments {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  vibrance: number;
  temperature: number;
  tint: number;
  blend: string;
}

export interface CropBounds {
  x0: number; // percentage 0 - 1
  y0: number; // percentage 0 - 1
  x1: number; // percentage 0 - 1
  y1: number; // percentage 0 - 1
}

export interface LayoutEditorProps {
  rawImage?: string | null;
  image?: string | null;
  initialLayout?: any;
  onApplyResult: (newImageUrl: string) => void;
  onLayoutExtracted?: (extractedLayout: any) => void;
  className?: string;
  isEnlargedView?: boolean;
}

export interface TreeNode {
  originalIdx: number;
  reg: LayoutRegion;
  children: TreeNode[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  imageUrl?: string;
  isThinking?: boolean;
  time?: string;
}

export const REGION_COLORS = [
  '#8b5cf6', '#f43f5e', '#3b82f6', '#10b981', '#eab308',
  '#06b6d4', '#a855f7', '#f97316', '#ec4899', '#14b8a6',
];

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  blend: 'normal'
};

export const DEFAULT_CROP_BOUNDS: CropBounds = {
  x0: 0.05,
  y0: 0.05,
  x1: 0.95,
  y1: 0.95
};

export const buildReveHierarchyTree = (regions: LayoutRegion[], searchQuery: string): TreeNode[] => {
  const allNodes: TreeNode[] = regions
    .map((reg, idx) => ({ originalIdx: idx, reg, children: [] }))
    .filter(({ reg }) => !searchQuery || reg.label.toLowerCase().includes(searchQuery.toLowerCase()));

  if (allNodes.length === 0) return [];

  const sorted = [...allNodes].sort((a, b) => {
    const areaA = (a.reg.bbox.x1 - a.reg.bbox.x0) * (a.reg.bbox.y1 - a.reg.bbox.y0);
    const areaB = (b.reg.bbox.x1 - b.reg.bbox.x0) * (b.reg.bbox.y1 - b.reg.bbox.y0);
    return areaB - areaA;
  });

  const rootNodes: TreeNode[] = [];

  sorted.forEach(node => {
    let parentNode: TreeNode | null = null;
    let minParentArea = Infinity;

    sorted.forEach(candidateParent => {
      if (candidateParent.originalIdx === node.originalIdx) return;

      const pBox = candidateParent.reg.bbox;
      const cBox = node.reg.bbox;

      const interX0 = Math.max(pBox.x0, cBox.x0);
      const interY0 = Math.max(pBox.y0, cBox.y0);
      const interX1 = Math.min(pBox.x1, cBox.x1);
      const interY1 = Math.min(pBox.y1, cBox.y1);

      if (interX1 > interX0 && interY1 > interY0) {
        const interArea = (interX1 - interX0) * (interY1 - interY0);
        const childArea = (cBox.x1 - cBox.x0) * (cBox.y1 - cBox.y0);

        if (childArea > 0 && interArea / childArea >= 0.65) {
          const pArea = (pBox.x1 - pBox.x0) * (pBox.y1 - pBox.y0);
          if (pArea > childArea && pArea < minParentArea) {
            parentNode = candidateParent;
            minParentArea = pArea;
          }
        }
      }
    });

    if (parentNode) {
      (parentNode as TreeNode).children.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  return rootNodes;
};

export const ASPECT_RATIO_OPTIONS = [
  { label: 'Freeform', ratio: 'Freeform', sub: '' },
  { label: 'Story', ratio: '9:16', sub: '9:16' },
  { label: 'Instagram post', ratio: '4:5', sub: '4:5' },
  { label: 'Portrait', ratio: '3:4', sub: '3:4' },
  { label: 'Facebook post', ratio: '1:1', sub: '1:1' },
  { label: 'X banner', ratio: '3:1', sub: '3:1' },
  { label: 'Email header', ratio: '2:1', sub: '2:1' },
  { label: 'Poster', ratio: '2:3', sub: '2:3' },
  { label: 'Presentation', ratio: '4:3', sub: '4:3' },
  { label: 'Photo print', ratio: '3:2', sub: '3:2' },
  { label: 'Widescreen', ratio: '16:9', sub: '16:9' },
  { label: 'Cinematic', ratio: '21:9', sub: '21:9' },
  { label: 'LinkedIn banner', ratio: '4:1', sub: '4:1' },
];

export const RELAYOUT_CATEGORIES = [
  {
    category: 'Social',
    items: [
      { label: 'Story', ratio: '9:16' },
      { label: 'Instagram post', ratio: '4:5' },
      { label: 'Facebook post', ratio: '1:1' },
      { label: 'Pinterest Pin', ratio: '2:3' },
      { label: 'X banner', ratio: '3:1' },
      { label: 'LinkedIn banner', ratio: '4:1' },
      { label: 'YouTube thumbnail', ratio: '16:9' },
    ]
  },
  {
    category: 'Print',
    items: [
      { label: 'Poster', ratio: '2:3' },
      { label: 'Photo print', ratio: '3:2' },
      { label: 'A4', ratio: '210:297' },
    ]
  },
  {
    category: 'Screen',
    items: [
      { label: 'Widescreen', ratio: '16:9' },
      { label: 'Cinematic', ratio: '21:9' },
      { label: 'Presentation', ratio: '4:3' },
      { label: 'Email header', ratio: '2:1' },
    ]
  }
];

