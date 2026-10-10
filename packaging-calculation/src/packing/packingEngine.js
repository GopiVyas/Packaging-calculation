import { NESTABLE_SHAPES } from './types';
/**
 * Heightmap-based 3D bin packing with nesting support.
 *
 * Instead of flat shelf layers, the carton floor is discretized into a grid of
 * cells. Each cell tracks the current top-surface height. When placing an item,
 * we scan the grid for the lowest-cost position where the item's footprint fits
 * entirely — meaning all cells under the footprint are at the same height and
 * that height + item height <= carton height. The item then "sits" on that
 * surface and the grid heights under it are raised.
 *
 * This lets items rest on top of other items of different heights (not just
 * flat layers), dramatically improving space utilization. All 6 axis-aligned
 * orientations are tried for each item.
 *
 * Nesting: hollow items (cups, jars) of the same type can stack inside each
 * other. A stack of N items has the footprint of one item and height =
 * itemHeight + (N-1) * wallThickness.
 *
 * Coordinates use a bottom-front-left origin:
 *   X = length (left→right), Y = width (front→back), Z = height (bottom→top)
 */
const EPS = 1e-4;
/**
 * Discretization resolution. We use a cell size that divides common dimensions
 * reasonably. Smaller = more precise but slower. We adapt to the carton size.
 */
function getCellSize(carton) {
    const maxDim = Math.max(carton.length, carton.width);
    // Target ~80-120 cells along the longest axis, clamped to sane bounds
    let cs = maxDim / 100;
    // Round to a "nice" number
    if (cs > 1)
        cs = Math.floor(cs);
    else if (cs > 0.5)
        cs = 0.5;
    else if (cs > 0.25)
        cs = 0.25;
    else if (cs > 0.1)
        cs = 0.1;
    else
        cs = Math.max(cs, 0.05);
    return cs;
}
/**
 * The heightmap: a 2D grid where each cell stores the current top height.
 * We also track which placed box occupies the top of each cell so we can
 * detect when a surface is contiguous (all same box) or fragmented.
 */
class Heightmap {
    constructor(carton) {
        Object.defineProperty(this, "grid", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cols", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "rows", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cell", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.cell = getCellSize(carton);
        this.cols = Math.max(1, Math.round(carton.length / this.cell));
        this.rows = Math.max(1, Math.round(carton.width / this.cell));
        // Adjust cell size to exactly divide the carton
        this.cell = carton.length / this.cols;
        this.grid = new Float32Array(this.cols * this.rows);
    }
    /** Get height at cell (col, row) */
    get(col, row) {
        return this.grid[row * this.cols + col];
    }
    /** Set height at cell (col, row) */
    set(col, row, v) {
        this.grid[row * this.cols + col] = v;
    }
    /**
     * Find the best position to place an item of size (dx, dy) on the grid.
     * "Best" = lowest surface height, then lowest Y (front), then lowest X.
     * Returns the placement or null if it doesn't fit anywhere.
     */
    findBestPlacement(dx, dy, dz, carton) {
        const itemCols = Math.ceil(dx / this.cell - EPS);
        const itemRows = Math.ceil(dy / this.cell - EPS);
        if (itemCols > this.cols || itemRows > this.rows)
            return null;
        let best = null;
        // Scan all possible positions
        for (let row = 0; row <= this.rows - itemRows; row++) {
            for (let col = 0; col <= this.cols - itemCols; col++) {
                // Find the max height under the footprint (must be uniform for stable placement)
                let surfaceH = -1;
                let uniform = true;
                for (let r = row; r < row + itemRows; r++) {
                    for (let c = col; c < col + itemCols; c++) {
                        const h = this.get(c, r);
                        if (surfaceH < 0) {
                            surfaceH = h;
                        }
                        else if (Math.abs(h - surfaceH) > this.cell * 0.5) {
                            uniform = false;
                            break;
                        }
                        // Keep the max so we don't float
                        if (h > surfaceH)
                            surfaceH = h;
                    }
                    if (!uniform)
                        break;
                }
                // If not perfectly uniform, use the max height (item sits on highest point)
                if (!uniform) {
                    surfaceH = 0;
                    for (let r = row; r < row + itemRows; r++) {
                        for (let c = col; c < col + itemCols; c++) {
                            surfaceH = Math.max(surfaceH, this.get(c, r));
                        }
                    }
                }
                // Check it fits vertically
                if (surfaceH + dz > carton.height + EPS)
                    continue;
                // Score: prefer lowest height, then front-most (lowest y), then left-most (lowest x)
                const score = surfaceH * 1e6 + row * 1e3 + col;
                if (best === null || score < best.score) {
                    const x = col * this.cell;
                    const y = row * this.cell;
                    best = { x, y, z: surfaceH, score };
                }
            }
        }
        return best ? { x: best.x, y: best.y, z: best.z } : null;
    }
    /** Raise the heightmap under a placed item */
    raise(x, y, dx, dy, newH) {
        const col0 = Math.round(x / this.cell);
        const row0 = Math.round(y / this.cell);
        const col1 = Math.min(this.cols, Math.ceil((x + dx) / this.cell));
        const row1 = Math.min(this.rows, Math.ceil((y + dy) / this.cell));
        for (let r = row0; r < row1; r++) {
            for (let c = col0; c < col1; c++) {
                if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
                    this.grid[r * this.cols + c] = newH;
                }
            }
        }
    }
}
/**
 * Generate all 6 orientations of a box (dx, dy, dz).
 * We keep Z as height (don't lay items on their side unless they fit better).
 * Actually for packing we try swapping X/Y (rotate on floor) and also
 * Z with X or Y (stand on side) — all 6 permutations.
 */
