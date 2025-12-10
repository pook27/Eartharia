const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W, H;

const world = new Uint8Array(CHUNK_W * CHUNK_H);
const lighting = new Uint8Array(CHUNK_W * CHUNK_H);
const chests = {};

let entities = [], particles = [], loot = [];
let camera = { x: 0, y: 0 };
let time = 7000;
let player;

const keys = {};
const mouse = { x: 0, y: 0, l: false, r: false, lastL: false, lastR: false };
let uiOpen = false;
let isInventoryOpen = false;
let heldItem = null;

/* ======================== ENTITY CLASSES ======================== */
class Entity {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.vx = 0; this.vy = 0;
        this.ground = false; this.dead = false;
        this.face = 1; this.hp = 10; this.maxHp = 10;
        this.iframe = 0; this.hpBarTimer = 0;
    }

    update() {
        if (this.dead) return;
        this.vy = Math.min(this.vy + GRAVITY, TERM_VEL);
        this.x += this.vx;
        this.collide(true);
        this.y += this.vy;
        this.ground = false;
        this.collide(false);
        if (this.iframe > 0) this.iframe--;
        if (this.hpBarTimer > 0) this.hpBarTimer--;
        if (this.y > CHUNK_H * TILE) this.die();
    }

    collide(isX) {
        const sx = Math.floor(this.x / TILE);
        const ex = Math.floor((this.x + this.w - 1) / TILE);
        const sy = Math.floor(this.y / TILE);
        const ey = Math.floor((this.y + this.h - 1) / TILE);

        for (let y = sy; y <= ey; y++) {
            for (let x = sx; x <= ex; x++) {
                if (x < 0 || x >= CHUNK_W || y < 0 || y >= CHUNK_H) continue;
                const t = world[y * CHUNK_W + x];
                if (t && PROPS[t] && PROPS[t].solid) {
                    if (isX) {
                        if (this.vx > 0) this.x = x * TILE - this.w;
                        else if (this.vx < 0) this.x = (x + 1) * TILE;
                        this.vx = 0;
                    } else {
                        if (this.vy > 0) {
                            this.y = y * TILE - this.h;
                            this.ground = true;
                        } else if (this.vy < 0) {
                            this.y = (y + 1) * TILE;
                        }
                        this.vy = 0;
                    }
                }
            }
        }
    }

    hit(dmg, dir) {
        if (this.iframe > 0) return;
        let finalDmg = dmg;
        if (this instanceof Player) {
            finalDmg = Math.max(1, dmg - Math.ceil(this.defense / 2));
        }
        this.hp -= finalDmg;
        this.vx = dir * 6;
        this.vy = -4;
        this.iframe = 25;
        this.hpBarTimer = 120;
        spawnParticles(this.x + this.w/2, this.y + this.h/2, '#f44336', 6);
        if (this instanceof Player) spawnFloatText(this.x, this.y - 20, `-${finalDmg}`, '#f44336');
        if (this.hp <= 0) this.die();
    }

    die() { this.dead = true; }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, TILE, 3*TILE);
        this.hp = 100;
        this.maxHp = 100;
        this.inv = new Array(50).fill(null).map(() => ({id: 0, n: 0}));
        this.armor = [null, null, null];
        this.defense = 0;
        this.sel = 0;
        this.regenTimer = 0;
        this.useTimer = 0; // NEW: Controls mining/attack speed for auto-fire

        this.inv[0] = { id: IDS.COPPER_PICKAXE, n: 1 };
        this.inv[1] = { id: IDS.COPPER_AXE, n: 1 };
        this.inv[2] = { id: IDS.COPPER_BROADSWORD, n: 1 };
        this.inv[3] = { id: IDS.TORCH, n: 20 };
    }

    update() {
        this.defense = 0;
        for(let piece of this.armor) {
            if(piece && PROPS[piece.id]) this.defense += PROPS[piece.id].defense || 0;
        }

        if (this.dead) {
            this.x = CHUNK_W * TILE / 2;
            this.y = 0;
            this.hp = this.maxHp;
            this.dead = false;
            this.vx = 0;
            this.vy = 0;
        }

        if (!uiOpen && !isInventoryOpen) {
            if (keys['a'] || keys['ArrowLeft']) { this.vx = -4.5; this.face = -1; }
            else if (keys['d'] || keys['ArrowRight']) { this.vx = 4.5; this.face = 1; }
            else { this.vx *= 0.82; }

            if ((keys['w'] || keys['ArrowUp'] || keys[' ']) && this.ground) { this.vy = -9.5; }
        } else { this.vx *= 0.82; }

        super.update();

        loot.forEach(l => {
            const dist = Math.hypot(l.x - this.x, l.y - this.y);
            if (!l.dead && dist < 70) {
                l.vx += (this.x - l.x) * 0.02;
                l.vy += (this.y - l.y) * 0.02;
                if (dist < 20) {
                    this.add(l.id, l.n);
                    l.dead = true;
                    spawnFloatText(this.x, this.y - 20, `+${l.n} ${PROPS[l.id].name}`);
                }
            }
        });

        this.regenTimer++;
        if (this.regenTimer >= 100 && this.hp < this.maxHp) { this.hp++; this.regenTimer = 0; }

        // NEW: Cooldown management
        if (this.useTimer > 0) this.useTimer--;
    }

    add(id, n) {
        for (let s of this.inv) { if (s.id === id) { s.n += n; updateInv(); return; } }
        for (let s of this.inv) { if (s.id === 0) { s.id = id; s.n = n; updateInv(); return; } }
    }

    has(id, n) { return this.inv.some(s => s.id === id && s.n >= n); }

    rem(id, n) {
        for (let s of this.inv) {
            if (s.id === id && s.n >= n) {
                s.n -= n;
                if (s.n <= 0) s.id = 0;
                updateInv();
                return true;
            }
        }
        return false;
    }

    use(slot) {
        const item = this.inv[slot];
        if (!item.id) return;
        const prop = PROPS[item.id];
        if (prop.consumable) {
            // Simple hardcoded check for potion for now
            if (item.id === IDS.LESSER_HEALING_POTION && this.hp < this.maxHp) {
                this.hp = Math.min(this.hp + 50, this.maxHp);
                this.rem(item.id, 1);
                spawnFloatText(this.x, this.y - 30, "+50 HP", '#4caf50');
                spawnParticles(this.x + this.w/2, this.y + this.h/2, '#4caf50', 8);
            }
        }
    }
}

