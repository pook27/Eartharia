import { DAY_LENGTH, NIGHT_START, NIGHT_END, TILE_SIZE } from '../constants';
import { IDS, PROPS } from '../data/items';

type EngineLike = any;

type BiomeName =
    | 'Forest'
    | 'Snow'
    | 'Desert'
    | 'Jungle'
    | 'Ocean'
    | 'Underground'
    | 'Cavern'
    | 'Mushroom'
    | 'Evil';

type EventName = 'Slime Rain' | 'Blood Moon' | 'Goblin Army' | 'Meteor Shower';

interface House {
    x: number;
    y: number;
    w: number;
    h: number;
    assigned?: string;
}

interface AnglerQuest {
    fish: string;
    day: number;
    turnedIn: boolean;
}

interface PylonPoint {
    name: string;
    x: number;
    y: number;
    biome: BiomeName;
}

const TOWN_TYPES = [
    'guide',
    'merchant',
    'nurse',
    'angler',
    'golfer',
    'zoologist',
    'stylist',
    'tavernkeep',
    'goblin_tinkerer',
    'party_girl',
];

const TOWN_NAMES: Record<string, string> = {
    guide: 'Guide',
    merchant: 'Merchant',
    nurse: 'Nurse',
    angler: 'Angler',
    golfer: 'Golfer',
    zoologist: 'Zoologist',
    stylist: 'Stylist',
    tavernkeep: 'Tavernkeep',
    goblin_tinkerer: 'Goblin Tinkerer',
    party_girl: 'Party Girl',
};

const PREFERRED_BIOME: Record<string, BiomeName[]> = {
    guide: ['Forest'],
    merchant: ['Forest'],
    nurse: ['Snow'],
    angler: ['Ocean'],
    golfer: ['Desert'],
    zoologist: ['Forest'],
    stylist: ['Ocean'],
    tavernkeep: ['Cavern'],
    goblin_tinkerer: ['Underground'],
    party_girl: ['Forest'],
};

const PREFERRED_NEIGHBOR: Record<string, string[]> = {
    guide: ['zoologist'],
    merchant: ['golfer'],
    nurse: ['angler'],
    angler: ['demolitionist', 'pirate'],
    golfer: ['angler'],
    zoologist: ['witch_doctor', 'golfer'],
    stylist: ['dyetrader'],
    tavernkeep: ['demolitionist'],
    goblin_tinkerer: ['mechanic'],
    party_girl: ['wizard'],
};

const pickId = (...names: string[]): number => {
    const lower = names.map(n => n.toLowerCase());
    for (const [rawId, prop] of Object.entries(PROPS)) {
        const id = Number(rawId);
        const name = (prop?.name || '').toLowerCase();
        if (!name) continue;
        if (lower.includes(name)) return id;
    }
    for (const [rawId, prop] of Object.entries(PROPS)) {
        const id = Number(rawId);
        const name = (prop?.name || '').toLowerCase();
        if (!name) continue;
        if (lower.some(n => name.includes(n) || n.includes(name))) return id;
    }
    return 0;
};

const itemName = (id: number): string => PROPS[id]?.name || '';

export class PreBossFeatures {
    readonly engine: EngineLike;
    readonly storageKey: string;

    root: HTMLDivElement | null = null;
    toastEl: HTMLDivElement | null = null;
    panelEl: HTMLDivElement | null = null;
    fxCanvas: HTMLCanvasElement | null = null;

    tick = 0;
    worldDay = 1;
    lastTime = 4500;

    biome: BiomeName = 'Forest';
    weather: 'Clear' | 'Rain' = 'Clear';

    houses: House[] = [];
    discovered = new Set<string>();
    visitedBiomes = new Set<BiomeName>();
    townUnlocked = new Set<string>();

    anglerQuest: AnglerQuest = { fish: 'Bass', day: 1, turnedIn: false };
    questsCompleted = 0;

    fishing = {
        active: false,
        waiting: false,
        biteIn: 0,
        spotBiome: 'Forest' as BiomeName,
    };

    activeEvent: EventName | null = null;
    eventTicks = 0;
    eventProgress = 0;
    eventGoal = 0;
    eventSpawnTimer = 0;

    pylonIndex = 0;
    bestiarySize = 0;
    maxBestiary = 55;

    private wrapped = false;

    constructor(engine: EngineLike) {
        this.engine = engine;
        this.storageKey = 'eartharia-preboss-' + (engine.worldData?.id || 'world');

        this.restore();
        this.buildOverlay();
        this.ensureWorldFeatures();
        this.ensureStarterTown();
        this.wrapEngineHooks();

        this.notify('Pre-boss expansion loaded: H housing, J bestiary, M map, P pylons, F fishing.');
    }

    update(_dt: number) {
        if (!this.engine.worldData) return;

        this.tick++;

        const currentTime = this.engine.time;
        if (currentTime < this.lastTime) {
            this.worldDay++;
            this.onDawn();
        }
        this.lastTime = currentTime;

        this.updateBiome();
        this.updateWeather();
        this.updateBestiary();
        this.refreshHousing();
        this.refreshTown();
        this.updateAnglerQuest();
        this.updateFishing();
        this.updateEvent();

        if (this.tick % 10 === 0) this.syncOverlay();
        if (this.tick % 90 === 0) this.persist();
    }

    handleKey(code: string) {
        if (!this.engine.worldData) return;

        switch (code) {
            case 'KeyH':
                this.togglePanel('housing');
                break;
            case 'KeyJ':
                this.togglePanel('bestiary');
                break;
            case 'KeyM':
                this.togglePanel('map');
                break;
            case 'KeyP':
                this.usePylonTravel();
                break;
            case 'KeyF':
                this.handleFishingKey();
                break;
            case 'KeyE':
                this.featureInteract();
                break;
            case 'KeyG':
                this.startGoblinArmy();
                break;
            case 'KeyL':
                this.togglePanel('town');
                break;
            case 'Escape':
                this.hidePanel();
                break;
        }
    }

    handleDeath() {
        const p = this.engine.player;
        const tomb = pickId('Tombstone', 'Grave Marker', 'Gravestone');
        if (tomb) this.engine.spawnLoot(p.x, p.y, tomb, 1);
        this.notify('You died. A tombstone marks the spot.');
    }

    onNpcDefeated(npc: any) {
        const tag = npc?.eventTag || npc?.type;
        if (tag) this.discovered.add(String(tag));

        if (this.activeEvent === 'Slime Rain' && npc?.type === 'slime') {
            this.eventProgress++;
        }
        if (this.activeEvent === 'Goblin Army' && npc?.eventTag === 'goblin') {
            this.eventProgress++;
        }

        if (this.activeEvent === 'Goblin Army' && this.eventProgress >= this.eventGoal) {
            this.endEvent('The goblin invasion was defeated. The Goblin Tinkerer can now be found.');
            this.unlockTownNpc('goblin_tinkerer');
        }

        this.recalculateBestiary();
    }

