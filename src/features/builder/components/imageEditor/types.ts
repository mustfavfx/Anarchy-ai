export type ActiveToolType = 'markup' | 'comment' | 'removeBg' | 'erase' | 'resize' | null;

export interface CommentPin {
  id: string;
  xPct: number; // 0 - 100
  yPct: number; // 0 - 100
  text: string;
  num: number;
}

export const PRESET_COLORS = [
  '#ffffff', // White
  '#ef4444', // Red
  '#f59e0b', // Yellow
  '#10b981', // Green
  '#3b82f6', // Blue
  '#000000', // Black
];

export interface ResizeRatioOption {
  id: string;
  name: string;
  ratio: string;
  wireframeClass: string;
  wRatio: number;
  hRatio: number;
}

export const RESIZE_OPTIONS: ResizeRatioOption[] = [
  { id: '1:1', name: 'Square', ratio: '1:1', wireframeClass: 'wf-square', wRatio: 1, hRatio: 1 },
  { id: '3:4', name: 'Portrait', ratio: '3:4', wireframeClass: 'wf-portrait', wRatio: 3, hRatio: 4 },
  { id: '9:16', name: 'Story', ratio: '9:16', wireframeClass: 'wf-story', wRatio: 9, hRatio: 16 },
  { id: '4:3', name: 'Landscape', ratio: '4:3', wireframeClass: 'wf-landscape', wRatio: 4, hRatio: 3 },
  { id: '16:9', name: 'Widescreen', ratio: '16:9', wireframeClass: 'wf-widescreen', wRatio: 16, hRatio: 9 },
];