class Slime extends Entity {
    constructor(x, y, big = false) {
        const sz = big ? 28 : 18;
        super(x, y, sz, sz * 0.8);
        this.hp = big ? 35 : 12;
        this.maxHp = this.hp;
        this.color = big ? '#1565c0' : '#42a5f5';
        this.big = big;
        this.jumpTimer = Math.random() * 80;
        this.dmg = big ? 15 : 8;
    }

    update() {
        super.update();
        if (this.dead) return;
        const dx = player.x - this.x;
        const dist = Math.hypot(dx, player.y - this.y);
        this.jumpTimer++;
        if (this.ground && this.jumpTimer > 70 && dist < 300) {
            this.vy = -7 - Math.random() * 2;
            this.vx = (dx > 0 ? 1 : -1) * (2 + Math.random() * 1.5);
            this.jumpTimer = 0;
            this.face = dx > 0 ? 1 : -1;
        }
        if (this.ground) this.vx *= 0.85;
        if (dist < 25 && this.iframe === 0) {
            player.hit(this.dmg, this.face);
            this.iframe = 60;
        }
    }

    die() {
        super.die();
        spawnLoot(this.x + this.w/2, this.y + this.h/2, IDS.GEL, 1 + Math.floor(Math.random() * 3));
        if (Math.random() > 0.6) spawnLoot(this.x + this.w/2, this.y + this.h/2, IDS.COPPER_COIN, this.big ? 3 : 1);
    }
}

