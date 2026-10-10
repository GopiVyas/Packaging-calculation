// Real part geometry (GLB from the CAD service) inside <Viewer3D>.
// The GLB is in mm, Z up, min corner at 0,0,0. The viewer is Y up in metres, so every copy
// gets: base (Z-up → Y-up) → turn into the packing orientation → move to its slot.
import { useMemo, useLayoutEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const S = 0.001;

/** Merge every mesh of the GLB into one geometry (mm, Z up). */
function useGeometry(url) {
  const gltf = useGLTF(url);
  return useMemo(() => {
    const parts = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        const g = o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        parts.push(g.index ? g.toNonIndexed() : g);
      }
    });
    if (!parts.length) return null;
    // Copy into one typed array. (Spreading a large model into push(...) overflows the call stack.)
    const total = parts.reduce((n, g) => n + g.attributes.position.array.length, 0);
    const pos = new Float32Array(total);
    let at = 0;
    for (const g of parts) {
      pos.set(g.attributes.position.array, at);
      at += g.attributes.position.array.length;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.computeVertexNormals();
    return geom;
  }, [gltf]);
}

/**
 * Matrix placing the part (box l × w × h as drawn, Z up) so that in the viewer it occupies
 * x ∈ [pos.x, pos.x + orient[0]], y (up) ∈ [pos.y, pos.y + orient[2]], z ∈ [pos.z, pos.z + orient[1]].
 */
export function placementMatrix(box, orient, pos) {
  // Natural viewer frame: x = l, y = h (up), z = w.
  const base = new THREE.Matrix4().makeRotationX(-Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(0, 0, box.w));
  const natural = [box.l, box.h, box.w]; // sizes along viewer x, y, z
  const target = orient ? [orient[0], orient[2], orient[1]] : natural;
  // Permutation: target axis i takes natural axis p[i] (match sizes, each axis once).
  const used = [false, false, false];
  const p = target.map((t) => {
    let best = -1;
    for (let j = 0; j < 3; j++) if (!used[j] && (best < 0 || Math.abs(natural[j] - t) < Math.abs(natural[best] - t))) best = j;
    used[best] = true;
    return best;
  });
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  p.forEach((j, i) => { m[i][j] = 1; });
  const det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  if (det < 0) m[0] = m[0].map((v) => -v); // keep it a rotation, never a mirror
  const rot = new THREE.Matrix4().set(m[0][0], m[0][1], m[0][2], 0, m[1][0], m[1][1], m[1][2], 0, m[2][0], m[2][1], m[2][2], 0, 0, 0, 0, 1);
  const turned = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(...natural)).applyMatrix4(rot);
  const shift = new THREE.Matrix4().makeTranslation(pos[0] - turned.min.x, pos[1] - turned.min.y, pos[2] - turned.min.z);
  const scale = new THREE.Matrix4().makeScale(S, S, S);
  return scale.multiply(shift).multiply(rot).multiply(base);
}

/** One part, as drawn (section 2). */
export function CadModel({ url, box, color = '#8C98A8' }) {
  const geom = useGeometry(url);
  const matrix = useMemo(() => placementMatrix(box, null, [0, 0, 0]), [box]);
  if (!geom) return null;
  return (
    <mesh geometry={geom} matrix={matrix} matrixAutoUpdate={false}>
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.25} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Many copies of the part (section 4): either { orient, pos } items (grid packing, mm)
 *  or ready-made viewer matrices (real-shape packing from the CAD service). */
export function CadInstances({ url, box, items = [], matrices, color = '#7B5BD6' }) {
  const geom = useGeometry(url);
  const ref = useRef();
  const count = matrices ? matrices.length : items.length;
  useLayoutEffect(() => {
    if (!ref.current) return;
    if (matrices) matrices.forEach((m, i) => ref.current.setMatrixAt(i, m));
    else items.forEach((it, i) => ref.current.setMatrixAt(i, placementMatrix(box, it.orient, it.pos)));
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items, matrices, box, geom]);
  if (!geom || !count) return null;
  return (
    <instancedMesh key={count} ref={ref} args={[geom, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

/** A few pieces, each with its own matrix and colour (section 3: one cluster). */
export function CadPieces({ url, items }) {
  const geom = useGeometry(url);
  if (!geom) return null;
  return items.map((it, i) => (
    <mesh key={i} geometry={geom} matrix={it.matrix} matrixAutoUpdate={false}>
      <meshStandardMaterial color={it.color} roughness={0.55} metalness={0.15} side={THREE.DoubleSide} />
    </mesh>
  ));
}