    private wrapEngineHooks() {
        if (this.wrapped) return;
        this.wrapped = true;

        const originalRespawn = this.engine.respawn?.bind(this.engine);
        if (originalRespawn) {
            this.engine.respawn = () => {
                this.handleDeath();
                originalRespawn();
            };
        }

        const originalDamageNPC = this.engine.damageNPC?.bind(this.engine);
        if (originalDamageNPC) {
            this.engine.damageNPC = (npc: any, dmg: number, knockback: number) => {
                const wasAlive = npc?.hp > 0;
                originalDamageNPC(npc, dmg, knockback);
                if (wasAlive && npc?.hp <= 0) this.onNpcDefeated(npc);
            };
        }
    }

    private updateBiome() {
        const p = this.engine.player;
        const tx = Math.floor((p.x + p.w / 2) / TILE_SIZE);
        const ty = Math.floor((p.y + p.h / 2) / TILE_SIZE);
        const surfaceY = this.surfaceAt(tx);

        const edge = tx < this.engine.width * 0.05 || tx > this.engine.width * 0.95;
        const belowSurface = ty > surfaceY + 12;
        const deep = ty > this.engine.height * 0.58;

        let next: BiomeName = 'Forest';

        if (edge) next = 'Ocean';
        else if (this.isEvilAt(tx, ty)) next = 'Evil';
        else if (this.isMushroomAt(tx, ty)) next = 'Mushroom';
        else if (belowSurface && deep) next = 'Cavern';
        else if (belowSurface) next = 'Underground';
        else if (tx < this.engine.width * 0.15) next = 'Snow';
        else if (tx > this.engine.width * 0.75) next = 'Jungle';
        else if (tx > this.engine.width * 0.55) next = 'Desert';

        this.biome = next;
        this.visitedBiomes.add(next);
    }

    private updateWeather() {
        if (this.tick % 120 !== 0) return;

        const isNight = this.engine.time > NIGHT_START && this.engine.time < NIGHT_END;

        if (this.weather === 'Rain') {
            if (Math.random() < 0.015) {
                this.weather = 'Clear';
                this.notify('The rain has stopped.');
            }
            return;
        }

        if (Math.random() < (isNight ? 0.0015 : 0.0008)) {
            this.weather = 'Rain';
            this.notify('Rain started. Fishing is improved.');
        }
    }

    private onDawn() {
        this.endEvent();
        this.anglerQuest = {
            fish: this.pickQuestFish(),
            day: this.worldDay,
            turnedIn: false,
        };

        const maxHp = this.engine.player.maxHp || 100;
        if (maxHp >= 140 && Math.random() < 0.08) {
            this.startEvent('Slime Rain');
        }
    }

    private updateEvent() {
        if (this.tick % 30 === 0 && !this.activeEvent) {
            const isNight = this.engine.time > NIGHT_START && this.engine.time < NIGHT_END;

            if (isNight && Math.random() < 0.003) {
                this.startEvent('Blood Moon');
            } else if (isNight && Math.random() < 0.0025) {
                this.startEvent('Meteor Shower');
            }
        }

        if (!this.activeEvent) return;

        this.eventTicks--;
        this.eventSpawnTimer--;

        if (this.activeEvent === 'Slime Rain' && this.eventSpawnTimer <= 0) {
            this.spawnEventEnemy('slime', undefined, 30);
            this.eventSpawnTimer = 55;
        }

        if (this.activeEvent === 'Blood Moon' && this.eventSpawnTimer <= 0) {
            this.spawnEventEnemy(Math.random() < 0.6 ? 'zombie' : 'demon_eye', 'bloodmoon', 45);
            this.eventSpawnTimer = 70;
        }

        if (this.activeEvent === 'Goblin Army' && this.eventSpawnTimer <= 0) {
            const remaining = Math.max(1, this.eventGoal - this.eventProgress);
            const waves = Math.min(5, Math.ceil(remaining / 15));
            for (let i = 0; i < waves; i++) {
                this.spawnEventEnemy('zombie', 'goblin', 35);
            }
            this.eventSpawnTimer = 90;
        }

        if (this.activeEvent === 'Meteor Shower' && this.eventSpawnTimer <= 0) {
            this.dropMeteor();
            this.eventSpawnTimer = 170;
        }

        if (this.activeEvent !== 'Goblin Army' && this.eventTicks <= 0) {
            this.endEvent();
        }
    }

    private startEvent(name: EventName) {
        if (this.activeEvent) return;

        this.activeEvent = name;
        this.eventProgress = 0;
        this.eventSpawnTimer = 1;

        if (name === 'Slime Rain') {
            this.eventTicks = 6000;
            this.eventGoal = 60;
            this.notify('Slime is falling from the sky!');
        } else if (name === 'Blood Moon') {
            this.eventTicks = 5200;
            this.eventGoal = 0;
            this.notify('The Blood Moon is rising!');
        } else if (name === 'Meteor Shower') {
            this.eventTicks = 4800;
            this.eventGoal = 0;
            this.notify('A meteor shower has begun.');
        } else {
            this.eventTicks = 12000;
            this.eventGoal = 120;
            this.notify('A goblin army is approaching!');
        }
    }

    private endEvent(message?: string) {
        if (this.activeEvent && message) this.notify(message);
        this.activeEvent = null;
        this.eventTicks = 0;
        this.eventProgress = 0;
        this.eventGoal = 0;
        this.eventSpawnTimer = 0;
    }

    private spawnEventEnemy(type: string, eventTag?: string, hp = 30) {
        const p = this.engine.player;
        const side = Math.random() > 0.5 ? 1 : -1;
        const sx = p.x + side * (700 + Math.random() * 450);
        const tx = Math.floor(sx / TILE_SIZE);

        if (tx < 4 || tx >= this.engine.width - 4) return;

        let sy = 0;
        for (let y = 0; y < this.engine.height; y++) {
            if (this.engine.isSolid(tx, y)) {
                sy = (y - 1) * TILE_SIZE;
                break;
            }
        }
        if (!sy) return;

        const flying = type === 'demon_eye';

        this.engine.npcs.push({
            id: Math.random(),
            type,
            aiStyle: flying ? 'flying' : (type === 'slime' ? 'slime' : 'fighter'),
            x: sx,
            y: sy - (flying ? 130 : 0),
            w: type === 'slime' ? 32 : 24,
            h: type === 'slime' ? 24 : 42,
            vx: 0,
            vy: 0,
            face: side === 1 ? -1 : 1,
            hp,
            maxHp: hp,
            walkFrame: 0,
            damage: type === 'slime' ? 10 : 14,
            defense: 2,
            eventTag,
        });
    }

