export class ViewportRestoreService {
  static focusOnNode(fitView: (options?: any) => void, _nodeId?: string): void {
    if (typeof fitView === 'function') {
      setTimeout(() => {
        fitView({ padding: 0.3, duration: 400 });
      }, 50);
    }
  }
}
