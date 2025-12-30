
import { IDS, PROPS } from '../data/items';
import { InventorySlot, WorldData, NPC } from '../types';
import { TILE_SIZE } from '../constants';

// --- RNG Helper ---
class RNG {
    seed: number;
    constructor(seedString: string) {
        // Simple hash of the seed string
        let h = 2166136261 >>> 0;
        for (let i = 0; i < seedString.length; i++) {
            h = Math.imul(h ^ seedString.charCodeAt(i), 16777619);
        }
        this.seed = h >>> 0;
    }

    // Mulberry32
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
const getPerlinRoughness = (x: number, maxW: number, rng: RNG): number => {
    // Determine distance from center to flatten spawn
    const dist = Math.abs(x - maxW / 2);
    const safeZone = maxW * 0.1; // 10% of world width is safe/flat spawn
    let amplitude = 1.0;
    
    if (dist < safeZone) {
        // Smoothly ramp up noise from 0 at center to 1.0 at edge of safe zone
        amplitude = Math.pow(dist / safeZone, 2);
    }

    // Combine a few sine waves for terrain height
    const base = Math.sin(x * 0.02 + rng.seed) * 15 * amplitude; // Rolling hills
    const detail = Math.sin(x * 0.1 + rng.seed * 2) * 5 * amplitude; // Bumps
    const mountain = Math.sin(x * 0.005 + rng.seed * 3) * 30 * amplitude; // Biome variance
    
    return base + detail + mountain;
};

export const generateWorld = (
    world: Uint16Array,
    walls: Uint16Array,
    chests: Record<string, InventorySlot[]>,
    npcs: NPC[],
    worldData: WorldData
) => {
    console.log("Generating World with Eartharia Gen...", worldData);
    const rng = new RNG(worldData.seed);
    const w = worldData.width;
    const h = worldData.height;

    const surfaceHeights = new Int32Array(w);
    const SURFACE_BASE = Math.floor(h * 0.25); // Ground starts at 25% down
    const ROCK_LEVEL = Math.floor(h * 0.45);   // Stone starts at 45% down
    const HELL_LEVEL = h - 80;                 // Hell is the bottom 80 rows

    // --- Pass 1: Terrain Shape & Backgrounds ---
    for (let x = 0; x < w; x++) {
        // Calculate surface height with flattened center
        const roughness = getPerlinRoughness(x, w, rng);
        const sy = Math.floor(SURFACE_BASE + roughness);
        surfaceHeights[x] = sy;

        for (let y = 0; y < h; y++) {
            const idx = y * w + x;

            if (y < sy) {
                // Sky
                world[idx] = IDS.AIR;
                walls[idx] = 0;
            } else {
                // Solid Ground
                
                // Determine Layer
                if (y >= HELL_LEVEL) {
                    world[idx] = IDS.ASH_BLOCK;
                    walls[idx] = 0; // Hell has unique background or open back (we use 0 for dark moody look)
                } else if (y >= ROCK_LEVEL) {
                    world[idx] = IDS.STONE_BLOCK;
                    walls[idx] = IDS.STONE_WALL;
                } else {
                    world[idx] = IDS.DIRT_BLOCK;
                    walls[idx] = IDS.DIRT_WALL;
                }
            }
        }
        
        // Grassify Surface
        const idx = sy * w + x;
        if (world[idx] === IDS.DIRT_BLOCK) {
            world[idx] = IDS.GRASS_BLOCK;
            // Chance for weeds/flowers
            if (rng.chance(3) && sy > 0) {
                world[(sy-1)*w+x] = IDS.WEED;
            }
        }
    }

    // --- Pass 2: The Worms (Cave Generation) ---
    // Increase chaos underground while keeping surface intact
    const numCaves = Math.floor((w * h) / 800); 

    for (let i = 0; i < numCaves; i++) {
        let cx = rng.range(0, w);
        // Start caves deeper to preserve surface planar look
        let cy = rng.range(SURFACE_BASE + 15, h - 5);
        
        // Hell caves are large open pockets
        const isHell = cy > HELL_LEVEL;
        let radius = isHell ? rng.range(4, 9) : rng.range(2, 5);
        let life = rng.range(50, 400);
        
        let vx = rng.range(-1, 1);
        let vy = rng.range(-1, 1);

        while (life > 0) {
            life--;

            // Carve
            const rSq = radius * radius;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (dx*dx + dy*dy <= rSq) {
                        const tx = Math.floor(cx + dx);
                        const ty = Math.floor(cy + dy);
                        if (tx > 0 && tx < w-1 && ty > 0 && ty < h-1) {
                            // Don't dig up through the surface layer unless it's a specific surface cave entrance (rare)
                            if (ty > surfaceHeights[tx] + 5) {
                                world[ty * w + tx] = IDS.AIR;
                                // In hell, remove walls occasionally for texture
                                if (isHell && rng.chance(10)) walls[ty * w + tx] = 0; 
                            }
                        }
                    }
                }
            }

            // Move
            cx += vx;
            cy += vy;

            // Wiggle
            vx += rng.range(-0.2, 0.2);
            vy += rng.range(-0.2, 0.2);
            
            // Normalize speed
            const speed = Math.sqrt(vx*vx + vy*vy);
            if (speed > 0) {
                vx = (vx / speed);
                vy = (vy / speed);
            }

            // Bounce
            if (cx < 5 || cx > w - 5) vx = -vx;
            if (cy < SURFACE_BASE + 20 || cy > h - 5) vy = -vy;
        }
    }

    // --- Pass 3: Ore Veins ---
    const generateVein = (tileId: number, attempts: number, size: number, minDepth: number, maxDepth: number, replaceAsh: boolean = false) => {
        for (let i = 0; i < attempts; i++) {
            let cx = rng.range(0, w);
            let cy = rng.range(minDepth, maxDepth);
            
            // Check if start is solid
            const startIdx = Math.floor(cy) * w + Math.floor(cx);
            if (world[startIdx] === IDS.AIR) continue;

            for (let j = 0; j < size; j++) {
                const tx = Math.floor(cx);
                const ty = Math.floor(cy);
                if (tx > 0 && tx < w && ty > 0 && ty < h) {
                    const idx = ty * w + tx;
                    const currentTile = world[idx];
                    
                    // Specific logic for Hellstone: replace Ash
                    if (replaceAsh) {
                        if (currentTile === IDS.ASH_BLOCK) {
                            world[idx] = tileId;
                        }
                    } else {
                        // Normal ores replace stone/dirt/ash
                        if (currentTile !== IDS.AIR && currentTile !== IDS.CHEST) {
                             world[idx] = tileId;
                        }
                    }
                }
                cx += rng.range(-1, 1);
                cy += rng.range(-1, 1);
            }
        }
    };

    const mapScale = w / 400; // Multiplier for map size

    generateVein(IDS.COPPER_ORE, 180 * mapScale, 8, SURFACE_BASE + 10, HELL_LEVEL);
    generateVein(IDS.IRON_ORE, 140 * mapScale, 9, SURFACE_BASE + 30, HELL_LEVEL);
    generateVein(IDS.SILVER_ORE, 110 * mapScale, 7, ROCK_LEVEL, HELL_LEVEL);
    generateVein(IDS.GOLD_ORE, 80 * mapScale, 6, ROCK_LEVEL + 50, HELL_LEVEL);
    
    // Hellstone: High frequency, smaller veins, specifically inside Ash
    generateVein(IDS.HELLSTONE, 300 * mapScale, 5, HELL_LEVEL, h, true);

    // --- Pass 4: Liquids ---
    // Water pools in caves
    for (let i = 0; i < 60 * mapScale; i++) {
        const x = Math.floor(rng.range(0, w));
        const y = Math.floor(rng.range(SURFACE_BASE + 10, HELL_LEVEL - 50));
        const idx = y * w + x;
        if (world[idx] === IDS.AIR) {
            // Check solid bottom
            let solidBottom = false;
            for(let k=1; k<4; k++) {
                if (PROPS[world[(y+k)*w+x]]?.solid) { solidBottom = true; break; }
            }
            if (solidBottom) world[idx] = IDS.WATER;
        }
    }
    
    // Massive Lava pools in Hell
    for (let x = 0; x < w; x++) {
        for (let y = HELL_LEVEL + 15; y < h; y++) {
            const idx = y * w + x;
            if (world[idx] === IDS.AIR) {
                // Fill lower half of hell caves with lava
                // Or if it's the very bottom of the map
                if (y > h - 15 || rng.chance(4)) {
                     world[idx] = IDS.LAVA;
                }
            }
        }
    }

    // --- Pass 5: Biome Columns ---
    // Layout: Snow (Left) -> Forest (Center) -> Desert (Right-Mid) -> Jungle (Far Right)
    const snowEnd = Math.floor(w * 0.15);
    // Center Spawn Area (Forest) is implicit between Snow and Desert
    const desertStart = Math.floor(w * 0.65);
    const desertEnd = Math.floor(w * 0.80);
    const jungleStart = Math.floor(w * 0.80);

    for (let y = 0; y < HELL_LEVEL; y++) {
        for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const tile = world[idx];
            
            if (x < snowEnd) {
                // Snow Biome
                if (tile === IDS.DIRT_BLOCK || tile === IDS.GRASS_BLOCK) world[idx] = IDS.SNOW_BLOCK;
                if (tile === IDS.STONE_BLOCK) world[idx] = IDS.ICE_BLOCK;
            } else if (x > desertStart && x < desertEnd) {
                // Desert
                if (tile === IDS.DIRT_BLOCK || tile === IDS.GRASS_BLOCK) world[idx] = IDS.SAND_BLOCK;
                if (tile === IDS.STONE_BLOCK) world[idx] = IDS.SANDSTONE_BLOCK;
            } else if (x > jungleStart) {
                // Jungle
                if (tile === IDS.DIRT_BLOCK || tile === IDS.STONE_BLOCK) world[idx] = IDS.MUD_BLOCK;
                if (tile === IDS.GRASS_BLOCK) world[idx] = IDS.JUNGLE_GRASS_SEEDS ? IDS.JUNGLE_GRASS_SEEDS : IDS.GRASS_BLOCK; // Needs distinct jungle grass ID ideally
            }
        }
    }

    // --- Pass 6: Structures (Underground Cabins) ---
    const generateCabin = (cx: number, cy: number) => {
        let fy = cy;
        // Search downwards for a floor
        while(fy < h && world[fy * w + cx] === IDS.AIR) fy++;
        if (fy >= h - 5) return; 

        const floorY = fy;
        const cabinW = 10;
        const cabinH = 6;
        const startX = cx - Math.floor(cabinW / 2);
        const startY = floorY - cabinH;

        if (startX < 0 || startX + cabinW >= w) return;

        // Build Shell
        for (let y = startY; y <= floorY; y++) {
            for (let x = startX; x <= startX + cabinW; x++) {
                const idx = y * w + x;
                
                // Back Walls
                if (x > startX && x < startX + cabinW && y > startY && y < floorY) {
                    world[idx] = IDS.AIR;
                    walls[idx] = IDS.WOOD_WALL;
                }
                
                // Frame (Wood Planks)
                if (x === startX || x === startX + cabinW || y === startY || y === floorY) {
                    world[idx] = IDS.WOOD;
                }
            }
        }

        // Place Chest
        const chestX = cx;
        const chestY = floorY - 1;
        world[chestY * w + chestX] = IDS.CHEST;
        
        // Loot Table
        const loot: InventorySlot[] = [];
        const rares = [IDS.CLOUD_IN_A_BOTTLE, IDS.HERMES_BOOTS, IDS.BAND_OF_REGENERATION, IDS.MAGIC_MIRROR, IDS.SHOE_SPIKES, IDS.FLARE_GUN, IDS.ENCHANTED_BOOMERANG];
        const rareId = rares[Math.floor(rng.next() * rares.length)];
        if (rareId) loot.push({ id: rareId, n: 1 });
        
        // Consumables
        loot.push({ id: IDS.GOLD_COIN, n: rng.range(1, 3) });
        loot.push({ id: IDS.HEALING_POTION, n: rng.range(3, 8) });
        loot.push({ id: IDS.TORCH, n: rng.range(15, 40) });
        if (rng.chance(2)) loot.push({ id: IDS.SILVER_BAR, n: rng.range(4, 10) });
        if (rng.chance(2)) loot.push({ id: IDS.GOLD_BAR, n: rng.range(3, 8) });

        chests[`${chestX},${chestY}`] = loot;

        // Place Torch inside
        world[(floorY - 3) * w + cx] = IDS.TORCH;
    };

    // Try to place cabins
    const cabinAttempts = 60 * mapScale;
    for (let i = 0; i < cabinAttempts; i++) {
        const cx = Math.floor(rng.range(50, w - 50));
        const cy = Math.floor(rng.range(ROCK_LEVEL, HELL_LEVEL - 40));
        // Only start if we are in air (in a cave)
        if (world[cy * w + cx] === IDS.AIR) {
            generateCabin(cx, cy);
        }
    }

    // --- Pass 7: Spawn Area Cleanup ---
    // Ensure the player spawns in the center forest on flat ground
    const spawnX = Math.floor(w / 2);
    let spawnY = surfaceHeights[spawnX] - 3;
    
    // Force a small flat area around spawn
    for (let x = spawnX - 5; x <= spawnX + 5; x++) {
        // Match height to spawn center height
        const targetY = surfaceHeights[spawnX];
        // Fill ground below
        for (let y = targetY; y < targetY + 10; y++) {
             world[y * w + x] = IDS.DIRT_BLOCK;
             walls[y * w + x] = IDS.DIRT_WALL;
        }
        // Clear air above
        for (let y = targetY - 10; y < targetY; y++) {
            world[y * w + x] = IDS.AIR;
            walls[y * w + x] = 0;
        }
        // Add grass
        world[targetY * w + x] = IDS.GRASS_BLOCK;
    }

    // Spawn Guide
    npcs.push({
        id: Math.random(),
        type: 'guide',
        aiStyle: 'passive',
        x: spawnX * TILE_SIZE,
        y: (spawnY - 2) * TILE_SIZE,
        w: 24, h: 42,
        vx: 0, vy: 0,
        face: 1,
        hp: 250, maxHp: 250,
        walkFrame: 0,
        defense: 15
    });

    console.log("World Generation Complete.");
};