    private startGoblinArmy() {
        if (this.activeEvent) {
            this.notify('Another event is already active.');
            return;
        }

        if ((this.engine.player.maxHp || 0) < 200) {
            this.notify('Goblin Armies require 200 maximum health.');
            return;
        }

        this.startEvent('Goblin Army');
    }

    private dropMeteor() {
        const meteor = pickId('Meteorite');
        if (!meteor) return;

        const x = 20 + Math.floor(Math.random() * Math.max(1, this.engine.width - 40));
        const y = this.surfaceAt(x);
        const idx = y * this.engine.width + x;

        if (!this.engine.world[idx]) {
            this.engine.world[idx] = meteor;
            this.engine.invDirty = true;
            return;
        }

        for (let ox = -3; ox <= 3; ox++) {
            for (let oy = 0; oy <= 2; oy++) {
                const tx = x + ox;
                const ty = y - oy;
                if (tx < 1 || tx >= this.engine.width - 1 || ty < 2 || ty >= this.engine.height) continue;
                const i = ty * this.engine.width + tx;
                if (PROPS[this.engine.world[i]]?.solid) {
                    this.engine.world[i] = meteor;
                }
            }
        }

        this.engine.invDirty = true;
        this.notify('A meteorite landed somewhere in the world.');
    }

    private updateBestiary() {
        const p = this.engine.player;
        const py = p.y / TILE_SIZE;

        for (const npc of this.engine.npcs) {
            if (npc.type && Math.hypot(npc.x - p.x, npc.y - p.y) < 320) {
                this.discovered.add(npc.eventTag || npc.type);
            }
        }

        if (py > this.engine.height * 0.50) {
            this.discovered.add('bat');
            this.discovered.add('skeleton');
        }
        if (this.biome === 'Jungle') this.discovered.add('hornet');
        if (this.biome === 'Desert') this.discovered.add('antlion');
        if (this.biome === 'Snow') this.discovered.add('ice_slime');
        if (this.biome === 'Ocean') this.discovered.add('crab');

        this.recalculateBestiary();
    }

    private recalculateBestiary() {
        this.bestiarySize = this.discovered.size;
    }

    private refreshHousing() {
        if (this.tick % 45 !== 0) return;

        const valid = this.houses.filter(h => this.isValidHouse(h));
        const nearby = this.findNearbyCustomHouses();
        const merged = [...valid];

        for (const h of nearby) {
            if (!merged.some(v => Math.abs(v.x - h.x) < 2 && Math.abs(v.y - h.y) < 2)) {
                merged.push(h);
            }
        }

        this.houses = merged.slice(0, 25);
    }

    private isValidHouse(h: House): boolean {
        const w = this.engine.width;
        const world = this.engine.world;
        const walls = this.engine.walls;

        let hasChair = false;
        let hasTable = false;
        let hasLight = false;
        let hasDoor = false;

        for (let y = h.y; y <= h.y + h.h; y++) {
            for (let x = h.x; x <= h.x + h.w; x++) {
                if (x < 1 || y < 1 || x >= this.engine.width - 1 || y >= this.engine.height - 1) {
                    return false;
                }

                const idx = y * w + x;
                const prop = PROPS[world[idx]];
                const name = (prop?.name || '').toLowerCase();
                const wallName = (PROPS[walls[idx]]?.name || '').toLowerCase();

                if (x > h.x && x < h.x + h.w && y > h.y && y < h.y + h.h) {
                    if (world[idx] && PROPS[world[idx]]?.solid) return false;
                    if (!walls[idx] && !wallName) return false;
                }

                hasChair ||= name.includes('chair');
                hasTable ||= name.includes('work bench') ||
                    name.includes('workbench') ||
                    name.includes('table') ||
                    name.includes('bench');
                hasLight ||= !!prop?.light ||
                    name.includes('torch') ||
                    name.includes('lantern') ||
                    name.includes('lamp') ||
                    name.includes('candle');
                hasDoor ||= name.includes('door') || name.includes('platform');

                if (x === h.x || x === h.x + h.w || y === h.y || y === h.y + h.h) {
                    const isDoor = name.includes('door') || name.includes('platform');
                    const solidFrame = PROPS[world[idx]]?.solid || isDoor;
                    if (!solidFrame && !walls[idx]) return false;
                }
            }
        }

        return hasChair && hasTable && hasLight && hasDoor;
    }

    private findNearbyCustomHouses(): House[] {
        const out: House[] = [];
        const cx = Math.floor((this.engine.player.x + this.engine.player.w / 2) / TILE_SIZE);
        const cy = Math.floor((this.engine.player.y + this.engine.player.h / 2) / TILE_SIZE);

        for (let h = 5; h <= 12; h++) {
            for (let w = 8; w <= 14; w++) {
                const startY = cy - h - 2;
                for (const startX of [cx - 10, cx - Math.floor(w / 2), cx + 8]) {
                    const candidate = { x: startX, y: startY, w, h };
                    if (this.isValidHouse(candidate)) out.push(candidate);
                }
            }
        }

        return out.slice(0, 6);
    }

    private ensureStarterTown() {
        const midX = Math.floor(this.engine.width / 2);
        const surface = this.surfaceAt(midX);
        const roomY = Math.max(4, surface - 9);
        const offsets = [-19, -6, 7];

        this.houses = [];

        for (const off of offsets) {
            const house = { x: midX + off, y: roomY, w: 10, h: 6 };
            this.buildHouse(house);
            if (this.isValidHouse(house)) this.houses.push(house);
        }
    }

    private buildHouse(h: House) {
        const wood = pickId('Wood');
        const wall = pickId('Wood Wall', 'Wood wall');
        const torch = pickId('Torch');
        const chair = pickId('Wooden Chair', 'Chair');
        const table = pickId('Work Bench', 'Workbench', 'Table');
        const door = pickId('Wooden Door', 'Door', 'Wood Platform', 'Platform');

        if (!wood) return;

        for (let y = h.y; y <= h.y + h.h; y++) {
            for (let x = h.x; x <= h.x + h.w; x++) {
                const idx = y * this.engine.width + x;

                if (x === h.x || x === h.x + h.w || y === h.y || y === h.y + h.h) {
                    this.engine.world[idx] = wood;
                } else {
                    this.engine.world[idx] = 0;
                    if (wall) this.engine.walls[idx] = PROPS[wall]?.placeWall || wall;
                }
            }
        }

        const floorY = h.y + h.h;

        if (door) {
            this.engine.world[floorY * this.engine.width + h.x + Math.floor(h.w / 2)] = door;
        }
        if (table) {
            this.engine.world[(h.y + h.h - 1) * this.engine.width + h.x + 2] = table;
        }
        if (chair) {
            this.engine.world[(h.y + h.h - 1) * this.engine.width + h.x + 3] = chair;
        }
        if (torch) {
            this.engine.world[(h.y + 1) * this.engine.width + h.x + 2] = torch;
        }
    }

