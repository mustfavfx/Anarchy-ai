import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { 
  Download, Check, AlertCircle, 
  ExternalLink, Settings, Plug, Trash2, RefreshCw, FolderOpen,
  Film, Sparkles, ArrowLeft
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { ANARCHY_3DSMAX_SCRIPT } from './threeDsMaxPlugin';
import { VideoConverterModal } from './components/VideoConverterModal';
import './IntegrationsPage.css';
import logo3dsmax from '../../assets/3dsmax.png';
import logoRevit from '../../assets/revit.png';
import logoSketchup from '../../assets/sketchup.png';
import logoArchicad from '../../assets/archicad.png';

interface Plugin {
  id: string;
  name: string;
  description: string;
  icon: '3dsmax' | 'revit' | 'sketchup' | 'archicad' | 'video-converter';
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
    description: '5-Tool Suite: Send Viewport, Send VFB, 1-Click Instant AI Render, Multi-Camera Batch Render, and Plugin Settings.',
    icon: '3dsmax',
    version: '0.0',
    latestVersion: '1.2.0',
    status: 'available',
    fileSize: '12 MB',
    supportedVersions: '2022, 2023, 2024, 2025, 2026, 2027',
    features: ['1. Send Viewport', '2. Send VFB (Buffer)', '3. Instant AI Render', '4. Batch Camera Render', '5. Plugin Settings']
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
    supportedVersions: '2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027',
    features: ['Send Viewport', 'Instant AI Render', 'Batch Scenes Export', 'Camera & Metadata Sync']
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
  /*
  // Hidden temporarily per user request
  {
    id: 'video-converter',
    name: 'Video Converter Plugin',
    description: 'Dedicated GPU-accelerated video converter package for Windows x64. Generates smooth camera animations, frame interpolation, and video exports.',
    icon: 'video-converter',
    version: '1.0.0',
    latestVersion: '1.0.0',
    status: 'available',
    fileSize: '109.5 MB',
    supportedVersions: 'Windows x64',
    features: ['H.264 & ProRes GPU acceleration', '1080p / 4K camera orbits', 'Autonomous interpolation', 'Direct Builder Timeline sync']
  }
  */
];

// All versions supported for each 3D / CAD product
const SUPPORTED_VERSIONS: Record<string, string[]> = {
  '3dsmax':   ['2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027'],
  'revit':    ['2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027'],
  'sketchup': ['2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027'],
};

const SoftwareLogo: React.FC<{ id: Plugin['icon'] }> = ({ id }) => {
  if (id === 'video-converter') {
    return (
      <div className="software-logo logo-img-container" style={{ background: 'rgba(6, 182, 212, 0.12)', border: '1px solid rgba(6, 182, 212, 0.4)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Film size={22} style={{ color: '#22d3ee' }} />
      </div>
    );
  }

  let logoSrc = '';
  if (id === '3dsmax') logoSrc = logo3dsmax;
  else if (id === 'revit') logoSrc = logoRevit;
  else if (id === 'sketchup') logoSrc = logoSketchup;
  else if (id === 'archicad') logoSrc = logoArchicad;

  return (
    <div className="software-logo logo-img-container">
      <img src={logoSrc} alt={id} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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

  const [showVideoConverterModal, setShowVideoConverterModal] = useState(false);

  const handleVideoConverterInstalled = () => {
    const updated = {
      ...PLUGINS.find(p => p.id === 'video-converter')!,
      version: '1.0.0',
      status: 'installed' as const
    };
    setPlugins(prev => prev.map(p => p.id === 'video-converter' ? updated : p));
    const saved = JSON.parse(localStorage.getItem('anarchy_plugins') || '{}');
    saved['video-converter'] = { version: '1.0.0', installedAt: Date.now(), paths: ['C:\\Program Files\\Anarchy AI\\converter'] };
    localStorage.setItem('anarchy_plugins', JSON.stringify(saved));
  };

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
    if (plugin.id !== '3dsmax' && plugin.id !== 'revit' && plugin.id !== 'sketchup') {
      setDetectedInstalls([]);
      setSelectedVersions([]);
      return;
    }

    try {
      const installs = (await invoke<AutodeskInstall[]>('detect_autodesk_installs', {
        target: plugin.id,
      })) || [];

      if (Array.isArray(installs) && installs.length > 0) {
        setDetectedInstalls(installs);
        setSelectedVersions(installs.map(install => install.version));
      } else {
        // Fallback: Show all supported versions so user can select their version on any drive
        const versions = SUPPORTED_VERSIONS[plugin.id] || ['2022', '2023', '2024', '2025', '2026', '2027'];
        setDetectedInstalls(versions.map(v => ({ version: v, path: 'Custom / Standard Drive' })));
        setSelectedVersions(plugin.id === 'sketchup' ? ['2023', '2024', '2025', '2026'] : ['2024', '2025']);
      }
    } catch (error) {
      const versions = SUPPORTED_VERSIONS[plugin.id] || ['2022', '2023', '2024', '2025', '2026', '2027'];
      setDetectedInstalls(versions.map(v => ({ version: v, path: 'Custom / Standard Drive' })));
      setSelectedVersions(plugin.id === 'sketchup' ? ['2023', '2024', '2025', '2026'] : ['2024', '2025']);
      setInstallMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const handleBrowseCustomPath = async (plugin: Plugin) => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: `Select ${plugin.name} Installation Folder`,
      });

      if (selectedPath && typeof selectedPath === 'string') {
        const customInstall = await invoke<AutodeskInstall>('validate_custom_autodesk_path', {
          target: plugin.id,
          path: selectedPath,
        });

        if (customInstall && customInstall.version) {
          setDetectedInstalls(prev => {
            const filtered = prev.filter(i => i.version !== customInstall.version);
            return [...filtered, customInstall];
          });
          setSelectedVersions(prev => Array.from(new Set([...prev, customInstall.version])));
          setInstallMessage(`Added ${plugin.name} ${customInstall.version} from: ${customInstall.path}`);
        }
      }
    } catch (err) {
      logger.warn('Failed to pick custom folder:', err);
      setInstallMessage(err instanceof Error ? err.message : String(err));
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
    if (plugin.id === 'video-converter') {
      setShowVideoConverterModal(true);
      return;
    }

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
      } else if (plugin.id === 'sketchup') {
        installedPaths = await invoke<string[]>('install_sketchup_plugin', {
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

      if (plugin.id === '3dsmax' || plugin.id === 'revit' || plugin.id === 'sketchup' || keepModalOpen) {
        setSelected(updated);
        setShowInstructions(true);
        if (plugin.id === 'revit') {
          setInstallMessage(`Installed to ${installedPaths.length / 2} Revit version(s). Restart Revit — you will find the "Anarchy" tab with a "Send to Anarchy" button.`);
        } else if (plugin.id === 'sketchup') {
          setInstallMessage(`Installed successfully to ${installedPaths.length} SketchUp installation(s). Open or restart SketchUp — you will find the "Anarchy AI" Toolbar and Extensions menu.`);
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
    if (plugin.id !== '3dsmax' && plugin.id !== 'revit' && plugin.id !== 'sketchup') return;

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
          : `No old ${plugin.name} plugin files were found in known folders.`
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
                <div className="int-modal-title-row">
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
                <p className="int-modal-desc-inline">{selected.description}</p>
              </div>
            </div>

            {(selected.id === '3dsmax' || selected.id === 'revit') && (() => {
              const allVersions = SUPPORTED_VERSIONS[selected.id] || [];
              const detectedMap = new Map(detectedInstalls.map(i => [i.version, i.path]));

              return (
                <div className="int-modal-section">
                  <div className="int-section-header-row">
                    <h4 className="int-section-title">
                      Target Versions
                      {detectedInstalls.length > 0 && (
                        <span className="int-section-hint">({detectedInstalls.length} detected)</span>
                      )}
                    </h4>
                    <button
                      type="button"
                      className="int-browse-btn"
                      onClick={() => handleBrowseCustomPath(selected)}
                      title="Browse custom installation folder"
                    >
                      <FolderOpen size={12} />
                      <span>Custom Folder</span>
                    </button>
                  </div>

                  <div className="int-version-chips-grid">
                    {allVersions.map(ver => {
                      const installPath = detectedMap.get(ver);
                      const isDetected = !!installPath;
                      const isSelected = selectedVersions.includes(ver);
                      return (
                        <button
                          type="button"
                          key={ver}
                          className={`int-ver-chip ${isDetected ? 'detected' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleSelectedVersion(ver)}
                          title={installPath ? `${selected.name} ${ver} detected: ${installPath}` : `${selected.name} ${ver}`}
                        >
                          <span className="int-ver-chip-box">
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </span>
                          <span className="int-ver-chip-year">{ver}</span>
                          {isDetected && <span className="int-ver-chip-dot" title="Auto-detected on system" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Collapsible Guide Accordion (Only expands if user clicks) */}
            {selected.id === '3dsmax' && (
              <details className="int-modal-section int-doc-accordion" open={showInstructions}>
                <summary onClick={(e) => { e.preventDefault(); setShowInstructions(prev => !prev); }}>
                  <span>📘 How to use inside 3ds Max</span>
                  <span className="int-accordion-toggle">{showInstructions ? '▲' : '▼'}</span>
                </summary>
                <div className="int-doc-panel">
                  <ol>
                    <li>Restart 3ds Max after installation (or launch it if closed).</li>
                    <li>The <strong>"Anarchy AI"</strong> toolbar and menu bar will appear automatically.</li>
                    <li>Click <strong>"⚡ Send to Anarchy"</strong> to stream active viewport into Builder canvas.</li>
                  </ol>
                </div>
              </details>
            )}

            {selected.id === 'revit' && (
              <details className="int-modal-section int-doc-accordion" open={showInstructions}>
                <summary onClick={(e) => { e.preventDefault(); setShowInstructions(prev => !prev); }}>
                  <span>📘 Revit installation & usage</span>
                  <span className="int-accordion-toggle">{showInstructions ? '▲' : '▼'}</span>
                </summary>
                <div className="int-doc-panel">
                  <ol>
                    <li>Close Revit completely before installing.</li>
                    <li>Select Revit versions above and click <strong>Install</strong>.</li>
                    <li>Open Revit — find the new <strong>Anarchy</strong> tab in the ribbon.</li>
                  </ol>
                </div>
              </details>
            )}

            {selected.id === 'sketchup' && (
              <details className="int-modal-section int-doc-accordion" open={showInstructions}>
                <summary onClick={(e) => { e.preventDefault(); setShowInstructions(prev => !prev); }}>
                  <span>📘 SketchUp installation & usage</span>
                  <span className="int-accordion-toggle">{showInstructions ? '▲' : '▼'}</span>
                </summary>
                <div className="int-doc-panel">
                  <ol>
                    <li>Select your SketchUp version(s) above and click <strong>Install</strong>.</li>
                    <li>Launch SketchUp — the <strong>"Anarchy AI"</strong> toolbar and Extensions menu appear automatically.</li>
                    <li>Click <strong>"Send Viewport"</strong> to stream active 3D view to Anarchy AI.</li>
                    <li>Use <strong>"Instant AI Render"</strong> or <strong>"Batch Scenes Export"</strong> to render all scene tabs.</li>
                  </ol>
                </div>
              </details>
            )}

            {installMessage && (selected.id === '3dsmax' || selected.id === 'revit' || selected.id === 'sketchup') && (
              <div className="int-modal-section">
                <div className="int-install-message">
                  <AlertCircle size={13} />
                  <span>{renderInstallMessage(installMessage)}</span>
                </div>
              </div>
            )}

            <div className="int-modal-actions">
              {selected.status === 'available' && (
                <button 
                  className="int-btn primary"
                  onClick={() => handleInstall(selected)}
                  disabled={(selected.id === '3dsmax' || selected.id === 'revit' || selected.id === 'sketchup') && selectedVersions.length === 0}
                >
                  <Download size={13} />
                  Install
                </button>
              )}
              {selected.status === 'installing' && (
                <button className="int-btn primary" disabled>
                  <RefreshCw size={13} className="spin" />
                  Installing...
                </button>
              )}
              {selected.status === 'installed' && (
                <>
                  <button
                    className="int-btn secondary"
                    onClick={() => handleInstall(selected, true)}
                    disabled={(selected.id === '3dsmax' || selected.id === 'revit' || selected.id === 'sketchup') && selectedVersions.length === 0}
                  >
                    <Settings size={13} />
                    Reinstall
                  </button>
                  {(selected.id === '3dsmax' || selected.id === 'revit' || selected.id === 'sketchup') && (
                    <button className="int-btn danger" onClick={() => handleRemoveOldPlugin(selected)}>
                      <Trash2 size={13} />
                      Uninstall
                    </button>
                  )}
                  <button className="int-btn ghost" onClick={() => setShowInstructions(prev => !prev)}>
                    <ExternalLink size={13} />
                    {showInstructions ? 'Hide Guide' : 'Guide'}
                  </button>
                </>
              )}
              {selected.status === 'update' && (
                <>
                  <button 
                    className="int-btn primary"
                    onClick={() => handleInstall(selected)}
                  >
                    <RefreshCw size={13} />
                    Update
                  </button>
                  {(selected.id === '3dsmax' || selected.id === 'revit' || selected.id === 'sketchup') && (
                    <button className="int-btn danger" onClick={() => handleRemoveOldPlugin(selected)}>
                      <Trash2 size={13} />
                      Uninstall
                    </button>
                  )}
                </>
              )}
            </div>
          </dialog>
        </div>
      )}

      {/* Video Converter Downloader Modal (Screenshot 3 Parity) */}
      <VideoConverterModal
        isOpen={showVideoConverterModal}
        onClose={() => setShowVideoConverterModal(false)}
        onInstalled={handleVideoConverterInstalled}
      />
    </div>
  );
};
