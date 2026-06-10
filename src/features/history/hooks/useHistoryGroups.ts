import { useHistoryStore } from '../stores/historyStore';

export function useHistoryGroups() {
  const {
    isGroupedView,
    setIsGroupedView,
    activeGroup,
    setActiveGroup,
    groupedGroups
  } = useHistoryStore();

  return {
    isGroupedView,
    setIsGroupedView,
    activeGroup,
    setActiveGroup,
    groupedGroups
  };
}
