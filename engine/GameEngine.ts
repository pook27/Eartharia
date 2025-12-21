import { CHUNK_W, CHUNK_H, TILE_SIZE, GRAVITY, TERM_VEL, DAY_LENGTH, NIGHT_START, NIGHT_END } from '../constants';
import { IDS, PROPS, STATION_LOOKUP } from '../data/items';
import { generateWorld } from './WorldGen';
import { NPC } from '../types';

export class GameEngine {
    world: Uint16Array;
    walls: Uint16Array;
    chests: Record<string, any[]>;
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
    
    constructor() {
        this.world = new Uint16Array(CHUNK_W * CHUNK_H);
        this.walls = new Uint16Array(CHUNK_W * CHUNK_H);
        this.chests = {};
        this.npcs = [];
        this.camera = { x: 0, y: 0 };
        this.particles = [];
        this.loot = [];
        this.lastTime = 0;
        this.time = 4500; // Start at 4:30 AM approx (Morning)
        this.invDirty = true;
        this.smartCursor = false;
        this.attackCooldown = 0;
        
        // Player with expanded inventory
        this.player = {
            x: 0, y: 0, w: TILE_SIZE, h: TILE_SIZE * 3,
            vx: 0, vy: 0,
            hp: 100, maxHp: 100,
            mana: 20, maxMana: 20,
            defense: 0,
            inv: new Array(50).fill(null).map(() => ({ id: 0, n: 0 })),
            armor: new Array(3).fill(null).map(() => ({ id: 0, n: 0 })), // Head, Body, Legs
            coins: new Array(4).fill(null).map(() => ({ id: 0, n: 0 })),
            ammo: new Array(4).fill(null).map(() => ({ id: 0, n: 0 })),
            sel: 0,
            face: 1,
            walkFrame: 0,
            regenTimer: 0,
            immune: 0,
            swinging: 0, // 0 = no swing, >0 = swing timer
            targetAngle: 0 // Angle of mouse relative to player
        };
    }

    start() {
        // Starting Gear
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
        generateWorld(this.world, this.walls, this.chests, this.npcs);
        // Find spawn
        const midX = Math.floor(CHUNK_W / 2);
        let spawnY = 0;
        for(let y=0; y<CHUNK_H; y++) {
            if(PROPS[this.world[y*CHUNK_W+midX]]?.solid) {
                spawnY = (y - 4) * TILE_SIZE;
                break;
            }
        }
        this.player.x = midX * TILE_SIZE;
        this.player.y = spawnY;
    }