class Zombie extends Entity {
    constructor(x, y) {
        super(x, y, TILE, 3*TILE);
        this.hp = 40;
        this.maxHp = this.hp;
        this.color = '#388e3c';
        this.dmg = 12;
    }

    update() {
        super.update();
        if (this.dead) return;
        const dx = player.x - this.x;
        const dist = Math.hypot(dx, player.y - this.y);
        if (dist < 400) {
            this.vx = dx > 0 ? 1.8 : -1.8;
            this.face = dx > 0 ? 1 : -1;
            const checkX = Math.floor((this.x + (dx > 0 ? this.w + 5 : -5)) / TILE);
            const checkY = Math.floor((this.y + this.h - 5) / TILE);
            if (checkX >= 0 && checkX < CHUNK_W && checkY >= 0 && checkY < CHUNK_H) {
                const tile = world[checkY * CHUNK_W + checkX];
                if (tile && PROPS[tile] && PROPS[tile].solid && this.ground) {
                    this.vy = -8;
                }
            }
        } else { this.vx *= 0.9; }
        if (dist < 28 && Math.abs(player.y - this.y) < 50 && this.iframe === 0) {
            player.hit(this.dmg, this.face);
            this.iframe = 50;
        }
    }

    die() {
        super.die();
        spawnLoot(this.x + this.w/2, this.y + this.h/2, IDS.SILVER_COIN, 1);
    }
}

class FallenStar extends Entity {
    constructor(x, y) {
        super(x, y, 16, 16);
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = 8;
        this.rotation = 0;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += 0.2;
        const tx = Math.floor((this.x + 8) / TILE);
        const ty = Math.floor((this.y + 8) / TILE);
        if (tx >= 0 && tx < CHUNK_W && ty >= 0 && ty < CHUNK_H) {
            const tile = world[ty * CHUNK_W + tx];
            if (tile && PROPS[tile] && PROPS[tile].solid) this.die();
        }
        if (this.y > CHUNK_H * TILE) this.dead = true;
        if (Math.random() > 0.5) spawnParticles(this.x + 8, this.y + 8, '#ffeb3b', 1);
    }

    die() {
        this.dead = true;
        spawnLoot(this.x, this.y - 16, IDS.FALLEN_STAR, 1);
        spawnParticles(this.x, this.y, '#ffd700', 8);
    }
}

class NPC extends Entity {
    constructor(x, y) {
        super(x, y, 20, 44);
        this.npc = true;
        this.timer = 0;
    }
    update() {
        super.update();
        this.timer++;
        if(this.timer % 200 === 0 && Math.random() > 0.5) this.vx = (Math.random()-0.5) * 4;
        this.vx *= 0.9;

        if(mouse.r && Math.hypot(mouse.x + camera.x - this.x, mouse.y + camera.y - this.y) < 50) {
            const msgs = ["Press 'Esc' for inventory", "Right click armor to equip", "Scroll wheel changes items", "Dig down for copper", "Craft a workbench first"];
            showBubble(this, msgs[Math.floor(Math.random()*msgs.length)]);
            mouse.r = false;
        }
    }
}

class LootItem {
    constructor(x, y, id, n) {
        this.x = x; this.y = y; this.id = id; this.n = n;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = -4 - Math.random() * 2;
        this.dead = false;
        this.bounces = 0;
    }

    update() {
        this.vy = Math.min(this.vy + GRAVITY, TERM_VEL);
        this.x += this.vx; this.y += this.vy;
        if (this.y > CHUNK_H * TILE) { this.dead = true; return; }
        const tx = Math.floor(this.x / TILE);
        const ty = Math.floor((this.y + 8) / TILE);
        if (tx >= 0 && tx < CHUNK_W && ty >= 0 && ty < CHUNK_H) {
            const tile = world[ty * CHUNK_W + tx];
            if (tile && PROPS[tile] && PROPS[tile].solid) {
                this.y = ty * TILE - 8;
                if (this.bounces < 3) { this.vy = -this.vy * 0.5; this.vx *= 0.7; this.bounces++; }
                else { this.vy = 0; this.vx *= 0.9; }
            }
        }
    }
}
