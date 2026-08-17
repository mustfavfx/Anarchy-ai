import { buildWorkflowTimeline, type TimelineStep } from '@/services/history/WorkflowTimelineService';
import type { HistoryEntry, NodeTreeData } from '@/types/history';

export type { TimelineStep };

export class TimelineEngine {
  static build(entry: HistoryEntry, nodeTree: NodeTreeData | null): TimelineStep[] {
    return buildWorkflowTimeline(entry, nodeTree);
  }
}
