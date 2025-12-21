
export interface ItemProp {
    id: number;
    name: string;
    c: string; // Color (hex)
    icon: string;
    solid?: number; // 1 for solid, 0 for pass-through
    hardness?: number; // For mining
    tool?: 'pick' | 'axe' | 'sword' | 'hammer' | 'wall';
    pwr?: number; // Tool power
    dmg?: number; // Weapon damage
    interact?: number; // 1 if interactable
    consumable?: number;
    light?: number; // Light emission radius
    defense?: number;
    type?: 'armor' | 'accessory' | 'material' | 'block' | 'wall';
    slot?: number; // 0: head, 1: body, 2: legs
    tint?: string; // CSS color string for tinting overlay
    bg?: boolean; // If true, drawn behind player
    placeWall?: number; // ID of wall this item places
}

export interface InventorySlot {
    id: number;
    n: number;
}

export interface Recipe {
    out: number;
    n: number;
    cost: Record<number, number>;
    req?: number; // Required station ID (block ID)
}

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    c: string;
    life: number;
}

export interface NPC {
    id: number; // unique id
    type: string; // 'guide', 'zombie', 'slime', 'demon_eye', 'merchant'
    aiStyle: 'fighter' | 'slime' | 'flying' | 'passive';
    x: number;
    y: number;
    w: number;
    h: number;
    vx: number;
    vy: number;
    face: number;
    hp: number;
    maxHp: number;
    walkFrame: number;
    ground?: boolean;
    knockback?: number;
    immune?: number;
    damage?: number;
    defense?: number;
}

export enum Biome {
    Forest,
    Snow,
    Desert
}
