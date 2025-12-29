
import { TILE_SIZE, GRAVITY, TERM_VEL, DAY_LENGTH, NIGHT_START, NIGHT_END } from '../constants';
import { IDS, PROPS, STATION_LOOKUP } from '../data/items';
import { MODIFIERS, getRandomModifier } from '../data/modifiers';
import { generateWorld } from './WorldGen';
import { NPC, ActiveChest, CharacterData, WorldData, Recipe, InventorySlot } from '../types';

export class GameEngine {
    world: Uint16Array;
    walls: Uint16Array;
    lightMap: Float32Array; // 0.0 (dark) to 1.0 (bright)
    chests: Record<string, InventorySlot[]>;
    activeChest: ActiveChest | null;
    camera: { x: number, y: number };
    player: any;
    npcs: NPC[];
    lastTime: number;
    particles: any[];
    loot: any[];
    time: number; // 0 - 24000
    invDirty: boolean; // Flag to sync React state
    smartCursor: boolean;
    attackCooldown: number;
    
    // World Config
    width: number;
    height: number;
    worldData: WorldData | null = null;
    
    constructor() {
        // Default small init, overwritten in start()
        this.width = 800;
        this.height = 300;
        this.world = new Uint16Array(1); 
        this.walls = new Uint16Array(1); 
        this.lightMap = new Float32Array(1);
        this.chests = {};
        this.activeChest = null;
        this.npcs = [];
        this.camera = { x: 0, y: 0 };
        this.particles = [];
        this.loot = [];
        this.lastTime = 0;
        this.time = 4500; 
        this.invDirty = true;
        this.smartCursor = false;
        this.attackCooldown = 0;
        
        // Initialize player with empty arrays to prevent crashes if accessed before start()
        this.player = {
            x: 0, y: 0, w: TILE_SIZE, h: TILE_SIZE * 3,
            vx: 0, vy: 0,
            hp: 100, maxHp: 100, mana: 20, maxMana: 20,
            defense: 0,
            inv: [],
            armor: [],
            accessories: [],
            coins: [],
            ammo: [],
            sel: 0,
            colors: {}
        };
    }

    start(char: CharacterData, world: WorldData) {
        this.worldData = world;
        this.width = world.width;
        this.height = world.height;
        
        // Re-allocate arrays based on new world size
        this.world = new Uint16Array(this.width * this.height);
        this.walls = new Uint16Array(this.width * this.height);
        this.lightMap = new Float32Array(this.width * this.height);
        this.chests = {};
        this.npcs = [];
        this.loot = [];
        this.particles = [];
        this.time = 4500;
        
        // Setup Player
        this.player = {
            x: 0, y: 0, w: TILE_SIZE, h: TILE_SIZE * 3,
            vx: 0, vy: 0,
            hp: char.hp || 100, maxHp: char.maxHp || 100,
            mana: char.mana || 20, maxMana: char.maxMana || 20,
            defense: 0,
            inv: new Array(50).fill(null).map(() => ({ id: 0, n: 0 })),
            armor: new Array(3).fill(null).map(() => ({ id: 0, n: 0 })),
            accessories: new Array(5).fill(null).map(() => ({ id: 0, n: 0 })),
            coins: new Array(4).fill(null).map(() => ({ id: 0, n: 0 })),
            ammo: new Array(4).fill(null).map(() => ({ id: 0, n: 0 })),
            sel: 0,
            face: 1,
            walkFrame: 0,
            regenTimer: 0,
            immune: 0,
            swinging: 0,
            targetAngle: 0,
            inLiquid: false,
            // Cosmetic
            colors: char.colors,
            name: char.name,
            difficulty: char.difficulty
        };

        // Starting Gear based on difficulty or standard
        const addStartItem = (slot: number, name: string, qty: number) => {
            if (IDS[name]) this.player.inv[slot] = { id: IDS[name], n: qty };
        };
        
        addStartItem(0, 'COPPER_PICKAXE', 1);
        addStartItem(1, 'COPPER_AXE', 1);
        addStartItem(2, 'COPPER_BROADSWORD', 1);
        addStartItem(3, 'TORCH', 20);
        
        this.invDirty = true;
        this.init();
    }

    init() {
        if (!this.worldData) return;
        
        generateWorld(this.world, this.walls, this.chests, this.npcs, this.worldData);
        
        // Find spawn
        const midX = Math.floor(this.width / 2);
        let spawnY = 0;
        for(let y=0; y<this.height; y++) {
            if(PROPS[this.world[y*this.width+midX]]?.solid) {
                spawnY = (y - 4) * TILE_SIZE;
                break;
            }
        }
        this.player.x = midX * TILE_SIZE;
        this.player.y = spawnY;
        this.camera.x = this.player.x - window.innerWidth/2;
        this.camera.y = this.player.y - window.innerHeight/2;
    }