    private refreshTown() {
        if (this.tick % 90 !== 0) return;

        const maxHp = this.engine.player.maxHp || 100;
        const canSpawn: string[] = ['guide'];

        if (maxHp >= 200) canSpawn.push('nurse');
        if (this.engine.countMoney?.() >= 5000) canSpawn.push('merchant');
        if (this.visitedBiomes.has('Ocean')) canSpawn.push('angler');
        if (this.visitedBiomes.has('Desert')) canSpawn.push('golfer');
        if (this.bestiarySize >= 6) canSpawn.push('zoologist');
        if ((this.engine.player.y / TILE_SIZE) > this.engine.height * 0.48) {
            canSpawn.push('stylist', 'tavernkeep');
        }
        if (this.discovered.has('goblin')) canSpawn.push('goblin_tinkerer');
        if (this.townCount() >= 8) canSpawn.push('party_girl');

        for (const type of canSpawn) {
            if (type === 'guide' || this.hasTownNpc(type)) continue;
            if (!this.houses.some(h => !h.assigned && this.isValidHouse(h))) continue;
            this.unlockTownNpc(type);
            break;
        }
    }

    private unlockTownNpc(type: string) {
        if (this.hasTownNpc(type)) return;

        const house = this.houses.find(h => !h.assigned && this.isValidHouse(h));
        if (!house) {
            this.notify('Build a valid house to attract another town NPC.');
            return;
        }

        const x = (house.x + Math.floor(house.w / 2)) * TILE_SIZE;
        const y = (house.y + house.h - 2) * TILE_SIZE;

        house.assigned = type;

        this.engine.npcs.push({
            id: Math.random(),
            type,
            aiStyle: 'passive',
            x,
            y,
            w: 24,
            h: 42,
            vx: 0,
            vy: 0,
            face: 1,
            hp: 250,
            maxHp: 250,
            walkFrame: 0,
            damage: 0,
            defense: 15,
            homeX: x,
            homeY: y,
        });

        this.townUnlocked.add(type);
        this.notify(TOWN_NAMES[type] + ' has moved in.');
        this.persist();
    }

    private hasTownNpc(type: string): boolean {
        return this.engine.npcs.some((n: any) => n.type === type);
    }

    private townCount(): number {
        return this.engine.npcs.filter((n: any) => TOWN_TYPES.includes(n.type)).length;
    }

    private featureInteract() {
        const npc = this.nearestTownNpc();

        if (!npc) {
            this.notify('No feature NPC nearby.');
            return;
        }

        switch (npc.type) {
            case 'nurse':
                this.healAtNurse();
                break;
            case 'angler':
                this.handleAnglerQuest();
                break;
            case 'golfer':
                this.notify('The Golfer is ready for a round once you build somewhere suitable.');
                break;
            case 'zoologist':
                this.notify('Bestiary completion: ' + this.bestiarySize + ' / ' + this.maxBestiary);
                break;
            case 'stylist':
                this.notify('The Stylist can be found after exploring deeper underground.');
                break;
            case 'tavernkeep':
                this.notify('The Tavernkeep has arrived in the town.');
                break;
            case 'goblin_tinkerer':
                this.notify('The Goblin Tinkerer has arrived after the invasion.');
                break;
            case 'party_girl':
                this.notify('The Party Girl has arrived.');
                break;
            default:
                this.notify('Talk to ' + (TOWN_NAMES[npc.type] || npc.type) + ' using Right Click.');
        }
    }

    private nearestTownNpc(): any | null {
        const p = this.engine.player;
        let best: any = null;
        let bestDist = Infinity;

        for (const n of this.engine.npcs) {
            if (!TOWN_TYPES.includes(n.type)) continue;

            const d = Math.hypot(p.x - n.x, p.y - n.y);
            if (d < bestDist && d < 180) {
                best = n;
                bestDist = d;
            }
        }

        return best;
    }

    private healAtNurse() {
        const p = this.engine.player;

        if (p.hp >= p.maxHp) {
            this.notify('The Nurse cannot heal you at full health.');
            return;
        }

        const missing = Math.ceil(p.maxHp - p.hp);
        const price = Math.max(100, missing * 40);

        if (this.engine.countMoney() < price) {
            this.notify('The Nurse needs ' + price + ' copper coins.');
            return;
        }

        this.engine.removeMoney(price);
        p.hp = p.maxHp;
        this.notify('The Nurse restored your health.');
    }

    private updateAnglerQuest() {
        if (this.anglerQuest.day !== this.worldDay) {
            this.anglerQuest = {
                fish: this.pickQuestFish(),
                day: this.worldDay,
                turnedIn: false,
            };
        }
    }

    private pickQuestFish(): string {
        const candidates = [
            'Bass',
            'Trout',
            'Salmon',
            'Tuna',
            'Frost Minnow',
            'Neon Tetra',
            'Flounder',
            'Pufferfish',
        ];

        const available = candidates.filter(name => !!pickId(name));
        return available[Math.floor(Math.random() * Math.max(1, available.length))] || 'Bass';
    }

    private handleAnglerQuest() {
        const fishId = pickId(this.anglerQuest.fish);

        if (fishId && this.engine.countItem(fishId) > 0 && !this.anglerQuest.turnedIn) {
            this.engine.removeItem(fishId, 1);
            this.engine.addMoney(500 + this.questsCompleted * 25);
            this.anglerQuest.turnedIn = true;
            this.questsCompleted++;

            const bait = pickId('Worm', 'Grasshopper', 'Bait');
            if (bait) this.engine.addToInv(bait, 5);

            this.notify('Angler quest complete. Reward granted.');
        } else {
            this.notify('Today\'s fishing quest: catch ' + this.anglerQuest.fish + '.');
        }
    }

    private handleFishingKey() {
        if (!this.fishing.active) {
            this.startFishing();
            return;
        }

        if (this.fishing.waiting) {
            this.notify('Not yet — wait for the bite.');
            return;
        }

        this.reelFishing();
    }

    private startFishing() {
        const rod = this.findFishingRod();
        const bait = this.findBait();

        if (!rod) {
            this.notify('You need a fishing pole.');
            return;
        }
        if (!bait) {
            this.notify('You need bait.');
            return;
        }
        if (!this.nearLiquid()) {
            this.notify('Stand near water to fish.');
            return;
        }

        this.consumeOne(bait.id);

        this.fishing = {
            active: true,
            waiting: true,
            biteIn: 90 + Math.floor(Math.random() * 140),
            spotBiome: this.biome,
        };

        this.notify('Fishing... press F when the bobber bites.');
    }

    private updateFishing() {
        if (!this.fishing.active || !this.fishing.waiting) return;

        this.fishing.biteIn--;

        if (this.fishing.biteIn <= 0) {
            this.fishing.waiting = false;
            this.notify('A fish is biting! Press F to reel it in.');
        }
    }

