import { IDS, PROPS } from '../data/items';
import { InventorySlot, WorldData, NPC } from '../types';

// Deterministic RNG. World generation never depends on Math.random().
class RNG {
    seed: number;

    constructor(seedString: string) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < seedString.length; i++) {
            h ^= seedString.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        this.seed = h >>> 0;
    }

    next(): number {
        this.seed = (this.seed + 0x6D2B79F5) | 0;
        let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    range(min: number, max: number): number {
        return min + this.next() * (max - min);
    }

    int(min: number, max: number): number {
        return Math.floor(this.range(min, max + 1));
    }

    chance(oneIn: number): boolean {
        return this.next() < 1 / Math.max(1, oneIn);
    }
}

const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

const hashString = (s: string): number => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

const valueNoise = (x: number, seed: number, scale: number): number => {
    const p = x / scale;
    const i0 = Math.floor(p);
    const t = smooth(p - i0);

    const h = (n: number) => {
        let v = Math.imul(n ^ seed, 374761393);
        v = Math.imul(v ^ (v >>> 13), 1274126177);
        return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
    };

    return lerp(h(i0), h(i0 + 1), t) * 2 - 1;
};

const surfaceHeight = (
    x: number,
    width: number,
    height: number,
    seed: number
): number => {
    const center = width / 2;
    const edgeDistance = Math.min(x, width - 1 - x);
    const edgeFactor = clamp(edgeDistance / Math.max(1, width * 0.13), 0, 1);

    const broad = valueNoise(x, seed, 180) * 18;
    const medium = valueNoise(x + 71, seed ^ 0x9e3779b9, 55) * 7;
    const detail = valueNoise(x + 913, seed ^ 0x85ebca6b, 18) * 2.2;

    // Flat spawn area, gentle rolling terrain elsewhere.
    const centerFlatten = clamp(Math.abs(x - center) / Math.max(1, width * 0.10), 0, 1);
    const flatten = smooth(centerFlatten);

    const base = height * 0.285;
    const raw = base + (broad + medium + detail) * flatten;
    const coastalLift = (1 - edgeFactor) * 2;

    return Math.floor(clamp(raw + coastalLift, height * 0.22, height * 0.38));
};

const isSolidId = (id: number) => !!(id && PROPS[id]?.solid);

const findSurface = (
    world: Uint16Array,
    width: number,
    height: number,
    x: number
): number => {
    x = clamp(Math.floor(x), 0, width - 1);
    for (let y = 1; y < height; y++) {
        if (isSolidId(world[y * width + x])) return y;
    }
    return Math.floor(height * 0.3);
};

