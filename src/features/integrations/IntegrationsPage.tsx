import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { 
  Download, Check, AlertCircle, 
  ExternalLink, Settings, Plug, Trash2, RefreshCw
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { ANARCHY_3DSMAX_SCRIPT } from './threeDsMaxPlugin';
import './IntegrationsPage.css';

interface Plugin {
  id: string;
  name: string;
  description: string;
  icon: '3dsmax' | 'revit' | 'sketchup' | 'archicad';
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
  }
];

// All versions supported for each Autodesk product
const SUPPORTED_VERSIONS: Record<string, string[]> = {
  '3dsmax': ['2022', '2023', '2024', '2025', '2026', '2027'],
  'revit':  ['2022', '2023', '2024', '2025', '2026', '2027'],
};

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

  return (
    <div className="software-logo autodesk-logo logo-archicad">
      <i className="autodesk-side" />
      <i className="autodesk-shadow" />
      <span>C</span>
    </div>
  );
};

const AUTODESK_IDS = new Set(['3dsmax', 'revit']);

async function resolvePluginStatus(
  plugin: Plugin,
  installedPlugins: Record<string, { version: string; installedAt: number; paths: string[]; detected?: boolean }>
): Promise<{ version: string; status: 'installed' | 'available' | 'update'; installedPlugins: typeof installedPlugins }> {
  let actualStatus: 'installed' | 'available' | 'update' = 'available';
  let detectedVersion = '0.0';

  try {
    if (AUTODESK_IDS.has(plugin.id)) {
      const installs = (await invoke<AutodeskInstall[]>('detect_autodesk_installs', { target: plugin.id })) || [];
      if (Array.isArray(installs) && installs.length > 0) {
        const saved = installedPlugins[plugin.id];
        if (saved) {
          detectedVersion = saved.version || plugin.latestVersion;
          actualStatus = saved.version === plugin.latestVersion ? 'installed' : 'update';
        } else {
          const isInstalled = await invoke<boolean>('is_plugin_installed', { target: plugin.id });
          if (isInstalled) {
            detectedVersion = plugin.latestVersion;
            actualStatus = 'installed';
            installedPlugins[plugin.id] = { version: plugin.latestVersion, installedAt: Date.now(), paths: installs.map(i => i.path), detected: true };
          } else {
            actualStatus = 'available';
          }
        }
      }
    } else {
      const saved = installedPlugins[plugin.id];
      if (saved) {
        detectedVersion = saved.version || plugin.latestVersion;
        actualStatus = saved.version === plugin.latestVersion ? 'installed' : 'update';
      }
    }
  } catch (error) {
    logger.warn(`Failed to detect ${plugin.name} installation:`, error);
    const saved = installedPlugins[plugin.id];
    if (saved) {
      detectedVersion = saved.version || plugin.latestVersion;
      actualStatus = saved.version === plugin.latestVersion ? 'installed' : 'update';
    }
  }

  return { version: detectedVersion, status: actualStatus, installedPlugins };
}

const handleOpenUrl = async (url: string) => {
  try {
    await invoke('open_url', { url });
  } catch (err) {
    window.open(url, '_blank');
  }
};

