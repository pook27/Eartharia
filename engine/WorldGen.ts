import { CHUNK_W, CHUNK_H, BIOME_SNOW_END, BIOME_DESERT_START, TILE_SIZE } from '../constants';
import { IDS, PROPS } from '../data/items';
import { Biome, NPC } from '../types';

export const generateWorld = (world: Uint16Array, walls: Uint16Array, chests: Record<string, any[]>, npcs: NPC[]) => {
    console.log("Generating World...");
    
    // Noise function (Simple pseudo-random)
    const noise = (x: number, y: number) => {
        return Math.sin(x * 0.05 + y * 0.05) + Math.sin(x * 0.01 + y * 0.01) * 2;
    };

    const getBiome = (x: number): Biome => {
        const pct = x / CHUNK_W;
        if (pct < 0.25) return Biome.Snow;
        if (pct > 0.75) return Biome.Desert;
        return Biome.Forest;
    };

    // 1. Terrain Heightmap
    const surfaceHeight = new Int32Array(CHUNK_W);
    for (let x = 0; x < CHUNK_W; x++) {
        const biome = getBiome(x);
        let base = CHUNK_H * 0.3;
        if (biome === Biome.Desert) base = CHUNK_H * 0.35;
        if (biome === Biome.Snow) base = CHUNK_H * 0.28;
        
        let n = Math.sin(x * 0.02) * 10 + Math.sin(x * 0.005) * 20;
        if (biome === Biome.Desert) n *= 0.3; // Flatter
        
        surfaceHeight[x] = Math.floor(base + n);
    }

    // 2. Fill
    for (let x = 0; x < CHUNK_W; x++) {
        const h = surfaceHeight[x];
        const biome = getBiome(x);
        
        for (let y = 0; y < CHUNK_H; y++) {
            const idx = y * CHUNK_W + x;
            
            // Background Walls (Underground)
            if (y > h + 5) {
                // Determine wall type
                if (biome === Biome.Snow && y < h + 50) walls[idx] = IDS.SNOW_BRICK_WALL; 
                else if (biome === Biome.Desert) walls[idx] = IDS.SANDSTONE_WALL;
                else walls[idx] = IDS.DIRT_WALL; // ID 30 Dirt Wall
                
                if (y > h + 100) walls[idx] = IDS.STONE_WALL; // Stone Wall
            }

            if (y < h) {
                world[idx] = IDS.AIR;
            } else {
                // Solid Ground
                // Surface Layer
                let block = IDS.DIRT_BLOCK || 2;
                if (biome === Biome.Snow) block = IDS.SNOW_BLOCK;
                if (biome === Biome.Desert) block = IDS.SAND_BLOCK;

                // Underground Layer
                if (y > h + 20) {
                     block = IDS.STONE_BLOCK;
                     if (biome === Biome.Snow) block = IDS.ICE_BLOCK;
                     if (biome === Biome.Desert) block = IDS.SANDSTONE_BLOCK;
                }
                
                world[idx] = block;

                // Caves (Simplex-ish noise)
                if (y > h + 15 && y < CHUNK_H - 10) {
                     const n = Math.sin(x*0.04 + y*0.04) + Math.cos(x*0.02 - y*0.05) * 1.5;
                     const threshold = 1.3; // Higher = smaller caves
                     if (Math.abs(n) > threshold) {
                         world[idx] = IDS.AIR;
                     }
                }
            }
        }
    }

    // 3. Ores
    const ores = [
        { id: IDS.COPPER_ORE || 12, chance: 0.03, minD: 20 },
        { id: IDS.IRON_ORE || 11, chance: 0.025, minD: 40 },
        { id: IDS.SILVER_ORE || 14, chance: 0.02, minD: 80 },
        { id: IDS.GOLD_ORE || 13, chance: 0.015, minD: 120 },
    ];
    
    for (let x = 0; x < CHUNK_W; x++) {
        for (let y = surfaceHeight[x] + 10; y < CHUNK_H; y++) {
            if (world[y*CHUNK_W+x] !== IDS.AIR) {
                for (const ore of ores) {
                    if (y > surfaceHeight[x] + ore.minD && Math.random() < 0.003) {
                         // Ore Vein
                         generateVein(world, x, y, ore.id);
                         break;
                    }
                }
            }
        }
    }

    // 4. Vegetation (Trees)
    for (let x = 5; x < CHUNK_W - 5; x++) {
        if (Math.random() > 0.03) continue;
        const h = surfaceHeight[x];
        const ground = world[h*CHUNK_W+x];
        
        if (ground === IDS.DIRT_BLOCK) {
             // Forest Tree
             generateTree(world, x, h, IDS.TREE_TRUNK, IDS.TREE_LEAVES);
        } else if (ground === IDS.SNOW_BLOCK) {
             // Pine Tree
             generateTree(world, x, h, IDS.PINE_TRUNK, IDS.PINE_LEAVES);
        } else if (ground === IDS.SAND_BLOCK) {
             // Cactus
             generateCactus(world, x, h);
        }
    }

    // 5. Cabins
    for (let i = 0; i < 8; i++) {
        const cx = 50 + Math.floor(Math.random() * (CHUNK_W - 100));
        const cy = surfaceHeight[cx] + 30 + Math.floor(Math.random() * 100);
        if (world[cy*CHUNK_W+cx] === IDS.AIR) // Find open space in caves
             generateCabin(world, walls, chests, cx, cy);
    }
    
    // Spawn Guide
    const sx = Math.floor(CHUNK_W/2);
    npcs.push({
        id: Math.random(), type: 'guide',
        aiStyle: 'passive',
        x: sx * TILE_SIZE, y: (surfaceHeight[sx]-3) * TILE_SIZE,
        w: TILE_SIZE, h: TILE_SIZE*3,
        vx:0, vy:0, face:1, hp:250, maxHp:250, walkFrame:0
    });
};

