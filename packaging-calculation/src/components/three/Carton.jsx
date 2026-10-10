import { useMemo } from 'react';
import * as THREE from 'three';
import { Line, Text, Billboard } from '@react-three/drei';
function DimensionLine({ start, end, label, offset, }) {
    const labelPos = [
        (start[0] + end[0]) / 2 + offset[0],
        (start[1] + end[1]) / 2 + offset[1],
        (start[2] + end[2]) / 2 + offset[2],
    ];
    const tickStart = [
        start[0] + offset[0],
        start[1] + offset[1],
        start[2] + offset[2],
    ];
    const tickEnd = [
        end[0] + offset[0],
        end[1] + offset[1],
        end[2] + offset[2],
    ];
    return (<>
      <Line points={[tickStart, tickEnd]} color="#2563eb" lineWidth={1.5}/>
      <Billboard position={labelPos}>
        <Text fontSize={Math.max(3, Math.min(end[0] - start[0], end[1] - start[1], end[2] - start[2]) * 0.06)} color="#1e40af" anchorX="center" anchorY="middle" outlineWidth={0.5} outlineColor="#ffffff">
          {label}
        </Text>
      </Billboard>
    </>);
}
export function Carton({ carton, transparent, showLabels }) {
    const { length, width, height } = carton;
    // Walls only — bottom + 4 side walls, no top (open carton)
    const wallThickness = Math.min(length, width) * 0.015;
    const wallColor = '#94a3b8';
    const wallOpacity = transparent ? 0.12 : 0.85;
    const segments = useMemo(() => {
        // L, W, H in our world space: X=length, Y=height(packing Z), Z=width(packing Y)
        const L = length;
        const H = height;
        const W = width;
        const t = wallThickness;
        const walls = [
            // bottom
            { args: [L, t, W], position: [L / 2, -t / 2, W / 2] },
            // back wall (high Y side / back Z)
            { args: [L, H, t], position: [L / 2, H / 2, W + t / 2] },
            // front wall (low Z side)
            { args: [L, H, t], position: [L / 2, H / 2, -t / 2] },
            // left wall (low X side)
            { args: [t, H, W], position: [-t / 2, H / 2, W / 2] },
            // right wall (high X side)
            { args: [t, H, W], position: [L + t / 2, H / 2, W / 2] },
        ];
        return walls;
    }, [length, width, height, wallThickness]);
    // Edge lines for the open-top carton
    const edgePoints = useMemo(() => {
        const L = length;
        const H = height;
        const W = width;
        const t = wallThickness;
        const o = t / 2; // outer offset
        const edges = [
            // Bottom edges (outer)
            { from: [-o, -t, -o], to: [L + o, -t, -o] },
            { from: [L + o, -t, -o], to: [L + o, -t, W + o] },
            { from: [L + o, -t, W + o], to: [-o, -t, W + o] },
            { from: [-o, -t, W + o], to: [-o, -t, -o] },
            // Top edges (rim)
            { from: [-o, H, -o], to: [L + o, H, -o] },
            { from: [L + o, H, -o], to: [L + o, H, W + o] },
            { from: [L + o, H, W + o], to: [-o, H, W + o] },
            { from: [-o, H, W + o], to: [-o, H, -o] },
            // Vertical edges
            { from: [-o, -t, -o], to: [-o, H, -o] },
            { from: [L + o, -t, -o], to: [L + o, H, -o] },
            { from: [L + o, -t, W + o], to: [L + o, H, W + o] },
            { from: [-o, -t, W + o], to: [-o, H, W + o] },
        ];
        return edges;
    }, [length, width, height, wallThickness]);
    return (<group>
      {/* Walls */}
      {segments.map((seg, i) => (<mesh key={i} position={seg.position} castShadow receiveShadow>
          <boxGeometry args={seg.args}/>
          <meshStandardMaterial color={wallColor} transparent={transparent || wallOpacity < 1} opacity={wallOpacity} roughness={0.7} metalness={0.05} side={THREE.DoubleSide} depthWrite={!transparent}/>
        </mesh>))}

      {/* Edge lines */}
      {edgePoints.map((edge, i) => (<Line key={`edge-${i}`} points={[edge.from, edge.to]} color="#475569" lineWidth={1.5}/>))}

      {/* Dimension labels */}
      {showLabels && (<>
          {/* Length (X axis) — along bottom front edge */}
          <DimensionLine start={[0, -wallThickness, -wallThickness]} end={[length, -wallThickness, -wallThickness]} label={`L: ${length}`} offset={[0, -height * 0.12, 0]}/>
          {/* Width (Z axis / depth) — along bottom right edge */}
          <DimensionLine start={[length, -wallThickness, 0]} end={[length, -wallThickness, width]} label={`W: ${width}`} offset={[height * 0.12, 0, 0]}/>
          {/* Height (Y axis) — along right back vertical edge */}
          <DimensionLine start={[length + wallThickness, 0, width + wallThickness]} end={[length + wallThickness, height, width + wallThickness]} label={`H: ${height}`} offset={[height * 0.12, 0, 0]}/>
        </>)}
    </group>);
}
