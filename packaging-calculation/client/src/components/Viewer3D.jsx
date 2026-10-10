// Shared 3D viewer used by every section (part, cluster, carton, pallet, container).
// Give it a list of boxes in millimetres; it frames the camera, draws a floor grid,
// shows L / W / H labels, layer toggles and a GLB download.
//
// Coordinates: x = length, y = height (up), z = width. 1 unit = 1 m (mm / 1000).
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Edges } from '@react-three/drei';
import { Suspense, useMemo, useRef, useState } from 'react';
import { CadModel, CadInstances, CadPieces } from './CadModel.jsx';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { useI18n } from '../i18n.jsx';

const S = 0.001;

/**
 * box: { pos: [x, y, z] (mm, min corner), size: [l, h, w] (mm), color, opacity, wire, edge, layer }
 * layers: [{ id, label, on }] toggles shown under the viewer; boxes with a `layer` hide when it is off
 * dims: { l, w, h } overall size for the L/W/H labels (mm)
 * model: { url, box, layer? }                 the real part (section 2)
 * instances: { url, box, items: [{orient,pos}] }  copies of the real part (section 4)
 */
export default function Viewer3D({ boxes, layers = [], dims, height = 420, caption, fileName = 'model', model, instances, pieces }) {
  const { t } = useI18n();
  const [on, setOn] = useState(() => Object.fromEntries(layers.map((l) => [l.id, l.on !== false])));
  const sceneRef = useRef();

  const bounds = useMemo(() => {
    const max = [0, 0, 0];
    for (const b of boxes) for (let i = 0; i < 3; i++) max[i] = Math.max(max[i], b.pos[i] + b.size[i]);
    return max;
  }, [boxes]);
  const span = Math.max(...bounds) * S || 1;
  const center = [bounds[0] * S / 2, bounds[1] * S / 2, bounds[2] * S / 2];
  // long, thin scenes (a container) get a closer camera so the load fills the view
  const [b1, b2] = [...bounds].sort((u, v) => v - u);
  const k = b2 > 0 && b1 / b2 > 2.5 ? 0.72 : 1;
  const cam = [center[0] + span * 1.25 * k, center[1] + span * 0.9 * k, center[2] + span * 1.45 * k];

  // keep each box's own index as its key, so turning a layer off never hands one box another's geometry
  const visible = boxes.map((b, i) => [b, i]).filter(([b]) => !b.layer || on[b.layer]);

  const downloadGlb = () => {
    if (!sceneRef.current) return;
    new GLTFExporter().parse(sceneRef.current, (glb) => {
      const url = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.glb`;
      a.click();
      URL.revokeObjectURL(url);
    }, (err) => console.error(err), { binary: true });
  };

  return (
    <div className="viewer">
      <div className="viewer-canvas" style={{ height }}>
        <Canvas camera={{ position: cam, fov: 40, near: span / 100, far: span * 50 }} gl={{ preserveDrawingBuffer: true, antialias: true }}>
          <color attach="background" args={['#F6F5F2']} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[span * 2, span * 3, span * 1.5]} intensity={1.1} />
          <directionalLight position={[-span, span, -span]} intensity={0.35} />
          <group ref={sceneRef}>
            {visible.map(([b, i]) => <Block key={i} b={b} />)}
            <Suspense fallback={null}>
              {model && (!model.layer || on[model.layer]) && <CadModel url={model.url} box={model.box} />}
              {instances && (!instances.layer || on[instances.layer]) && <CadInstances url={instances.url} box={instances.box} items={instances.items} matrices={instances.matrices} />}
              {pieces && <CadPieces url={pieces.url} items={pieces.items} />}
            </Suspense>
          </group>
          {dims && <DimLabels dims={dims} />}
          <Grid position={[center[0], -0.0005, center[2]]} args={[span * 6, span * 6]} cellSize={span / 10} sectionSize={span / 2}
            cellColor="#E2E0DA" sectionColor="#D2CFC6" fadeDistance={span * 6} infiniteGrid={false} />
          <OrbitControls target={center} makeDefault enableDamping />
        </Canvas>
      </div>
      <div className="viewer-hint"><span>{t('dragHint')}</span>{caption && <span>{caption}</span>}</div>
      <div className="viewer-foot">
        <div className="inline" style={{ gap: 16 }}>
          {layers.map((l) => (
            <label key={l.id} className="inline" style={{ gap: 6, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={!!on[l.id]} onChange={(e) => setOn({ ...on, [l.id]: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--blue)' }} />
              {l.label}
            </label>
          ))}
        </div>
        <button className="btn btn-ghost" style={{ minHeight: 36, padding: '0 12px' }} onClick={downloadGlb}>{t('downloadGlb')}</button>
      </div>
    </div>
  );
}

function Block({ b }) {
  const [l, h, w] = b.size.map((v) => v * S);
  const p = [b.pos[0] * S + l / 2, b.pos[1] * S + h / 2, b.pos[2] * S + w / 2];
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
    return (
      <mesh position={p}>
        <cylinderGeometry args={[l / 2, l / 2, h, 48]} />
        <meshStandardMaterial color={b.color || '#8A93A0'} roughness={0.6} metalness={0.15} />
      </mesh>
    );
  }
  if (b.diamond) {
    return (
      <mesh position={p} rotation={[0, Math.PI / 4, 0]} scale={[l / Math.SQRT2, 1, w / Math.SQRT2]}>
        <boxGeometry args={[1, h, 1]} />
        <meshStandardMaterial color={b.color || '#8A93A0'} roughness={0.6} metalness={0.15} />
      </mesh>
    );
  }
  return (
    <mesh position={p}>
      <boxGeometry args={[l, h, w]} />
      <meshStandardMaterial color={b.color || '#8A93A0'} transparent={b.opacity < 1} opacity={b.opacity ?? 1} roughness={0.75} />
      {b.edge !== false && <Edges color={b.edgeColor || '#00000033'} />}
    </mesh>
  );
}

function DimLabels({ dims }) {
  const { l, w, h } = dims;
  const tag = (pos, text) => (
    <Html position={pos} center style={{ pointerEvents: 'none' }}>
      <span className="dim-tag">{text}</span>
    </Html>
  );
  return (
    <>
      {tag([l * S / 2, 0, w * S], `L ${Math.round(l)} mm`)}
      {tag([l * S, 0, w * S / 2], `W ${Math.round(w)} mm`)}
      {tag([l * S, h * S / 2, w * S], `H ${Math.round(h)} mm`)}
    </>
  );
}
