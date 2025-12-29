
import { BIOME_SNOW_END, BIOME_DESERT_START, BIOME_JUNGLE_START, TILE_SIZE } from '../constants';
import { IDS, PROPS } from '../data/items';
import { Biome, NPC, WorldData } from '../types';

// --- Simple Seeded RNG ---
class RNG {
    seed: number;
    constructor(seedString: string) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < seedString.length; i++) {
            h = Math.imul(h ^ seedString.charCodeAt(i), 16777619);
        }
        this.seed = h >>> 0;
    }

    // Returns float between 0 and 1
    next(): number {
        this.seed = (Math.imul(1839567234, this.seed) + 695182583) | 0;
        let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    
    // Range [min, max)
    range(min: number, max: number): number {
        return min + this.next() * (max - min);
    }
}

// --- 1D Value Noise for Terrain ---
const getSmoothedNoise = (x: number, period: number, min: number, max: number, rng: RNG): number => {
    const intX = Math.floor(x / period);
    const fracX = (x / period) - intX;
    
    // Pseudo-random height at integer points based on seed
    const getHash = (n: number) => {
        let h = (n * 374761393) ^ (rng.seed + n); 
        h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };

    const h1 = min + getHash(intX) * (max - min);
    const h2 = min + getHash(intX + 1) * (max - min);
    
    // Cosine interpolation for smooth hills
    const ft = fracX * 3.1415927;
    const f = (1 - Math.cos(ft)) * 0.5;
    
    return h1 * (1 - f) + h2 * f;
};