function getOrientations(dx, dy, dz) {
    const perms = [
        [dx, dy, dz],
        [dy, dx, dz],
        [dx, dz, dy],
        [dz, dx, dy],
        [dy, dz, dx],
        [dz, dy, dx],
    ];
    // Deduplicate (in case some dims are equal)
    const seen = new Set();
    const result = [];
    for (const [a, b, c] of perms) {
        const key = `${a}|${b}|${c}`;
        if (!seen.has(key)) {
            seen.add(key);
            result.push({ dx: a, dy: b, dz: c });
        }
    }
    return result;
}
/**
 * Group nestable items of the same type into stacks.
 * stackHeight(N) = itemHeight + (N-1) * wallThickness
 */
function buildNestableStacks(productTypes, carton) {
    const units = [];
    for (const pt of productTypes) {
        if (pt.quantity === 0)
            continue;
        const isNestable = NESTABLE_SHAPES.includes(pt.shape);
        const wallT = pt.wallThickness ?? Math.max(0.1, pt.height * 0.04);
        if (!isNestable) {
            for (let i = 0; i < pt.quantity; i++) {
                units.push({
                    typeId: pt.id, name: pt.name, shape: pt.shape, color: pt.color,
                    dimX: pt.length, dimY: pt.width, dimZ: pt.height,
                    count: 1, wallThickness: wallT,
                });
            }
            continue;
        }
        // Max stack that fits carton height
        const maxStackByHeight = Math.floor((carton.height - pt.height) / wallT + 1);
        const maxStack = Math.max(1, maxStackByHeight);
        let remaining = pt.quantity;
        while (remaining > 0) {
            const stackSize = Math.min(maxStack, remaining);
            const stackHeight = pt.height + (stackSize - 1) * wallT;
            const nestedOffsets = [];
            for (let i = 0; i < stackSize; i++)
                nestedOffsets.push(i * wallT);
            units.push({
                typeId: pt.id, name: pt.name, shape: pt.shape, color: pt.color,
                dimX: pt.length, dimY: pt.width, dimZ: stackHeight,
                count: stackSize, nestedOffsets, wallThickness: wallT,
            });
            remaining -= stackSize;
        }
    }
    return units;
}
/** Build individual units (no nesting) */
function buildIndividualUnits(productTypes) {
    const units = [];
    for (const pt of productTypes) {
        if (pt.quantity === 0)
            continue;
        for (let i = 0; i < pt.quantity; i++) {
            units.push({
                typeId: pt.id, name: pt.name, shape: pt.shape, color: pt.color,
                dimX: pt.length, dimY: pt.width, dimZ: pt.height,
                count: 1, wallThickness: pt.wallThickness,
            });
        }
    }
    return units;
}
export function packProducts(carton, productTypes, nestingEnabled = true) {
    const warnings = [];
    if (carton.length <= 0 || carton.width <= 0 || carton.height <= 0) {
        warnings.push('Carton dimensions must be positive values.');
        return {
            items: [], packedCount: 0, requestedCount: 0, layers: 0,
            usedVolume: 0, cartonVolume: 0, efficiency: 0, warnings,
            productTypeCounts: {}, nestingEnabled, nestedStacks: 0, spaceSaved: 0,
        };
    }
    const units = nestingEnabled
        ? buildNestableStacks(productTypes, carton)
        : buildIndividualUnits(productTypes);
    const requestedCount = productTypes.reduce((sum, pt) => sum + pt.quantity, 0);
    // Sort: largest volume first, then tallest — big items are hardest to place
    units.sort((a, b) => b.dimX * b.dimY * b.dimZ - a.dimX * a.dimY * a.dimZ ||
        b.dimZ - a.dimZ);
    // Warn about items that can't fit at all
    for (const pt of productTypes) {
        if (pt.quantity === 0)
            continue;
        const orients = getOrientations(pt.length, pt.width, pt.height);
        const fits = orients.some((o) => o.dx <= carton.length + EPS &&
            o.dy <= carton.width + EPS &&
            o.dz <= carton.height + EPS);
        if (!fits) {
            warnings.push(`"${pt.name}" (${pt.length}x${pt.width}x${pt.height}) cannot fit in the carton (${carton.length}x${carton.width}x${carton.height}) in any orientation.`);
        }
    }
    const heightmap = new Heightmap(carton);
    const placedBoxes = [];
    const items = [];
    const productTypeCounts = {};
    let packedCount = 0;
    let nestedStacks = 0;
    for (const unit of units) {
        // Try all 6 orientations, pick the one that fits at the lowest height
        let bestPlacement = null;
        let bestScore = Infinity;
        for (const orient of getOrientations(unit.dimX, unit.dimY, unit.dimZ)) {
            if (orient.dx > carton.length + EPS ||
                orient.dy > carton.width + EPS ||
                orient.dz > carton.height + EPS)
                continue;
            const pos = heightmap.findBestPlacement(orient.dx, orient.dy, orient.dz, carton);
            if (pos) {
                // Score: prefer lowest Z, then smallest footprint waste, then front-left
                const waste = (carton.length - orient.dx) + (carton.width - orient.dy);
                const score = pos.z * 1e6 + waste * 1e3 + pos.y * 10 + pos.x;
                if (score < bestScore) {
                    bestScore = score;
                    bestPlacement = { ...pos, dx: orient.dx, dy: orient.dy, dz: orient.dz };
                }
            }
        }
        if (bestPlacement) {
            const { x, y, z, dx, dy, dz } = bestPlacement;
            // Record the placed box
            placedBoxes.push({ x, y, z, dx, dy, dz, unit });
            // Raise the heightmap
            heightmap.raise(x, y, dx, dy, z + dz);
            // Determine layer number by counting how many boxes are directly below
            let layer = 0;
            if (z > EPS) {
                // Count distinct surfaces below this item
                const belowBoxes = placedBoxes.filter((b) => b.unit !== unit &&
                    b.x < x + dx - EPS && b.x + b.dx > x + EPS &&
                    b.y < y + dy - EPS && b.y + b.dy > y + EPS &&
                    Math.abs(b.z + b.dz - z) < heightmap.cell * 0.5);
                if (belowBoxes.length > 0) {
                    const maxBelowLayer = Math.max(...belowBoxes.map((b) => {
                        const idx = placedBoxes.indexOf(b);
                        return items[idx]?.layer ?? 0;
                    }));
                    layer = maxBelowLayer + 1;
                }
            }
            const item = {
                typeId: unit.typeId,
                name: unit.name,
                shape: unit.shape,
                color: unit.color,
                dimX: dx, dimY: dy, dimZ: dz,
                posX: x, posY: y, posZ: z,
                layer,
                nestedCount: unit.count,
                nestedOffsets: unit.nestedOffsets,
            };
            items.push(item);
            productTypeCounts[unit.typeId] = (productTypeCounts[unit.typeId] || 0) + unit.count;
            packedCount += unit.count;
            if (unit.count > 1)
                nestedStacks++;
        }
    }
    // Calculate volumes
    const usedVolume = items.reduce((sum, it) => sum + it.dimX * it.dimY * it.dimZ, 0);
    const cartonVolume = carton.length * carton.width * carton.height;
    // Calculate space saved by nesting
    let spaceSaved = 0;
    if (nestingEnabled) {
        for (const it of items) {
            if (it.nestedCount > 1 && it.nestedOffsets) {
                const wallT = it.nestedOffsets[1] - it.nestedOffsets[0];
                const singleH = it.dimZ - (it.nestedCount - 1) * wallT;
                const fullHeight = it.nestedCount * singleH;
                spaceSaved += it.dimX * it.dimY * (fullHeight - it.dimZ);
            }
        }
    }
    // Layers = max layer number + 1 (or 0 if nothing placed)
    const layers = items.length > 0 ? Math.max(...items.map((it) => it.layer)) + 1 : 0;
    if (packedCount < requestedCount) {
        warnings.push(`Only ${packedCount} of ${requestedCount} products fit in the carton. ${requestedCount - packedCount} item(s) could not be placed.`);
    }
    return {
        items, packedCount, requestedCount, layers,
        usedVolume, cartonVolume,
        efficiency: cartonVolume > 0 ? (usedVolume / cartonVolume) * 100 : 0,
        warnings, productTypeCounts,
        nestingEnabled, nestedStacks, spaceSaved,
    };
}