    private reelFishing() {
        this.fishing.active = false;

        if (Math.random() < 0.16) {
            const crate = pickId('Wooden Crate', 'Iron Crate', 'Golden Crate');

            if (crate) {
                this.engine.addToInv(crate, 1);
                this.notify('You caught a fishing crate.');
                return;
            }
        }

        const fishCandidates: string[] = [];
        const fishWords = [
            'Fish',
            'Bass',
            'Trout',
            'Salmon',
            'Tuna',
            'Minnow',
            'Pufferfish',
            'Flounder',
            'Tetra',
        ];

        for (const [rawId, prop] of Object.entries(PROPS)) {
            const name = prop?.name || '';
            if (!fishWords.some(word => name.toLowerCase().includes(word.toLowerCase()))) continue;

            const id = Number(rawId);
            if (prop && !prop.solid && !prop.dmg) {
                fishCandidates.push(name);
                void id;
            }
        }

        const fishName =
            fishCandidates[Math.floor(Math.random() * Math.max(1, fishCandidates.length))] || 'Bass';
        const fishId = pickId(fishName);

        if (fishId) {
            this.engine.addToInv(fishId, 1);
            this.notify('You caught ' + fishName + '.');
        } else {
            this.engine.addMoney(75);
            this.notify('You found 75 copper instead.');
        }
    }

    private findFishingRod(): { id: number } | null {
        for (const [rawId, prop] of Object.entries(PROPS)) {
            const name = (prop?.name || '').toLowerCase();
            if ((name.includes('fishing pole') || name.includes('fishing rod')) &&
                this.engine.countItem(Number(rawId)) > 0) {
                return { id: Number(rawId) };
            }
        }
        return null;
    }

    private findBait(): { id: number } | null {
        for (const [rawId, prop] of Object.entries(PROPS)) {
            const name = (prop?.name || '').toLowerCase();
            if ((name.includes('worm') ||
                name.includes('grasshopper') ||
                name.includes('bait') ||
                name.includes('firefly')) &&
                this.engine.countItem(Number(rawId)) > 0) {
                return { id: Number(rawId) };
            }
        }
        return null;
    }

    private consumeOne(id: number) {
        this.engine.removeItem(id, 1);
    }

    private nearLiquid(): boolean {
        const p = this.engine.player;
        const cx = Math.floor((p.x + p.w / 2) / TILE_SIZE);
        const cy = Math.floor((p.y + p.h) / TILE_SIZE);

        for (let y = cy - 1; y <= cy + 2; y++) {
            for (let x = cx - 4; x <= cx + 4; x++) {
                if (x < 0 || y < 0 || x >= this.engine.width || y >= this.engine.height) continue;
                const t = this.engine.world[y * this.engine.width + x];
                if (PROPS[t]?.liquid) return true;
            }
        }

        return false;
    }

    private usePylonTravel() {
        if (this.townCount() < 2) {
            this.notify('You need at least two town NPCs before pylon travel unlocks.');
            return;
        }

        const points = this.getPylonPoints().filter(p => this.visitedBiomes.has(p.biome));
        if (!points.length) {
            this.notify('Explore another biome to discover a pylon destination.');
            return;
        }

        const point = points[this.pylonIndex % points.length];
        this.pylonIndex++;

        const surface = this.surfaceAt(point.x);

        this.engine.player.x = point.x * TILE_SIZE;
        this.engine.player.y = Math.max(0, (surface - 4) * TILE_SIZE);
        this.engine.player.vx = 0;
        this.engine.player.vy = 0;

        this.notify('Pylon travel: ' + point.name);
    }

    private getPylonPoints(): PylonPoint[] {
        const w = this.engine.width;

        return [
            { name: 'Forest Pylon', x: Math.floor(w * 0.50), y: 0, biome: 'Forest' },
            { name: 'Snow Pylon', x: Math.floor(w * 0.08), y: 0, biome: 'Snow' },
            { name: 'Desert Pylon', x: Math.floor(w * 0.60), y: 0, biome: 'Desert' },
            { name: 'Jungle Pylon', x: Math.floor(w * 0.86), y: 0, biome: 'Jungle' },
            { name: 'Ocean Pylon', x: Math.floor(w * 0.03), y: 0, biome: 'Ocean' },
            { name: 'Cavern Pylon', x: Math.floor(w * 0.50), y: Math.floor(this.engine.height * 0.60), biome: 'Cavern' },
        ];
    }

    private getHappiness(type: string): number {
        const preferred = PREFERRED_BIOME[type] || ['Forest'];
        const biomeBonus = preferred.includes(this.biome) ? 1 : 0;

        const nearby = this.engine.npcs.filter((n: any) =>
            n.type !== type &&
            TOWN_TYPES.includes(n.type) &&
            Math.hypot(n.x - this.engine.player.x, n.y - this.engine.player.y) < 400
        );

        const likedNeighbor = nearby.some((n: any) =>
            (PREFERRED_NEIGHBOR[type] || []).includes(n.type)
        );

        const score =
            50 +
            biomeBonus * 25 +
            (likedNeighbor ? 20 : 0) -
            Math.max(0, nearby.length - 4) * 5;

        return Math.max(0, Math.min(100, score));
    }

