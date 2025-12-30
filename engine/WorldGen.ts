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
    // Tamer, rolling hills for the overworld (Terraria-style Purity)
    const baseFreq = 0.015;
    const detailFreq = 0.05;
    
    // Flatten spawn area (center 10%)
    const distFromCenter = Math.abs(x - maxW / 2);
    let amplitude = 1.0;
    if (distFromCenter < maxW * 0.05) {
        amplitude = Math.max(0, (distFromCenter / (maxW * 0.05)));
    }

    const h1 = Math.sin(x * baseFreq + rng.seed) * 20 * amplitude;
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
    console.log("Generating Terraria-style World...", worldData);
    const rng = new RNG(worldData.seed);
    const w = worldData.width;
    const h = worldData.height;

    const surfaceHeights = new Int32Array(w);
    const SURFACE_LEVEL = Math.floor(h * 0.3); // Surface Layer
    const UNDERGROUND_LEVEL = Math.floor(h * 0.4); // Dirt -> Stone transition
    const CAVERN_LEVEL = Math.floor(h * 0.6); // Deep Caves
    const HELL_LEVEL = h - 100; // Underworld

    // --- Pass 1: Terrain Shape & Layers ---
    for (let x = 0; x < w; x++) {
        const rough = getSurfaceHeight(x, w, rng);
        const sy = Math.floor(SURFACE_LEVEL + rough);
        surfaceHeights[x] = sy;

        for (let y = 0; y < h; y++) {
            const idx = y * w + x;

            if (y < sy) {
                // Sky
                world[idx] = IDS.AIR;
                walls[idx] = 0;
            } else {
                // Solid Ground
                if (y >= HELL_LEVEL) {
                    world[idx] = IDS.ASH_BLOCK || IDS.STONE_BLOCK; // Fallback if Ash missing
                    walls[idx] = 0; // Hell background is usually handled by shader/renderer or Ash Wall
                } else if (y >= UNDERGROUND_LEVEL) {
                    world[idx] = IDS.STONE_BLOCK;
                    walls[idx] = IDS.STONE_WALL;
                } else {
                    world[idx] = IDS.DIRT_BLOCK;
                    walls[idx] = IDS.DIRT_WALL;
                }
            }
        }
    }

    // --- Pass 2: The "Big Tunneling" (Cavern Generation) ---
    // Terraria uses "Worms" or "Walkers" that dig tunnels.
    // Deep caverns need to be wider and more interconnected.
    
    const digWorm = (cx: number, cy: number, size: number, length: number, branchChance: number) => {
        let vx = rng.range(-1, 1);
        let vy = rng.range(-1, 1);
        
        for(let i=0; i<length; i++) {
            // Dig circle
            const rSq = size * size;
            for(let dy = -size; dy <= size; dy++) {
                for(let dx = -size; dx <= size; dx++) {
                    if(dx*dx + dy*dy <= rSq) {
                        const tx = Math.floor(cx + dx);
                        const ty = Math.floor(cy + dy);
                        if(tx > 0 && tx < w-1 && ty > 0 && ty < h-1) {
                            // Don't break surface crust heavily
                            if (ty > surfaceHeights[tx] + 8) {
                                world[ty*w+tx] = IDS.AIR;
                            }
                        }
                    }
                }
            }

            // Move
            cx += vx;
            cy += vy;
            
            // Steer (Wiggle)
            vx += rng.range(-0.3, 0.3);
            vy += rng.range(-0.3, 0.3);
            
            // Normalize
            const speed = Math.sqrt(vx*vx + vy*vy);
            if(speed > 0) { vx /= speed; vy /= speed; }

            // Bounds bounce
            if(cx < 20 || cx > w-20) vx = -vx;
            if(cy < SURFACE_LEVEL + 10 || cy > h-20) vy = -vy;

            // Branching - FIXED: Check if branchChance > 0 to prevent infinite 1/0 (Infinity) probability
            if(branchChance > 0 && rng.chance(branchChance) && length > 20) {
                // Pass 0 to ensure children do not branch further
                digWorm(cx, cy, size * 0.8, length / 2, 0);
            }
        }
    };

    // 2a. Surface Caves (Small, sparse)
    for(let i=0; i < w/10; i++) {
        if(rng.chance(3)) {
            const x = rng.range(0, w);
            const y = surfaceHeights[Math.floor(x)] + 10;
            digWorm(x, y, rng.range(2, 3), rng.range(50, 100), 500);
        }
    }

    // 2b. Deep Caverns (Large, Swiss Cheese)
    const numDeepCaves = (w * h) / 8000;
    for(let i=0; i < numDeepCaves; i++) {
        const x = rng.range(0, w);
        const y = rng.range(CAVERN_LEVEL, HELL_LEVEL - 20);
        // Larger radius for deep caves
        digWorm(x, y, rng.range(3, 7), rng.range(100, 300), 50);
    }

    // --- Pass 3: Biomes ---
    // Dividing world into vertical slices
    // Layout: Snow (Left) - Corruption - Forest - Desert - Jungle (Right)
    const biomeWidth = w / 5;
    
    const SNOW_START = 0;
    const SNOW_END = biomeWidth;
    
    const CORRUPTION_START = biomeWidth;
    const CORRUPTION_END = biomeWidth * 1.5; // Narrower corruption
    
    // Forest is roughly center (1.5 to 3.0)
    
    const DESERT_START = biomeWidth * 3.0;
    const DESERT_END = biomeWidth * 3.8;
    
    const JUNGLE_START = biomeWidth * 3.8;
    const JUNGLE_END = w;

    // Helper: Replace blocks in a region
    const transformBiome = (xStart: number, xEnd: number, targetBlock: number, targetWall?: number, check?: (id:number)=>boolean) => {
        for (let x = Math.floor(xStart); x < xEnd; x++) {
            for (let y = 0; y < h; y++) {
                const idx = y * w + x;
                const tile = world[idx];
                if (tile === IDS.AIR) continue;
                
                // Don't touch Hell
                if (y >= HELL_LEVEL) continue;

                let shouldChange = false;
                if (check) {
                    shouldChange = check(tile);
                } else {
                    // Default: Convert Dirt and Stone
                    shouldChange = (tile === IDS.DIRT_BLOCK || tile === IDS.STONE_BLOCK || tile === IDS.GRASS_BLOCK);
                }

                if (shouldChange) {
                    world[idx] = targetBlock;
                    if (targetWall && walls[idx] !== 0) walls[idx] = targetWall; 
                }
            }
        }
    };

    // Apply Snow
    transformBiome(SNOW_START, SNOW_END, IDS.SNOW_BLOCK || IDS.DIRT_BLOCK, 0, (t) => t === IDS.DIRT_BLOCK || t === IDS.GRASS_BLOCK || t === IDS.STONE_BLOCK);
    // Add Ice deep underground in snow
    for(let x=0; x<SNOW_END; x++) {
        for(let y=UNDERGROUND_LEVEL; y<HELL_LEVEL; y++) {
            if(world[y*w+x] === IDS.SNOW_BLOCK && rng.chance(2)) world[y*w+x] = IDS.ICE_BLOCK || IDS.SNOW_BLOCK;
        }
    }

    // Apply Desert
    transformBiome(DESERT_START, DESERT_END, IDS.SAND_BLOCK || IDS.DIRT_BLOCK, 0, (t) => t === IDS.DIRT_BLOCK || t === IDS.GRASS_BLOCK);
    // Sandstone underground
    for(let x=DESERT_START; x<DESERT_END; x++) {
        for(let y=UNDERGROUND_LEVEL; y<HELL_LEVEL; y++) {
            if(world[y*w+x] === IDS.STONE_BLOCK) world[y*w+x] = IDS.SANDSTONE_BRICK || IDS.SAND_BLOCK; // Fallback
        }
    }

    // Apply Jungle
    transformBiome(JUNGLE_START, JUNGLE_END, IDS.MUD_BLOCK || IDS.DIRT_BLOCK);
    // Jungle Grass on Mud (Surface & Underground)
    for(let x=Math.floor(JUNGLE_START); x<w; x++) {
        for(let y=0; y<HELL_LEVEL; y++) {
            const idx = y*w+x;
            if(world[idx] === IDS.MUD_BLOCK) {
                // Check if air adjacent for grass
                let airAdj = false;
                if(y>0 && world[(y-1)*w+x]===IDS.AIR) airAdj = true;
                if(airAdj) world[idx] = IDS.JUNGLE_GRASS_SEEDS || IDS.GRASS_BLOCK; // Visual placeholder
            }
        }
    }

    // --- Pass 4: Corruption Chasms ---
    // Vertical drops
    const numChasms = rng.range(2, 4);
    for(let i=0; i<numChasms; i++) {
        let cx = rng.range(CORRUPTION_START + 20, CORRUPTION_END - 20);
        const startY = surfaceHeights[Math.floor(cx)];
        let cy = startY;
        
        // Dig Shaft
        while(cy < CAVERN_LEVEL + 50) {
            const radius = rng.range(4, 7);
            const rSq = radius * radius;
            
            // Dig & Infect
            for(let dy=-radius; dy<=radius; dy++) {
                for(let dx=-radius; dx<=radius; dx++) {
                    const tx = Math.floor(cx + dx);
                    const ty = Math.floor(cy + dy);
                    const tidx = ty*w+tx;
                    
                    if (dx*dx+dy*dy <= rSq) {
                        // Dig air in center
                        if (dx*dx+dy*dy <= (radius-2)*(radius-2)) {
                            world[tidx] = IDS.AIR;
                            walls[tidx] = IDS.EBONSTONE_BRICK_WALL || IDS.STONE_WALL; // Background
                        } else {
                            // Wall of the chasm (Ebonstone)
                            if (world[tidx] !== IDS.AIR) {
                                world[tidx] = IDS.EBONSTONE_BLOCK || IDS.STONE_BLOCK;
                            }
                        }
                    }
                }
            }
            cy += 1;
            cx += rng.range(-0.5, 0.5); // Slight wobble
        }
        
        // Horizontal tunnel at bottom
        digWorm(cx, cy, 6, 100, 0);
    }

    // --- Pass 5: Ore Veins ---
    const generateVein = (tileId: number, attempts: number, size: number, minDepth: number, maxDepth: number) => {
        if (!tileId) return;
        for (let i = 0; i < attempts; i++) {
            let cx = rng.range(0, w);
            let cy = rng.range(minDepth, maxDepth);
            if (world[Math.floor(cy)*w + Math.floor(cx)] === IDS.AIR) continue;

            for (let j = 0; j < size; j++) {
                if(cx>0 && cx<w && cy>0 && cy<h) {
                    const idx = Math.floor(cy)*w + Math.floor(cx);
                    if(world[idx] !== IDS.AIR && world[idx] !== IDS.CHEST) world[idx] = tileId;
                }
                cx += rng.range(-1, 1);
                cy += rng.range(-1, 1);
            }
        }
    };

    const scale = w / 400;
    generateVein(IDS.COPPER_ORE, 200 * scale, 8, SURFACE_LEVEL, HELL_LEVEL);
    generateVein(IDS.IRON_ORE, 150 * scale, 8, SURFACE_LEVEL + 50, HELL_LEVEL);
    generateVein(IDS.SILVER_ORE, 120 * scale, 7, UNDERGROUND_LEVEL, HELL_LEVEL);
    generateVein(IDS.GOLD_ORE, 100 * scale, 6, CAVERN_LEVEL, HELL_LEVEL);
    generateVein(IDS.DEMONITE_ORE, 60 * scale, 6, CAVERN_LEVEL, HELL_LEVEL); // Rare
    generateVein(IDS.HELLSTONE, 300 * scale, 6, HELL_LEVEL, h);

    // --- Pass 6: Hell Layer ---
    // Lava lakes and Ash
    for (let x = 0; x < w; x++) {
        for (let y = HELL_LEVEL; y < h; y++) {
            const idx = y * w + x;
            // Clear space for hell (openness)
            if (y > HELL_LEVEL + 10 && y < h - 10 && rng.chance(2)) {
                world[idx] = IDS.AIR;
            }
            
            // Lava Lakes
            if (y > h - 40 && world[idx] === IDS.AIR) {
                world[idx] = IDS.LAVA;
            }
        }
    }

    // --- Pass 7: Liquids & Vegetation ---
    // Water in caves
    for (let i=0; i<50*scale; i++) {
        const wx = Math.floor(rng.range(0, w));
        const wy = Math.floor(rng.range(SURFACE_LEVEL+20, CAVERN_LEVEL));
        if (world[wy*w+wx] === IDS.AIR) world[wy*w+wx] = IDS.WATER;
    }

    // Grass on Dirt Surface
    for (let x = 0; x < w; x++) {
        let y = 0;
        while(y < h && world[y*w+x] === IDS.AIR) y++;
        
        if (world[y*w+x] === IDS.DIRT_BLOCK) {
            world[y*w+x] = IDS.GRASS_BLOCK;
            // Plant trees/weeds
            if (rng.chance(5)) world[(y-1)*w+x] = IDS.WEED;
            // Trees? Engine might handle saplings, but we can place logs if needed.
        }
    }

    // --- Pass 8: Structures (Cabins) ---
    const chestsPlaced: string[] = [];
    const placeCabin = (cx: number, cy: number) => {
        // Find floor
        let fy = cy;
        while(fy < h && world[fy*w+cx] === IDS.AIR) fy++;
        if (fy >= h) return;

        const floorY = fy;
        const width = 8;
        const height = 5;
        const sx = cx - Math.floor(width/2);
        const sy = floorY - height;

        // Build box
        for(let y=sy; y<=floorY; y++) {
            for(let x=sx; x<=sx+width; x++) {
                const idx = y*w+x;
                if (x===sx || x===sx+width || y===sy || y===floorY) {
                    world[idx] = IDS.WOOD; // Planks
                } else {
                    world[idx] = IDS.AIR;
                    walls[idx] = IDS.WOOD_WALL;
                }
            }
        }
        
        // Chest
        const chestX = cx;
        const chestY = floorY - 1;
        world[chestY*w+chestX] = IDS.CHEST;
        
        // Loot
        const loot: InventorySlot[] = [];
        const rares = [IDS.CLOUD_IN_A_BOTTLE, IDS.HERMES_BOOTS, IDS.MAGIC_MIRROR, IDS.BAND_OF_REGENERATION];
        if (rares.length && rares[0]) loot.push({ id: rares[Math.floor(rng.next()*rares.length)], n: 1 });
        loot.push({ id: IDS.GOLD_COIN, n: rng.range(1, 5) });
        loot.push({ id: IDS.HEALING_POTION, n: rng.range(3, 10) });
        loot.push({ id: IDS.TORCH, n: rng.range(10, 30) });

        chests[`${chestX},${chestY}`] = loot;
    };

    for(let i=0; i<40*scale; i++) {
        const cx = Math.floor(rng.range(50, w-50));
        const cy = Math.floor(rng.range(UNDERGROUND_LEVEL, HELL_LEVEL-50));
        if (world[cy*w+cx] === IDS.AIR) placeCabin(cx, cy);
    }

    // --- Pass 9: Spawn Cleanup ---
    const spawnX = Math.floor(w / 2);
    let spawnY = surfaceHeights[spawnX] - 3;
    
    // Ensure spawn is safe
    for(let x=spawnX-5; x<=spawnX+5; x++) {
        const sy = surfaceHeights[spawnX]; // Flatten to center height
        for(let y=sy-5; y<sy+5; y++) {
            if (y >= sy) world[y*w+x] = IDS.GRASS_BLOCK;
            else world[y*w+x] = IDS.AIR;
        }
    }

    npcs.push({
        id: Math.random(),
        type: 'guide',
        aiStyle: 'passive',
        x: spawnX * TILE_SIZE,
        y: (spawnY - 5) * TILE_SIZE,
        w: 24, h: 42,
        vx: 0, vy: 0,
        face: 1,
        hp: 250, maxHp: 250,
        walkFrame: 0,
        defense: 15
    });

    console.log("World Generation Complete.");
};