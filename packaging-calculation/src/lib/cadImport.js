import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
/**
 * Parse a text-based OBJ file into a BufferGeometry.
 * Supports vertices (v), faces (f), and vertex normals (vn).
 */
function parseOBJ(text) {
    const vertices = [];
    const normals = [];
    const indices = [];
    const tempNormals = [];
    const lines = text.split('\n');
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const cmd = parts[0];
        if (cmd === 'v') {
            vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
        }
        else if (cmd === 'vn') {
            tempNormals.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
        }
        else if (cmd === 'f') {
            // Faces: f v/vt/vn or f v//vn or f v
            for (let i = 1; i <= 3; i++) {
                const faceParts = parts[i].split('/');
                const vi = parseInt(faceParts[0]) - 1;
                indices.push(vi);
                if (faceParts[2]) {
                    const ni = parseInt(faceParts[2]) - 1;
                    normals.push(tempNormals[ni * 3], tempNormals[ni * 3 + 1], tempNormals[ni * 3 + 2]);
                }
            }
            // Handle quads (4 vertices) → triangulate
            if (parts.length === 5) {
                const faceParts = parts[1].split('/');
                const faceParts3 = parts[3].split('/');
                const faceParts4 = parts[4].split('/');
                indices.push(parseInt(faceParts[0]) - 1, parseInt(faceParts3[0]) - 1, parseInt(faceParts4[0]) - 1);
                if (faceParts[2] && faceParts3[2] && faceParts4[2]) {
                    normals.push(tempNormals[(parseInt(faceParts[2]) - 1) * 3], tempNormals[(parseInt(faceParts[2]) - 1) * 3 + 1], tempNormals[(parseInt(faceParts[2]) - 1) * 3 + 2]);
                    normals.push(tempNormals[(parseInt(faceParts3[2]) - 1) * 3], tempNormals[(parseInt(faceParts3[2]) - 1) * 3 + 1], tempNormals[(parseInt(faceParts3[2]) - 1) * 3 + 2]);
                    normals.push(tempNormals[(parseInt(faceParts4[2]) - 1) * 3], tempNormals[(parseInt(faceParts4[2]) - 1) * 3 + 1], tempNormals[(parseInt(faceParts4[2]) - 1) * 3 + 2]);
                }
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    if (indices.length > 0) {
        geometry.setIndex(indices);
    }
    if (normals.length > 0) {
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    }
    else {
        geometry.computeVertexNormals();
    }
    return geometry;
}
/**
 * Parse a binary or ASCII STL file into a BufferGeometry.
 */
function parseSTL(buffer) {
    const isBinary = (() => {
        const view = new DataView(buffer);
        // ASCII STL starts with "solid"
        const header = new Uint8Array(buffer, 0, 5);
        let isAscii = true;
        for (let i = 0; i < 5; i++) {
            if (header[i] > 127) {
                isAscii = false;
                break;
            }
        }
        if (!isAscii)
            return true;
        // Even if it starts with "solid", check for binary signature
        const numTriangles = view.getUint32(80, true);
        const expectedBinarySize = 84 + numTriangles * 50;
        return buffer.byteLength === expectedBinarySize;
    })();
    if (isBinary) {
        return parseBinarySTL(buffer);
    }
    return parseASCIISTL(new TextDecoder().decode(buffer));
}
function parseBinarySTL(buffer) {
    const view = new DataView(buffer);
    const numTriangles = view.getUint32(80, true);
    const vertices = [];
    const normals = [];
    let offset = 84;
    for (let i = 0; i < numTriangles; i++) {
        const nx = view.getFloat32(offset, true);
        const ny = view.getFloat32(offset + 4, true);
        const nz = view.getFloat32(offset + 8, true);
        offset += 12;
        for (let j = 0; j < 3; j++) {
            vertices.push(view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true));
            normals.push(nx, ny, nz);
            offset += 12;
        }
        offset += 2; // attribute byte count
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return geometry;
}
function parseASCIISTL(text) {
    const vertices = [];
    const normals = [];
    const lines = text.split('\n');
    let currentNormal = [0, 0, 1];
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('facet normal')) {
            const parts = trimmed.split(/\s+/);
            currentNormal = [
                parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]),
            ];
        }
        else if (trimmed.startsWith('vertex')) {
            const parts = trimmed.split(/\s+/);
            vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
            normals.push(...currentNormal);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return geometry;
}
/**
 * Parse a GLTF/GLB file into a merged BufferGeometry.
 * Extracts all meshes from the scene and merges them.
 */
async function parseGLTF(buffer) {
    const loader = new GLTFLoader();
    const result = await loader.parseAsync(buffer, '');
    const geometries = [];
    result.scene.traverse((child) => {
        if (child.isMesh) {
            const mesh = child;
            const geo = mesh.geometry.clone();
            // Apply mesh's world transform
            mesh.updateWorldMatrix(true, false);
            geo.applyMatrix4(mesh.matrixWorld);
            geometries.push(geo);
        }
    });
    if (geometries.length === 0) {
        throw new Error('No meshes found in GLTF file');
    }
    // Merge all geometries
    const merged = mergeGeometries(geometries);
    return merged;
}
function mergeGeometries(geometries) {
    if (geometries.length === 1)
        return geometries[0];
    // Use BufferGeometryUtils if available, otherwise manual merge
    const positions = [];
    const normals = [];
    for (const geo of geometries) {
        const pos = geo.getAttribute('position');
        const norm = geo.getAttribute('normal');
        const index = geo.getIndex();
        if (index) {
            for (let i = 0; i < index.count; i++) {
                const vi = index.getX(i);
                positions.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
                if (norm)
                    normals.push(norm.getX(vi), norm.getY(vi), norm.getZ(vi));
            }
        }
        else {
            for (let i = 0; i < pos.count; i++) {
                positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
                if (norm)
                    normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
            }
        }
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (normals.length > 0) {
        merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    }
    else {
        merged.computeVertexNormals();
    }
    return merged;
}
/**
 * Import a 3D file and extract geometry with bounding box info.
 */
export async function importCADFile(file) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    let geometry;
    let sourceFormat = ext;
    if (ext === 'obj') {
        const text = await file.text();
        geometry = parseOBJ(text);
    }
    else if (ext === 'stl') {
        const buffer = await file.arrayBuffer();
        geometry = parseSTL(buffer);
    }
    else if (ext === 'gltf' || ext === 'glb') {
        const buffer = await file.arrayBuffer();
        geometry = await parseGLTF(buffer);
    }
    else {
        throw new Error(`Unsupported file format: .${ext}. Supported: .obj, .stl, .gltf, .glb`);
    }
    if (geometry.getAttribute('position').count === 0) {
        throw new Error('File contains no geometry data');
    }
    // Center the geometry on its bounding box
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const center = new THREE.Vector3();
    box.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);
    // Recompute bounding box after centering
    geometry.computeBoundingBox();
    const centeredBox = geometry.boundingBox;
    // Dimensions: map to length(X), width(Y), height(Z)
    const dimensions = {
        length: centeredBox.max.x - centeredBox.min.x,
        width: centeredBox.max.y - centeredBox.min.y,
        height: centeredBox.max.z - centeredBox.min.z,
    };
    // Guard against zero dimensions
    if (dimensions.length < 0.001)
        dimensions.length = 0.001;
    if (dimensions.width < 0.001)
        dimensions.width = 0.001;
    if (dimensions.height < 0.001)
        dimensions.height = 0.001;
    return {
        id: `cad-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        geometry,
        boundingBox: centeredBox,
        dimensions,
        sourceFormat,
    };
}
