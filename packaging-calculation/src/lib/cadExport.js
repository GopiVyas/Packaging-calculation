/**
 * Export the packed scene as an STL file.
 * Each packed item becomes a mesh in the STL.
 * The carton is included as a wireframe-like box.
 */
export function exportPackedSceneAsSTL(items, carton, customGeometries) {
    const triangles = [];
    // Carton outer box (as a thin shell)
    const cl = carton.length;
    const cw = carton.width;
    const ch = carton.height;
    const t = 0.1; // wall thickness for visualization
    // Carton bottom
    addBoxTriangles(triangles, 0, 0, 0, cl, cw, t);
    // Carton walls (4 sides, no top)
    addBoxTriangles(triangles, 0, 0, 0, t, cw, ch);
    addBoxTriangles(triangles, cl - t, 0, 0, t, cw, ch);
    addBoxTriangles(triangles, 0, 0, 0, cl, t, ch);
    addBoxTriangles(triangles, 0, cw - t, 0, cl, t, ch);
    // Packed items
    for (const item of items) {
        const cx = item.posX + item.dimX / 2;
        const cy = item.posZ + item.dimZ / 2;
        const cz = item.posY + item.dimY / 2;
        // Check if this item has a custom geometry
        const custom = customGeometries.get(item.typeId);
        if (custom) {
            // Transform the custom geometry to the item's position and scale
            const geo = custom.geometry.clone();
            // Scale from original dimensions to placement dimensions
            // Custom geometry is centered at origin; we need to scale and position it
            const scaleX = item.dimX / custom.dimensions.length;
            const scaleY = item.dimY / custom.dimensions.width;
            const scaleZ = item.dimZ / custom.dimensions.height;
            // For nested items, each sub-item is offset
            if (item.nestedCount > 1 && item.nestedOffsets) {
                for (const offset of item.nestedOffsets) {
                    const subGeo = geo.clone();
                    subGeo.scale(scaleX, scaleZ, scaleY);
                    // Position: center of the sub-item in the stack
                    // packing: posX + dimX/2, posZ + offset + singleHeight/2, posY + dimY/2
                    // world mapping: X→X, Z→Y, Y→Z
                    const singleH = item.dimZ - (item.nestedCount - 1) * (item.nestedOffsets[1] - item.nestedOffsets[0]);
                    const wx = cx;
                    const wy = item.posZ + offset + singleH / 2;
                    const wz = cz;
                    subGeo.translate(wx, wy, wz);
                    extractTrianglesFromGeometry(subGeo, triangles);
                }
            }
            else {
                geo.scale(scaleX, scaleZ, scaleY);
                geo.translate(cx, cy, cz);
                extractTrianglesFromGeometry(geo, triangles);
            }
        }
        else {
            // Standard box for the item
            if (item.nestedCount > 1 && item.nestedOffsets) {
                const wallT = item.nestedOffsets[1] - item.nestedOffsets[0];
                const singleH = item.dimZ - (item.nestedCount - 1) * wallT;
                for (const offset of item.nestedOffsets) {
                    addBoxTriangles(triangles, item.posX, item.posY, item.posZ + offset, item.dimX, item.dimY, singleH);
                }
            }
            else {
                addBoxTriangles(triangles, item.posX, item.posY, item.posZ, item.dimX, item.dimY, item.dimZ);
            }
        }
    }
    return buildASCIISTL(triangles);
}
function addBoxTriangles(triangles, x, y, z, dx, dy, dz) {
    // Generate the 12 triangles of a box
    // Using packing coordinates: x, y are floor, z is height
    // STL uses Z-up, so we map packing Z → STL Z, packing X → STL X, packing Y → STL Y
    const p = [
        [x, y, z], [x + dx, y, z], [x + dx, y + dy, z], [x, y + dy, z],
        [x, y, z + dz], [x + dx, y, z + dz], [x + dx, y + dy, z + dz], [x, y + dy, z + dz],
    ];
    // 6 faces, 2 triangles each
    const faces = [
        [0, 1, 2, 3], // bottom
        [4, 7, 6, 5], // top
        [0, 4, 5, 1], // front
        [1, 5, 6, 2], // right
        [2, 6, 7, 3], // back
        [3, 7, 4, 0], // left
    ];
    for (const [a, b, c, d] of faces) {
        const v1 = p[a];
        const v2 = p[b];
        const v3 = p[c];
        const v4 = p[d];
        const normal = computeNormal(v1, v2, v3);
        triangles.push({ normal, v1, v2, v3 });
        triangles.push({ normal, v1: v1, v2: v3, v3: v4 });
    }
}
function extractTrianglesFromGeometry(geo, triangles) {
    const pos = geo.getAttribute('position');
    const index = geo.getIndex();
    if (index) {
        for (let i = 0; i < index.count; i += 3) {
            const a = index.getX(i);
            const b = index.getX(i + 1);
            const c = index.getX(i + 2);
            const v1 = [pos.getX(a), pos.getY(a), pos.getZ(a)];
            const v2 = [pos.getX(b), pos.getY(b), pos.getZ(b)];
            const v3 = [pos.getX(c), pos.getY(c), pos.getZ(c)];
            const normal = computeNormal(v1, v2, v3);
            triangles.push({ normal, v1, v2, v3 });
        }
    }
    else {
        for (let i = 0; i < pos.count; i += 3) {
            const v1 = [pos.getX(i), pos.getY(i), pos.getZ(i)];
            const v2 = [pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1)];
            const v3 = [pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2)];
            const normal = computeNormal(v1, v2, v3);
            triangles.push({ normal, v1, v2, v3 });
        }
    }
}
function computeNormal(v1, v2, v3) {
    const ux = v2[0] - v1[0];
    const uy = v2[1] - v1[1];
    const uz = v2[2] - v1[2];
    const vx = v3[0] - v1[0];
    const vy = v3[1] - v1[1];
    const vz = v3[2] - v1[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    return [nx / len, ny / len, nz / len];
}
function buildASCIISTL(triangles) {
    const lines = [];
    lines.push('solid PackVision3D_Export');
    for (const t of triangles) {
        lines.push(`  facet normal ${t.normal[0]} ${t.normal[1]} ${t.normal[2]}`);
        lines.push('    outer loop');
        lines.push(`      vertex ${t.v1[0]} ${t.v1[1]} ${t.v1[2]}`);
        lines.push(`      vertex ${t.v2[0]} ${t.v2[1]} ${t.v2[2]}`);
        lines.push(`      vertex ${t.v3[0]} ${t.v3[1]} ${t.v3[2]}`);
        lines.push('    endloop');
        lines.push('  endfacet');
    }
    lines.push('endsolid PackVision3D_Export');
    return lines.join('\n');
}
/**
 * Trigger a browser download of the STL string.
 */
export function downloadSTL(stlContent, filename = 'packvision-export.stl') {
    const blob = new Blob([stlContent], { type: 'model/stl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