const renderInstallMessage = (msg: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = msg.split(urlRegex);
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a 
          key={index} 
          href={part} 
          onClick={(e) => { e.preventDefault(); handleOpenUrl(part); }}
          className="int-message-link"
          style={{ color: 'var(--accent-red)', textDecoration: 'underline', cursor: 'pointer' }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export const IntegrationsPage: React.FC = () => {
  const [plugins, setPlugins] = useState<Plugin[]>(PLUGINS);
  const [filter, setFilter] = useState<'all' | 'installed' | 'available'>('all');
  const [selected, setSelected] = useState<Plugin | null>(null);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [detectedInstalls, setDetectedInstalls] = useState<AutodeskInstall[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [notified, setNotified] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('anarchy_plugin_notify') || '[]')); }
    catch { return new Set(); }
  });

  // Load installed versions and detect actual installations
  useEffect(() => {
    const checkPluginInstallations = async () => {
      let installedPlugins: Record<string, any> = {};
      try { installedPlugins = JSON.parse(localStorage.getItem('anarchy_plugins') || '{}'); } catch { /* ignore */ }

      const updatedPlugins = await Promise.all(PLUGINS.map(async (plugin) => {
        const result = await resolvePluginStatus(plugin, installedPlugins);
        installedPlugins = result.installedPlugins;
        return { ...plugin, version: result.version, status: result.status };
      }));

      localStorage.setItem('anarchy_plugins', JSON.stringify(installedPlugins));
      setPlugins(updatedPlugins);
    };

    checkPluginInstallations();
  }, []);



  const loadDetectedInstalls = async (plugin: Plugin) => {
    if (plugin.id !== '3dsmax' && plugin.id !== 'revit') {
      setDetectedInstalls([]);
      setSelectedVersions([]);
      return;
    }

    try {
      const installs = (await invoke<AutodeskInstall[]>('detect_autodesk_installs', {
        target: plugin.id,
      })) || [];
      setDetectedInstalls(installs);
      setSelectedVersions(Array.isArray(installs) ? installs.map(install => install.version) : []);
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
      } else {
        await new Promise(resolve => setTimeout(resolve, 1200));
      }

      const updated = { ...plugin, version: plugin.latestVersion, status: 'installed' as const };
      setPlugins(prev => prev.map(p => p.id === plugin.id ? updated : p));
      
      const saved = JSON.parse(localStorage.getItem('anarchy_plugins') || '{}');
      saved[plugin.id] = { version: plugin.latestVersion, installedAt: Date.now(), paths: installedPaths };
      localStorage.setItem('anarchy_plugins', JSON.stringify(saved));

      if (plugin.id === '3dsmax' || plugin.id === 'revit' || keepModalOpen) {
        setSelected(updated);
        setShowInstructions(true);
        if (plugin.id === 'revit') {
          setInstallMessage(`Installed to ${installedPaths.length / 2} Revit version(s). Restart Revit — you will find the "Anarchy" tab with a "Send to Anarchy" button.`);
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
    if (plugin.id !== '3dsmax' && plugin.id !== 'revit') return;

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

  const handleNotify = (e: React.MouseEvent, pluginId: string) => {
    e.stopPropagation();
    setNotified(prev => {
      const next = new Set(prev);
      if (next.has(pluginId)) { next.delete(pluginId); } else { next.add(pluginId); }
      localStorage.setItem('anarchy_plugin_notify', JSON.stringify([...next]));
      return next;
    });
  };

  const filtered = plugins.filter(p => {
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
        {filtered.map(plugin => plugin.comingSoon ? (
          <div
            key={plugin.id}
            className={`int-card ${plugin.status} coming-soon`}
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
            <button
              className={`int-notify-btn ${notified.has(plugin.id) ? 'notified' : ''}`}
              onClick={() => handleNotify({ stopPropagation: () => {} } as React.MouseEvent, plugin.id)}
              title={notified.has(plugin.id) ? 'Click to cancel notification' : 'Notify me when available'}
            >
              {notified.has(plugin.id) ? <><Check size={12} /> Notified</> : '🔔 Notify Me'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            key={plugin.id}
            className={`int-card ${plugin.status}`}
            onClick={() => openPluginDetails(plugin)}
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
                {plugin.status === 'available' && (
                  <span className="int-badge available">Available</span>
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
                  <><span className="int-ver-sep">•</span><span className="int-ver-current">v{plugin.version}</span></>
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
          </button>
        ))}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="int-overlay">
          <button
            type="button"
            className="int-overlay-backdrop"
            aria-label="Close plugin details"
            onClick={() => { setSelected(null); setInstallMessage(null); setShowInstructions(false); }}
          />
          <dialog
            className="int-modal"
            open
            aria-label={`${selected.name} plugin details`}
          >
            <button
              className="int-modal-close"
              autoFocus
              onClick={() => { setSelected(null); setInstallMessage(null); setShowInstructions(false); }}
              onKeyDown={e => { if (e.key === 'Escape') { setSelected(null); setInstallMessage(null); setShowInstructions(false); } }}
            >
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
                {selected.features.map((f) => (
                  <span key={f} className="int-feature">{f}</span>
                ))}
              </div>
            </div>

            <div className="int-modal-section">
              <h4>Compatibility</h4>
              <p className="int-compat">{selected.name} {selected.supportedVersions}</p>
            </div>

            {(selected.id === '3dsmax' || selected.id === 'revit') && (() => {
              const allVersions = SUPPORTED_VERSIONS[selected.id] || [];
              const detectedSet = new Set(detectedInstalls.map(i => i.version));
              // Keep natural ascending order (2022 → 2027); detected versions highlighted in place

              return (
                <div className="int-modal-section">
                  <h4>
                    Select Versions to Install
                    {detectedInstalls.length > 0 && (
                      <span className="int-section-hint"> — {detectedInstalls.length} detected on this machine</span>
                    )}
                  </h4>
                  <div className="int-version-grid">
                    {allVersions.map(ver => {
                      const isDetected = detectedSet.has(ver);
                      const isSelected = selectedVersions.includes(ver);
                      return (
                        <label
                          key={ver}
                          className={`int-version-option ${isDetected ? 'detected' : ''} ${isSelected ? 'checked' : ''}`}
                          aria-label={`${selected.name} ${ver}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectedVersion(ver)}
                            aria-label={`Select ${selected.name} ${ver}`}
                          />
                          <strong className="int-version-name">{selected.name} {ver}</strong>
                          {isDetected && (
                            <span className="int-version-detected">
                              <Check size={10} />
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  {detectedInstalls.length === 0 && (
                    <p className="int-compat-hint">No versions detected. Select manually to install.</p>
                  )}
                </div>
              );
            })()}

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

            {/* AutoCAD instructions removed */}

            {installMessage && (selected.id === '3dsmax' || selected.id === 'revit') && (
              <div className="int-modal-section">
                <div className="int-install-message">
                  <AlertCircle size={14} />
                  <span>{renderInstallMessage(installMessage)}</span>
                </div>
              </div>
            )}

            <div className="int-modal-actions">
              {selected.status === 'available' && (
                <button 
                  className="int-btn primary"
                  onClick={() => handleInstall(selected)}
                  disabled={(selected.id === '3dsmax' || selected.id === 'revit') && selectedVersions.length === 0}
                >
                  <Download size={14} />
                  Install
                </button>
              )}
              {selected.status === 'installing' && (
                <button className="int-btn primary" disabled>
                  <RefreshCw size={14} className="spin" />
                  Installing...
                </button>
              )}
              {selected.status === 'installed' && (
                <>
                  <button
                    className="int-btn secondary"
                    onClick={() => handleInstall(selected, true)}
                    disabled={(selected.id === '3dsmax' || selected.id === 'revit') && selectedVersions.length === 0}
                  >
                    <Settings size={14} />
                    Reinstall
                  </button>
                  {(selected.id === '3dsmax' || selected.id === 'revit') && (
                    <button className="int-btn danger" onClick={() => handleRemoveOldPlugin(selected)}>
                      <Trash2 size={14} />
                      Uninstall
                    </button>
                  )}
                  <button className="int-btn secondary" onClick={() => setShowInstructions(prev => !prev)}>
                    <ExternalLink size={14} />
                    {showInstructions ? 'Hide' : 'Docs'}
                  </button>
                </>
              )}
              {selected.status === 'update' && (
                <>
                  <button 
                    className="int-btn primary"
                    onClick={() => handleInstall(selected)}
                  >
                    <RefreshCw size={14} />
                    Update
                  </button>
                  {(selected.id === '3dsmax' || selected.id === 'revit') && (
                    <button className="int-btn danger" onClick={() => handleRemoveOldPlugin(selected)}>
                      <Trash2 size={14} />
                      Uninstall
                    </button>
                  )}
                </>
              )}
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
};
