import { useMemo } from 'react';
import { Line, Text, Billboard } from '@react-three/drei';
/**
 * Standalone dimension lines rendered outside the carton for orthographic views.
 * Drawn on the ground plane and side so they're visible from top/front/side.
 */
export function DimensionLabels({ carton }) {
    const { length, width, height } = carton;
    const L = length;
    const W = width;
    const H = height;
    const fontSize = Math.max(L, W, H) * 0.05;
    const arrowSize = Math.max(L, W, H) * 0.02;
    const offset = Math.max(L, W, H) * 0.08;
    const lines = useMemo(() => {
        const result = [
            // Length along front (X axis), below the carton
            {
                from: [0, -offset, 0],
                to: [L, -offset, 0],
                label: `L: ${L}`,
                labelPos: [L / 2, -offset, 0],
            },
            // Width along side (Z axis), to the right of carton
            {
                from: [L + offset, 0, 0],
                to: [L + offset, 0, W],
                label: `W: ${W}`,
                labelPos: [L + offset, 0, W / 2],
            },
            // Height (Y axis), to the right-back
            {
                from: [L + offset, 0, W + offset],
                to: [L + offset, H, W + offset],
                label: `H: ${H}`,
                labelPos: [L + offset, H / 2, W + offset],
            },
        ];
        return result;
    }, [L, W, H, offset]);
    return (<group>
      {lines.map((line, i) => (<group key={i}>
          <Line points={[line.from, line.to]} color="#2563eb" lineWidth={2}/>
          {/* Tick marks at ends */}
          <Line points={[
                [line.from[0] - arrowSize, line.from[1], line.from[2]],
                [line.from[0] + arrowSize, line.from[1], line.from[2]],
            ]} color="#2563eb" lineWidth={2}/>
          <Line points={[
                [line.to[0] - arrowSize, line.to[1], line.to[2]],
                [line.to[0] + arrowSize, line.to[1], line.to[2]],
            ]} color="#2563eb" lineWidth={2}/>
          <Billboard position={line.labelPos}>
            <Text fontSize={fontSize} color="#1e40af" anchorX="center" anchorY="middle" outlineWidth={0.6} outlineColor="#ffffff">
              {line.label}
            </Text>
          </Billboard>
        </group>))}
    </group>);
}
