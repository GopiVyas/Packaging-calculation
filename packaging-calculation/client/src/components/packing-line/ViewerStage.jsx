import React, { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Edges } from '@react-three/drei';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { Rotate3d, Download, Eye, Layers } from 'lucide-react';
import { CadModel, CadInstances, CadPieces } from '../CadModel.jsx';
import { useI18n } from '../../i18n.jsx';

const S = 0.001; // mm to meters

export default function ViewerStage({
  boxes = [],
  layers = [],
  dims = null,
  height = 440,
  caption = null,
  fileName = 'packsmart-model',
  model = null,
  instances = null,
  pieces = null,
  topControls = null
}) {
  const { t } = useI18n();
  const [layerStates, setLayerStates] = useState(() =>
    Object.fromEntries(layers.map((l) => [l.id, l.on !== false]))
  );
  const [interacted, setInteracted] = useState(false);
  const sceneRef = useRef();

  // Compute 3D bounding frame
  const bounds = useMemo(() => {
    const max = [0, 0, 0];
    for (const b of boxes) {
      for (let i = 0; i < 3; i++) {
        max[i] = Math.max(max[i], (b.pos?.[i] || 0) + (b.size?.[i] || 0));
      }
    }
    return max;
  }, [boxes]);

  const span = Math.max(...bounds) * S || 1;
  const center = [(bounds[0] * S) / 2, (bounds[1] * S) / 2, (bounds[2] * S) / 2];
  const cam = [center[0] + span * 1.25, center[1] + span * 0.9, center[2] + span * 1.45];

  const visibleBoxes = boxes.filter((b) => !b.layer || layerStates[b.layer]);

  const toggleLayer = (layerId) => {
    setLayerStates((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  const handleDownloadGlb = () => {
    if (!sceneRef.current) return;
    new GLTFExporter().parse(
      sceneRef.current,
      (glb) => {
        const url = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.glb`;
        a.click();
        URL.revokeObjectURL(url);
      },
      (err) => console.error(err),
      { binary: true }
    );
  };

  return (
    <div className="sh-viewer-stage">
      <div
        className="sh-viewer-canvas-wrap"
        style={{ height }}
        onPointerDown={() => !interacted && setInteracted(true)}
      >
        {/* Floating Glass Toolbar */}
        <div className="sh-viewer-glass-toolbar">
          <div className="sh-toolbar-left">
            {topControls}
            {layers.map((l) => (
              <label
                key={l.id}
                className={`sh-glass-chip ${layerStates[l.id] ? 'active' : ''}`}
                title={`Toggle ${l.label}`}
              >
                <input
                  type="checkbox"
                  checked={!!layerStates[l.id]}
                  onChange={() => toggleLayer(l.id)}
                />
                <span>{l.label}</span>
              </label>
            ))}
          </div>

          <div className="sh-toolbar-right">
            <button
              className="sh-glass-btn"
              onClick={handleDownloadGlb}
              title={t('downloadGlb')}
              type="button"
            >
              <Download size={14} />
              <span>GLB</span>
            </button>
          </div>
        </div>

        {/* Floating Rotate Hint Badge */}
        <div className={`sh-rotate-hint ${interacted ? 'faded' : ''}`}>
          <Rotate3d size={13} />
          <span>{t('dragHint') || 'Drag to rotate • Scroll to zoom'}</span>
        </div>

        {/* 3D Canvas */}
        <Canvas
          camera={{ position: cam, fov: 40, near: span / 100, far: span * 50 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
        >
          <color attach="background" args={['#F6F5F2']} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[span * 2, span * 3, span * 1.5]} intensity={1.1} />
          <directionalLight position={[-span, span, -span]} intensity={0.35} />

          <group ref={sceneRef}>
            {visibleBoxes.map((b, i) => (
              <Block key={i} b={b} />
            ))}
            <Suspense fallback={null}>
              {model && (!model.layer || layerStates[model.layer]) && (
                <CadModel url={model.url} box={model.box} />
              )}
              {instances && (!instances.layer || layerStates[instances.layer]) && (
                <CadInstances
                  url={instances.url}
                  box={instances.box}
                  items={instances.items}
                  matrices={instances.matrices}
                />
              )}
              {pieces && <CadPieces url={pieces.url} items={pieces.items} />}
            </Suspense>
          </group>

          {dims && <DimLabels dims={dims} />}

          <Grid
            position={[center[0], -0.0005, center[2]]}
            args={[span * 6, span * 6]}
            cellSize={span / 10}
            sectionSize={span / 2}
            cellColor="#E2E0DA"
            sectionColor="#D2CFC6"
            fadeDistance={span * 6}
            infiniteGrid={false}
          />

          <OrbitControls
            target={center}
            makeDefault
            enableDamping
            onStart={() => !interacted && setInteracted(true)}
          />
        </Canvas>
      </div>

      {/* Stage Footer Caption */}
      {caption && (
        <div className="sh-viewer-footer">
          <span className="sh-viewer-caption">{caption}</span>
          <span className="muted" style={{ fontSize: 11 }}>
            Coordinates: mm · ISO orientation
          </span>
        </div>
      )}
    </div>
  );
}

function Block({ b }) {
  const [l, h, w] = b.size.map((v) => v * S);
  const p = [(b.pos?.[0] || 0) * S + l / 2, (b.pos?.[1] || 0) * S + h / 2, (b.pos?.[2] || 0) * S + w / 2];

  if (b.wire) {
    return (
      <mesh position={p}>
        <boxGeometry args={[l, h, w]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        <Edges color={b.color || '#6C8EBF'} />
      </mesh>
    );
  }

  if (b.cylinder) {
    const r = Math.min(l, w) / 2;
    return (
      <group position={p}>
        <mesh>
          <cylinderGeometry args={[r, r, h, 36]} />
          <meshStandardMaterial color={b.color || '#8C98A8'} roughness={0.4} metalness={0.15} />
        </mesh>
        <lineSegments>
          <edgesGeometry args={[new cylinderEdgesGeometry(r, h)]} />
          <lineBasicMaterial color="#5A6675" />
        </lineSegments>
      </group>
    );
  }

  return (
    <mesh position={p}>
      <boxGeometry args={[l, h, w]} />
      <meshStandardMaterial
        color={b.color || '#8C98A8'}
        transparent={b.opacity != null && b.opacity < 1}
        opacity={b.opacity ?? 1}
        roughness={0.5}
      />
      {b.edge && <Edges color="#475569" />}
    </mesh>
  );
}

function cylinderEdgesGeometry(r, h) {
  const geom = new THREE.BufferGeometry();
  return geom;
}

import * as THREE from 'three';

function DimLabels({ dims }) {
  const [L, W, H] = [dims.l * S, dims.w * S, dims.h * S];
  return (
    <>
      <Html position={[L / 2, -0.015, -0.04]} center distanceFactor={12}>
        <span className="dim-tag">L {dims.l} mm</span>
      </Html>
      <Html position={[-0.04, -0.015, W / 2]} center distanceFactor={12}>
        <span className="dim-tag">W {dims.w} mm</span>
      </Html>
      <Html position={[-0.04, H / 2, -0.04]} center distanceFactor={12}>
        <span className="dim-tag">H {dims.h} mm</span>
      </Html>
    </>
  );
}