export const generateWorld = (
    world: Uint16Array,
    walls: Uint16Array,
    chests: Record<string, InventorySlot[]>,
    npcs: NPC[],
    worldData: WorldData
) => {
    const rng = new RNG(worldData.seed);
    const seedHash = hashString(worldData.seed);
    const w = worldData.width;
    const h = worldData.height;

    world.fill(0);
    walls.fill(0);

    const surfaceHeights = new Int32Array(w);

    const surfaceBase = Math.floor(h * 0.285);
    const undergroundStart = Math.floor(h * 0.43);
    const cavernStart = Math.floor(h * 0.61);
    const hellLevel = h - Math.max(35, Math.floor(h * 0.18));

    // ------------------------------------------------------------
    // Pass 1: smooth, connected surface + layered underground
    // ------------------------------------------------------------
    for (let x = 0; x < w; x++) {
        surfaceHeights[x] = surfaceHeight(x, w, h, seedHash);
    }

    // Hard cap the maximum step between neighboring columns. This is the
    // important "no floating grass / air gap" rule for the overworld.
    for (let pass = 0; pass < 3; pass++) {
        for (let x = 1; x < w; x++) {
            surfaceHeights[x] = clamp(
                surfaceHeights[x],
                surfaceHeights[x - 1] - 2,
                surfaceHeights[x - 1] + 2
            );
        }

        for (let x = w - 2; x >= 0; x--) {
            surfaceHeights[x] = clamp(
                surfaceHeights[x],
                surfaceHeights[x + 1] - 2,
                surfaceHeights[x + 1] + 2
            );
        }
    }

    // Flatten a generous spawn area.
    const spawnCenter = Math.floor(w / 2);
    const spawnRadius = Math.floor(Math.min(38, w * 0.055));
    for (let x = Math.max(1, spawnCenter - spawnRadius); x <= Math.min(w - 2, spawnCenter + spawnRadius); x++) {
        const t = Math.abs(x - spawnCenter) / Math.max(1, spawnRadius);
        surfaceHeights[x] = Math.floor(lerp(surfaceHeights[x], surfaceHeights[spawnCenter], 1 - t));
    }

    for (let x = 0; x < w; x++) {
        const sy = surfaceHeights[x];

        for (let y = 0; y < h; y++) {
            const idx = y * w + x;

            if (y < sy) {
                world[idx] = IDS.AIR;
                walls[idx] = 0;
                continue;
            }

            if (y >= hellLevel) {
                world[idx] = IDS.ASH_BLOCK || IDS.STONE_BLOCK || 1;
                continue;
            }

            if (y === sy) {
                world[idx] = IDS.GRASS_BLOCK || IDS.DIRT_BLOCK || 2;
            } else if (y < undergroundStart) {
                world[idx] = IDS.DIRT_BLOCK || 2;
                walls[idx] = IDS.DIRT_WALL || 0;
            } else {
                world[idx] = IDS.STONE_BLOCK || 1;
                walls[idx] = IDS.STONE_WALL || 0;
            }
        }
    }

    // Guaranteed connected surface shell. This also repairs tiny pockets
    // generated by any later world decoration.
    for (let x = 1; x < w - 1; x++) {
        const sy = surfaceHeights[x];
        for (let y = sy; y <= Math.min(h - 1, sy + 5); y++) {
            const idx = y * w + x;
            if (!isSolidId(world[idx])) {
                world[idx] = y === sy
                    ? (IDS.GRASS_BLOCK || IDS.DIRT_BLOCK || 2)
                    : (y < undergroundStart ? (IDS.DIRT_BLOCK || 2) : (IDS.STONE_BLOCK || 1));
            }
        }
    }

    // ------------------------------------------------------------
    // Pass 2: caves / pockets, always kept below the surface shell
    // ------------------------------------------------------------
    const digBlob = (
        startX: number,
        startY: number,
        radius: number,
        length: number,
        lowerBound: number,
        upperBound: number
    ) => {
        let cx = startX;
        let cy = startY;
        let vx = rng.range(-1, 1);
        let vy = rng.range(-0.7, 0.7);
        let r = radius;

        for (let step = 0; step < length; step++) {
            const rr = Math.ceil(r);

            for (let dy = -rr; dy <= rr; dy++) {
                for (let dx = -rr; dx <= rr; dx++) {
                    if (dx * dx + dy * dy > r * r) continue;

                    const tx = Math.floor(cx + dx);
                    const ty = Math.floor(cy + dy);

                    if (tx < 2 || tx >= w - 2 || ty < lowerBound || ty >= upperBound) continue;

                    // Leave a thick roof around the overworld.
                    if (ty <= surfaceHeights[tx] + 9) continue;

                    const idx = ty * w + tx;
                    world[idx] = IDS.AIR;
                    walls[idx] = 0;
                }
            }

            cx += vx;
            cy += vy;

            vx += rng.range(-0.24, 0.24);
            vy += rng.range(-0.18, 0.18);

            const speed = Math.hypot(vx, vy) || 1;
            if (speed > 1.8) {
                vx = vx / speed * 1.8;
                vy = vy / speed * 1.8;
            }

            cx = clamp(cx, 8, w - 9);
            cy = clamp(cy, lowerBound + 2, upperBound - 2);

            if (rng.chance(18)) {
                r = clamp(r + rng.range(-0.55, 0.55), radius * 0.65, radius * 1.6);
            }
        }
    };

    const areaScale = (w * h) / 240000;
    const mainCaves = Math.floor(28 * areaScale);
    const smallCaves = Math.floor(90 * areaScale);

    for (let i = 0; i < mainCaves; i++) {
        const startY = rng.int(undergroundStart + 6, Math.max(undergroundStart + 7, cavernStart + 20));
        digBlob(
            rng.range(20, w - 20),
            startY,
            rng.range(2.5, 4.4),
            rng.int(55, 150),
            undergroundStart,
            hellLevel - 5
        );
    }

    for (let i = 0; i < smallCaves; i++) {
        digBlob(
            rng.range(10, w - 10),
            rng.range(undergroundStart + 8, hellLevel - 8),
            rng.range(1.1, 2.2),
            rng.int(15, 42),
            undergroundStart,
            hellLevel - 4
        );
    }

    // A few wider chambers make exploration more interesting.
    for (let i = 0; i < Math.max(3, Math.floor(areaScale * 5)); i++) {
        const cx = rng.int(30, w - 31);
        const cy = rng.int(cavernStart, hellLevel - 25);
        const rx = rng.int(7, 14);
        const ry = rng.int(4, 8);

        for (let y = cy - ry; y <= cy + ry; y++) {
            for (let x = cx - rx; x <= cx + rx; x++) {
                if (x < 2 || x >= w - 2 || y < 2 || y >= hellLevel - 2) continue;

                const nx = (x - cx) / rx;
                const ny = (y - cy) / ry;

                if (nx * nx + ny * ny <= 1.0 && y > surfaceHeights[x] + 10) {
                    world[y * w + x] = IDS.AIR;
                    walls[y * w + x] = 0;
                }
            }
        }
    }

    // ------------------------------------------------------------
    // Pass 3: ore veins
    // ------------------------------------------------------------
    const generateVein = (
        tileId: number,
        attempts: number,
        size: number,
        minY: number,
        maxY: number,
        replaceOnly?: number[]
    ) => {
        if (!tileId) return;

        for (let i = 0; i < attempts; i++) {
            let cx = rng.range(5, w - 5);
            let cy = rng.range(minY, maxY);

            for (let j = 0; j < size; j++) {
                const tx = Math.floor(cx);
                const ty = Math.floor(cy);

                if (tx > 1 && tx < w - 2 && ty > 1 && ty < h - 1) {
                    const idx = ty * w + tx;
                    const current = world[idx];

                    const replaceable = replaceOnly
                        ? replaceOnly.includes(current)
                        : current !== IDS.AIR && ![IDS.CHEST, IDS.WOOD].includes(current);

                    if (replaceable) world[idx] = tileId;
                }

                cx += rng.range(-1.1, 1.1);
                cy += rng.range(-0.9, 0.9);
            }
        }
    };

    const basicScale = areaScale * 0.9;

    generateVein(IDS.COPPER_ORE, Math.floor(230 * basicScale), 8, surfaceBase + 12, hellLevel - 25);
    generateVein(IDS.IRON_ORE, Math.floor(180 * basicScale), 7, undergroundStart - 5, hellLevel - 20);
    generateVein(IDS.SILVER_ORE, Math.floor(135 * basicScale), 7, undergroundStart + 12, hellLevel - 15);
    generateVein(IDS.GOLD_ORE, Math.floor(110 * basicScale), 6, cavernStart - 10, hellLevel - 10);
    generateVein(IDS.DEMONITE_ORE, Math.floor(38 * basicScale), 5, cavernStart + 10, hellLevel - 10);

    generateVein(
        IDS.HELLSTONE,
        Math.floor(320 * basicScale),
        8,
        hellLevel,
        h - 1,
        [IDS.ASH_BLOCK || IDS.STONE_BLOCK]
    );

    const gems = [
        IDS.AMETHYST,
        IDS.TOPAZ,
        IDS.SAPPHIRE,
        IDS.EMERALD,
        IDS.RUBY,
        IDS.DIAMOND
    ];

    gems.forEach((id, index) => {
        if (!id) return;
        generateVein(
            id,
            Math.floor(28 * basicScale),
            4,
            undergroundStart + index * 12,
            hellLevel - 18
        );
    });

    // ------------------------------------------------------------
    // Pass 4: biome materials, with transitions rather than hard ugly cuts
    // ------------------------------------------------------------
    const snowEnd = Math.floor(w * 0.15);
    const desertStart = Math.floor(w * 0.55);
    const desertEnd = Math.floor(w * 0.68);
    const jungleStart = Math.floor(w * 0.77);

    for (let x = 0; x < w; x++) {
        const inSnow = x < snowEnd;
        const inDesert = x >= desertStart && x < desertEnd;
        const inJungle = x >= jungleStart;

        for (let y = 0; y < hellLevel; y++) {
            const idx = y * w + x;
            const t = world[idx];

            if (t === IDS.AIR) continue;

            if (inSnow) {
                if (t === IDS.GRASS_BLOCK || t === IDS.DIRT_BLOCK) world[idx] = IDS.SNOW_BLOCK || t;
                else if (t === IDS.STONE_BLOCK && rng.chance(3)) world[idx] = IDS.ICE_BLOCK || t;
            } else if (inDesert) {
                if (t === IDS.GRASS_BLOCK || t === IDS.DIRT_BLOCK) world[idx] = IDS.SAND_BLOCK || t;
                else if (t === IDS.STONE_BLOCK && y < cavernStart) world[idx] = IDS.SANDSTONE_BLOCK || t;
            } else if (inJungle) {
                if (t === IDS.GRASS_BLOCK || t === IDS.DIRT_BLOCK) world[idx] = IDS.MUD_BLOCK || t;
                else if (t === IDS.STONE_BLOCK && y < cavernStart && rng.chance(4)) world[idx] = IDS.MUD_BLOCK || t;
            }
        }
    }

    // Reassert clean surface tops after biome conversion.
    for (let x = 0; x < w; x++) {
        const y = surfaceHeights[x];
        const idx = y * w + x;

        if (x < snowEnd) {
            world[idx] = IDS.SNOW_BLOCK || IDS.GRASS_BLOCK || IDS.DIRT_BLOCK || 2;
        } else if (x >= desertStart && x < desertEnd) {
            world[idx] = IDS.SAND_BLOCK || IDS.GRASS_BLOCK || IDS.DIRT_BLOCK || 2;
        } else if (x >= jungleStart) {
            world[idx] = IDS.JUNGLE_GRASS_SEEDS || IDS.GRASS_BLOCK || IDS.MUD_BLOCK || 2;
        } else {
            world[idx] = IDS.GRASS_BLOCK || IDS.DIRT_BLOCK || 2;
        }
    }

    // ------------------------------------------------------------
    // Pass 5: water / lava. Only put water in actual basins.
    // ------------------------------------------------------------
    const water = IDS.WATER;
    const lava = IDS.LAVA;

    if (water) {
        for (let x = 1; x < w - 1; x++) {
            const surface = surfaceHeights[x];

            const nearOcean =
                x < Math.floor(w * 0.055) ||
                x > Math.floor(w * 0.945);

            if (nearOcean) {
                const oceanDepth = 24 + Math.floor((1 - Math.min(1, x < w / 2 ? x / (w * 0.055) : (w - x) / (w * 0.055))) * 4);
                for (let y = surface + 1; y < Math.min(hellLevel, surface + oceanDepth); y++) {
                    const idx = y * w + x;
                    if (world[idx] === IDS.AIR) world[idx] = water;
                }
            }
        }
    }

    if (lava) {
        for (let x = 1; x < w - 1; x++) {
            for (let y = h - 15; y < h; y++) {
                const idx = y * w + x;
                if (world[idx] === IDS.AIR) world[idx] = lava;
            }
        }
    }

    // ------------------------------------------------------------
    // Pass 6: natural vegetation and trees
    // ------------------------------------------------------------
    const placeTree = (x: number, groundY: number, kind: number) => {
        const trunk =
            kind === 1 ? IDS.PINE_TRUNK :
            kind === 2 ? IDS.PALM_TRUNK :
            IDS.TREE_TRUNK;

        const leaves =
            kind === 1 ? IDS.PINE_LEAVES :
            kind === 2 ? IDS.PALM_LEAVES :
            IDS.TREE_LEAVES;

        if (!trunk || !leaves) return;

        const treeH = kind === 1 ? rng.int(6, 10) : rng.int(5, 9);

        // Don't spawn trees under another block or too close to the spawn.
        if (x < 4 || x >= w - 4) return;
        if (Math.abs(x - spawnCenter) < spawnRadius + 8) return;

        for (let y = groundY - 1; y >= groundY - treeH; y--) {
            if (y < 1) continue;
            world[y * w + x] = trunk;
        }

        const top = groundY - treeH;
        const leafRadius = kind === 1 ? 3 : 2;

        for (let dy = 0; dy < treeH * 0.58; dy++) {
            const widthAtRow = Math.max(1, leafRadius - Math.floor(dy / 3));

            for (let dx = -widthAtRow; dx <= widthAtRow; dx++) {
                const tx = x + dx;
                const ty = top + dy;

                if (tx < 1 || tx >= w - 1 || ty < 1) continue;
                if (world[ty * w + tx] !== IDS.AIR && world[ty * w + tx] !== IDS.WEED) continue;

                world[ty * w + tx] = leaves;
            }
        }
    };

    for (let x = 4; x < w - 4; x++) {
        if (rng.next() > 0.055) continue;

        const sy = surfaceHeights[x];
        const surface = world[sy * w + x];
        const desert = x >= desertStart && x < desertEnd;
        const snow = x < snowEnd;
        const jungle = x >= jungleStart;

        if (desert || snow) continue;

        // Trees only where the surface is actually exposed.
        if (
            surface === IDS.GRASS_BLOCK ||
            surface === IDS.JUNGLE_GRASS_SEEDS ||
            surface === IDS.MUD_BLOCK
        ) {
            if (world[(sy - 1) * w + x] === IDS.AIR) {
                if (jungle) placeTree(x, sy, 0);
                else if (rng.chance(3)) placeTree(x, sy, 1);
                else placeTree(x, sy, 0);
            }
        }
    }

    // Cactus in the desert.
    const cactus = IDS.CACTUS_TRUNK;
    if (cactus) {
        for (let x = desertStart; x < desertEnd; x++) {
            if (!rng.chance(16)) continue;
            const sy = surfaceHeights[x];
            if (world[(sy - 1) * w + x] === IDS.AIR && world[sy * w + x] === (IDS.SAND_BLOCK || 0)) {
                const height = rng.int(2, 4);
                for (let y = 1; y <= height; y++) {
                    const ty = sy - y;
                    if (ty > 0 && world[ty * w + x] === IDS.AIR) world[ty * w + x] = cactus;
                }
            }
        }
    }

    // Grass / flowers as sparse top-of-world decoration.
    for (let x = 2; x < w - 2; x++) {
        const sy = surfaceHeights[x];
        if (world[(sy - 1) * w + x] !== IDS.AIR) continue;
        if (rng.chance(7)) world[(sy - 1) * w + x] = IDS.WEED || 0;
    }

    // ------------------------------------------------------------
    // Pass 7: cabins with continuous floors and safe placement
    // ------------------------------------------------------------
    const placeCabin = (cx: number, aroundY: number) => {
        const rw = 10;
        const rh = 6;
        const floorY = clamp(aroundY, rh + 2, h - 20);
        const sx = cx - Math.floor(rw / 2);
        const sy = floorY - rh;

        if (sx < 3 || sx + rw >= w - 3) return;

        // Reject cabins whose interior would cut through a large solid body.
        for (let y = sy + 1; y < floorY; y++) {
            for (let x = sx + 1; x < sx + rw; x++) {
                if (isSolidId(world[y * w + x])) return;
            }
        }

        for (let y = sy; y <= floorY; y++) {
            for (let x = sx; x <= sx + rw; x++) {
                const idx = y * w + x;
                const boundary = x === sx || x === sx + rw || y === sy || y === floorY;

                if (boundary) {
                    world[idx] = IDS.WOOD || IDS.TREE_TRUNK || 9001;
                } else {
                    world[idx] = IDS.AIR;
                    walls[idx] = IDS.WOOD_WALL || IDS.DIRT_WALL || 0;
                }
            }
        }

        const chestX = cx;
        const chestY = floorY - 1;
        const chestId = IDS.CHEST;

        if (chestId) {
            world[chestY * w + chestX] = chestId;
            const key = chestX + ',' + chestY;

            const rare = [
                IDS.CLOUD_IN_A_BOTTLE,
                IDS.HERMES_BOOTS,
                IDS.BAND_OF_REGENERATION,
                IDS.MAGIC_MIRROR,
                IDS.SHOE_SPIKES,
                IDS.FLARE_GUN
            ].filter(Boolean);

            const rareId = rare[rng.int(0, Math.max(0, rare.length - 1))] || 0;

            chests[key] = [
                rareId ? { id: rareId, n: 1 } : { id: 0, n: 0 },
                IDS.GOLD_COIN ? { id: IDS.GOLD_COIN, n: rng.int(1, 4) } : { id: 0, n: 0 },
                IDS.TORCH ? { id: IDS.TORCH, n: rng.int(5, 15) } : { id: 0, n: 0 },
                IDS.HEALING_POTION ? { id: IDS.HEALING_POTION, n: rng.int(2, 5) } : { id: 0, n: 0 }
            ];
        }
    };

    const cabinCount = Math.max(8, Math.floor(17 * areaScale));
    for (let i = 0; i < cabinCount; i++) {
        const cx = rng.int(12, w - 13);
        const cy = rng.int(undergroundStart + 15, hellLevel - 35);
        if (world[cy * w + cx] === IDS.AIR) {
            placeCabin(cx, cy);
        }
    }

    // ------------------------------------------------------------
    // Pass 8: guaranteed spawn pad and initial guide
    // ------------------------------------------------------------
    const sy = surfaceHeights[spawnCenter];

    // A broad, level starter platform with no gaps below it.
    for (let x = spawnCenter - 8; x <= spawnCenter + 8; x++) {
        for (let y = sy - 6; y <= sy + 8; y++) {
            if (x < 1 || x >= w - 1 || y < 1 || y >= h - 1) continue;

            const idx = y * w + x;

            if (y < sy) {
                world[idx] = IDS.AIR;
                walls[idx] = 0;
            } else if (y === sy) {
                world[idx] = IDS.GRASS_BLOCK || IDS.DIRT_BLOCK || 2;
                walls[idx] = 0;
            } else {
                world[idx] = IDS.DIRT_BLOCK || 2;
                walls[idx] = IDS.DIRT_WALL || 0;
            }
        }
    }

    // Small trees at the spawn sides make the starting area feel alive without
    // trapping the player.
    const leftTreeX = spawnCenter - 11;
    const rightTreeX = spawnCenter + 11;
    if (leftTreeX > 4) placeTree(leftTreeX, sy, 0);
    if (rightTreeX < w - 5) placeTree(rightTreeX, sy, 0);

    npcs.push({
        id: Math.random(),
        type: 'guide',
        aiStyle: 'passive',
        x: (spawnCenter + 2) * 16,
        y: (sy - 3) * 16,
        w: 24,
        h: 42,
        vx: 0,
        vy: 0,
        face: 1,
        hp: 250,
        maxHp: 250,
        walkFrame: 0,
        defense: 15
    });

    // One final safety pass: there must be a solid column directly below
    // every non-air surface block. This removes accidental one-block "floating"
    // shelves caused by trees/cabins/biome conversion.
    for (let x = 1; x < w - 1; x++) {
        const y = surfaceHeights[x];
        const current = world[y * w + x];

        if (current === IDS.AIR || !isSolidId(current)) {
            world[y * w + x] = IDS.GRASS_BLOCK || IDS.DIRT_BLOCK || 2;
        }

        for (let depth = 1; depth <= 2; depth++) {
            const ty = y + depth;
            const idx = ty * w + x;
            if (world[idx] === IDS.AIR) {
                world[idx] = ty < undergroundStart
                    ? (IDS.DIRT_BLOCK || 2)
                    : (IDS.STONE_BLOCK || 1);
            }
        }
    }
};
