import React, { useState, useEffect } from 'react';
import { 
  Search, Download, Check, AlertCircle, 
  RefreshCw, ExternalLink, Settings, Plug, Trash2
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { ANARCHY_3DSMAX_SCRIPT } from './threeDsMaxPlugin';
import './IntegrationsPage.css';

interface Plugin {
  id: string;
  name: string;
  description: string;
  icon: '3dsmax' | 'revit' | 'sketchup' | 'archicad' | 'autocad';
  version: string;
  latestVersion: string;
  status: 'installed' | 'available' | 'update' | 'installing';
  downloadUrl?: string;
  docsUrl?: string;
  fileSize?: string;
  supportedVersions: string;
  features: string[];
  comingSoon?: boolean;
}

interface AutodeskInstall {
  version: string;
  path: string;
}

const PLUGINS: Plugin[] = [
  {
    id: '3dsmax',
    name: '3ds Max',
    description: 'Send the active 3ds Max viewport image to Anarchy AI Builder as a source node for AI image workflows.',
    icon: '3dsmax',
    version: '0.0',
    latestVersion: '1.2.0',
    status: 'available',
    fileSize: '12 MB',
    supportedVersions: '2022, 2023, 2024, 2025, 2026, 2027',
    features: ['Viewport rendering', 'Material sync', 'Camera export', 'Batch processing']
  },
  {
    id: 'revit',
    name: 'Revit',
    description: 'BIM-powered AI visualization. Transform Revit views into stunning renders with one click. Supports linked models.',
    icon: 'revit',
    version: '0.0',
    latestVersion: '2.0.1',
    status: 'available',
    fileSize: '18 MB',
    supportedVersions: '2022, 2023, 2024, 2025, 2026, 2027',
    features: ['3D View export', 'Sheet integration', 'Parameter sync', 'Family library']
  },
  {
    id: 'sketchup',
    name: 'SketchUp',
    description: 'Lightning-fast AI for SketchUp. Render scenes in seconds with styles matching your design workflow.',
    icon: 'sketchup',
    version: '0.0',
    latestVersion: '1.8.2',
    status: 'available',
    fileSize: '8 MB',
    supportedVersions: '2021, 2022, 2023, 2024',
    features: ['One-click render', 'Style presets', 'Component library', 'Shadow sync'],
    comingSoon: true
  },
  {
    id: 'archicad',
    name: 'ArchiCAD',
    description: 'Native ArchiCAD integration for architects. Export BIMx models or render directly from 3D views.',
    icon: 'archicad',
    version: '0.0',
    latestVersion: '1.5.0',
    status: 'available',
    fileSize: '15 MB',
    supportedVersions: '24, 25, 26, 27',
    features: ['3D Document export', 'BIMx integration', 'Surface sync', 'MEP support'],
    comingSoon: true
  },
  {
    id: 'autocad',
    name: 'AutoCAD',
    description: 'AI rendering for 2D drawings and 3D models. Transform CAD views into presentation-ready visuals.',
    icon: 'autocad',
    version: '0.0',
    latestVersion: '1.3.1',
    status: 'available',
    fileSize: '10 MB',
    supportedVersions: '2022, 2023, 2024, 2025',
    features: ['Modelspace rendering', 'Layout export', 'Layer support', 'Plot style sync']
  }
];

const SoftwareLogo: React.FC<{ id: Plugin['icon'] }> = ({ id }) => {
  if (id === '3dsmax') {
    return (
      <div className="software-logo autodesk-logo logo-3dsmax">
        <i className="autodesk-side" />
        <i className="autodesk-shadow" />
        <span>3</span>
      </div>
    );
  }

  if (id === 'revit') {
    return (
      <div className="software-logo autodesk-logo logo-revit">
        <i className="autodesk-side" />
        <i className="autodesk-shadow" />
        <span>R</span>
      </div>
    );
  }

  if (id === 'sketchup') {
    return (
      <div className="software-logo autodesk-logo logo-sketchup">
        <i className="autodesk-side" />
        <i className="autodesk-shadow" />
        <span>S</span>
      </div>
    );
  }

  if (id === 'archicad') {
    return (
      <div className="software-logo autodesk-logo logo-archicad">
        <i className="autodesk-side" />
        <i className="autodesk-shadow" />
        <span>C</span>
      </div>
    );
  }

  return (
    <div className="software-logo autodesk-logo logo-autocad">
      <i className="autodesk-side" />
      <i className="autodesk-shadow" />
      <span>A</span>
    </div>
  );
};

export const IntegrationsPage: React.FC = () => {
  const [plugins, setPlugins] = useState<Plugin[]>(PLUGINS);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'installed' | 'available'>('all');
  const [selected, setSelected] = useState<Plugin | null>(null);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [detectedInstalls, setDetectedInstalls] = useState<AutodeskInstall[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // Load installed versions and detect actual installations
  useEffect(() => {
    const checkPluginInstallations = async () => {
      const saved = localStorage.getItem('anarchy_plugins');
      let installedPlugins: any = {};
      
      if (saved) {
        installedPlugins = JSON.parse(saved);
      }

      // Check actual installation status for each plugin
      const updatedPlugins = await Promise.all(PLUGINS.map(async (plugin) => {
        let actualStatus: 'installed' | 'available' | 'update' = 'available';
        let detectedVersion = '0.0';

        try {
          // Check if plugin is actually installed on the system
          if (plugin.id === '3dsmax' || plugin.id === 'revit' || plugin.id === 'autocad') {
            const installs = await invoke<AutodeskInstall[]>('detect_autodesk_installs', {
              target: plugin.id,
            });
            
            if (installs.length > 0) {
              // Plugin is detected in system
              const savedPlugin = installedPlugins[plugin.id];
              if (savedPlugin) {
                detectedVersion = savedPlugin.version || plugin.latestVersion;
                actualStatus = savedPlugin.version === plugin.latestVersion ? 'installed' : 'update';
              } else {
                // Detected but not in localStorage - assume latest version
                detectedVersion = plugin.latestVersion;
                actualStatus = 'installed';
                
                // Update localStorage with detected installation
                installedPlugins[plugin.id] = {
                  version: plugin.latestVersion,
                  installedAt: Date.now(),
                  paths: installs.map(i => i.path),
                  detected: true
                };
              }
            }
          } else {
            // For other plugins, check localStorage only
            const savedPlugin = installedPlugins[plugin.id];
            if (savedPlugin) {
              detectedVersion = savedPlugin.version || plugin.latestVersion;
              actualStatus = savedPlugin.version === plugin.latestVersion ? 'installed' : 'update';
            }
          }
        } catch (error) {
          console.warn(`Failed to detect ${plugin.name} installation:`, error);
          // Fallback to localStorage check
          const savedPlugin = installedPlugins[plugin.id];
          if (savedPlugin) {
            detectedVersion = savedPlugin.version || plugin.latestVersion;
            actualStatus = savedPlugin.version === plugin.latestVersion ? 'installed' : 'update';
          }
        }

        return {
          ...plugin,
          version: detectedVersion,
          status: actualStatus
        };
      }));

      // Update localStorage with any new detections
      localStorage.setItem('anarchy_plugins', JSON.stringify(installedPlugins));
      setPlugins(updatedPlugins);
    };

    checkPluginInstallations();
  }, []);

  // Manual refresh function
  const refreshPluginStatus = async () => {
    setIsScanning(true);
    try {
      const saved = localStorage.getItem('anarchy_plugins');
      let installedPlugins: any = {};
      
      if (saved) {
        installedPlugins = JSON.parse(saved);
      }

      const updatedPlugins = await Promise.all(PLUGINS.map(async (plugin) => {
        let actualStatus: 'installed' | 'available' | 'update' = 'available';
        let detectedVersion = '0.0';

        try {
          if (plugin.id === '3dsmax' || plugin.id === 'revit' || plugin.id === 'autocad') {
            const installs = await invoke<AutodeskInstall[]>('detect_autodesk_installs', {
              target: plugin.id,
            });
            
            if (installs.length > 0) {
              const savedPlugin = installedPlugins[plugin.id];
              if (savedPlugin) {
                detectedVersion = savedPlugin.version || plugin.latestVersion;
                actualStatus = savedPlugin.version === plugin.latestVersion ? 'installed' : 'update';
              } else {
                detectedVersion = plugin.latestVersion;
                actualStatus = 'installed';
                installedPlugins[plugin.id] = {
                  version: plugin.latestVersion,
                  installedAt: Date.now(),
                  paths: installs.map(i => i.path),
                  detected: true
                };
              }
            }
          } else {
            const savedPlugin = installedPlugins[plugin.id];
            if (savedPlugin) {
              detectedVersion = savedPlugin.version || plugin.latestVersion;
              actualStatus = savedPlugin.version === plugin.latestVersion ? 'installed' : 'update';
            }
          }
        } catch (error) {
          console.warn(`Failed to detect ${plugin.name} installation:`, error);
          const savedPlugin = installedPlugins[plugin.id];
          if (savedPlugin) {
            detectedVersion = savedPlugin.version || plugin.latestVersion;
            actualStatus = savedPlugin.version === plugin.latestVersion ? 'installed' : 'update';
          }
        }

        return {
          ...plugin,
          version: detectedVersion,
          status: actualStatus
        };
      }));

      localStorage.setItem('anarchy_plugins', JSON.stringify(installedPlugins));
      setPlugins(updatedPlugins);
    } finally {
      setIsScanning(false);
    }
  };

  const loadDetectedInstalls = async (plugin: Plugin) => {
    if (plugin.id !== '3dsmax' && plugin.id !== 'revit' && plugin.id !== 'autocad') {
      setDetectedInstalls([]);
      setSelectedVersions([]);
      return;
    }

    try {
      const installs = await invoke<AutodeskInstall[]>('detect_autodesk_installs', {
        target: plugin.id,
      });
      setDetectedInstalls(installs);
      setSelectedVersions(installs.map(install => install.version));
    } catch (error) {
      setDetectedInstalls([]);
      setSelectedVersions([]);
      setInstallMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const openPluginDetails = (plugin: Plugin) => {
    setSelected(plugin);
    setInstallMessage(null);
    setShowInstructions(false);
    loadDetectedInstalls(plugin);
  };

  const toggleSelectedVersion = (version: string) => {
    setSelectedVersions(prev => (
      prev.includes(version)
        ? prev.filter(v => v !== version)
        : [...prev, version]
    ));
  };

  const handleInstall = async (plugin: Plugin, keepModalOpen = false) => {
    setInstallMessage(null);
    setPlugins(prev => prev.map(p => 
      p.id === plugin.id ? { ...p, status: 'installing' } : p
    ));

    try {
      let installedPaths: string[] = [];
      if (plugin.id === '3dsmax') {
        installedPaths = await invoke<string[]>('install_3dsmax_plugin', {
          script: ANARCHY_3DSMAX_SCRIPT,
          versions: selectedVersions,
        });
      } else if (plugin.id === 'revit') {
        installedPaths = await invoke<string[]>('install_revit_plugin', {
          versions: selectedVersions,
        });
      } else if (plugin.id === 'autocad') {
        installedPaths = await invoke<string[]>('install_autocad_plugin', {
          versions: selectedVersions,
        });
      } else {
        await new Promise(resolve => setTimeout(resolve, 1200));
      }

      const updated = { ...plugin, version: plugin.latestVersion, status: 'installed' as const };
      setPlugins(prev => prev.map(p => p.id === plugin.id ? updated : p));
      
      const saved = JSON.parse(localStorage.getItem('anarchy_plugins') || '{}');
      saved[plugin.id] = { version: plugin.latestVersion, installedAt: Date.now(), paths: installedPaths };
      localStorage.setItem('anarchy_plugins', JSON.stringify(saved));

      if (plugin.id === '3dsmax' || plugin.id === 'revit' || plugin.id === 'autocad' || keepModalOpen) {
        setSelected(updated);
        setShowInstructions(true);
        if (plugin.id === 'revit') {
          setInstallMessage(`Installed to ${installedPaths.length / 2} Revit version(s). Restart Revit — you will find the "Anarchy" tab with a "Send to Anarchy" button.`);
        } else if (plugin.id === 'autocad') {
          setInstallMessage(`Installed as Autoloader bundle. Restart AutoCAD — you will find the "Anarchy" tab in the ribbon, or type ANARCHYSEND in the command line.`);
        } else {
          setInstallMessage(`Installed to ${installedPaths.length} 3ds Max profile(s). Restart 3ds Max, then find it under Customize > Customize User Interface > Toolbars > Category: Anarchy.`);
        }
      } else {
        setSelected(null);
      }
    } catch (error) {
      setPlugins(prev => prev.map(p => p.id === plugin.id ? { ...p, status: 'available' } : p));
      setInstallMessage(error instanceof Error ? error.message : String(error));
      setShowInstructions(true);
    }
  };

  const handleRemoveOldPlugin = async (plugin: Plugin) => {
    if (plugin.id !== '3dsmax' && plugin.id !== 'revit' && plugin.id !== 'autocad') return;

    setInstallMessage(null);

    try {
      const removedPaths = await invoke<string[]>('remove_old_autodesk_plugins', {
        target: plugin.id,
      });

      const saved = JSON.parse(localStorage.getItem('anarchy_plugins') || '{}');
      delete saved[plugin.id];
      localStorage.setItem('anarchy_plugins', JSON.stringify(saved));

      const updated = { ...plugin, version: '0.0', status: 'available' as const };
      setPlugins(prev => prev.map(p => p.id === plugin.id ? updated : p));
      setSelected(updated);
      setShowInstructions(true);
      setInstallMessage(
        removedPaths.length > 0
          ? `Removed ${removedPaths.length} old ${plugin.name} plugin file(s). Restart ${plugin.name}.`
          : `No old ${plugin.name} plugin files were found in the known Autodesk folders.`
      );
    } catch (error) {
      setInstallMessage(error instanceof Error ? error.message : String(error));
      setShowInstructions(true);
    }
  };

  const filtered = plugins.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'installed') return p.status === 'installed' || p.status === 'update';
    if (filter === 'available') return p.status === 'available';
    return true;
  });

  const installedCount = plugins.filter(p => p.status === 'installed' || p.status === 'update').length;
  const needsUpdate = plugins.filter(p => p.status === 'update').length;

  return (
    <div className="integrations-page">
      {/* Header */}
      <div className="int-header">
        <div className="int-header-left">
          <div className="int-title-row">
            <Plug size={22} className="int-title-icon" />
            <h1 className="page-title">Integrations</h1>
          </div>
          <p className="int-subtitle">Connect Anarchy AI with your architectural software</p>
        </div>
        <div className="int-header-right">
          <button 
            className="int-refresh-btn"
            onClick={refreshPluginStatus}
            disabled={isScanning}
            title="Scan computer for installed plugins"
          >
            <RefreshCw size={16} className={isScanning ? 'spin' : ''} />
            {isScanning ? 'Scanning...' : 'Refresh'}
          </button>
          <div className="int-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search plugins..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="int-stats">
        <div className="int-stat">
          <span className="int-stat-val">{installedCount}</span>
          <span className="int-stat-label">Installed</span>
        </div>
        <div className="int-stat">
          <span className="int-stat-val">{plugins.length - installedCount}</span>
          <span className="int-stat-label">Available</span>
        </div>
        {needsUpdate > 0 && (
          <div className="int-stat highlight">
            <span className="int-stat-val">{needsUpdate}</span>
            <span className="int-stat-label">Updates</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="int-filters">
        {(['all', 'installed', 'available'] as const).map(f => (
          <button
            key={f}
            className={`int-filter ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Plugins Grid */}
      <div className="int-grid">
        {filtered.map(plugin => (
          <div 
            key={plugin.id} 
            className={`int-card ${plugin.status} ${plugin.comingSoon ? 'coming-soon' : ''}`}
            onClick={() => { if (!plugin.comingSoon) openPluginDetails(plugin); }}
          >
            <div className="int-card-header">
              <div className="int-icon"><SoftwareLogo id={plugin.icon} /></div>
              <div className="int-card-meta">
                {plugin.status === 'installed' && (
                  <span className="int-badge installed"><Check size={10} /> Installed</span>
                )}
                {plugin.status === 'update' && (
                  <span className="int-badge update">Update</span>
                )}
                {plugin.status === 'installing' && (
                  <span className="int-badge installing"><RefreshCw size={10} className="spin" /> Installing</span>
                )}
                {plugin.status === 'available' && !plugin.comingSoon && (
                  <span className="int-badge available">Available</span>
                )}
                {plugin.comingSoon && (
                  <span className="int-badge coming-soon">Coming Soon</span>
                )}
              </div>
            </div>
            
            <h3 className="int-card-title">{plugin.name}</h3>
            <p className="int-card-desc">{plugin.description}</p>
            
            <div className="int-card-footer">
              <div className="int-versions">
                <span className="int-ver-label">Latest:</span>
                <span className="int-ver-val">v{plugin.latestVersion}</span>
                {plugin.status !== 'available' && (
                  <>
                    <span className="int-ver-sep">•</span>
                    <span className="int-ver-current">v{plugin.version}</span>
                  </>
                )}
              </div>
              <span className="int-filesize">{plugin.fileSize}</span>
            </div>

            {plugin.status === 'update' && (
              <div className="int-update-bar">
                <AlertCircle size={12} />
                <span>New version available</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="int-overlay" onClick={() => {
          setSelected(null);
          setInstallMessage(null);
          setShowInstructions(false);
        }}>
          <div className="int-modal" onClick={e => e.stopPropagation()}>
            <button className="int-modal-close" onClick={() => {
              setSelected(null);
              setInstallMessage(null);
              setShowInstructions(false);
            }}>
              ×
            </button>
            
            <div className="int-modal-header">
              <div className="int-modal-icon"><SoftwareLogo id={selected.icon} /></div>
              <div className="int-modal-info">
                <h2>{selected.name}</h2>
                <div className="int-modal-badges">
                  {selected.status === 'installed' && (
                    <span className="int-badge installed"><Check size={10} /> Installed v{selected.version}</span>
                  )}
                  {selected.status === 'update' && (
                    <span className="int-badge update">v{selected.version} → v{selected.latestVersion}</span>
                  )}
                  {selected.status === 'available' && (
                    <span className="int-badge available">v{selected.latestVersion}</span>
                  )}
                </div>
              </div>
            </div>

            <p className="int-modal-desc">{selected.description}</p>

            <div className="int-modal-section">
              <h4>Features</h4>
              <div className="int-features">
                {selected.features.map((f, i) => (
                  <span key={i} className="int-feature">{f}</span>
                ))}
              </div>
            </div>

            <div className="int-modal-section">
              <h4>Compatibility</h4>
              <p className="int-compat">{selected.name} {selected.supportedVersions}</p>
            </div>

            {(selected.id === '3dsmax' || selected.id === 'revit' || selected.id === 'autocad') && (
              <div className="int-modal-section">
                <h4>Detected Installed Versions</h4>
                {detectedInstalls.length > 0 ? (
                  <div className="int-version-list">
                    {detectedInstalls.map(install => (
                      <label key={`${install.version}-${install.path}`} className="int-version-option">
                        <input
                          type="checkbox"
                          checked={selectedVersions.includes(install.version)}
                          onChange={() => toggleSelectedVersion(install.version)}
                        />
                        <span>
                          <strong>{selected.name} {install.version}</strong>
                          <small>{install.path}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="int-compat">No installed {selected.name} versions detected yet. Open {selected.name} once, then return here.</p>
                )}
              </div>
            )}

            {showInstructions && selected.id === '3dsmax' && (
              <div className="int-modal-section">
                <div className="int-doc-panel">
                  <h4>How to use inside 3ds Max</h4>
                  <ol>
                    <li>Restart 3ds Max after installation.</li>
                    <li>Open Customize → Customize User Interface.</li>
                    <li>Open the Toolbars tab.</li>
                    <li>Choose Category: Anarchy.</li>
                    <li>Drag the Anarchy command to the top toolbar.</li>
                    <li>Open Anarchy AI Builder, then click the red A button in 3ds Max.</li>
                  </ol>
                  <p>The active viewport image will arrive as a Source Node in the Builder canvas.</p>
                </div>
              </div>
            )}

            {showInstructions && selected.id === 'revit' && (
              <div className="int-modal-section">
                <div className="int-doc-panel">
                  <h4>Revit installation & usage</h4>
                  <ol>
                    <li>Close Revit before installing.</li>
                    <li>Select the detected Revit version(s) above and click Install Plugin.</li>
                    <li>The plugin is compiled against your Revit API and installed to %APPDATA%\Autodesk\Revit\Addins.</li>
                    <li>Open Revit — a new <strong>Anarchy</strong> tab will appear in the ribbon.</li>
                    <li>Open any project, set the desired view, then click <strong>Send to Anarchy</strong>.</li>
                    <li>The current view image is sent to the Builder canvas as a Source Node.</li>
                  </ol>
                  <p><strong>Requirements:</strong> Revit 2022-2024 installed under Program Files\Autodesk. Revit 2025+ uses .NET 8 and is not yet supported.</p>
                </div>
              </div>
            )}

            {showInstructions && selected.id === 'autocad' && (
              <div className="int-modal-section">
                <div className="int-doc-panel">
                  <h4>AutoCAD installation & usage</h4>
                  <ol>
                    <li>Close AutoCAD before installing.</li>
                    <li>Select the detected AutoCAD version(s) above and click Install Plugin.</li>
                    <li>The plugin is installed as an Autoloader bundle under %APPDATA%\Autodesk\ApplicationPlugins\AnarchyAutoCAD.bundle.</li>
                    <li>Open AutoCAD — a new <strong>Anarchy</strong> tab will appear in the ribbon.</li>
                    <li>Click <strong>Send to Anarchy</strong>, or type <code>ANARCHYSEND</code> in the command line.</li>
                    <li>The current drawing view is captured and sent to the Builder canvas as a Source Node.</li>
                  </ol>
                  <p><strong>Requirements:</strong> AutoCAD 2022-2025 installed under Program Files\Autodesk. For 2025 support, .NET 8 SDK must be installed.</p>
                </div>
              </div>
            )}

            {installMessage && (selected.id === '3dsmax' || selected.id === 'revit' || selected.id === 'autocad') && (
              <div className="int-modal-section">
                <div className="int-install-message">
                  <AlertCircle size={14} />
                  <span>{installMessage}</span>
                </div>
              </div>
            )}

            <div className="int-modal-actions">
              {selected.status === 'available' && (
                <button 
                  className="int-btn primary"
                  onClick={() => handleInstall(selected)}
                  disabled={(selected.id === '3dsmax' || selected.id === 'revit' || selected.id === 'autocad') && selectedVersions.length === 0}
                >
                  <Download size={16} />
                  Install Plugin
                </button>
              )}
              {selected.status === 'installing' && (
                <button className="int-btn primary" disabled>
                  <RefreshCw size={16} className="spin" />
                  Installing...
                </button>
              )}
              {selected.status === 'installed' && (
                <>
                  <button
                    className="int-btn secondary"
                    onClick={() => handleInstall(selected, true)}
                    disabled={(selected.id === '3dsmax' || selected.id === 'revit' || selected.id === 'autocad') && selectedVersions.length === 0}
                  >
                    <Settings size={16} />
                    Reinstall / Configure
                  </button>
                  {(selected.id === '3dsmax' || selected.id === 'revit' || selected.id === 'autocad') && (
                    <button className="int-btn danger" onClick={() => handleRemoveOldPlugin(selected)}>
                      <Trash2 size={16} />
                      Remove Old Plugin
                    </button>
                  )}
                  <button className="int-btn secondary" onClick={() => setShowInstructions(prev => !prev)}>
                    <ExternalLink size={16} />
                    {showInstructions ? 'Hide Instructions' : 'Documentation'}
                  </button>
                </>
              )}
              {selected.status === 'update' && (
                <>
                  <button 
                    className="int-btn primary"
                    onClick={() => handleInstall(selected)}
                  >
                    <RefreshCw size={16} />
                    Update to v{selected.latestVersion}
                  </button>
                  {(selected.id === '3dsmax' || selected.id === 'revit' || selected.id === 'autocad') && (
                    <button className="int-btn danger" onClick={() => handleRemoveOldPlugin(selected)}>
                      <Trash2 size={16} />
                      Remove Old Plugin
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
