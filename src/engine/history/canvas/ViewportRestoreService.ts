export class ViewportRestoreService {
  static focusOnNode(fitView: (options?: any) => void, nodeId?: string): void {
    if (typeof fitView === 'function') {
      setTimeout(() => {
        fitView({ padding: 0.3, duration: 400 });
      }, 50);
    }
  }
}