    update(input: any, dt: number) {
        if (!this.worldData) return; // Prevent updating if not started
        
        // Time Cycle
        this.time = (this.time + 1) % DAY_LENGTH;
        if(this.attackCooldown > 0) this.attackCooldown--;
        
        // Player State
        const p = this.player;
        if (p.immune > 0) p.immune--;
        if (p.swinging > 0) p.swinging--;
        
        // Update Stats & Armor
        this.updateStats();
        this.regenPlayer();
        
        // Spawning
        this.handleSpawning();
        
        // Fallen Star Event
        this.handleFallenStars();
        
        // Vegetation Growth
        this.updateVegetation();
        
        // Chest Interaction Range Check
        if (this.activeChest) {
            const dist = Math.hypot(p.x - this.activeChest.x * TILE_SIZE, p.y - this.activeChest.y * TILE_SIZE);
            if (dist > 150) { 
                this.activeChest = null;
                this.invDirty = true;
            }
        }

        // Player Physics
        if (input.left) { p.vx = -4.5; p.face = -1; p.walkFrame += dt * 10; }
        else if (input.right) { p.vx = 4.5; p.face = 1; p.walkFrame += dt * 10; }
        else { p.vx *= 0.82; p.walkFrame = 0; }
        
        if (p.inLiquid) {
            p.vx *= 0.7; 
        }

        if (input.jump) {
             if (p.ground) {
                 p.vy = -9.5;
             } else if (p.inLiquid) {
                 p.vy = -5; 
             }
        }

        this.applyPhysics(p);
        
        // NPC AI
        this.updateNPCs(dt);

        // Camera
        const cw = window.innerWidth;
        const ch = window.innerHeight;
        this.camera.x += (p.x - cw / 2 - this.camera.x) * 0.1;
        this.camera.y += (p.y - ch / 2 - this.camera.y) * 0.1;
        this.camera.x = Math.max(0, Math.min(this.camera.x, this.width * TILE_SIZE - cw));
        this.camera.y = Math.max(0, Math.min(this.camera.y, this.height * TILE_SIZE - ch));

        // Particles
        this.particles = this.particles.filter(pt => pt.life > 0);
        this.particles.forEach(pt => {
            pt.x += pt.vx; pt.y += pt.vy; pt.vy += GRAVITY * 0.5; pt.life--;
        });
        
        // Loot Logic
        this.loot = this.loot.filter(l => !l.dead);
        this.loot.forEach(l => {
            l.vy = Math.min(l.vy + GRAVITY, TERM_VEL);
            l.x += l.vx;
            if (this.isSolid(Math.floor(l.x/TILE_SIZE), Math.floor((l.y+8)/TILE_SIZE))) l.x -= l.vx;
            l.y += l.vy;
            const ty = Math.floor((l.y + 12)/TILE_SIZE);
            if (this.isSolid(Math.floor(l.x/TILE_SIZE), ty)) {
                l.y = ty * TILE_SIZE - 12; l.vy = 0; l.vx *= 0.8;
            }

            // Magnet
            const dist = Math.hypot(p.x - l.x, p.y - l.y);
            if (dist < 100) { 
                const pull = (100 - dist) / 100;
                l.x += (p.x - l.x) * 0.15 * pull; 
                l.y += (p.y - l.y) * 0.15 * pull;
                
                if (dist < 30) {
                    if (this.addToInv(l.id, l.n, l.prefix)) {
                        l.dead = true;
                    }
                }
            }
        });

        // Update Lighting 
        this.updateLighting();
    }
    
    updateVegetation() {
        const updatesPerFrame = 50; 
        
        for (let k = 0; k < updatesPerFrame; k++) {
            const x = Math.floor(Math.random() * this.width);
            const y = Math.floor(Math.random() * this.height);
            const idx = y * this.width + x;
            const tile = this.world[idx];
            
            if (tile === IDS.GRASS_BLOCK) {
                const nx = x + Math.floor(Math.random() * 3) - 1;
                const ny = y + Math.floor(Math.random() * 3) - 1;
                
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    const nIdx = ny * this.width + nx;
                    if (this.world[nIdx] === IDS.DIRT_BLOCK) {
                        let exposed = false;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                const checkX = nx + dx;
                                const checkY = ny + dy;
                                if (checkX >= 0 && checkX < this.width && checkY >= 0 && checkY < this.height) {
                                    if (!PROPS[this.world[checkY * this.width + checkX]]?.solid) {
                                        exposed = true; break;
                                    }
                                }
                            }
                            if (exposed) break;
                        }
                        
                        if (exposed) {
                            this.world[nIdx] = IDS.GRASS_BLOCK;
                        }
                    }
                }

                if (y > 0 && this.world[(y - 1) * this.width + x] === IDS.AIR) {
                     if (Math.random() < 0.02) { 
                         this.world[(y - 1) * this.width + x] = IDS.WEED;
                     }
                }
                