    update(input: any, dt: number) {
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

        // Player Physics
        if (input.left) { p.vx = -4.5; p.face = -1; p.walkFrame += dt * 10; }
        else if (input.right) { p.vx = 4.5; p.face = 1; p.walkFrame += dt * 10; }
        else { p.vx *= 0.82; p.walkFrame = 0; }

        if (input.jump && p.ground) p.vy = -9.5;

        this.applyPhysics(p);
        
        // NPC AI
        this.updateNPCs(dt);

        // Camera
        const cw = window.innerWidth;
        const ch = window.innerHeight;
        this.camera.x += (p.x - cw / 2 - this.camera.x) * 0.1;
        this.camera.y += (p.y - ch / 2 - this.camera.y) * 0.1;
        this.camera.x = Math.max(0, Math.min(this.camera.x, CHUNK_W * TILE_SIZE - cw));
        this.camera.y = Math.max(0, Math.min(this.camera.y, CHUNK_H * TILE_SIZE - ch));

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
                    if (this.addToInv(l.id, l.n)) {
                        l.dead = true;
                    }
                }
            }
        });
    }
    
    updateStats() {
        let def = 0;
        for(let i=0; i<3; i++) {
            const id = this.player.armor[i].id;
            if (id && PROPS[id]) {
                def += PROPS[id].defense || 0;
            }
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
    
    handleSpawning() {
        const isNight = this.time > NIGHT_START && this.time < NIGHT_END;
        if (this.npcs.length < 20) {
             if (Math.random() < 0.02) {
                 // Spawn Logic
                 const type = isNight ? (Math.random() > 0.3 ? 'zombie' : 'demon_eye') : (Math.random() > 0.5 ? 'slime' : 'merchant');
                 
                 // Unique NPCs
                 if (type === 'merchant' && this.npcs.find(n => n.type === type)) return;
                 
                 this.spawnNPC(type);
             }
        }
        
        // Despawn far away hostile mobs
        this.npcs = this.npcs.filter(n => {
            if (n.hp <= 0) return false;
            const dist = Math.abs(n.x - this.player.x);
            return dist < 2000 || n.aiStyle === 'passive';
        });
    }
    
    spawnNPC(type: string) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const spawnX = this.player.x + side * (window.innerWidth/2 + 100);
        const tx = Math.floor(spawnX / TILE_SIZE);
        
        if (tx < 0 || tx >= CHUNK_W) return;
        
        // Find ground
        let spawnY = -100;
        for(let y=0; y<CHUNK_H; y++) {
            if (this.isSolid(tx, y)) {
                spawnY = (y-3) * TILE_SIZE;
                break;
            }
        }
        
        let aiStyle: any = 'fighter';
        let w=TILE_SIZE, h=TILE_SIZE*3, hp=50, dmg=10, def=2;
        
        if (type === 'slime') { aiStyle = 'slime'; w=TILE_SIZE*1.2; h=TILE_SIZE; hp=20; dmg=6; }
        else if (type === 'demon_eye') { aiStyle = 'flying'; w=TILE_SIZE*2; h=TILE_SIZE*1.5; hp=40; spawnY -= 200; dmg=15; }
        else if (type === 'guide' || type === 'merchant' || type === 'nurse') { aiStyle = 'passive'; hp=250; dmg=0; }
        else if (type === 'zombie') { hp=40; dmg=12; }
        
        this.npcs.push({
            id: Math.random(), type, aiStyle,
            x: tx * TILE_SIZE, y: spawnY,
            w, h,
            vx: 0, vy: 0, face: 1, hp, maxHp: hp, walkFrame: 0,
            damage: dmg, defense: def, immune: 0
        });
    }
    
    handleFallenStars() {
        if (this.time > NIGHT_START && this.time < NIGHT_END) {
            if (Math.random() < 0.002) { 
                 const x = this.player.x + (Math.random() - 0.5) * 1000;
                 this.loot.push({ 
                     x, y: this.player.y - 400, 
                     id: IDS.FALLEN_STAR || 75, n: 1, 
                     vx: (Math.random()-0.5)*4, vy: 5, dead: false 
                 });
            }
        }
    }

    updateNPCs(dt: number) {
         this.npcs.forEach(npc => {
            if (npc.immune && npc.immune > 0) npc.immune--;

            const dist = Math.hypot(this.player.x - npc.x, this.player.y - npc.y);
            
            // Damage Player
            if (npc.damage && npc.damage > 0 && dist < 30) {
                this.damagePlayer(npc.damage, Math.sign(this.player.x - npc.x));
            }

            // AI Logic
            if (npc.aiStyle === 'fighter') {
                 if (dist < 400) {
                     npc.vx = this.player.x > npc.x ? 2 : -2;
                     npc.face = Math.sign(npc.vx);
                     if (npc.ground && this.isSolid(Math.floor((npc.x + npc.vx*10)/TILE_SIZE), Math.floor(npc.y/TILE_SIZE))) {
                         npc.vy = -7;
                     }
                 } else {
                     npc.vx *= 0.9;
                 }
            } 
            else if (npc.aiStyle === 'slime') {
                if (npc.ground) {
                    npc.vx = 0;
                    if (Math.random() < 0.02) { 
                        npc.vy = -8;
                        npc.vx = (Math.random() - 0.5) * 6;
                        npc.face = Math.sign(npc.vx) || 1;
                    }
                }
            }
            else if (npc.aiStyle === 'flying') {
                const dx = (this.player.x - npc.x);
                const dy = (this.player.y - npc.y);
                const len = Math.sqrt(dx*dx+dy*dy);
                if (len > 0) {
                    npc.vx += (dx/len) * 0.2;
                    npc.vy += (dy/len) * 0.2;
                }
                const speed = 4;
                if (npc.vx > speed) npc.vx = speed; if (npc.vx < -speed) npc.vx = -speed;
                if (npc.vy > speed) npc.vy = speed; if (npc.vy < -speed) npc.vy = -speed;
                npc.face = Math.sign(npc.vx);
            }
            else if (npc.aiStyle === 'passive') {
                if (Math.random() < 0.01) npc.vx = (Math.random() - 0.5) * 3;
                if (Math.abs(npc.vx) > 0.1) npc.face = Math.sign(npc.vx);
                if (npc.ground && this.isSolid(Math.floor((npc.x + npc.vx*5)/TILE_SIZE), Math.floor(npc.y/TILE_SIZE))) {
                     npc.vx *= -1;
                }
            }

            // Apply Physics
            if (npc.aiStyle !== 'flying') {
                npc.vy = Math.min(npc.vy + GRAVITY, TERM_VEL);
            }
            
            // Knockback decay
            if (npc.knockback) {
                npc.vx += npc.knockback;
                npc.knockback *= 0.8;
                if(Math.abs(npc.knockback) < 0.1) npc.knockback = 0;
            }

            npc.x += npc.vx;
            this.collide(npc, true);
            npc.y += npc.vy;
            npc.ground = false;
            this.collide(npc, false);
            
            if (Math.abs(npc.vx) > 0.1) npc.walkFrame += dt * 5;
        });
    }

    damagePlayer(rawDmg: number, dir: number) {
        if (this.player.immune > 0) return;
        const dmg = Math.max(1, rawDmg - Math.floor(this.player.defense / 2));
        this.player.hp -= dmg;
        this.player.immune = 60; // 1 second immunity
        this.player.vx = dir * 8;
        this.player.vy = -5;
        this.spawnParticles(this.player.x, this.player.y, '#ff0000', 5);
        if (this.player.hp <= 0) {
            this.respawn();
        }
    }

    damageNPC(npc: NPC, dmg: number, knockback: number) {
        if (npc.immune && npc.immune > 0) return;
        npc.hp -= dmg;
        npc.immune = 15;
        npc.knockback = knockback;
        npc.vy = -3;
        this.spawnParticles(npc.x, npc.y, '#ff0000', 3);
        
        // Display damage number (simulated by particles for now or UI overlay)
        if (npc.hp <= 0) {
            this.killNPC(npc);
        }
    }

    killNPC(npc: NPC) {
        // Drops
        if (npc.type === 'slime') {
            this.spawnLoot(npc.x, npc.y, 23, 1 + Math.floor(Math.random()*3)); // Gel
        } else if (npc.type === 'zombie') {
             if (Math.random() < 0.1) this.spawnLoot(npc.x, npc.y, 216, 1); // Shackle
             this.spawnLoot(npc.x, npc.y, 72, 1 + Math.floor(Math.random()*3)); // Silver Coin
        } else if (npc.type === 'demon_eye') {
             if (Math.random() < 0.3) this.spawnLoot(npc.x, npc.y, 38, 1); // Lens
        }
    }

    respawn() {
        this.player.hp = this.player.maxHp;
        const midX = Math.floor(CHUNK_W / 2);
        let spawnY = 0;
        for(let y=0; y<CHUNK_H; y++) {
            if(PROPS[this.world[y*CHUNK_W+midX]]?.solid) {
                spawnY = (y - 4) * TILE_SIZE;
                break;
            }
        }
        this.player.x = midX * TILE_SIZE;
        this.player.y = spawnY;
    }

    applyPhysics(e: any) {
        e.vy = Math.min(e.vy + GRAVITY, TERM_VEL);
        e.x += e.vx;
        this.collide(e, true);
        e.y += e.vy;
        e.ground = false;
        this.collide(e, false);
    }

    isSolid(x: number, y: number) {
        if (x < 0 || x >= CHUNK_W || y < 0 || y >= CHUNK_H) return true;
        const t = this.world[y * CHUNK_W + x];
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

        const range = 6 * TILE_SIZE; 
        
        const px = this.player.x + this.player.w / 2;
        const py = this.player.y + this.player.h / 2;
        const wx = mx + this.camera.x;
        const wy = my + this.camera.y;
        
        const dx = wx - px;
        const dy = wy - py;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const dirX = dx / dist;
        const dirY = dy / dist;

        if (prop.tool === 'pick') {
             for(let i=0; i<range; i+=TILE_SIZE/2) {
                 const tx = Math.floor((px + dirX * i) / TILE_SIZE);
                 const ty = Math.floor((py + dirY * i) / TILE_SIZE);
                 
                 if (this.isSolid(tx, ty)) {
                     return { x: tx * TILE_SIZE, y: ty * TILE_SIZE };
                 }
             }
        }
        
        if (prop.tool === 'axe') {
             for(let i=0; i<range; i+=TILE_SIZE/2) {
                 const tx = Math.floor((px + dirX * i) / TILE_SIZE);
                 const ty = Math.floor((py + dirY * i) / TILE_SIZE);
                 const id = this.world[ty*CHUNK_W+tx];
                 if (id >= 9000) { 
                     return { x: tx * TILE_SIZE, y: ty * TILE_SIZE };
                 }
             }
        }

        return null;
    }

    interact(mx: number, my: number, isLeft: boolean, smartTarget?: {x: number, y: number} | null) {
        const item = this.player.inv[this.player.sel];
        const prop = PROPS[item.id];

        // Attack Logic: Arc based Swing towards mouse
        if (isLeft && prop?.tool === 'sword' && this.attackCooldown <= 0) {
            this.attackCooldown = prop.pwr ? 20 - prop.pwr : 20; 
            if(this.attackCooldown < 10) this.attackCooldown = 10;
            this.player.swinging = 15;
            
            const wx = mx + this.camera.x;
            const wy = my + this.camera.y;
            const px = this.player.x + this.player.w/2;
            const py = this.player.y + this.player.h/2;
            
            this.player.face = wx > px ? 1 : -1;
            this.player.targetAngle = Math.atan2(wy - py, wx - px);

            const reach = 80; 
            const swingArc = Math.PI / 2; // 90 degrees

            this.npcs.forEach(npc => {
                 // Simple circle check first
                 const nx = npc.x + npc.w/2;
                 const ny = npc.y + npc.h/2;
                 const dist = Math.hypot(nx - px, ny - py);
                 
                 if (dist < reach + Math.max(npc.w, npc.h)/2) { // Add NPC radius approximation
                     const angleToNPC = Math.atan2(ny - py, nx - px);
                     let angleDiff = angleToNPC - this.player.targetAngle;
                     // Normalize angleDiff to -PI to PI
                     while (angleDiff <= -Math.PI) angleDiff += Math.PI*2;
                     while (angleDiff > Math.PI) angleDiff -= Math.PI*2;
                     
                     if (Math.abs(angleDiff) < swingArc / 2) {
                         if (npc.aiStyle !== 'passive') {
                            this.damageNPC(npc, prop.dmg || 5, 5 * Math.cos(this.player.targetAngle));
                         }
                     }
                 }
            });
            return;
        }

        let tx, ty;
        if (this.smartCursor && smartTarget && isLeft) {
            tx = Math.floor(smartTarget.x / TILE_SIZE);
            ty = Math.floor(smartTarget.y / TILE_SIZE);
        } else {
            tx = Math.floor((mx + this.camera.x) / TILE_SIZE);
            ty = Math.floor((my + this.camera.y) / TILE_SIZE);
        }

        if (tx < 0 || tx >= CHUNK_W || ty < 0 || ty >= CHUNK_H) return;

        const idx = ty * CHUNK_W + tx;
        const tile = this.world[idx];
        const tool = prop?.tool;
        const dist = Math.hypot(this.player.x + this.player.w/2 - (tx*TILE_SIZE), this.player.y + this.player.h/2 - (ty*TILE_SIZE));
        
        if (dist > 250) return; 

        if (isLeft) {
            // Consumable Usage
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

            // Mine / Chop
            if (tile !== IDS.AIR) {
                const isTree = (tile >= 9001 && tile <= 9007);
                if (isTree) {
                    if (tool === 'axe') this.chopTree(tx, ty);
                } else {
                    if (PROPS[tile]?.hardness) {
                        this.world[idx] = IDS.AIR;
                        this.spawnLoot(tx*TILE_SIZE, ty*TILE_SIZE, tile, 1);
                        this.spawnParticles(tx*TILE_SIZE, ty*TILE_SIZE, PROPS[tile]?.c || '#fff', 5);
                    }
                }
            }
        } else {
            // Place
            if (item.id && item.n > 0) {
                if (prop.placeWall) {
                    if (this.walls[idx] !== prop.placeWall) {
                         this.walls[idx] = prop.placeWall;
                         item.n--;
                         if (item.n <= 0) item.id = 0;
                         this.invDirty = true;
                    }
                } else if (tile === IDS.AIR && prop.type === 'block') {
                    const p = this.player;
                    const bx = tx*TILE_SIZE, by = ty*TILE_SIZE;
                    if (!prop.solid || !(p.x < bx + TILE_SIZE && p.x + p.w > bx && p.y < by + TILE_SIZE && p.y + p.h > by)) {
                         this.world[idx] = item.id;
                         item.n--;
                         if(item.n <= 0) item.id = 0;
                         this.invDirty = true;
                    }
                }
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

    chopTree(tx: number, ty: number) {
        const queue = [{x: tx, y: ty}];
        const visited = new Set<string>();
        let woodCount = 0;
        
        while(queue.length > 0) {
            const p = queue.shift()!;
            const key = `${p.x},${p.y}`;
            if (visited.has(key)) continue;
            visited.add(key);

            if (p.x < 0 || p.x >= CHUNK_W || p.y < 0 || p.y >= CHUNK_H) continue;
            
            const idx = p.y * CHUNK_W + p.x;
            const t = this.world[idx];
            
            const isTrunk = (t === IDS.TREE_TRUNK || t === IDS.PINE_TRUNK || t === IDS.PALM_TRUNK || t === IDS.CACTUS_TRUNK);
            const isLeaf = (t === IDS.TREE_LEAVES || t === IDS.PINE_LEAVES || t === IDS.PALM_LEAVES);

            if (t !== IDS.AIR && (isTrunk || isLeaf)) {
                this.world[idx] = IDS.AIR;
                this.spawnParticles(p.x*TILE_SIZE, p.y*TILE_SIZE, PROPS[t].c || '#fff', 3);
                
                if (isTrunk) woodCount++;
                
                queue.push({x: p.x, y: p.y - 1});
                queue.push({x: p.x + 1, y: p.y});
                queue.push({x: p.x - 1, y: p.y});
                queue.push({x: p.x, y: p.y + 1});
            }
        }
        
        if (woodCount > 0) {
            const woodID = IDS.WOOD;
            this.spawnLoot(tx*TILE_SIZE, ty*TILE_SIZE, woodID, woodCount * 4);
        }
    }

    spawnParticles(x: number, y: number, c: string, n: number) {
        for(let i=0; i<n; i++) {
            this.particles.push({
                x: x + TILE_SIZE/2, y: y + TILE_SIZE/2,
                vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5,
                c, life: 30 + Math.random()*20
            });
        }
    }
    
    spawnLoot(x: number, y: number, id: number, n: number) {
        if(!PROPS[id]) return; 
        this.loot.push({ x, y, id, n, vx: (Math.random()-0.5)*3, vy: -3, dead: false });
    }

    addToInv(id: number, n: number): boolean {
        // Simple stacking logic
        for(let i=0; i<this.player.inv.length; i++) {
            if (this.player.inv[i].id === id) {
                this.player.inv[i].n += n;
                this.invDirty = true;
                return true;
            }
        }
        for(let i=0; i<this.player.inv.length; i++) {
            if (this.player.inv[i].id === 0) {
                this.player.inv[i].id = id;
                this.player.inv[i].n = n;
                this.invDirty = true;
                return true;
            }
        }
        return false;
    }

    swapInventory(sourceList: string, sourceIdx: number, targetList: string, targetIdx: number) {
        // Validate target
        if (sourceList === targetList && sourceIdx === targetIdx) return;
        
        // Helper to get array ref
        const getList = (name: string) => {
            if (name === 'inv') return this.player.inv;
            if (name === 'armor') return this.player.armor;
            if (name === 'coins') return this.player.coins;
            if (name === 'ammo') return this.player.ammo;
            return null;
        };

        const src = getList(sourceList);
        const tgt = getList(targetList);
        if (!src || !tgt) return;

        // Logic check for Armor/Acc slots
        const item = src[sourceIdx];
        if (item.id !== 0 && targetList === 'armor') {
            const prop = PROPS[item.id];
            if (!prop || prop.type !== 'armor' || prop.slot !== targetIdx) return; 
        }

        const temp = src[sourceIdx];
        src[sourceIdx] = tgt[targetIdx];
        tgt[targetIdx] = temp;
        this.invDirty = true;
    }

    changeSlot(delta: number) {
        let s = this.player.sel + delta;
        if (s < 0) s = 9;
        if (s > 9) s = 0;
        this.player.sel = s;
    }

    nearStation(reqTableId?: number): boolean {
        if (!reqTableId) return true;
        const cx = Math.floor((this.player.x + this.player.w/2)/TILE_SIZE);
        const cy = Math.floor((this.player.y + this.player.h/2)/TILE_SIZE);
        
        for(let y = cy - 4; y <= cy + 4; y++) {
            for(let x = cx - 5; x <= cx + 5; x++) {
                 if (x>=0 && x<CHUNK_W && y>=0 && y<CHUNK_H) {
                     const blockId = this.world[y*CHUNK_W+x];
                     if (STATION_LOOKUP[blockId] === reqTableId) return true;
                 }
            }
        }
        return false;
    }

    canCraft(recipe: any): boolean {
        if (recipe.req && !this.nearStation(recipe.req)) return false;
        for (const [idStr, cost] of Object.entries(recipe.cost)) {
            const id = parseInt(idStr);
            const amt = cost as number;
            const has = this.player.inv.reduce((acc: number, slot: any) => slot.id === id ? acc + slot.n : acc, 0);
            if (has < amt) return false;
        }
        return true;
    }

    craft(recipe: any) {
        if (!this.canCraft(recipe)) return;
        for (const [idStr, cost] of Object.entries(recipe.cost)) {
            const id = parseInt(idStr);
            let needed = cost as number;
            for (let i = 0; i < this.player.inv.length; i++) {
                if (this.player.inv[i].id === id) {
                    const take = Math.min(needed, this.player.inv[i].n);
                    this.player.inv[i].n -= take;
                    needed -= take;
                    if (this.player.inv[i].n <= 0) this.player.inv[i].id = 0;
                    if (needed <= 0) break;
                }
            }
        }
        this.addToInv(recipe.out, recipe.n);
    }
}