    private persist() {
        try {
            const data = {
                worldDay: this.worldDay,
                discovered: [...this.discovered],
                visitedBiomes: [...this.visitedBiomes],
                townUnlocked: [...this.townUnlocked],
                questsCompleted: this.questsCompleted,
                anglerQuest: this.anglerQuest,
                weather: this.weather,
            };

            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch {
            // Ignore disabled local storage.
        }
    }

    private restore() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;

            const data = JSON.parse(raw);

            this.worldDay = data.worldDay || 1;
            this.discovered = new Set(data.discovered || []);
            this.visitedBiomes = new Set(data.visitedBiomes || []);
            this.townUnlocked = new Set(data.townUnlocked || []);
            this.questsCompleted = data.questsCompleted || 0;
            this.anglerQuest = data.anglerQuest || this.anglerQuest;
            this.weather = data.weather || 'Clear';
        } catch {
            // Ignore corrupt data.
        }
    }

    private togglePanel(kind: 'housing' | 'bestiary' | 'map' | 'town') {
        if (!this.panelEl) return;

        if (this.panelEl.dataset.kind === kind && this.panelEl.style.display !== 'none') {
            this.hidePanel();
            return;
        }

        this.panelEl.dataset.kind = kind;
        this.panelEl.style.display = 'block';

        if (kind === 'housing') this.panelEl.innerHTML = this.housingHTML();
        if (kind === 'bestiary') this.panelEl.innerHTML = this.bestiaryHTML();
        if (kind === 'map') this.panelEl.innerHTML = this.mapHTML();
        if (kind === 'town') this.panelEl.innerHTML = this.townHTML();

        if (kind === 'map') this.drawMap();
    }

    private hidePanel() {
        if (this.panelEl) this.panelEl.style.display = 'none';
    }

    private housingHTML(): string {
        const valid = this.houses.filter(h => this.isValidHouse(h));

        const rows = valid.map((h, i) => {
            const npc = h.assigned ? (TOWN_NAMES[h.assigned] || h.assigned) : 'Available';
            return '<div><b>House ' + (i + 1) + '</b> — ' + npc + '</div>';
        }).join('');

        return '<div style="font-size:18px;font-weight:800;margin-bottom:8px">Housing</div>' +
            '<div>Valid rooms: <b>' + valid.length + '</b></div>' +
            '<div style="opacity:.8;margin:8px 0">Needs an enclosed frame, background wall, light, table/workbench, chair, and entrance.</div>' +
            '<div style="line-height:1.7">' + (rows || '<i>No valid houses nearby.</i>') + '</div>';
    }

    private bestiaryHTML(): string {
        const progress = Math.min(100, Math.floor((this.bestiarySize / this.maxBestiary) * 100));

        return '<div style="font-size:18px;font-weight:800;margin-bottom:8px">Bestiary</div>' +
            '<div style="font-size:34px;font-weight:900">' + this.bestiarySize + ' / ' + this.maxBestiary + '</div>' +
            '<div style="height:10px;background:#111;border-radius:5px;overflow:hidden;margin:8px 0 12px">' +
            '<div style="width:' + progress + '%;height:100%;background:#8bc34a"></div></div>' +
            '<div style="opacity:.85">Zoologist unlocks at 10% (6 entries in this expansion).</div>' +
            '<div style="margin-top:10px;line-height:1.5">' +
            [...this.discovered].sort().map(x => '• ' + x).join('<br>') +
            '</div>';
    }

    private mapHTML(): string {
        return '<div style="font-size:18px;font-weight:800;margin-bottom:8px">World Map</div>' +
            '<canvas id="eartharia-map" width="420" height="240" style="width:100%;border:1px solid #47607d;background:#0b1020;image-rendering:pixelated"></canvas>' +
            '<div style="opacity:.7;margin-top:8px">M map • current biome: <b>' + this.biome + '</b></div>';
    }

    private townHTML(): string {
        const towns = this.engine.npcs
            .filter((n: any) => TOWN_TYPES.includes(n.type))
            .map((n: any) => {
                const happy = this.getHappiness(n.type);

                return '<div style="display:flex;justify-content:space-between;gap:16px;margin:5px 0">' +
                    '<span>' + (TOWN_NAMES[n.type] || n.type) + '</span>' +
                    '<b>' + happy + '%</b>' +
                    '</div>';
            }).join('');

        const event = this.activeEvent
            ? '<div style="margin-top:10px;color:#ffd54f"><b>' +
              this.activeEvent +
              '</b> ' +
              this.eventProgress +
              (this.eventGoal ? '/' + this.eventGoal : '') +
              '</div>'
            : '';

        return '<div style="font-size:18px;font-weight:800;margin-bottom:8px">Town</div>' +
            '<div>NPCs: <b>' + this.townCount() + '</b></div>' +
            '<div>World day: <b>' + this.worldDay + '</b></div>' +
            '<div>Weather: <b>' + this.weather + '</b></div>' +
            '<div style="margin-top:8px">' + (towns || '<i>No town NPCs yet.</i>') + '</div>' +
            event +
            '<div style="margin-top:10px;opacity:.75">E interact • L town • P pylon travel</div>';
    }

    private buildOverlay() {
        if (this.root || typeof document === 'undefined') return;

        const root = document.createElement('div');
        root.id = 'eartharia-preboss-root';
        root.style.position = 'fixed';
        root.style.inset = '0';
        root.style.zIndex = '5000';
        root.style.pointerEvents = 'none';
        root.style.fontFamily = 'system-ui, sans-serif';
        root.style.color = '#fff';

        const header = document.createElement('div');
        header.style.position = 'absolute';
        header.style.right = '12px';
        header.style.top = '12px';
        header.style.padding = '10px 12px';
        header.style.background = 'rgba(8,16,30,.76)';
        header.style.border = '1px solid rgba(150,190,230,.4)';
        header.style.borderRadius = '10px';
        header.style.backdropFilter = 'blur(8px)';
        header.style.pointerEvents = 'none';
        root.appendChild(header);

        const panel = document.createElement('div');
        panel.style.position = 'absolute';
        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.transform = 'translate(-50%,-50%)';
        panel.style.width = 'min(560px, calc(100vw - 32px))';
        panel.style.maxHeight = 'min(70vh, 560px)';
        panel.style.overflow = 'auto';
        panel.style.padding = '16px';
        panel.style.background = 'rgba(8,16,30,.94)';
        panel.style.border = '2px solid #5f7892';
        panel.style.borderRadius = '12px';
        panel.style.boxShadow = '0 16px 50px rgba(0,0,0,.55)';
        panel.style.pointerEvents = 'auto';
        panel.style.display = 'none';
        root.appendChild(panel);

        const toast = document.createElement('div');
        toast.style.position = 'absolute';
        toast.style.left = '50%';
        toast.style.bottom = '70px';
        toast.style.transform = 'translateX(-50%)';
        toast.style.padding = '9px 14px';
        toast.style.background = 'rgba(0,0,0,.78)';
        toast.style.border = '1px solid rgba(255,255,255,.25)';
        toast.style.borderRadius = '999px';
        toast.style.fontWeight = '700';
        toast.style.opacity = '0';
        toast.style.transition = 'opacity .15s';
        toast.style.pointerEvents = 'none';
        root.appendChild(toast);

        const fx = document.createElement('canvas');
        fx.width = window.innerWidth;
        fx.height = window.innerHeight;
        fx.style.position = 'absolute';
        fx.style.inset = '0';
        fx.style.width = '100%';
        fx.style.height = '100%';
        fx.style.pointerEvents = 'none';
        root.appendChild(fx);

        this.root = root;
        this.panelEl = panel;
        this.toastEl = toast;
        this.fxCanvas = fx;

        window.addEventListener('resize', () => {
            if (!this.fxCanvas) return;
            this.fxCanvas.width = window.innerWidth;
            this.fxCanvas.height = window.innerHeight;
        });

        document.body.appendChild(root);
    }

    private syncOverlay() {
        if (!this.root) return;

        const isNight = this.engine.time > NIGHT_START && this.engine.time < NIGHT_END;

        const eventText = this.activeEvent
            ? '<div style="color:#ffd54f;font-weight:800">' +
              this.activeEvent +
              (this.activeEvent === 'Goblin Army'
                  ? ' ' + this.eventProgress + '/' + this.eventGoal
                  : '') +
              '</div>'
            : '';

        const questText =
            '<div style="margin-top:4px">Angler: <b>' +
            this.anglerQuest.fish +
            '</b></div>';

        const guide =
            '<div style="font-weight:900;font-size:15px;letter-spacing:.5px">EARTHARIA • PRE-BOSS</div>' +
            '<div style="margin-top:4px">Biome: <b>' +
            this.biome +
            '</b> • ' +
            (isNight ? 'Night' : 'Day') +
            '</div>' +
            '<div>Weather: <b>' +
            this.weather +
            '</b> • Town: <b>' +
            this.townCount() +
            '</b></div>' +
            questText +
            eventText +
            '<div style="margin-top:6px;opacity:.66;font-size:11px">' +
            'H housing • J bestiary • M map • L town • P pylons • F fish • E interact • G goblin army' +
            '</div>';

        const header = this.root.firstElementChild as HTMLDivElement | null;
        if (header) header.innerHTML = guide;

        if (this.panelEl && this.panelEl.style.display !== 'none') {
            const kind = this.panelEl.dataset.kind as 'housing' | 'bestiary' | 'map' | 'town';

            if (kind === 'housing') this.panelEl.innerHTML = this.housingHTML();
            if (kind === 'bestiary') this.panelEl.innerHTML = this.bestiaryHTML();
            if (kind === 'town') this.panelEl.innerHTML = this.townHTML();
            if (kind === 'map') {
                this.panelEl.innerHTML = this.mapHTML();
                this.drawMap();
            }
        }

        const ctx = this.fxCanvas?.getContext('2d');

        if (ctx && this.fxCanvas) {
            ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);

            for (const npc of this.engine.npcs) {
                if (!TOWN_TYPES.includes(npc.type)) continue;

                const sx = npc.x - this.engine.camera.x;
                const sy = npc.y - this.engine.camera.y;

                if (sx < -100 ||
                    sy < -100 ||
                    sx > this.fxCanvas.width + 100 ||
                    sy > this.fxCanvas.height + 100) {
                    continue;
                }

                ctx.fillStyle = '#fff';
                ctx.font = 'bold 11px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText(
                    TOWN_NAMES[npc.type] || npc.type,
                    sx + npc.w / 2,
                    sy - 8
                );

                ctx.fillStyle = '#4fc3f7';
                ctx.fillRect(sx + npc.w / 2 - 18, sy - 4, 36, 4);

                ctx.fillStyle = '#81c784';
                ctx.fillRect(
                    sx + npc.w / 2 - 18,
                    sy - 4,
                    36 * (this.getHappiness(npc.type) / 100),
                    4
                );
            }

            if (this.activeEvent) {
                ctx.fillStyle = 'rgba(255,255,255,.8)';
                ctx.font = 'bold 13px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText(this.activeEvent, this.fxCanvas.width / 2, 34);
            }

            if (this.weather === 'Rain') {
                ctx.strokeStyle = 'rgba(160,210,255,.55)';
                ctx.lineWidth = 1;

                for (let i = 0; i < 180; i++) {
                    const x = (i * 83 + this.tick * 5) % this.fxCanvas.width;
                    const y = (i * 47 + this.tick * 9) % this.fxCanvas.height;

                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x - 3, y + 9);
                    ctx.stroke();
                }
            }
        }
    }

    private drawMap() {
        const canvas = document.getElementById('eartharia-map') as HTMLCanvasElement | null;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        const scaleX = w / this.engine.width;
        const scaleY = h / this.engine.height;
        const stepX = Math.max(1, Math.floor(this.engine.width / w));
        const stepY = Math.max(1, Math.floor(this.engine.height / h));

        for (let y = 0; y < this.engine.height; y += stepY) {
            for (let x = 0; x < this.engine.width; x += stepX) {
                const id = this.engine.world[y * this.engine.width + x];
                const prop = PROPS[id];

                if (!id) {
                    ctx.fillStyle = y < this.engine.height * 0.34 ? '#6ea8d9' : '#111827';
                } else if (prop?.liquid) {
                    ctx.fillStyle = prop.c || '#2b90d9';
                } else if (prop?.solid) {
                    ctx.fillStyle = prop.c || '#777';
                } else {
                    ctx.fillStyle = 'rgba(100,100,100,.45)';
                }

                ctx.fillRect(
                    x * scaleX,
                    y * scaleY,
                    Math.ceil(scaleX * stepX),
                    Math.ceil(scaleY * stepY)
                );
            }
        }

        const px = (this.engine.player.x / TILE_SIZE) * scaleX;
        const py = (this.engine.player.y / TILE_SIZE) * scaleY;

        ctx.fillStyle = '#fff';
        ctx.fillRect(px - 2, py - 2, 4, 4);
    }

    private ensureWorldFeatures() {
        this.ensureOceans();
        this.ensureEvilBiome();
        this.ensureSkyIslands();
        this.ensureMushroomBiome();
        this.ensureDungeon();
        this.engine.invDirty = true;
    }

    private ensureOceans() {
        const water = IDS.WATER || pickId('Water');
        if (!water) return;

        for (const side of [0, 1]) {
            const x0 = side === 0 ? 2 : this.engine.width - 32;
            const x1 = side === 0 ? 32 : this.engine.width - 2;

            for (let x = x0; x < x1; x++) {
                const surface = this.surfaceAt(x);

                for (
                    let y = surface;
                    y < Math.min(this.engine.height - 1, surface + 28);
                    y++
                ) {
                    const idx = y * this.engine.width + x;
                    this.engine.world[idx] = water;
                    this.engine.walls[idx] = 0;
                }
            }
        }
    }

    private ensureEvilBiome() {
        const evil = this.engine.worldData?.evil || 'Corruption';

        const ore = pickId(
            evil === 'Crimson' ? 'Crimstone' : 'Ebonstone',
            evil === 'Crimson' ? 'Crimstone Brick' : 'Ebonstone Brick'
        );

        const grass = pickId(
            evil === 'Crimson' ? 'Crimson Grass' : 'Corrupt Grass'
        );

        if (!ore) return;

        const start = evil === 'Crimson'
            ? Math.floor(this.engine.width * 0.35)
            : Math.floor(this.engine.width * 0.65);

        for (
            let x = start;
            x < start + Math.floor(this.engine.width * 0.08);
            x++
        ) {
            const surface = this.surfaceAt(x);

            for (
                let y = surface;
                y < Math.min(this.engine.height * 0.58, surface + 50);
                y++
            ) {
                const idx = y * this.engine.width + x;

                if (y === surface && grass) {
                    this.engine.world[idx] = grass;
                } else if (this.engine.world[idx] && PROPS[this.engine.world[idx]]?.solid) {
                    this.engine.world[idx] = ore;
                }
            }
        }
    }

    private ensureSkyIslands() {
        const wood = pickId('Wood');
        const cloud = pickId('Cloud');
        const chest = IDS.CHEST || pickId('Chest');

        if (!wood) return;

        const count =
            this.engine.worldData?.size === 'Large'
                ? 6
                : this.engine.worldData?.size === 'Medium'
                    ? 5
                    : 4;

        for (let i = 0; i < count; i++) {
            const x = Math.floor(
                this.engine.width *
                (0.10 + i * (0.75 / Math.max(1, count - 1)))
            );
            const y = Math.floor(
                this.engine.height *
                (0.12 + (i % 2) * 0.05)
            );
            const radius = 5 + (i % 3);

            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.abs(dx) > radius - Math.max(0, Math.abs(dy))) continue;

                    const tx = x + dx;
                    const ty = y + dy;

                    if (
                        tx < 2 ||
                        tx >= this.engine.width - 2 ||
                        ty < 2 ||
                        ty >= this.engine.height - 2
                    ) {
                        continue;
                    }

                    this.engine.world[ty * this.engine.width + tx] = cloud || wood;
                }
            }

            for (let dx = -radius + 1; dx <= radius - 1; dx++) {
                const tx = x + dx;
                const ty = y - 3;

                if (tx >= 0 && tx < this.engine.width) {
                    this.engine.world[ty * this.engine.width + tx] = wood;
                }
            }

            if (chest) {
                const key = x + ',' + (y - 2);
                this.engine.world[(y - 2) * this.engine.width + x] = chest;

                if (!this.engine.chests[key]) {
                    this.engine.chests[key] = [
                        {
                            id: pickId('Cloud in a Bottle', 'Hermes Boots', 'Magic Mirror') || 0,
                            n: 1,
                        },
                        { id: pickId('Gold Coin') || 0, n: 2 },
                        {
                            id: pickId('Healing Potion', 'Lesser Healing Potion') || 0,
                            n: 3,
                        },
                    ];
                }
            }
        }
    }

    private ensureMushroomBiome() {
        const mud = pickId('Mud Block', 'Mud');
        const mushroomGrass = pickId('Mushroom Grass');
        const mushroom = pickId('Glowing Mushroom', 'Mushroom');

        if (!mud) return;

        const cx = Math.floor(this.engine.width * 0.27);
        const cy = Math.floor(this.engine.height * 0.56);

        for (let y = cy - 10; y <= cy + 10; y++) {
            for (let x = cx - 18; x <= cx + 18; x++) {
                if (
                    x < 2 ||
                    x >= this.engine.width - 2 ||
                    y < 2 ||
                    y >= this.engine.height - 2
                ) {
                    continue;
                }

                const idx = y * this.engine.width + x;

                if (Math.hypot(x - cx, y - cy) < 20) {
                    if (y === cy - 10 && mushroomGrass) {
                        this.engine.world[idx] = mushroomGrass;
                    } else if (
                        this.engine.world[idx] === IDS.STONE_BLOCK ||
                        this.engine.world[idx] === IDS.DIRT_BLOCK
                    ) {
                        this.engine.world[idx] = mud;
                    }
                }
            }
        }

        if (mushroom) {
            for (let i = 0; i < 24; i++) {
                const x = cx - 16 + Math.floor(Math.random() * 32);
                const y = cy - 8 + Math.floor(Math.random() * 14);
                const idx = y * this.engine.width + x;

                if (!this.engine.world[idx]) {
                    this.engine.world[idx] = mushroom;
                }
            }
        }
    }

    private ensureDungeon() {
        const bricks = pickId(
            'Dungeon Brick',
            'Blue Dungeon Brick',
            'Green Dungeon Brick',
            'Pink Dungeon Brick'
        );
        const wall = pickId('Dungeon Brick Wall', 'Dungeon Wall');

        if (!bricks) return;

        const x0 = Math.floor(this.engine.width * 0.90);
        const surface = this.surfaceAt(x0);
        const top = Math.min(
            this.engine.height - 90,
            surface + 6
        );
        const bottom = Math.min(
            this.engine.height - 12,
            top + 75
        );

        for (let y = top; y <= bottom; y++) {
            for (let x = x0 - 16; x <= x0 + 16; x++) {
                if (x < 2 || x >= this.engine.width - 2) continue;

                const idx = y * this.engine.width + x;
                const outer =
                    x === x0 - 16 ||
                    x === x0 + 16 ||
                    y === top ||
                    y === bottom;

                if (outer) {
                    this.engine.world[idx] = bricks;
                } else {
                    this.engine.world[idx] = 0;
                    if (wall) {
                        this.engine.walls[idx] =
                            PROPS[wall]?.placeWall || wall;
                    }
                }
            }
        }

        const door = pickId('Wooden Door', 'Door', 'Platform');

        if (door) {
            this.engine.world[
                top * this.engine.width + x0
            ] = door;
        }
    }

    private surfaceAt(x: number): number {
        x = Math.max(0, Math.min(this.engine.width - 1, Math.floor(x)));

        for (let y = 1; y < this.engine.height; y++) {
            if (this.engine.isSolid(x, y)) return y;
        }

        return Math.floor(this.engine.height * 0.3);
    }

    private isEvilAt(x: number, y: number): boolean {
        const id = this.engine.world[y * this.engine.width + x];
        const name = itemName(id).toLowerCase();

        return (
            name.includes('ebonstone') ||
            name.includes('crimstone') ||
            name.includes('corrupt') ||
            name.includes('crimson')
        );
    }

    private isMushroomAt(x: number, y: number): boolean {
        const id = this.engine.world[y * this.engine.width + x];
        const name = itemName(id).toLowerCase();

        return (
            name.includes('mushroom') ||
            (name.includes('mud') && y > this.engine.height * 0.5)
        );
    }

    private drawRainFX() {
        // Kept as a separate hook point for future canvas-only effects.
    }

    private notify(message: string) {
        if (!this.toastEl) return;

        this.toastEl.textContent = message;
        this.toastEl.style.opacity = '1';

        window.setTimeout(() => {
            if (this.toastEl) this.toastEl.style.opacity = '0';
        }, 2600);
    }
}

const registry = new WeakMap<object, PreBossFeatures>();

export const getPreBossFeatures = (
    engine: EngineLike
): PreBossFeatures | undefined => registry.get(engine);

export const attachPreBossFeatures = (
    engine: EngineLike
): PreBossFeatures => {
    let feature = registry.get(engine);

    if (!feature) {
        feature = new PreBossFeatures(engine);
        registry.set(engine, feature);
    }

    return feature;
};

export const installPreBossExpansion = (GameEngineClass: any) => {
    const proto = GameEngineClass.prototype;

    if (proto.__earthariaPreBossInstalled) return;
    proto.__earthariaPreBossInstalled = true;

    const originalStart = proto.start;
    proto.start = function (...args: any[]) {
        const result = originalStart.apply(this, args);
        attachPreBossFeatures(this);
        return result;
    };

    const originalUpdate = proto.update;
    proto.update = function (input: any, dt: number) {
        const result = originalUpdate.apply(this, [input, dt]);
        const feature =
            getPreBossFeatures(this) ||
            attachPreBossFeatures(this);

        feature.update(dt);
        return result;
    };
};