                if (y > 0 && PROPS[this.world[(y - 1) * this.width + x]]?.solid) {
                    this.world[idx] = IDS.DIRT_BLOCK;
                }
            }
        }
    }
    
    updateLighting() {
        const viewW = Math.ceil(window.innerWidth / TILE_SIZE);
        const viewH = Math.ceil(window.innerHeight / TILE_SIZE);
        const startX = Math.max(0, Math.floor(this.camera.x / TILE_SIZE) - 20);
        const endX = Math.min(this.width, startX + viewW + 40);
        const startY = Math.max(0, Math.floor(this.camera.y / TILE_SIZE) - 20);
        const endY = Math.min(this.height, startY + viewH + 40);

        const TRANSITION_TICKS = 1500;
        let globalLight = 1.0;

        if (this.time < NIGHT_START - TRANSITION_TICKS) {
            globalLight = 1.0;
        } else if (this.time < NIGHT_START) {
            const progress = (this.time - (NIGHT_START - TRANSITION_TICKS)) / TRANSITION_TICKS;
            globalLight = 1.0 - (progress * 0.9); 
        } else if (this.time < NIGHT_END) {
            globalLight = 0.1;
        } else if (this.time < NIGHT_END + TRANSITION_TICKS) {
            const progress = (this.time - NIGHT_END) / TRANSITION_TICKS;
            globalLight = 0.1 + (progress * 0.9);
        } else {
            globalLight = 1.0;
        }

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const idx = y * this.width + x;
                const tile = this.world[idx];
                const wall = this.walls[idx];
                
                let light = 0;

                if (y > 200) { 
                    light = 0.01; 
                } else {
                    if (y < 100) light = (wall === 0) ? globalLight : 0.05;
                    else light = 0.01; 
                }
                
                if (y > this.height - 100) {
                     light = Math.max(light, 0.4); 
                }

                if (PROPS[tile]?.light) {
                    light = 1.0;
                }
                if (tile === IDS.HELLSTONE || tile === IDS.MAGMA_ORE) {
                     light = 0.8;
                }

                this.lightMap[idx] = light;
            }
        }
        
        const px = Math.floor((this.player.x + this.player.w/2) / TILE_SIZE);
        const py = Math.floor((this.player.y + this.player.h/2) / TILE_SIZE);
        if (px >= startX && px < endX && py >= startY && py < endY) {
            const heldItem = this.player.inv[this.player.sel];
            if ((heldItem.id && PROPS[heldItem.id]?.light) || this.player.inv.some((i: any) => i.id === 88)) {
                this.lightMap[py * this.width + px] = 1.0;
            }
        }

        const AIR_DECAY = 0.03;
        const SOLID_DECAY = 0.2;
        const WALL_DECAY = 0.08;

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const idx = y * this.width + x;
                const tile = this.world[idx];
                const wall = this.walls[idx];
                
                let decay = AIR_DECAY;
                if (PROPS[tile]?.solid) decay = SOLID_DECAY;
                else if (wall !== 0) decay = WALL_DECAY;
                else if (PROPS[tile]?.liquid) decay = 0.1;
                
                if (y > startY) {
                    const top = this.lightMap[(y - 1) * this.width + x];
                    if (top - decay > this.lightMap[idx]) this.lightMap[idx] = top - decay;
                }
                if (x > startX) {
                    const left = this.lightMap[y * this.width + (x - 1)];
                    if (left - decay > this.lightMap[idx]) this.lightMap[idx] = left - decay;
                }
            }
        }

        for (let y = endY - 1; y >= startY; y--) {
            for (let x = endX - 1; x >= startX; x--) {
                const idx = y * this.width + x;
                const tile = this.world[idx];
                const wall = this.walls[idx];
                
                let decay = AIR_DECAY;
                if (PROPS[tile]?.solid) decay = SOLID_DECAY;
                else if (wall !== 0) decay = WALL_DECAY;
                else if (PROPS[tile]?.liquid) decay = 0.1;

                if (y < endY - 1) {
                    const bottom = this.lightMap[(y + 1) * this.width + x];
                    if (bottom - decay > this.lightMap[idx]) this.lightMap[idx] = bottom - decay;
                }
                if (x < endX - 1) {
                    const right = this.lightMap[y * this.width + (x + 1)];
                    if (right - decay > this.lightMap[idx]) this.lightMap[idx] = right - decay;
                }
            }
        }
    }

    isSolid(x: number, y: number) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return true;
        const t = this.world[y * this.width + x];
        return t && PROPS[t]?.solid; 
    }

    collide(e: any, isX: boolean) {
        const sx = Math.floor(e.x / TILE_SIZE);
        const ex = Math.floor((e.x + e.w - 0.1) / TILE_SIZE);
        const sy = Math.floor(e.y / TILE_SIZE);
        const ey = Math.floor((e.y + e.h - 0.1) / TILE_SIZE);

        for (let y = sy; y <= ey; y++) {
            for (let x = sx; x <= ex; x++) {
                if (this.isSolid(x, y)) {
                    if (isX) {
                        if (e.vx > 0) e.x = x * TILE_SIZE - e.w;
                        else if (e.vx < 0) e.x = (x + 1) * TILE_SIZE;
                        e.vx = 0;
                    } else {
                        if (e.vy > 0) {
                            e.y = y * TILE_SIZE - e.h;
                            e.ground = true;
                        } else if (e.vy < 0) e.y = (y + 1) * TILE_SIZE;
                        e.vy = 0;
                    }
                }
            }
        }
    }
    
    getSmartTarget(mx: number, my: number): {x: number, y: number} | null {
        const item = this.player.inv[this.player.sel];
        const prop = PROPS[item.id];
        if (!prop) return null;
        
        const reach = 5; 
        const pCx = Math.floor((this.player.x + this.player.w / 2) / TILE_SIZE);
        const pCy = Math.floor((this.player.y + this.player.h / 2) / TILE_SIZE);
        const wx = mx + this.camera.x;
        const wy = my + this.camera.y;
        const angle = Math.atan2(wy - (this.player.y + this.player.h/2), wx - (this.player.x + this.player.w/2));

        if (prop.tool === 'pick') {
            let dirX = 0;
            let dirY = 0;
            const absAngle = Math.abs(angle);

            if (absAngle < Math.PI / 4) dirX = 1; 
            else if (absAngle > 3 * Math.PI / 4) dirX = -1;
            else if (angle > 0) dirY = 1;
            else dirY = -1;

            if (dirX !== 0) {
                for (let i = 1; i <= reach; i++) {
                    const tx = pCx + (dirX * i);
                    const yOffsets = [-1, 0, 1]; 
                    for (const yOff of yOffsets) {
                        const ty = pCy + yOff;
                        if (this.isSolid(tx, ty)) {
                            return { x: tx * TILE_SIZE, y: ty * TILE_SIZE };
                        }
                    }
                }
            } else if (dirY !== 0) {
                for (let i = 1; i <= reach; i++) {
                    const ty = pCy + (dirY * (i + (dirY === 1 ? 1 : 0)));
                    const xOffsets = [0, this.player.face];
                    for (const xOff of xOffsets) {
                        const tx = pCx + xOff;
                        if (this.isSolid(tx, ty)) {
                            return { x: tx * TILE_SIZE, y: ty * TILE_SIZE };
                        }
                    }
                }
            }
        }
        
        if (prop.tool === 'axe') {
             const dirX = Math.cos(angle);
             const dirY = Math.sin(angle);
             for(let i=0; i<reach * TILE_SIZE; i+=TILE_SIZE/2) {
                 const tx = Math.floor((this.player.x + this.player.w/2 + dirX * i) / TILE_SIZE);
                 const ty = Math.floor((this.player.y + this.player.h/2 + dirY * i) / TILE_SIZE);
                 const id = this.world[ty*this.width+tx];
                 if (id >= 9000) { 
                     return { x: tx * TILE_SIZE, y: ty * TILE_SIZE };
                 }
             }
        }

        return null;
    }

    interact(mx: number, my: number, isLeft: boolean, smartTarget?: {x: number, y: number} | null, shiftKey: boolean = false) {
        let item = this.player.inv[this.player.sel];
        
        let usedTorch = false;
        if (shiftKey && isLeft) {
            const torchSlot = this.player.inv.find((i: any) => i.id === 8 && i.n > 0);
            if (torchSlot) {
                 item = torchSlot;
                 usedTorch = true;
            } else {
                if(!item.id) return; 
            }
        }

        const prop = PROPS[item.id];

        // Attack Logic
        if (isLeft && (prop?.tool === 'sword' || (prop?.dmg && !prop.tool)) && this.attackCooldown <= 0) {
            this.attackCooldown = prop.pwr ? 20 - prop.pwr : 20; 
            
            if (item.prefix && MODIFIERS[item.prefix]?.speed) {
                this.attackCooldown = Math.max(5, Math.floor(this.attackCooldown / MODIFIERS[item.prefix].speed!));
            }
            
            if(this.attackCooldown < 10) this.attackCooldown = 10;
            this.player.swinging = 15;
            
            const wx = mx + this.camera.x;
            const wy = my + this.camera.y;
            const px = this.player.x + this.player.w/2;
            const py = this.player.y + this.player.h/2;
            
            this.player.face = wx > px ? 1 : -1;
            this.player.targetAngle = Math.atan2(wy - py, wx - px);

            const reach = 80; 
            const swingArc = Math.PI / 2; 
            
            let dmg = prop.dmg || 5;
            let kb = 5;
            
            if (item.prefix && MODIFIERS[item.prefix]) {
                const mod = MODIFIERS[item.prefix];
                if (mod.dmg) dmg *= mod.dmg;
                if (mod.knockback) kb *= mod.knockback;
            }

            this.npcs.forEach(npc => {
                 const nx = npc.x + npc.w/2;
                 const ny = npc.y + npc.h/2;
                 const dist = Math.hypot(nx - px, ny - py);
                 
                 if (dist < reach + Math.max(npc.w, npc.h)/2) { 
                     const angleToNPC = Math.atan2(ny - py, nx - px);
                     let angleDiff = angleToNPC - this.player.targetAngle;
                     while (angleDiff <= -Math.PI) angleDiff += Math.PI*2;
                     while (angleDiff > Math.PI) angleDiff -= Math.PI*2;
                     
                     if (Math.abs(angleDiff) < swingArc / 2) {
                         if (npc.aiStyle !== 'passive') {
                            this.damageNPC(npc, Math.floor(dmg), kb * Math.cos(this.player.targetAngle));
                         }
                     }
                 }
            });
            
            if (!prop.tool && !prop.placeWall && prop.type !== 'block' && !usedTorch) {
                return; 
            }
        }

        let tx, ty;
        if (this.smartCursor && smartTarget && isLeft && !usedTorch) {
            tx = Math.floor(smartTarget.x / TILE_SIZE);
            ty = Math.floor(smartTarget.y / TILE_SIZE);
        } else {
            tx = Math.floor((mx + this.camera.x) / TILE_SIZE);
            ty = Math.floor((my + this.camera.y) / TILE_SIZE);
        }

        if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return;

        const idx = ty * this.width + tx;
        const tile = this.world[idx];
        const tool = prop?.tool;
        const dist = Math.hypot(this.player.x + this.player.w/2 - (tx*TILE_SIZE), this.player.y + this.player.h/2 - (ty*TILE_SIZE));
        
        if (dist > 250) return; 

        if (isLeft) {
            if (item.id === IDS.LIFE_CRYSTAL) {
                this.player.maxHp += 20;
                this.player.hp = this.player.maxHp;
                item.n--;
                if(item.n<=0) item.id=0;
                this.invDirty = true;
                return;
            }
            if (item.id === IDS.MANA_CRYSTAL) {
                this.player.maxMana += 20;
                this.player.mana = this.player.maxMana;
                item.n--;
                if(item.n<=0) item.id=0;
                this.invDirty = true;
                return;
            }

            if (tile !== IDS.AIR && !usedTorch) {
                if (PROPS[tile]?.liquid) return;

                const isTree = (tile >= 9001 && tile <= 9007);
                if (isTree) {
                    if (tool === 'axe') this.chopTree(tx, ty);
                } else {
                    if (tile === IDS.WEED || tile === IDS.GRASS_BLOCK) {
                        if (tile === IDS.WEED) {
                             this.world[idx] = IDS.AIR;
                             this.spawnParticles(tx*TILE_SIZE, ty*TILE_SIZE, '#4caf50', 3);
                             return;
                        }
                    }

                    if (PROPS[tile]?.hardness) {
                        if (tool === 'pick' || tool === 'hammer') {
                            this.world[idx] = IDS.AIR;
                            const dropId = tile === IDS.GRASS_BLOCK ? IDS.DIRT_BLOCK : tile;
                            this.spawnLoot(tx*TILE_SIZE, ty*TILE_SIZE, dropId, 1);
                            this.spawnParticles(tx*TILE_SIZE, ty*TILE_SIZE, PROPS[tile]?.c || '#fff', 5);
                            
                            if (tile === IDS.CHEST || tile === 48) {
                                const key = `${tx},${ty}`;
                                if (this.chests[key]) {
                                    this.chests[key].forEach(it => {
                                        if(it.id !== 0) this.spawnLoot(tx*TILE_SIZE, ty*TILE_SIZE, it.id, it.n, it.prefix);
                                    });
                                    delete this.chests[key];
                                }
                                if(this.activeChest && this.activeChest.x === tx && this.activeChest.y === ty) {
                                    this.activeChest = null;
                                    this.invDirty = true;
                                }
                            }
                        }
                    }
                }
            } else if (usedTorch || prop?.type === 'block') {
                 const canPlace = tile === IDS.AIR || PROPS[tile]?.liquid || tile === IDS.WEED; 
                 if (canPlace) {
                    const p = this.player;
                    const bx = tx*TILE_SIZE, by = ty*TILE_SIZE;
                    if (!prop.solid || !(p.x < bx + TILE_SIZE && p.x + p.w > bx && p.y < by + TILE_SIZE && p.y + p.h > by)) {
                         this.world[idx] = item.id;
                         item.n--;
                         if(item.n <= 0) { item.id = 0; item.prefix = undefined; }
                         this.invDirty = true;
                         
                         if (item.id === IDS.CHEST || item.id === 48) {
                             this.chests[`${tx},${ty}`] = new Array(20).fill(null).map(() => ({id:0, n:0}));
                         }
                    }
                }
            }
        } else {
            if (tile === IDS.CHEST || tile === 48) {
                const key = `${tx},${ty}`;
                if (!this.chests[key]) {
                    this.chests[key] = new Array(20).fill(null).map(() => ({id:0, n:0}));
                }
                
                if (this.activeChest && this.activeChest.x === tx && this.activeChest.y === ty) {
                    this.activeChest = null; 
                } else {
                    this.activeChest = { x: tx, y: ty, slots: this.chests[key] };
                }
                this.invDirty = true;
                return; 
            }

            if (item.id && item.n > 0) {
                if (prop.placeWall) {
                    if (this.walls[idx] !== prop.placeWall) {
                         this.walls[idx] = prop.placeWall;
                         item.n--;
                         if (item.n <= 0) item.id = 0;
                         this.invDirty = true;
                    }
                }
            }
        }
    }
    
    handleSpawning() {
        if (this.npcs.length > 15) return;
        if (Math.random() > 0.02) return;

        const p = this.player;
        const side = Math.random() > 0.5 ? 1 : -1;
        const sx = p.x + side * (Math.random() * 400 + 600);
        
        const tx = Math.floor(sx / TILE_SIZE);
        if (tx < 5 || tx >= this.width - 5) return;

        let sy = 0;
        for(let y = 0; y < this.height; y++) {
            if (this.isSolid(tx, y)) {
                sy = (y - 1) * TILE_SIZE;
                break;
            }
        }
        if (sy === 0) return;

        let type = 'slime';
        let ai: any = 'slime';
        let hp = 20;
        let w = 32, h = 24;
        let dmg = 5;
        let defense = 0;

        const isNight = this.time > NIGHT_START && this.time < NIGHT_END;
        
        if (isNight) {
            if (Math.random() < 0.6) {
                type = 'zombie'; ai = 'fighter'; hp = 40; w = 24; h = 42; dmg = 14; defense = 6;
                sy -= 20;
            } else {
                type = 'demon_eye'; ai = 'flying'; hp = 30; w = 30; h = 20; dmg = 18; defense = 2;
                sy -= 150; 
            }
        } else {
             if (sy > (this.height * TILE_SIZE) / 2) {
                 type = 'slime'; hp = 30; dmg = 10;
             }
        }

        this.npcs.push({
            id: Math.random(),
            type, aiStyle: ai,
            x: sx, y: sy, w, h,
            vx: 0, vy: 0,
            hp, maxHp: hp,
            face: side === 1 ? -1 : 1,
            walkFrame: 0,
            damage: dmg,
            defense
        });
        
        if(this.time % 600 === 0 && !isNight) {
             if(!this.npcs.find(n => n.type === 'merchant')) {
                 if(this.countMoney() >= 5000) { 
                     this.npcs.push({
                         id: Math.random(),
                         type: 'merchant', aiStyle: 'passive',
                         x: sx, y: sy, w: 24, h: 42,
                         vx: 0, vy: 0, hp: 250, maxHp: 250,
                         face: 1, walkFrame: 0, damage: 0, defense: 15
                     });
                 }
             }
        }
    }

    handleFallenStars() {
        if (this.time > NIGHT_START && this.time < NIGHT_END) {
             if (Math.random() < 0.0005) { 
                 const x = Math.random() * (this.width * TILE_SIZE);
                 const id = 75; 
                 this.spawnLoot(x, -50, id, 1); 
             }
        }
    }
    
    checkNPCInteract(mx: number, my: number): NPC | undefined {
        const wx = mx + this.camera.x;
        const wy = my + this.camera.y;
        
        for(const npc of this.npcs) {
            if (wx >= npc.x && wx <= npc.x + npc.w && wy >= npc.y && wy <= npc.y + npc.h) {
                const dist = Math.hypot(this.player.x - npc.x, this.player.y - npc.y);
                if (dist < 150) return npc;
            }
        }
        return undefined;
    }
    
    updateNPCs(dt: number) {
        this.npcs = this.npcs.filter(n => n.hp > 0);
        
        this.npcs.forEach(npc => {
            if (npc.immune && npc.immune > 0) npc.immune--;
            
            npc.vy = Math.min(npc.vy + GRAVITY, TERM_VEL);
            if (npc.aiStyle === 'flying') npc.vy = 0; 

            const dx = this.player.x - npc.x;
            const dy = this.player.y - npc.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist > 2500 && !['guide', 'merchant', 'nurse'].includes(npc.type)) {
                npc.hp = 0; return;
            }
            
            if (npc.aiStyle === 'fighter' || npc.aiStyle === 'slime') {
                 if (npc.ground) {
                     if (npc.aiStyle === 'slime') {
                         if (Math.random() < 0.02) {
                             npc.vy = -6 - Math.random() * 3;
                             npc.vx = (dx > 0 ? 1 : -1) * (2 + Math.random()*2);
                         }
                         npc.vx *= 0.95;
                     } else {
                         // Fighter
                         const dir = dx > 0 ? 1 : -1;
                         npc.vx += dir * 0.2;
                         if (Math.abs(npc.vx) > 2) npc.vx = dir * 2;
                         
                         const tx = Math.floor((npc.x + npc.w/2 + (dir * TILE_SIZE)) / TILE_SIZE);
                         const ty = Math.floor((npc.y + npc.h - 5) / TILE_SIZE);
                         if (this.isSolid(tx, ty)) {
                             npc.vy = -7;
                         }
                     }
                 }
            } else if (npc.aiStyle === 'flying') {
                const speed = 2.5;
                npc.vx += (dx / dist) * 0.1;
                npc.vy += (dy / dist) * 0.1;
                const v = Math.hypot(npc.vx, npc.vy);
                if (v > speed) { npc.vx = (npc.vx/v)*speed; npc.vy = (npc.vy/v)*speed; }
            } else if (npc.aiStyle === 'passive') {
                 if (Math.random() < 0.01) npc.vx = (Math.random()-0.5) * 2;
                 if (npc.ground && Math.random() < 0.005) npc.vy = -5;
                 npc.vx *= 0.9;
            }
            
            this.applyPhysics(npc);
            
            if (npc.damage && npc.damage > 0) {
                if (npc.x < this.player.x + this.player.w && npc.x + npc.w > this.player.x &&
                    npc.y < this.player.y + this.player.h && npc.y + npc.h > this.player.y) {
                    this.damagePlayer(npc.damage);
                }
            }
        });
    }

    damagePlayer(amt: number) {
        if (this.player.immune > 0) return;
        const dmg = Math.max(1, amt - this.player.defense / 2);
        this.player.hp -= Math.floor(dmg);
        this.player.immune = 60;
        this.player.vx += (Math.random()-0.5) * 10;
        this.player.vy = -5;
        if (this.player.hp <= 0) this.respawn();
    }

    respawn() {
        this.player.hp = this.player.maxHp;
        let sx = Math.floor(this.width/2);
        let sy = 0;
        for(let y=0; y<this.height; y++) {
            if(this.isSolid(sx, y)) {
                sy = (y-3)*TILE_SIZE; break;
            }
        }
        this.player.x = sx * TILE_SIZE;
        this.player.y = sy;
        this.player.vx = 0; 
        this.player.vy = 0;
        this.removeMoney(Math.floor(this.countMoney() / 2));
    }
    
    removeMoney(amount: number): boolean {
        if (this.countMoney() < amount) return false;
        const currentTotal = this.countMoney();
        const newTotal = currentTotal - amount;
        
        // Clear all existing money slots first
        const clear = (list: any[]) => {
            list?.forEach(slot => {
                if ([71, 72, 73, 74].includes(slot.id)) {
                    slot.id = 0; slot.n = 0;
                }
            });
        };
        clear(this.player.inv);
        clear(this.player.coins);
        
        this.addMoney(newTotal);
        this.invDirty = true;
        return true;
    }

    damageNPC(npc: NPC, dmg: number, knockback: number) {
        if (npc.immune && npc.immune > 0) return;
        npc.hp -= dmg;
        npc.vx = knockback;
        npc.vy = -3;
        npc.immune = 20;
        
        this.spawnParticles(npc.x, npc.y, '#ff0000', 5);

        if (npc.hp <= 0) {
             if (npc.type === 'slime') {
                 this.spawnLoot(npc.x, npc.y, 23, 1 + Math.floor(Math.random()*2));
                 this.spawnLoot(npc.x, npc.y, 71, 1 + Math.floor(Math.random()*5));
             } else if (npc.type === 'zombie') {
                 this.spawnLoot(npc.x, npc.y, 72, 1);
             } else if (npc.type === 'demon_eye') {
                 if (Math.random() < 0.1) this.spawnLoot(npc.x, npc.y, 38, 1);
                 this.spawnLoot(npc.x, npc.y, 72, 1); 
             }
        }
    }

    chopTree(tx: number, ty: number) {
        const id = this.world[ty*this.width+tx];
        if (id < 9000) return;

        let by = ty;
        while(by < this.height && this.world[by*this.width+tx] >= 9000) by++;
        by--; 
        
        for(let y = by; y >= 0; y--) {
            const tid = this.world[y*this.width+tx];
            if (tid < 9000 && tid !== IDS.AIR) break;
            
            if (tid >= 9000) {
                this.world[y*this.width+tx] = IDS.AIR;
                this.spawnParticles(tx*TILE_SIZE, y*TILE_SIZE, '#8d6e63', 3);
                this.spawnLoot(tx*TILE_SIZE, y*TILE_SIZE, IDS.WOOD, 2 + Math.floor(Math.random()*3));
                
                for(let lx=tx-2; lx<=tx+2; lx++) {
                    for(let ly=y-2; ly<=y+2; ly++) {
                         const lid = this.world[ly*this.width+lx];
                         if ([IDS.TREE_LEAVES, IDS.PINE_LEAVES, IDS.PALM_LEAVES].includes(lid)) {
                             this.world[ly*this.width+lx] = IDS.AIR;
                             this.spawnParticles(lx*TILE_SIZE, ly*TILE_SIZE, '#388e3c', 2);
                             if (Math.random() < 0.1) this.spawnLoot(lx*TILE_SIZE, ly*TILE_SIZE, 27, 1); 
                         }
                    }
                }
            }
        }
    }

    // --- New Methods ---

    changeSlot(delta: number) {
        this.player.sel = (this.player.sel - delta + 10) % 10;
        if (this.player.sel < 0) this.player.sel += 10;
    }

    canCraft(r: Recipe): boolean {
        // Check station requirements
        if (r.req) {
             const px = Math.floor((this.player.x + this.player.w/2) / TILE_SIZE);
             const py = Math.floor((this.player.y + this.player.h/2) / TILE_SIZE);
             let found = false;
             for(let y=py-3; y<=py+3; y++) {
                 for(let x=px-4; x<=px+4; x++) {
                     if (x>=0 && x<this.width && y>=0 && y<this.height) {
                         const tid = this.world[y*this.width+x];
                         if (STATION_LOOKUP[tid] === r.req) {
                             found = true;
                             break;
                         }
                     }
                 }
                 if(found) break;
             }
             if (!found && r.req !== 0) return false;
        }

        // Check ingredients
        for (const [id, qty] of Object.entries(r.cost)) {
            const has = this.countItem(parseInt(id));
            if (has < (qty as number)) return false;
        }
        return true;
    }
    
    countItem(id: number): number {
        let count = 0;
        // Optional chaining to prevent crash if inv is undefined
        this.player.inv?.forEach((slot: any) => {
            if (slot.id === id) count += slot.n;
        });
        return count;
    }

    craft(r: Recipe) {
        if (!this.canCraft(r)) return;
        for (const [id, qty] of Object.entries(r.cost)) {
            this.removeItem(parseInt(id), qty as number);
        }
        this.addToInv(r.out, r.n);
    }
    
    removeItem(id: number, qty: number) {
        for (let i = 0; i < this.player.inv.length; i++) {
            const slot = this.player.inv[i];
            if (slot.id === id) {
                if (slot.n >= qty) {
                    slot.n -= qty;
                    qty = 0;
                } else {
                    qty -= slot.n;
                    slot.n = 0;
                    slot.id = 0;
                }
                if (slot.n === 0) slot.id = 0;
                if (qty === 0) break;
            }
        }
        this.invDirty = true;
    }

    sellItem(slotIdx: number) {
        const item = this.player.inv[slotIdx];
        if (!item || item.id === 0) return;
        const prop = PROPS[item.id];
        if (!prop || !prop.value) return;
        
        const val = Math.floor((prop.value * item.n) / 5); 
        if (val > 0) {
            item.id = 0; 
            item.n = 0;
            item.prefix = undefined;
            this.addMoney(val);
            this.invDirty = true;
        }
    }
    
    addMoney(amount: number) {
        let total = this.countMoney() + amount;
        
        for(let i=0; i<4; i++) { this.player.coins[i] = {id:0, n:0}; }
        
        const plat = Math.floor(total / 1000000);
        total %= 1000000;
        const gold = Math.floor(total / 10000);
        total %= 10000;
        const silver = Math.floor(total / 100);
        const copper = total % 100;
        
        if (plat > 0) this.player.coins[3] = { id: 74, n: plat };
        if (gold > 0) this.player.coins[2] = { id: 73, n: gold };
        if (silver > 0) this.player.coins[1] = { id: 72, n: silver };
        if (copper > 0) this.player.coins[0] = { id: 71, n: copper };
        
        this.invDirty = true;
    }
    
    countMoney(): number {
        let total = 0;
        this.player.coins?.forEach((c: any) => {
            if (c.id === 71) total += c.n;
            if (c.id === 72) total += c.n * 100;
            if (c.id === 73) total += c.n * 10000;
            if (c.id === 74) total += c.n * 1000000;
        });
        return total;
    }
    
    buyItem(id: number, price: number) {
        const money = this.countMoney();
        if (money >= price) {
            if (this.addToInv(id, 1)) {
                this.addMoney(-price);
            }
        }
    }
    
    getShopItems(npcType: string): any[] {
        if (npcType === 'merchant') {
            return [
                { id: 8, price: 50 },
                { id: 28, price: 1000 }, 
                { id: 9, price: 100 }, 
                { id: 40, price: 1000 }, 
                { id: 296, price: 50000 }, 
                { id: 87, price: 5000 }, 
            ].map(i => ({...i, name: PROPS[i.id]?.name}));
        }
        return [];
    }

    transferItem(fromChest: boolean, index: number) {
        if (!this.activeChest) return;
        
        if (fromChest) {
            const item = this.activeChest.slots[index];
            if (item.id !== 0) {
                if (this.addToInv(item.id, item.n, item.prefix)) {
                    item.id = 0; item.n = 0; item.prefix = undefined;
                    this.invDirty = true;
                }
            }
        } else {
            const item = this.player.inv[index];
            if (item.id === 0) return;
            
            let deposited = false;
            for(const slot of this.activeChest.slots) {
                if (slot.id === item.id && (!slot.prefix && !item.prefix)) {
                    const space = 999 - slot.n;
                    if (space > 0) {
                        const amt = Math.min(space, item.n);
                        slot.n += amt;
                        item.n -= amt;
                        if (item.n <= 0) { item.id = 0; deposited = true; break; }
                    }
                }
            }
            if (!deposited && item.n > 0) {
                for(const slot of this.activeChest.slots) {
                    if (slot.id === 0) {
                        slot.id = item.id;
                        slot.n = item.n;
                        slot.prefix = item.prefix;
                        item.id = 0;
                        item.n = 0;
                        item.prefix = undefined;
                        break;
                    }
                }
            }
            this.invDirty = true;
        }
    }
    
    spawnParticles(x: number, y: number, c: string, count: number) {
        for(let i=0; i<count; i++) {
             this.particles.push({
                 x, y,
                 vx: (Math.random() - 0.5) * 4,
                 vy: (Math.random() - 0.5) * 4,
                 c,
                 life: 30 + Math.random() * 20
             });
        }
    }
    
    spawnLoot(x: number, y: number, id: number, n: number, prefix?: number) {
        if (!id || id === 0) return;
        this.loot.push({
            x, y, vx: (Math.random() - 0.5) * 4, vy: -3,
            id, n, prefix,
            dead: false
        });
    }
    
    addToInv(id: number, n: number, prefix?: number): boolean {
        for(const slot of this.player.inv) {
            if (slot.id === id && (!prefix && !slot.prefix)) {
                if (slot.n < 999) {
                     const space = 999 - slot.n;
                     const amt = Math.min(space, n);
                     slot.n += amt;
                     n -= amt;
                     if (n <= 0) { this.invDirty = true; return true; }
                }
            }
        }
        if (n > 0) {
            for(const slot of this.player.inv) {
                if (slot.id === 0) {
                    slot.id = id;
                    slot.n = n;
                    slot.prefix = prefix;
                    n = 0;
                    this.invDirty = true;
                    return true;
                }
            }
        }
        return n <= 0;
    }
    
    updateStats() {
        let def = 0;
        const addItemStats = (item: any) => {
            const id = item.id;
            if (id && PROPS[id]) {
                def += PROPS[id].defense || 0;
                if (item.prefix && MODIFIERS[item.prefix]) {
                    const mod = MODIFIERS[item.prefix];
                    if (mod.def) def += mod.def;
                }
            }
        };

        for(let i=0; i<3; i++) {
            addItemStats(this.player.armor[i]);
        }
        
        for(let i=0; i<this.player.accessories.length; i++) {
            addItemStats(this.player.accessories[i]);
        }

        this.player.defense = def;
    }
    
    regenPlayer() {
        this.player.regenTimer++;
        if (this.player.regenTimer > 60 && this.player.immune <= 0) {
            if (this.player.hp < this.player.maxHp) this.player.hp += 1;
            if (this.player.mana < this.player.maxMana) this.player.mana += 1;
            this.player.regenTimer = 0;
        }
    }
    
    applyPhysics(e: any) {
        const cx = Math.floor((e.x + e.w/2) / TILE_SIZE);
        const cy = Math.floor((e.y + e.h/2) / TILE_SIZE);
        
        // Safety check for out of bounds access
        if (cx >= 0 && cx < this.width && cy >= 0 && cy < this.height) {
            const t = this.world[cy * this.width + cx];
            if (PROPS[t]?.liquid) {
                e.inLiquid = true;
                e.vy = Math.min(e.vy + GRAVITY * 0.3, 3);
                e.vy *= 0.9;
            } else {
                e.inLiquid = false;
                e.vy = Math.min(e.vy + GRAVITY, TERM_VEL);
            }
        } else {
             e.vy = Math.min(e.vy + GRAVITY, TERM_VEL);
        }

        e.x += e.vx;
        this.collide(e, true);
        e.y += e.vy;
        e.ground = false;
        this.collide(e, false);
    }
    
    moveItem(srcList: string, srcIdx: number, dstList: string, dstIdx: number) {
        const getList = (name: string): any[] | null => {
            if (name === 'inv') return this.player.inv;
            if (name === 'chest') return this.activeChest ? this.activeChest.slots : null;
            if (name === 'coins') return this.player.coins;
            if (name === 'ammo') return this.player.ammo;
            if (name === 'armor') return this.player.armor;
            if (name === 'accessories') return this.player.accessories;
            return null;
        };

        const src = getList(srcList);
        const dst = getList(dstList);

        if (!src || !dst) return;
        
        const itemS = src[srcIdx];
        const itemD = dst[dstIdx];

        if (!itemS) return;

        // Validation for specialized slots
        if (dstList === 'armor') {
            if (itemS.id !== 0) {
                const p = PROPS[itemS.id];
                if (!p || p.type !== 'armor' || p.slot !== dstIdx) return;
            }
        }
        if (dstList === 'accessories') {
            if (itemS.id !== 0) {
                 const p = PROPS[itemS.id];
                 if (!p || p.type !== 'accessory') return;
            }
        }
        
        // Simple swap logic
        const temp = { ...itemS };
        src[srcIdx] = { ...itemD };
        dst[dstIdx] = temp;
        
        this.invDirty = true;
    }
}
