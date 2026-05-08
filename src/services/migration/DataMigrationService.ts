/**
 * Data Migration Service
 * Export and import all app data for easy transfer between devices
 */

export interface AppDataExport {
  version: string;
  exportedAt: string;
  data: {
    settings: string | null;
    history: string | null;
    workflows: string | null;
    library: string | null;
  };
}

export const DataMigrationService = {
  /**
   * Export all application data
   */
  exportAll(): AppDataExport {
    const data: AppDataExport = {
      version: '0.7.0',
      exportedAt: new Date().toISOString(),
      data: {
        settings: localStorage.getItem('anarchy_settings'),
        history: localStorage.getItem('anarchy_history'),
        workflows: localStorage.getItem('anarchy_workflows'),
        library: localStorage.getItem('anarchy_library'),
      }
    };
    return data;
  },

  /**
   * Export to JSON file (downloads file)
   */
  exportToFile(): void {
    const data = this.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `anarchy-ai-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Import from JSON string
   */
  importFromJSON(jsonString: string): boolean {
    try {
      const data: AppDataExport = JSON.parse(jsonString);
      
      // Validate structure
      if (!data.version || !data.data) {
        throw new Error('Invalid backup file format');
      }

      // Import each data type
      if (data.data.settings) {
        localStorage.setItem('anarchy_settings', data.data.settings);
      }
      if (data.data.history) {
        localStorage.setItem('anarchy_history', data.data.history);
      }
      if (data.data.workflows) {
        localStorage.setItem('anarchy_workflows', data.data.workflows);
      }
      if (data.data.library) {
        localStorage.setItem('anarchy_library', data.data.library);
      }

      return true;
    } catch (error) {
      console.error('[DataMigration] Import failed:', error);
      return false;
    }
  },

  /**
   * Import from file
   */
  async importFromFile(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          resolve(this.importFromJSON(content));
        } else {
          resolve(false);
        }
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file);
    });
  },

  /**
   * Clear all application data
   */
  clearAll(): void {
    const keys = [
      'anarchy_settings',
      'anarchy_history',
      'anarchy_workflows',
      'anarchy_library'
    ];
    keys.forEach(key => localStorage.removeItem(key));
  },

  /**
   * Get data statistics for display
   */
  getStats(): {
    settings: boolean;
    history: number;
    workflows: number;
    totalSize: string;
  } {
    let totalSize = 0;
    
    const settings = localStorage.getItem('anarchy_settings');
    const history = localStorage.getItem('anarchy_history');
    const workflows = localStorage.getItem('anarchy_workflows');
    
    if (settings) totalSize += settings.length;
    if (history) totalSize += history.length;
    if (workflows) totalSize += workflows.length;

    return {
      settings: !!settings,
      history: history ? JSON.parse(history).length : 0,
      workflows: workflows ? JSON.parse(workflows).length : 0,
      totalSize: `${(totalSize / 1024).toFixed(1)} KB`
    };
  }
};

export default DataMigrationService;
