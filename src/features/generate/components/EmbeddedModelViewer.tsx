import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Box,
  RotateCw,
  Sun,
  Maximize2,
  Minimize2,
  Download,
  Eye,
  Layers,
  Sparkles,
} from 'lucide-react';

interface EmbeddedModelViewerProps {
  typology?: string;
  style?: string;
  siteAreaSqm?: number;
  height?: number;
  interactiveIframeUrl?: string;
  className?: string;
}

export const EmbeddedModelViewer: React.FC<EmbeddedModelViewerProps> = ({
  typology = 'Residential Villa',
  style = 'Modern Contemporary',
  siteAreaSqm = 500,
  height = 340,
  interactiveIframeUrl,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Interaction State
  const [isRotating, setIsRotating] = useState(true);
  const [isWireframe, setIsWireframe] = useState(false);
  const [sunTime, setSunTime] = useState<'day' | 'golden' | 'night'>('golden');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeViewMode, setActiveViewMode] = useState<'3d_canvas' | 'live_iframe'>(
    interactiveIframeUrl ? 'live_iframe' : '3d_canvas'
  );

  const materialsGroupRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);

  // Mouse Orbit Drag tracking
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const cameraAngle = useRef({ theta: Math.PI / 4, phi: Math.PI / 5, radius: 45 });

  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const { theta, phi, radius } = cameraAngle.current;
    cameraRef.current.position.x = radius * Math.sin(phi) * Math.sin(theta);
    cameraRef.current.position.y = radius * Math.cos(phi);
    cameraRef.current.position.z = radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.lookAt(0, 5, 0);
  }, []);

  // Update lighting based on sun time
  useEffect(() => {
    if (!sunLightRef.current || !ambientLightRef.current || !sceneRef.current) return;

    if (sunTime === 'day') {
      sunLightRef.current.color.setHex(0xffffff);
      sunLightRef.current.intensity = 1.8;
      sunLightRef.current.position.set(30, 50, 20);
      ambientLightRef.current.intensity = 0.8;
      ambientLightRef.current.color.setHex(0xe2e8f0);
      sceneRef.current.background = new THREE.Color(0x0c0e14);
    } else if (sunTime === 'golden') {
      sunLightRef.current.color.setHex(0xffaa55);
      sunLightRef.current.intensity = 2.2;
      sunLightRef.current.position.set(45, 20, 25);
      ambientLightRef.current.intensity = 0.5;
      ambientLightRef.current.color.setHex(0x6b7280);
      sceneRef.current.background = new THREE.Color(0x090a0f);
    } else {
      // Night
      sunLightRef.current.color.setHex(0x38bdf8);
      sunLightRef.current.intensity = 0.4;
      sunLightRef.current.position.set(-20, 30, -20);
      ambientLightRef.current.intensity = 0.3;
      ambientLightRef.current.color.setHex(0x1e1b4b);
      sceneRef.current.background = new THREE.Color(0x050608);
    }
  }, [sunTime]);

  // Wireframe toggle
  useEffect(() => {
    materialsGroupRef.current.forEach((mat) => {
      mat.wireframe = isWireframe;
    });
  }, [isWireframe]);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!mountRef.current || activeViewMode !== '3d_canvas') return;

    const width = mountRef.current.clientWidth || 600;
    const currentHeight = height;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0b10);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / currentHeight, 0.5, 1000);
    cameraRef.current = camera;
    updateCameraPosition();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, currentHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    // Architectural Ground Grid & Floor Plate
    const grid = new THREE.GridHelper(60, 30, 0xe11d48, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    // Site Boundary Plinth
    const plinthSize = Math.max(24, Math.sqrt(siteAreaSqm) * 0.9);
    const plinthGeo = new THREE.BoxGeometry(plinthSize, 0.4, plinthSize);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x13151f,
      roughness: 0.9,
      metalness: 0.1,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -0.2;
    plinth.receiveShadow = true;
    scene.add(plinth);
    materialsGroupRef.current.push(plinthMat);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xe2e8f0, 0.7);
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.9);
    sunLight.position.set(35, 45, 25);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    const d = 30;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLightRef.current = sunLight;
    scene.add(sunLight);

    // Procedural Parametric Architectural Massing Assembly
    const buildingGroup = new THREE.Group();

    // Material Library
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      roughness: 0.65,
      metalness: 0.1,
    });
    const darkStoneMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.75,
      metalness: 0.2,
    });
    const woodSlatMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.5,
      metalness: 0.05,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.55,
    });
    const interiorGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.4,
      roughness: 0.2,
    });

    materialsGroupRef.current.push(concreteMat, darkStoneMat, woodSlatMat, glassMat, interiorGlowMat);

    const isTower = typology.includes('Tower') || typology.includes('High-Rise');
    const isCommercial = typology.includes('Commercial') || typology.includes('Office');
    const isPavilion = typology.includes('Pavilion') || typology.includes('Cultural');

    if (isTower) {
      // High-Rise Tower Form
      const towerHeight = 36;
      const coreGeo = new THREE.BoxGeometry(6, towerHeight, 6);
      const coreMesh = new THREE.Mesh(coreGeo, darkStoneMat);
      coreMesh.position.y = towerHeight / 2;
      buildingGroup.add(coreMesh);

      // Floor Slabs
      for (let i = 0; i < 9; i++) {
        const slabY = (i + 1) * 3.8;
        const slabGeo = new THREE.BoxGeometry(14, 0.4, 14);
        const slabMesh = new THREE.Mesh(slabGeo, concreteMat);
        slabMesh.position.y = slabY;
        slabMesh.castShadow = true;
        slabMesh.receiveShadow = true;
        buildingGroup.add(slabMesh);

        // Glass Curtain Walls
        const glassGeo = new THREE.BoxGeometry(13.6, 3.4, 13.6);
        const glassMesh = new THREE.Mesh(glassGeo, glassMat);
        glassMesh.position.y = slabY - 1.7;
        buildingGroup.add(glassMesh);
      }
    } else if (isPavilion) {
      // Organic / Sculpted Canopy Pavilion
      const baseGeo = new THREE.CylinderGeometry(12, 14, 0.6, 24);
      const baseMesh = new THREE.Mesh(baseGeo, darkStoneMat);
      baseMesh.position.y = 0.3;
      buildingGroup.add(baseMesh);

      // Slender Structural Columns
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        const colGeo = new THREE.CylinderGeometry(0.25, 0.25, 7, 16);
        const colMesh = new THREE.Mesh(colGeo, darkStoneMat);
        colMesh.position.set(Math.cos(a) * 9, 3.5, Math.sin(a) * 9);
        colMesh.castShadow = true;
        buildingGroup.add(colMesh);
      }

      // Floating Aerodynamic Canopy
      const roofGeo = new THREE.ConeGeometry(15, 2.5, 32);
      const roofMesh = new THREE.Mesh(roofGeo, concreteMat);
      roofMesh.position.y = 8;
      roofMesh.rotation.x = Math.PI;
      roofMesh.castShadow = true;
      buildingGroup.add(roofMesh);

      // Central Glass Enclosure
      const glassCoreGeo = new THREE.CylinderGeometry(6, 6, 6, 24);
      const glassCore = new THREE.Mesh(glassCoreGeo, glassMat);
      glassCore.position.y = 3.5;
      buildingGroup.add(glassCore);
    } else if (isCommercial) {
      // Stepped Terraced Commercial Complex
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(22, 5, 18), darkStoneMat);
      b1.position.set(0, 2.5, 0);
      b1.castShadow = true;
      b1.receiveShadow = true;
      buildingGroup.add(b1);

      const b2 = new THREE.Mesh(new THREE.BoxGeometry(16, 4.5, 14), concreteMat);
      b2.position.set(-2, 7.25, -1);
      b2.castShadow = true;
      buildingGroup.add(b2);

      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(22.2, 1.8, 18.2), glassMat);
      ribbon.position.set(0, 2.5, 0);
      buildingGroup.add(ribbon);
    } else {
      // Modern Luxury Residential Villa (Cantilevered Volumes)
      // Ground Volume (Living & Service Core)
      const groundGeo = new THREE.BoxGeometry(16, 4.2, 12);
      const groundMesh = new THREE.Mesh(groundGeo, darkStoneMat);
      groundMesh.position.set(0, 2.1, 0);
      groundMesh.castShadow = true;
      groundMesh.receiveShadow = true;
      buildingGroup.add(groundMesh);

      // Ground Floor Glazing & Entrance
      const entranceGlazing = new THREE.Mesh(new THREE.BoxGeometry(12, 3.8, 0.4), glassMat);
      entranceGlazing.position.set(0, 2.1, 6.1);
      buildingGroup.add(entranceGlazing);

      // Dramatic Upper Cantilever (Master Suite & Terrace)
      const upperGeo = new THREE.BoxGeometry(18, 4.0, 10);
      const upperMesh = new THREE.Mesh(upperGeo, concreteMat);
      upperMesh.position.set(3, 6.2, 1.5);
      upperMesh.castShadow = true;
      upperMesh.receiveShadow = true;
      buildingGroup.add(upperMesh);

      // Upper Floor Ribbon Glazing
      const upperGlazing = new THREE.Mesh(new THREE.BoxGeometry(14, 2.8, 0.3), glassMat);
      upperGlazing.position.set(3, 6.2, 6.6);
      buildingGroup.add(upperGlazing);

      // Architectural Wood Slat Privacy Louvers
      for (let i = 0; i < 7; i++) {
        const slatGeo = new THREE.BoxGeometry(0.15, 3.6, 0.8);
        const slat = new THREE.Mesh(slatGeo, woodSlatMat);
        slat.position.set(-4 + i * 0.45, 6.2, 6.7);
        slat.castShadow = true;
        buildingGroup.add(slat);
      }

      // Cantilever Terrace Parapet
      const parapetGeo = new THREE.BoxGeometry(6, 1.1, 0.2);
      const parapet = new THREE.Mesh(parapetGeo, concreteMat);
      parapet.position.set(9, 4.65, 4);
      buildingGroup.add(parapet);

      // Swimming Pool Water Plate
      const poolGeo = new THREE.BoxGeometry(9, 0.1, 4.5);
      const poolMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.05,
        metalness: 0.9,
      });
      const pool = new THREE.Mesh(poolGeo, poolMat);
      pool.position.set(-1, 0.05, 8.5);
      materialsGroupRef.current.push(poolMat);
      buildingGroup.add(pool);
    }

    scene.add(buildingGroup);

    // Animation Loop
    let lastTime = performance.now();
    const animate = (time: number) => {
      animationFrameId.current = requestAnimationFrame(animate);

      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (isRotating && !isDragging.current) {
        cameraAngle.current.theta += delta * 0.25;
        updateCameraPosition();
      }

      renderer.render(scene, camera);
    };

    animate(performance.now());

    // Mouse Controls (Orbit / Zoom)
    const dom = renderer.domElement;

    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaX = e.clientX - previousMousePosition.current.x;
      const deltaY = e.clientY - previousMousePosition.current.y;

      cameraAngle.current.theta -= deltaX * 0.008;
      cameraAngle.current.phi = Math.max(
        0.1,
        Math.min(Math.PI / 2 - 0.05, cameraAngle.current.phi - deltaY * 0.008)
      );

      updateCameraPosition();
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraAngle.current.radius = Math.max(
        15,
        Math.min(90, cameraAngle.current.radius + e.deltaY * 0.05)
      );
      updateCameraPosition();
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // Resize handler
    const onResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const newWidth = mountRef.current.clientWidth;
      cameraRef.current.aspect = newWidth / currentHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, currentHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      materialsGroupRef.current = [];
    };
  }, [activeViewMode, height, typology, siteAreaSqm, isRotating, updateCameraPosition]);

  const handleDownloadSnapshot = () => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `3D_Massing_${typology.replace(/\s+/g, '_')}_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const resetCamera = () => {
    cameraAngle.current = { theta: Math.PI / 4, phi: Math.PI / 5, radius: 45 };
    updateCameraPosition();
  };

  return (
    <div className={`embedded-3d-model-card ${isFullscreen ? 'fullscreen-mode' : ''} ${className}`}>
      {/* Top 3D Control Bar */}
      <div className="model-viewer-topbar">
        <div className="viewer-title-group">
          <Box size={14} className="viewer-accent-icon" />
          <span className="viewer-title">3D Volumetric Massing Viewport</span>
          <span className="viewer-typology-pill">{typology} ({siteAreaSqm} m²)</span>
        </div>

        <div className="viewer-actions-group">
          {interactiveIframeUrl && (
            <div className="view-mode-toggle-group">
              <button
                type="button"
                className={`viewer-mode-btn ${activeViewMode === '3d_canvas' ? 'active' : ''}`}
                onClick={() => setActiveViewMode('3d_canvas')}
                title="Interactive 3D Massing Viewport"
              >
                <Layers size={12} />
                <span>Massing</span>
              </button>
              <button
                type="button"
                className={`viewer-mode-btn ${activeViewMode === 'live_iframe' ? 'active' : ''}`}
                onClick={() => setActiveViewMode('live_iframe')}
                title="Interactive BIM Model (Speckle/WebGL)"
              >
                <Sparkles size={12} />
                <span>Speckle BIM</span>
              </button>
            </div>
          )}

          {activeViewMode === '3d_canvas' && (
            <>
              {/* Rotation Toggle */}
              <button
                type="button"
                className={`viewer-tool-btn ${isRotating ? 'active' : ''}`}
                onClick={() => setIsRotating(!isRotating)}
                title={isRotating ? 'Pause Auto-Rotation' : 'Start Auto-Rotation'}
              >
                <RotateCw size={13} className={isRotating ? 'spin-slow' : ''} />
              </button>

              {/* Wireframe Toggle */}
              <button
                type="button"
                className={`viewer-tool-btn ${isWireframe ? 'active' : ''}`}
                onClick={() => setIsWireframe(!isWireframe)}
                title="Toggle Wireframe Mode"
              >
                <Eye size={13} />
              </button>

              {/* Sun Lighting Toggle */}
              <button
                type="button"
                className="viewer-tool-btn sun-btn"
                onClick={() => {
                  setSunTime((prev) => (prev === 'golden' ? 'day' : prev === 'day' ? 'night' : 'golden'));
                }}
                title={`Sun Lighting Mode: ${sunTime}`}
              >
                <Sun size={13} />
                <span className="sun-indicator-text">{sunTime}</span>
              </button>

              {/* Download Snapshot */}
              <button
                type="button"
                className="viewer-tool-btn"
                onClick={handleDownloadSnapshot}
                title="Capture 3D Massing Snapshot (PNG)"
              >
                <Download size={13} />
              </button>
            </>
          )}

          {/* Fullscreen Toggle */}
          <button
            type="button"
            className="viewer-tool-btn"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Main Viewport Content Area */}
      <div className="model-viewer-canvas-wrap" style={{ height: isFullscreen ? 'calc(100vh - 80px)' : `${height}px` }}>
        {activeViewMode === 'live_iframe' && interactiveIframeUrl ? (
          <iframe
            src={interactiveIframeUrl}
            title="Interactive 3D BIM Viewer"
            className="viewer-iframe"
            allow="fullscreen"
          />
        ) : (
          <div ref={mountRef} className="three-mount-container" />
        )}

        {/* Viewport Floating Overlay Hint */}
        {activeViewMode === '3d_canvas' && (
          <div className="viewer-viewport-hud">
            <span className="hud-badge">Orbit: Drag Left-Click</span>
            <span className="hud-badge">Zoom: Mouse Wheel</span>
            <span className="hud-badge style-badge">{style}</span>
            <button type="button" className="hud-reset-btn" onClick={resetCamera}>
              Reset Camera
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
