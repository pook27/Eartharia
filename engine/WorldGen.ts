import { IDS, PROPS } from '../data/items';
import { InventorySlot, WorldData, NPC } from '../types';
import { TILE_SIZE } from '../constants';

// --- RNG Helper ---
class RNG {
    seed: number;
    constructor(seedString: string) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < seedString.length; i++) {
            h = Math.imul(h ^ seedString.charCodeAt(i), 16777619);
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
    
    chance(n: number): boolean {
        return this.next() < 1 / n;
    }
}

// --- Noise Helper ---
const getSurfaceHeight = (x: number, maxW: number, rng: RNG): number => {
    // Determine distance from center to flatten spawn
    const dist = Math.abs(x - maxW / 2);
    const safeZone = maxW * 0.15; // 15% center flatness
    let amplitude = 1.0;
    
    if (dist < safeZone) {
        // Smooth parabola for flat center
        amplitude = Math.pow(dist / safeZone, 3);
    }

    const baseFreq = 0.02;
    const detailFreq = 0.05;
    
    const h1 = Math.sin(x * baseFreq + rng.seed) * 25 * amplitude;
    const h2 = Math.sin(x * detailFreq + rng.seed * 2) * 5 * amplitude;
    
    return h1 + h2;
};

export const generateWorld = (
    world: Uint16Array,
    walls: Uint16Array,
    chests: Record<string, InventorySlot[]>,
    npcs: NPC[],
    worldData: WorldData
) => {
    console.log("Generating Eartharia World...", worldData);
    const rng = new RNG(worldData.seed);
    const w = worldData.width;
    const h = worldData.height;

    // Scale factors
    const mapScaleW = w / 800; // 1.0 for small
    const mapScaleH = h / 300; // 1.0 for small

    const surfaceHeights = new Int32Array(w);
    const SURFACE_LEVEL = Math.floor(h * 0.3); 
    const UNDERGROUND_LEVEL = Math.floor(h * 0.45);
    const CAVERN_LEVEL = Math.floor(h * 0.65);
    const HELL_LEVEL = h - Math.floor(60 * mapScaleH); // 60 blocks from bottom on small

    // --- Pass 1: Terrain Layers ---
    for (let x = 0; x < w; x++) {
        const rough = getSurfaceHeight(x, w, rng);
        const sy = Math.floor(SURFACE_LEVEL + rough);
        surfaceHeights[x] = sy;

        for (let y = 0; y < h; y++) {
            const idx = y * w + x;

            if (y < sy) {
                world[idx] = IDS.AIR;
                walls[idx] = 0;
            } else {
                // Default Layering
                if (y >= HELL_LEVEL) {
                    world[idx] = IDS.ASH_BLOCK || IDS.STONE_BLOCK; // Safety fallback
                    walls[idx] = 0; 
                } else if (y >= UNDERGROUND_LEVEL) {
                    world[idx] = IDS.STONE_BLOCK || 1; // Safety fallback
                    walls[idx] = IDS.STONE_WALL || 0;
                } else {
                    world[idx] = IDS.DIRT_BLOCK || 2; // Safety fallback
                    walls[idx] = IDS.DIRT_WALL || 0;
                }
            }
        }
        
        // Grass on Surface
        if (world[sy * w + x] === (IDS.DIRT_BLOCK || 2)) {
            world[sy * w + x] = IDS.GRASS_BLOCK || 3;
            // Plants
            if (rng.chance(4)) {
                world[(sy-1)*w + x] = IDS.WEED || 0;
            }
        }
    }

    // --- Pass 2: Caves (Worms) ---
    const numMainCaves = Math.floor((w * h) / 4000); 
    const numSmallCaves = Math.floor((w * h) / 1000);

    const digCave = (startX: number, startY: number, sizeBase: number, lengthBase: number, isHell: boolean) => {
        let cx = startX;
        let cy = startY;
        let radius = isHell ? sizeBase * 1.5 : sizeBase;
        let life = lengthBase;
        
        let vx = rng.range(-1, 1);
        let vy = rng.range(-1, 1);

        while (life > 0) {
            life--;

            // Carve
            const rSq = radius * radius;
            const rCeil = Math.ceil(radius);
            for (let dy = -rCeil; dy <= rCeil; dy++) {
                for (let dx = -rCeil; dx <= rCeil; dx++) {
                    if (dx*dx + dy*dy <= rSq) {
                        const tx = Math.floor(cx + dx);
                        const ty = Math.floor(cy + dy);
                        if (tx > 1 && tx < w-1 && ty > 1 && ty < h-1) {
                            // Don't break surface layer (keep it solid for walking)
                            if (ty > surfaceHeights[tx] + 8) {
                                world[ty * w + tx] = IDS.AIR;
                                // In hell, sometimes remove walls for magma look
                                if (isHell && rng.chance(10)) walls[ty * w + tx] = 0;
                            }
                        }
                    }
                }
            }

            cx += vx;
            cy += vy;

            // Wiggle
            vx += rng.range(-0.2, 0.2);
            vy += rng.range(-0.2, 0.2);
            
            // Normalize speed
            const speed = Math.sqrt(vx*vx + vy*vy);
            if (speed > 1.5) {
                vx = (vx / speed) * 1.5;
                vy = (vy / speed) * 1.5;
            }

            // Boundary bounce
            if (cx < 20 || cx > w - 20) vx *= -1;
            if (cy < SURFACE_LEVEL + 20 || cy > h - 20) vy *= -1;
            
            // Change size
            if (rng.chance(20)) {
                radius += rng.range(-0.5, 0.5);
                radius = Math.max(2, Math.min(sizeBase * 2, radius));
            }
        }
    };

    // Main Caves
    for (let i = 0; i < numMainCaves; i++) {
        const cx = rng.range(50, w - 50);
        const cy = rng.range(UNDERGROUND_LEVEL, HELL_LEVEL + 20);
        const isHell = cy > HELL_LEVEL;
        digCave(cx, cy, rng.range(3, 5), rng.range(50, 200), isHell);
    }

    // Detail Caves
    for (let i = 0; i < numSmallCaves; i++) {
        const cx = rng.range(20, w - 20);
        const cy = rng.range(SURFACE_LEVEL + 10, h - 20);
        digCave(cx, cy, rng.range(1.5, 2.5), rng.range(20, 60), false);
    }

    // --- Pass 3: Ore Veins ---
    const generateVein = (tileId: number, attempts: number, size: number, minY: number, maxY: number, replaceOnly?: number[]) => {
        if (!tileId) return;
        for (let i = 0; i < attempts; i++) {
            let cx = rng.range(10, w - 10);
            let cy = rng.range(minY, maxY);
            
            // Start vein only in solid block
            if (world[Math.floor(cy)*w + Math.floor(cx)] === IDS.AIR) continue;

            for (let j = 0; j < size; j++) {
                if(cx > 0 && cx < w && cy > 0 && cy < h) {
                    const idx = Math.floor(cy)*w + Math.floor(cx);
                    const current = world[idx];
                    
                    let canReplace = false;
                    if (replaceOnly) {
                        if (replaceOnly.includes(current)) canReplace = true;
                    } else {
                        // Standard replace (Stone, Dirt, Ash, Mud, Snow, Ice)
                        if (current !== IDS.AIR && current !== IDS.CHEST && current !== IDS.WOOD) canReplace = true;
                    }

                    if (canReplace) {
                        world[idx] = tileId;
                    }
                }
                cx += rng.range(-1, 1);
                cy += rng.range(-1, 1);
            }
        }
    };
    
    const scale = (w * h) / 240000; // Approx 1.0 for small

    // Basic Ores
    generateVein(IDS.COPPER_ORE, 250 * scale, 10, SURFACE_LEVEL + 10, HELL_LEVEL);
    generateVein(IDS.IRON_ORE, 200 * scale, 8, SURFACE_LEVEL + 30, HELL_LEVEL);
    generateVein(IDS.SILVER_ORE, 150 * scale, 7, UNDERGROUND_LEVEL, HELL_LEVEL);
    generateVein(IDS.GOLD_ORE, 120 * scale, 6, CAVERN_LEVEL, HELL_LEVEL);
    
    // Demonite (rare clumps)
    generateVein(IDS.DEMONITE_ORE, 40 * scale, 5, CAVERN_LEVEL + 50, HELL_LEVEL);

    // Hellstone (Abundant in Hell)
    // Explicitly target Ash Blocks
    generateVein(IDS.HELLSTONE, 350 * scale, 8, HELL_LEVEL, h, [IDS.ASH_BLOCK || IDS.STONE_BLOCK]);

    // Gems
    const gems = [IDS.AMETHYST, IDS.TOPAZ, IDS.SAPPHIRE, IDS.EMERALD, IDS.RUBY, IDS.DIAMOND];
    gems.forEach((id, idx) => {
        if (id) generateVein(id, 40 * scale, 4, UNDERGROUND_LEVEL + (idx * 15), HELL_LEVEL);
    });

    // --- Pass 4: Biomes ---
    // Layout: Snow (Left), Jungle (Right), Desert (Middle-Rightish)
    // Forest is everywhere else (center)
    const snowW = Math.floor(w * 0.15);
    const jungleW = Math.floor(w * 0.2);
    const desertW = Math.floor(w * 0.1);
    
    const jungleX = w - jungleW;
    const desertX = w / 2 + (w * 0.15); // Slightly right of center

    // Apply Biomes (Vertical columns)
    for (let y = 0; y < HELL_LEVEL; y++) {
        for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const t = world[idx];
            
            // Snow
            if (x < snowW) {
                if (t === IDS.DIRT_BLOCK || t === IDS.GRASS_BLOCK) world[idx] = IDS.SNOW_BLOCK;
                if (t === IDS.STONE_BLOCK) world[idx] = IDS.ICE_BLOCK;
            }
            // Jungle
            else if (x >= jungleX) {
                if (t === IDS.DIRT_BLOCK) world[idx] = IDS.MUD_BLOCK;
                if (t === IDS.GRASS_BLOCK) world[idx] = IDS.MUD_BLOCK; 
                if (t === IDS.STONE_BLOCK && rng.chance(2)) world[idx] = IDS.MUD_BLOCK; // Mix mud into stone
            }
            // Desert
            else if (x >= desertX && x < desertX + desertW) {
                if (t === IDS.DIRT_BLOCK || t === IDS.GRASS_BLOCK) world[idx] = IDS.SAND_BLOCK;
                if (t === IDS.STONE_BLOCK) world[idx] = IDS.SANDSTONE_BLOCK;
            }
        }
    }
    
    // Jungle Grass (Surface)
    for(let x=jungleX; x<w; x++) {
        let y = 0;
        while(y < h && world[y*w+x] === IDS.AIR) y++;
        if (world[y*w+x] === IDS.MUD_BLOCK) {
            world[y*w+x] = IDS.JUNGLE_GRASS_SEEDS || IDS.GRASS_BLOCK; 
        }
    }

    // --- Pass 5: Liquids & Hell Features ---
    for (let x = 0; x < w; x++) {
        // Hell Lava (bottom lake)
        for (let y = h - 20; y < h; y++) {
             if (world[y*w+x] === IDS.AIR) world[y*w+x] = IDS.LAVA;
        }
        
        // Random Pockets
        for (let y = SURFACE_LEVEL + 20; y < h; y++) {
            if (world[y*w+x] === IDS.AIR) {
                // Water in cavern/underground
                if (y < HELL_LEVEL && rng.chance(2000)) {
                      // Fill puddle
                      let py = y;
                      while(world[py*w+x] === IDS.AIR && py < HELL_LEVEL) {
                          world[py*w+x] = IDS.WATER;
                          py++;
                      }
                }
                // Lava in Hell
                if (y >= HELL_LEVEL && rng.chance(500)) {
                    let py = y;
                    while(world[py*w+x] === IDS.AIR && py < h) {
                        world[py*w+x] = IDS.LAVA;
                        py++;
                    }
                }
            }
        }
    }

    // --- Pass 6: Loot & Cabins ---
    const placeCabin = (cx: number, cy: number) => {
        // Simple rectangular room
        let floorY = cy;
        // Basic floor finder
        while(floorY < h && world[floorY*w+cx] === IDS.AIR) floorY++;
        
        const rw = 10;
        const rh = 6;
        const sx = cx - 5;
        const sy = floorY - 6;
        
        if (sx < 0 || sx + rw >= w) return;

        // Clear & Build
        for(let y=sy; y<=floorY; y++) {
            for(let x=sx; x<=sx+rw; x++) {
                const idx = y*w+x;
                if (x===sx || x===sx+rw || y===sy || y===floorY) {
                    world[idx] = IDS.WOOD;
                } else {
                    world[idx] = IDS.AIR;
                    walls[idx] = IDS.WOOD_WALL || IDS.DIRT_WALL;
                }
            }
        }
        
        // Chest
        const chestX = cx;
        const chestY = floorY - 1;
        world[chestY*w+chestX] = IDS.CHEST;
        
        const loot: InventorySlot[] = [];
        const raretable = [IDS.CLOUD_IN_A_BOTTLE, IDS.HERMES_BOOTS, IDS.BAND_OF_REGENERATION, IDS.MAGIC_MIRROR, IDS.SHOE_SPIKES, IDS.FLARE_GUN];
        const rare = raretable[Math.floor(rng.next() * raretable.length)];
        if (rare) loot.push({ id: rare, n: 1 });
        
        loot.push({ id: IDS.GOLD_COIN, n: rng.range(1, 4) });
        loot.push({ id: IDS.TORCH, n: rng.range(5, 15) });
        loot.push({ id: IDS.HEALING_POTION, n: rng.range(2, 5) });
        
        chests[`${chestX},${chestY}`] = loot;
    };

    const numCabins = 20 * scale;
    for (let i = 0; i < numCabins; i++) {
        const cx = rng.range(50, w - 50);
        const cy = rng.range(UNDERGROUND_LEVEL, HELL_LEVEL - 50);
        if (world[cy*w+cx] === IDS.AIR) {
             placeCabin(Math.floor(cx), Math.floor(cy));
        }
    }
    
    // --- Pass 7: Final Spawn Point Clean ---
    const midX = Math.floor(w / 2);
    const spawnY = surfaceHeights[midX] - 3;
    
    // Create a small flat platform for spawn
    for (let x = midX - 4; x <= midX + 4; x++) {
        const sy = surfaceHeights[midX];
        for(let y = sy - 5; y <= sy + 5; y++) {
            const idx = y * w + x;
            if (y >= sy) {
                world[idx] = y === sy ? IDS.GRASS_BLOCK : IDS.DIRT_BLOCK;
                walls[idx] = IDS.DIRT_WALL;
            } else {
                world[idx] = IDS.AIR;
                walls[idx] = 0;
            }
        }
    }
    
    npcs.push({
        id: Math.random(),
        type: 'guide',
        aiStyle: 'passive',
        x: midX * TILE_SIZE,
        y: (spawnY - 5) * TILE_SIZE,
        w: 24, h: 42,
        vx: 0, vy: 0,
        face: 1,
        hp: 250, maxHp: 250,
        walkFrame: 0,
        defense: 15
    });
};