const generateVein = (world: Uint16Array, x: number, y: number, id: number) => {
    const size = 5 + Math.random() * 10;
    for(let i=0; i<size; i++) {
        const ox = x + Math.floor((Math.random()-0.5)*4);
        const oy = y + Math.floor((Math.random()-0.5)*4);
        if (ox>=0 && ox<CHUNK_W && oy>=0 && oy<CHUNK_H) {
            if (world[oy*CHUNK_W+ox] !== IDS.AIR) world[oy*CHUNK_W+ox] = id;
        }
    }
};

const generateTree = (world: Uint16Array, x: number, groundY: number, trunk: number, leaves: number) => {
    const h = 5 + Math.floor(Math.random() * 10);
    // Trunk
    for(let i=1; i<=h; i++) {
        world[(groundY-i)*CHUNK_W + x] = trunk;
    }
    // Leaves (Top)
    for(let ly = groundY-h-2; ly <= groundY-h+1; ly++) {
        for(let lx = x-2; lx <= x+2; lx++) {
             if (lx===x && ly > groundY-h) continue; // Don't overwrite trunk
             const idx = ly*CHUNK_W+lx;
             if (world[idx] === IDS.AIR && Math.random() > 0.2) world[idx] = leaves;
        }
    }
};

const generateCactus = (world: Uint16Array, x: number, groundY: number) => {
    const h = 3 + Math.floor(Math.random() * 5);
    for(let i=1; i<=h; i++) {
        world[(groundY-i)*CHUNK_W + x] = IDS.CACTUS_TRUNK;
    }
    // Arms
    if (h > 3) {
         if (x > 0) world[(groundY-3)*CHUNK_W + x - 1] = IDS.CACTUS_TRUNK;
         if (x < CHUNK_W-1) world[(groundY-4)*CHUNK_W + x + 1] = IDS.CACTUS_TRUNK;
    }
};

const generateCabin = (world: Uint16Array, walls: Uint16Array, chests: any, cx: number, cy: number) => {
    const w = 8 + Math.floor(Math.random()*6);
    const h = 6 + Math.floor(Math.random()*4);
    
    for(let y=cy; y<cy+h; y++) {
        for(let x=cx; x<cx+w; x++) {
             const idx = y*CHUNK_W+x;
             if (x===cx || x===cx+w-1 || y===cy || y===cy+h-1) {
                 world[idx] = IDS.WOOD; // Wood
             } else {
                 world[idx] = IDS.AIR;
                 walls[idx] = IDS.WOOD_WALL;
             }
        }
    }
    // Chest
    const chX = cx + Math.floor(w/2);
    const chY = cy + h - 2;
    world[chY*CHUNK_W+chX] = IDS.CHEST;
    chests[`${chX},${chY}`] = [
        { id: IDS.TORCH || 8, n: 10 },
        { id: IDS.HEALING_POTION || 188, n: 2 },
        { id: IDS.GOLD_COIN || 73, n: 5 }
    ];
};