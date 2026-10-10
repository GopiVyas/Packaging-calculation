import { useMemo } from 'react';
import * as THREE from 'three';
/**
 * All geometry is built within the item's bounding box, centered at origin.
 * The parent group is then positioned to the item's world-space center.
 *
 * Coordinate mapping (packing → R3F world):
 *   packing X (length) → world X
 *   packing Z (height) → world Y
 *   packing Y (width)  → world Z
 */
/** Clamp helper so tiny dimensions don't produce degenerate geometry */
function clamp(v, min = 0.1) {
    return Math.max(v, min);
}
// ─── Individual realistic shape renderers ─────────────────────────
function BottleMesh({ dx, dy, dz, color }) {
    const w = clamp(Math.min(dx, dy));
    const h = clamp(dz);
    const bodyH = h * 0.68;
    const shoulderH = h * 0.12;
    const neckH = h * 0.14;
    const capH = h * 0.06;
    const bodyR = w / 2;
    const neckR = w * 0.18;
    const capR = w * 0.22;
    // Build a lathe profile for the bottle body + shoulder + neck
    const profile = useMemo(() => {
        const pts = [];
        // bottom
        pts.push(new THREE.Vector2(0, 0));
        pts.push(new THREE.Vector2(bodyR * 0.92, 0));
        pts.push(new THREE.Vector2(bodyR, bodyH * 0.05));
        pts.push(new THREE.Vector2(bodyR, bodyH * 0.85));
        // shoulder curve
        pts.push(new THREE.Vector2(bodyR * 0.88, bodyH + shoulderH * 0.4));
        pts.push(new THREE.Vector2(bodyR * 0.6, bodyH + shoulderH * 0.8));
        pts.push(new THREE.Vector2(neckR, bodyH + shoulderH));
        // neck
        pts.push(new THREE.Vector2(neckR, bodyH + shoulderH + neckH * 0.85));
        pts.push(new THREE.Vector2(neckR * 0.95, bodyH + shoulderH + neckH));
        pts.push(new THREE.Vector2(0, bodyH + shoulderH + neckH));
        return pts;
    }, [bodyR, bodyH, shoulderH, neckH, neckR]);
    return (<group>
      {/* Bottle body via lathe */}
      <mesh castShadow receiveShadow>
        <latheGeometry args={[profile, 32]}/>
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.15} transparent opacity={0.88}/>
      </mesh>
      {/* Cap */}
      <mesh position={[0, bodyH + shoulderH + neckH + capH / 2, 0]} castShadow>
        <cylinderGeometry args={[capR, capR, capH, 24]}/>
        <meshStandardMaterial color="#374151" roughness={0.6} metalness={0.3}/>
      </mesh>
    </group>);
}
function CupMesh({ dx, dy, dz, color }) {
    const w = clamp(Math.min(dx, dy));
    const h = clamp(dz);
    const bodyR = w / 2;
    const rimR = bodyR * 1.05;
    const wallT = Math.max(w * 0.06, 0.3);
    const handleR = w * 0.28;
    return (<group>
      {/* Outer cup body — slightly tapered cylinder */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[rimR, bodyR * 0.92, h, 32, 1, true]}/>
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} side={THREE.DoubleSide}/>
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -h / 2 + 0.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[bodyR * 0.92, bodyR * 0.92, 0.2, 32]}/>
        <meshStandardMaterial color={color} roughness={0.5}/>
      </mesh>
      {/* Rim ring */}
      <mesh position={[0, h / 2, 0]} castShadow>
        <torusGeometry args={[rimR - wallT / 2, wallT / 2, 8, 32]}/>
        <meshStandardMaterial color={color} roughness={0.4}/>
      </mesh>
      {/* Handle — torus on the side */}
      <mesh position={[bodyR + handleR * 0.5, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[handleR, Math.max(handleR * 0.18, 0.2), 8, 24, Math.PI]}/>
        <meshStandardMaterial color={color} roughness={0.5}/>
      </mesh>
    </group>);
}
function CanMesh({ dx, dy, dz, color }) {
    const w = clamp(Math.min(dx, dy));
    const h = clamp(dz);
    const r = w / 2;
    return (<group>
      {/* Can body */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[r, r, h, 32]}/>
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.55}/>
      </mesh>
      {/* Top lid */}
      <mesh position={[0, h / 2 + 0.05, 0]} castShadow>
        <cylinderGeometry args={[r * 0.98, r, 0.1, 32]}/>
        <meshStandardMaterial color="#9ca3af" roughness={0.3} metalness={0.7}/>
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -h / 2 - 0.05, 0]} castShadow>
        <cylinderGeometry args={[r, r * 0.98, 0.1, 32]}/>
        <meshStandardMaterial color="#9ca3af" roughness={0.3} metalness={0.7}/>
      </mesh>
    </group>);
}
function PhoneMesh({ dx, dy, dz, color }) {
    const w = clamp(dx);
    const d = clamp(dy);
    const h = clamp(dz, 0.1);
    return (<group>
      {/* Body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]}/>
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.4}/>
      </mesh>
      {/* Screen — slightly inset on top */}
      {h > 0.5 && (<mesh position={[0, h / 2 + 0.01, 0]} castShadow>
          <boxGeometry args={[w * 0.92, 0.02, d * 0.92]}/>
          <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.2} emissive="#1e293b" emissiveIntensity={0.3}/>
        </mesh>)}
    </group>);
}
function PacketMesh({ dx, dy, dz, color }) {
    const w = clamp(dx);
    const d = clamp(dy);
    const h = clamp(dz);
    return (<group>
      {/* Main box body — slightly rounded look via slight scale */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]}/>
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.05}/>
      </mesh>
      {/* Top seal flap — thin extra box on top */}
      <mesh position={[0, h / 2 + h * 0.02, 0]} castShadow>
        <boxGeometry args={[w * 0.95, h * 0.04, d * 0.95]}/>
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.05} opacity={0.85} transparent/>
      </mesh>
      {/* Label band — lighter strip across middle */}
      <mesh position={[0, 0, d / 2 + 0.05]} castShadow>
        <boxGeometry args={[w * 0.98, h * 0.2, 0.1]}/>
        <meshStandardMaterial color="#f8fafc" roughness={0.5}/>
      </mesh>
    </group>);
}
function PouchMesh({ dx, dy, dz, color }) {
    const w = clamp(dx);
    const d = clamp(dy);
    const h = clamp(dz);
    // Build a pouch-like shape using a slightly rounded/tapered box
    const profile = useMemo(() => {
        const pts = [];
        const halfW = w / 2;
        pts.push(new THREE.Vector2(0, -h / 2));
        pts.push(new THREE.Vector2(halfW * 0.7, -h / 2));
        pts.push(new THREE.Vector2(halfW, -h * 0.35));
        pts.push(new THREE.Vector2(halfW, h * 0.3));
        pts.push(new THREE.Vector2(halfW * 0.85, h * 0.42));
        pts.push(new THREE.Vector2(halfW * 0.5, h / 2));
        pts.push(new THREE.Vector2(0, h / 2));
        return pts;
    }, [w, h]);
    return (<group>
      {/* Pouch body via lathe, scaled to depth */}
      <mesh castShadow receiveShadow scale={[1, 1, d / w]}>
        <latheGeometry args={[profile, 24]}/>
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.05} side={THREE.DoubleSide}/>
      </mesh>
      {/* Top crimp seal */}
      <mesh position={[0, h / 2 + h * 0.03, 0]} castShadow>
        <boxGeometry args={[w * 0.7, h * 0.06, d * 0.8]}/>
        <meshStandardMaterial color="#9ca3af" roughness={0.6} metalness={0.3}/>
      </mesh>
    </group>);
}
function JarMesh({ dx, dy, dz, color }) {
    const w = clamp(Math.min(dx, dy));
    const h = clamp(dz);
    const bodyH = h * 0.72;
    const lidH = h * 0.28;
    const bodyR = w / 2;
    const lidR = bodyR * 1.08;
    return (<group>
      {/* Glass body */}
      <mesh position={[0, -lidH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[bodyR, bodyR, bodyH, 32]}/>
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.1} transparent opacity={0.7}/>
      </mesh>
      {/* Lid */}
      <mesh position={[0, bodyH / 2 - lidH / 2 + 0.05, 0]} castShadow>
        <cylinderGeometry args={[lidR, lidR, lidH, 32]}/>
        <meshStandardMaterial color="#6b7280" roughness={0.4} metalness={0.5}/>
      </mesh>
      {/* Lid rim detail */}
      <mesh position={[0, bodyH / 2 + 0.02, 0]} castShadow>
        <torusGeometry args={[lidR * 0.95, lidR * 0.04, 8, 32]}/>
        <meshStandardMaterial color="#4b5563" roughness={0.4} metalness={0.6}/>
      </mesh>
    </group>);
}
function DiamondMesh() {
    return (<mesh castShadow receiveShadow>
      <octahedronGeometry args={[1, 0]}/>
      <meshStandardMaterial color="#06b6d4" roughness={0.1} metalness={0.5} flatShading/>
    </mesh>);
}
// ─── Main component ───────────────────────────────────────────────
/** Render a single shape at a given Y offset (for nesting) */
function ShapeRenderer({ shape, dimX, dimY, dimZ, color, yOffset, customGeometry, }) {
    function renderShape() {
        // If we have a custom imported geometry, render it scaled to fit the bounding box
        if (customGeometry) {
            const scaleX = dimX / customGeometry.dimensions.length;
            const scaleY = dimZ / customGeometry.dimensions.height; // packing Z → world Y
            const scaleZ = dimY / customGeometry.dimensions.width; // packing Y → world Z
            return (<mesh castShadow receiveShadow scale={[scaleX, scaleY, scaleZ]}>
          <bufferGeometry attach="geometry" {...customGeometry.geometry}/>
          <meshStandardMaterial color={color} roughness={0.45} metalness={0.15} side={THREE.DoubleSide}/>
        </mesh>);
        }
        switch (shape) {
            case 'bottle':
                return <BottleMesh dx={dimX} dy={dimY} dz={dimZ} color={color}/>;
            case 'cup':
                return <CupMesh dx={dimX} dy={dimY} dz={dimZ} color={color}/>;
            case 'can':
                return <CanMesh dx={dimX} dy={dimY} dz={dimZ} color={color}/>;
            case 'phone':
                return <PhoneMesh dx={dimX} dy={dimY} dz={dimZ} color={color}/>;
            case 'packet':
                return <PacketMesh dx={dimX} dy={dimY} dz={dimZ} color={color}/>;
            case 'pouch':
                return <PouchMesh dx={dimX} dy={dimY} dz={dimZ} color={color}/>;
            case 'jar':
                return <JarMesh dx={dimX} dy={dimY} dz={dimZ} color={color}/>;
            case 'diamond':
                return <DiamondMesh dx={dimX} dy={dimY} dz={dimZ}/>;
            case 'sphere':
                return (<mesh castShadow receiveShadow>
            <sphereGeometry args={[clamp(Math.min(dimX, dimY, dimZ) / 2), 32, 16]}/>
            <meshStandardMaterial color={color} roughness={0.3} metalness={0.1}/>
          </mesh>);
            case 'cylinder':
                return (<mesh castShadow receiveShadow>
            <cylinderGeometry args={[clamp(Math.min(dimX, dimY) / 2), clamp(Math.min(dimX, dimY) / 2), clamp(dimZ), 32]}/>
            <meshStandardMaterial color={color} roughness={0.4} metalness={0.1}/>
          </mesh>);
            case 'custom':
                return (<mesh castShadow receiveShadow>
            <boxGeometry args={[dimX * 0.9, clamp(dimZ), dimY * 0.9]}/>
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.1}/>
          </mesh>);
            case 'box':
            default:
                return (<mesh castShadow receiveShadow>
            <boxGeometry args={[dimX, dimZ, dimY]}/>
            <meshStandardMaterial color={color} roughness={0.45} metalness={0.1}/>
          </mesh>);
        }
    }
    return (<group position={[0, yOffset, 0]}>
      {renderShape()}
    </group>);
}
export function ProductMesh({ item, customGeometry }) {
    const { shape, dimX, dimY, dimZ, color, nestedCount, nestedOffsets } = item;
    // World-space center of the stack's bounding box
    const cx = item.posX + dimX / 2;
    const cy = item.posZ + dimZ / 2; // packing Z → world Y
    const cz = item.posY + dimY / 2; // packing Y → world Z
    // For nested items, render each copy at its Z offset within the stack.
    // The first item sits at the bottom; subsequent ones slide in above.
    // Each individual item uses the original (un-nested) height.
    if (nestedCount > 1 && nestedOffsets && nestedOffsets.length > 1) {
        const wallT = nestedOffsets[1] - nestedOffsets[0];
        // Height of a single item (without nesting): totalStackHeight - (N-1)*wallT
        const singleItemHeight = dimZ - (nestedCount - 1) * wallT;
        // Center the stack vertically within the bounding box
        // The group origin is at the center of the bounding box (cy).
        // Each item's center is at: -dimZ/2 + offset + singleItemHeight/2
        return (<group position={[cx, cy, cz]}>
        {nestedOffsets.map((offset, i) => {
                const itemCenterY = -dimZ / 2 + offset + singleItemHeight / 2;
                // Slightly vary opacity to show nesting layers
                return (<group key={i} position={[0, itemCenterY, 0]}>
              <ShapeRenderer shape={shape} dimX={dimX} dimY={dimY} dimZ={singleItemHeight} color={color} yOffset={0} customGeometry={customGeometry}/>
            </group>);
            })}
      </group>);
    }
    // Single item (no nesting)
    return (<group position={[cx, cy, cz]}>
      <ShapeRenderer shape={shape} dimX={dimX} dimY={dimY} dimZ={dimZ} color={color} yOffset={0} customGeometry={customGeometry}/>
    </group>);
}