export const generateWorld = (world: Uint16Array, walls: Uint16Array, chests: Record<string, any[]>, npcs: NPC[], options: WorldData) => {
    console.log(`Generating World: ${options.name} (${options.size}) with Evil: ${options.evil}`);
    const rng = new RNG(options.seed);
    
    const CHUNK_W = options.width;
    const CHUNK_H = options.height;

    // --- Biome Zones ---
    const getBiome = (x: number): Biome => {
        const pct = x / CHUNK_W;
        if (pct < BIOME_SNOW_END) return Biome.Snow;
        if (pct > BIOME_JUNGLE_START) return Biome.Jungle;
        if (pct > BIOME_DESERT_START && pct < 0.7) return Biome.Desert; 
        return Biome.Forest;
    };

    // --- Pass 1: Terrain Heightmap ---
    const surfaceHeight = new Int32Array(CHUNK_W);
    const BASE_LEVEL = CHUNK_H * 0.3;

    for (let x = 0; x < CHUNK_W; x++) {
        const biome = getBiome(x);
        let h = BASE_LEVEL;
        
        if (biome === Biome.Snow) {
            h += getSmoothedNoise(x, 20, -10, 10, rng) + getSmoothedNoise(x, 50, -20, 20, rng);
        } else if (biome === Biome.Forest) {
            h += getSmoothedNoise(x, 30, -5, 5, rng) + getSmoothedNoise(x, 100, -15, 15, rng);
        } else if (biome === Biome.Desert) {
            h += getSmoothedNoise(x, 40, -10, 10, rng) + 15; 
        } else if (biome === Biome.Jungle) {
            h += getSmoothedNoise(x, 8, -8, 8, rng) + getSmoothedNoise(x, 60, -40, 30, rng);
        }

        surfaceHeight[x] = Math.floor(h);
    }

    // --- Pass 2: Base Filling ---
    const ID_DIRT = IDS.DIRT_BLOCK;
    const ID_STONE = IDS.STONE_BLOCK;
    const ID_ASH = IDS.ASH_BLOCK;
    const ID_AIR = IDS.AIR;
    const ID_DIRT_WALL = IDS.DIRT_WALL;
    const ID_STONE_WALL = IDS.STONE_WALL;

    const UNDERGROUND_LEVEL = BASE_LEVEL + (CHUNK_H * 0.15); // Dynamic depth
    const CAVERN_LEVEL = BASE_LEVEL + (CHUNK_H * 0.35);
    const HELL_LEVEL = CHUNK_H - 50;

    for (let x = 0; x < CHUNK_W; x++) {
        const surf = surfaceHeight[x];
        for (let y = 0; y < CHUNK_H; y++) {
            const idx = y * CHUNK_W + x;
            
            if (y < surf) {
                world[idx] = ID_AIR;
                if (y > surf + 2) walls[idx] = ID_DIRT_WALL; 
                continue;
            }

            if (y < UNDERGROUND_LEVEL) {
                world[idx] = ID_DIRT;
                if (y > surf + 2) walls[idx] = ID_DIRT_WALL;
            } else if (y < CAVERN_LEVEL) {
                world[idx] = rng.next() > 0.6 ? ID_STONE : ID_DIRT;
                walls[idx] = rng.next() > 0.5 ? ID_DIRT_WALL : ID_STONE_WALL;
            } else if (y < HELL_LEVEL) {
                world[idx] = ID_STONE;
                walls[idx] = ID_STONE_WALL;
            } else {
                world[idx] = ID_ASH;
                walls[idx] = 0; 
            }
        }
        
        // Grass Seeding
        const topY = surf;
        if (world[topY * CHUNK_W + x] === ID_DIRT) {
             world[topY * CHUNK_W + x] = IDS.GRASS_BLOCK;
             if (rng.next() > 0.8 && topY > 0) {
                 world[(topY-1) * CHUNK_W + x] = IDS.WEED;
             }
        }
    }

    // --- Pass 3: Cave Generation ---
    const dig = (cx: number, cy: number, radius: number, removeWalls: boolean = false) => {
        const r2 = radius * radius;
        for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
            for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
                if (x >= 0 && x < CHUNK_W && y >= 0 && y < CHUNK_H) {
                    if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) {
                        const idx = y * CHUNK_W + x;
                        if (world[idx] !== IDS.BLUE_BRICK) { 
                             world[idx] = ID_AIR;
                             if (removeWalls) walls[idx] = 0;
                        }
                    }
                }
            }
        }
    };

    // 3a. Small Surface Caves
    const numSurfaceCaves = CHUNK_W / 15;
    for (let i = 0; i < numSurfaceCaves; i++) {
        let cx = rng.range(0, CHUNK_W);
        let cy = surfaceHeight[Math.floor(cx)] + 5;
        let angle = rng.range(Math.PI / 4, 3 * Math.PI / 4); 
        let len = rng.range(20, 50);
        let size = rng.range(1.5, 3);
        
        for (let j = 0; j < len; j++) {
            dig(cx, cy, size);
            cx += Math.cos(angle);
            cy += Math.sin(angle);
            angle += rng.range(-0.2, 0.2); 
        }
    }

    // 3b. Deep Caverns
    const numDeepCaves = CHUNK_W / 8;
    for (let i = 0; i < numDeepCaves; i++) {
        let cx = rng.range(0, CHUNK_W);
        let cy = rng.range(UNDERGROUND_LEVEL, HELL_LEVEL);
        let len = rng.range(100, 300);
        let size = rng.range(2, 5);
        let angle = rng.range(0, Math.PI * 2);
        
        for (let j = 0; j < len; j++) {
            dig(cx, cy, size);
            cx += Math.cos(angle);
            cy += Math.sin(angle);
            angle += rng.range(-0.1, 0.1);
            if (rng.next() < 0.02) {
                size = rng.range(2, 4);
                angle += rng.range(-1, 1);
            }
        }
    }

    // --- Pass 4: Biome Conversion ---
    
    // Snow Biome
    const snowLimit = Math.floor(BIOME_SNOW_END * CHUNK_W);
    for (let x = 0; x < snowLimit; x++) {
        const surf = surfaceHeight[x];
        for (let y = surf; y < HELL_LEVEL; y++) {
            const idx = y * CHUNK_W + x;
            if (world[idx] === ID_DIRT || world[idx] === IDS.GRASS_BLOCK) world[idx] = IDS.SNOW_BLOCK;
            if (world[idx] === IDS.WEED) world[idx] = ID_AIR;
            if (world[idx] === ID_STONE && y < CAVERN_LEVEL) world[idx] = IDS.ICE_BLOCK;
            if (walls[idx] === ID_DIRT_WALL) walls[idx] = IDS.SNOW_BRICK_WALL;
        }
    }

    // Desert Biome
    const desertStart = Math.floor(BIOME_DESERT_START * CHUNK_W);
    const desertEnd = Math.floor(0.7 * CHUNK_W);
    for (let x = desertStart; x < desertEnd; x++) {
        const surf = surfaceHeight[x];
        for (let y = surf; y < HELL_LEVEL; y++) {
            const idx = y * CHUNK_W + x;
            if (world[idx] === ID_DIRT || world[idx] === IDS.GRASS_BLOCK) world[idx] = IDS.SAND_BLOCK;
            if (world[idx] === IDS.WEED) world[idx] = ID_AIR;
            if (world[idx] === ID_STONE && y < UNDERGROUND_LEVEL + 50) world[idx] = IDS.SANDSTONE_BLOCK;
            if (walls[idx] === ID_DIRT_WALL) walls[idx] = IDS.SANDSTONE_WALL;
        }
    }

    // Jungle Biome
    const jungleStart = Math.floor(BIOME_JUNGLE_START * CHUNK_W);
    for (let x = jungleStart; x < CHUNK_W; x++) {
        const surf = surfaceHeight[x];
        for (let y = surf; y < HELL_LEVEL; y++) {
            const idx = y * CHUNK_W + x;
            if (world[idx] === ID_DIRT || world[idx] === ID_STONE || world[idx] === IDS.GRASS_BLOCK) {
                world[idx] = IDS.MUD_BLOCK;
            }
            if (world[idx] === IDS.WEED) world[idx] = ID_AIR; 
            if (walls[idx] === ID_DIRT_WALL || walls[idx] === ID_STONE_WALL) {
                walls[idx] = IDS.JUNGLE_WALL;
            }
        }
        if(world[surf * CHUNK_W + x] === IDS.MUD_BLOCK) {
             world[surf * CHUNK_W + x] = IDS.GRASS_BLOCK;
        }
    }

    // Evil Biome (Corruption or Crimson)
    const corruptCenter = Math.floor(CHUNK_W * 0.35); 
    const corruptWidth = Math.floor(CHUNK_W * 0.05); // Dynamic width
    const isCrimson = options.evil === 'Crimson';
    
    // IDs for Evil
    const EVIL_STONE = isCrimson ? 836 : IDS.EBONSTONE_BLOCK; // 836 = Crimstone
    const EVIL_WALL = isCrimson ? 2790 : IDS.EBONSTONE_BRICK_WALL; // 2790 = Crimtane Wall approx

    for (let x = corruptCenter - corruptWidth; x <= corruptCenter + corruptWidth; x++) {
        const surf = surfaceHeight[x];
        for (let y = surf; y < HELL_LEVEL; y++) {
            const idx = y * CHUNK_W + x;
            if (world[idx] !== ID_AIR) world[idx] = EVIL_STONE;
            if (walls[idx] !== 0) walls[idx] = EVIL_WALL;
        }
    }
    
    // Chasm Digging
    let chasmY = surfaceHeight[corruptCenter] + 5;
    let chasmX = corruptCenter;
    while (chasmY < HELL_LEVEL - 20) {
        dig(chasmX, chasmY, 4, true);
        chasmY += 1;
        chasmX += Math.sin(chasmY * 0.05) * 0.5; 
        if (rng.next() < 0.05) {
             let tx = chasmX, ty = chasmY;
             let dir = rng.next() > 0.5 ? 1 : -1;
             for(let k=0; k<40; k++) {
                 tx += dir;
                 dig(tx, ty, 3);
             }
        }
    }

    // --- Pass 5: Structures (Living Trees, Dungeon, etc) ---
    // Scaled number of trees
    const numTrees = Math.max(2, Math.floor(CHUNK_W / 200)); 
    for (let i = 0; i < numTrees; i++) {
        const lx = rng.range(snowLimit + 20, desertStart - 20);
        if (Math.abs(lx - corruptCenter) < corruptWidth + 20) continue;
        
        let ly = surfaceHeight[Math.floor(lx)];
        for(let k=0; k<60; k++) {
             for(let wx=-2; wx<=2; wx++) walls[(ly+k)*CHUNK_W+(Math.floor(lx)+wx)] = IDS.WOOD_WALL;
             world[(ly+k)*CHUNK_W+Math.floor(lx)] = ID_AIR;
             world[(ly+k)*CHUNK_W+Math.floor(lx)-3] = IDS.TREE_TRUNK;
             world[(ly+k)*CHUNK_W+Math.floor(lx)+3] = IDS.TREE_TRUNK;
        }
        for(let cy = ly-10; cy < ly; cy++) {
            for(let cx = lx-8; cx <= lx+8; cx++) {
                if ((cx-lx)**2 + (cy-(ly-5))**2 < 64) {
                    world[Math.floor(cy)*CHUNK_W+Math.floor(cx)] = IDS.TREE_LEAVES;
                }
            }
        }
    }

    // Dungeon
    const dungeonX = Math.floor(CHUNK_W * 0.05); // 5% from left
    const dungeonSurface = surfaceHeight[dungeonX];
    for(let y = dungeonSurface - 8; y < dungeonSurface + 5; y++) {
        for(let x = dungeonX - 5; x <= dungeonX + 5; x++) {
             const idx = y*CHUNK_W+x;
             if (x === dungeonX - 5 || x === dungeonX + 5 || y === dungeonSurface - 8) {
                 world[idx] = IDS.BLUE_BRICK;
             } else {
                 world[idx] = ID_AIR;
                 walls[idx] = IDS.BLUE_BRICK_WALL;
             }
        }
    }
    let dX = dungeonX;
    let dY = dungeonSurface + 5;
    let dDir = 1; 
    let steps = 0;
    while (dY < HELL_LEVEL - 50) {
        for(let dy=-3; dy<=3; dy++) {
            for(let dx=-3; dx<=3; dx++) {
                const idx = (dY+dy)*CHUNK_W + (dX+dx);
                if (dy===-3 || dy===3 || dx===-3 || dx===3) {
                     if(world[idx] !== ID_AIR) world[idx] = IDS.BLUE_BRICK;
                } else {
                    world[idx] = ID_AIR;
                    walls[idx] = IDS.BLUE_BRICK_WALL;
                }
            }
        }
        if (steps++ > rng.range(15, 30)) {
            dY += 5; steps = 0; dDir *= -1; 
             for(let k=0; k<7; k++) {
                 for(let w=-2; w<=2; w++) {
                     const idx = (dY-k)*CHUNK_W + (dX+w);
                     if (w===-2 || w===2) world[idx] = IDS.BLUE_BRICK;
                     else { world[idx] = ID_AIR; walls[idx] = IDS.BLUE_BRICK_WALL; }
                 }
             }
        } else {
            dX += dDir;
        }
    }

    // Temple
    const templeX = rng.range(jungleStart + 50, CHUNK_W - 50);
    const templeY = rng.range(CAVERN_LEVEL + 50, HELL_LEVEL - 50);
    for(let y=templeY; y<templeY+40; y++) {
        for(let x=templeX; x<templeX+60; x++) {
             const idx = y*CHUNK_W+x;
             if (y===templeY || y===templeY+39 || x===templeX || x===templeX+59) {
                 world[idx] = IDS.LIHZAHRD_BRICK || 1101;
             } else {
                 world[idx] = ID_AIR;
                 walls[idx] = IDS.LIHZAHRD_BRICK_WALL || 1102;
             }
        }
    }

    // --- Pass 6: Ores, Liquids, Veg ---
    const generateVeinConfig = (x: number, y: number, id: number, size: number) => {
        for(let i=0; i<size; i++) {
            const ox = x + Math.floor(rng.range(-2, 3));
            const oy = y + Math.floor(rng.range(-2, 3));
            if (ox>=0 && ox<CHUNK_W && oy>=0 && oy<CHUNK_H) {
                const tid = world[oy*CHUNK_W+ox];
                if (tid !== ID_AIR && tid !== IDS.BLUE_BRICK && tid !== IDS.LIHZAHRD_BRICK) world[oy*CHUNK_W+ox] = id;
            }
        }
    };
    
    for(let x=0; x<CHUNK_W; x++) {
        for(let y=surfaceHeight[x]+10; y<CHUNK_H; y++) {
             const rand = rng.next();
             if (rand < 0.015) {
                 const depth = y / CHUNK_H;
                 let ore = IDS.COPPER_ORE;
                 if (depth > 0.3) ore = IDS.IRON_ORE;
                 if (depth > 0.5) ore = IDS.SILVER_ORE;
                 if (depth > 0.7) ore = IDS.GOLD_ORE;
                 if (y > HELL_LEVEL - 50 && rand < 0.005) ore = IDS.HELLSTONE;
                 if (x > jungleStart && depth > 0.5 && rand < 0.005) ore = IDS.CHLOROPHYTE_ORE;
                 generateVeinConfig(x, y, ore, 6);
             }
        }
    }

    // Liquids
    for (let x = 0; x < CHUNK_W; x++) {
        for (let y = HELL_LEVEL + 25; y < CHUNK_H; y++) {
            if (world[y*CHUNK_W+x] === ID_AIR) world[y*CHUNK_W+x] = IDS.LAVA;
        }
    }
    
    // Surface Vegetation (Trees)
    for (let x = 5; x < CHUNK_W - 5; x+= rng.range(2, 6)) {
        const h = surfaceHeight[Math.floor(x)];
        const ground = world[h*CHUNK_W+Math.floor(x)];
        const above = world[(h-1)*CHUNK_W+Math.floor(x)];
        
        if (above === ID_AIR || above === IDS.WEED) {
            if ((ground === ID_DIRT || ground === IDS.GRASS_BLOCK) && rng.next() > 0.6) {
                generateTreeConfig(world, Math.floor(x), h, IDS.TREE_TRUNK, IDS.TREE_LEAVES, CHUNK_W, CHUNK_H);
            }
            else if (ground === IDS.SNOW_BLOCK && rng.next() > 0.7) {
                generateTreeConfig(world, Math.floor(x), h, IDS.PINE_TRUNK, IDS.PINE_LEAVES, CHUNK_W, CHUNK_H);
            }
            else if (ground === IDS.SAND_BLOCK && rng.next() > 0.8) {
                generateCactusConfig(world, Math.floor(x), h, CHUNK_W);
            }
            else if (ground === IDS.MUD_BLOCK && rng.next() > 0.5) {
                generateTreeConfig(world, Math.floor(x), h, IDS.PALM_TRUNK, IDS.PALM_LEAVES, CHUNK_W, CHUNK_H);
            }
        }
    }
    
    // Add Guide
    const spawnX = Math.floor(CHUNK_W/2);
    const spawnY = surfaceHeight[spawnX] - 3;
    npcs.push({
        id: Math.random(), type: 'guide',
        aiStyle: 'passive',
        x: spawnX * TILE_SIZE, y: spawnY * TILE_SIZE,
        w: TILE_SIZE, h: TILE_SIZE*3,
        vx:0, vy:0, face:1, hp:250, maxHp:250, walkFrame:0
    });
};

const generateTreeConfig = (world: Uint16Array, x: number, groundY: number, trunk: number, leaves: number, w: number, h: number) => {
    const height = 5 + Math.floor(Math.random() * 10);
    const baseIdx = (groundY-1)*w+x;
    if (world[baseIdx] === IDS.WEED) world[baseIdx] = IDS.AIR;
    
    for(let i=1; i<=height; i++) {
        if ((groundY-i)*w + x >= 0) world[(groundY-i)*w + x] = trunk;
    }
    for(let ly = groundY-height-2; ly <= groundY-height+1; ly++) {
        for(let lx = x-2; lx <= x+2; lx++) {
             if (lx===x && ly > groundY-height) continue; 
             const idx = ly*w+lx;
             if (idx > 0 && idx < world.length && world[idx] === 0 && Math.random() > 0.3) world[idx] = leaves;
        }
    }
};

const generateCactusConfig = (world: Uint16Array, x: number, groundY: number, w: number) => {
    const height = 3 + Math.floor(Math.random() * 5);
    for(let i=1; i<=height; i++) {
         if ((groundY-i)*w + x >= 0) world[(groundY-i)*w + x] = IDS.CACTUS_TRUNK;
    }
};
