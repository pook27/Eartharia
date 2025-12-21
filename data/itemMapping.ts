import { ItemProp } from '../types';

// --- Material Colors & Tiers ---
const MATERIALS: Record<string, { c: string, pwr: number, dmg: number }> = {
    "Wood": { c: '#8d6e63', pwr: 2, dmg: 5 },
    "Rich Mahogany": { c: '#d50000', pwr: 2, dmg: 6 },
    "Ebonwood": { c: '#7b1fa2', pwr: 2, dmg: 7 },
    "Shadewood": { c: '#546e7a', pwr: 2, dmg: 7 },
    "Pearlwood": { c: '#fff9c4', pwr: 2, dmg: 8 },
    "Boreal Wood": { c: '#5d4037', pwr: 2, dmg: 6 },
    "Palm Wood": { c: '#e65100', pwr: 2, dmg: 6 },
    "Cactus": { c: '#43a047', pwr: 2, dmg: 5 },
    "Copper": { c: '#e67e22', pwr: 3, dmg: 8 },
    "Tin": { c: '#cdcfd1', pwr: 3, dmg: 9 },
    "Iron": { c: '#95a5a6', pwr: 4, dmg: 10 },
    "Lead": { c: '#34495e', pwr: 4, dmg: 11 },
    "Silver": { c: '#ecf0f1', pwr: 5, dmg: 12 },
    "Tungsten": { c: '#bdc3c7', pwr: 5, dmg: 13 },
    "Gold": { c: '#f1c40f', pwr: 6, dmg: 14 },
    "Platinum": { c: '#d5dbdb', pwr: 6, dmg: 15 },
    "Demonite": { c: '#8e44ad', pwr: 7, dmg: 18 },
    "Crimtane": { c: '#c0392b', pwr: 7, dmg: 19 },
    "Meteorite": { c: '#e74c3c', pwr: 8, dmg: 20 },
    "Hellstone": { c: '#c0392b', pwr: 9, dmg: 25 },
    "Cobalt": { c: '#2980b9', pwr: 10, dmg: 28 },
    "Palladium": { c: '#e67e22', pwr: 10, dmg: 29 },
    "Mythril": { c: '#2ecc71', pwr: 11, dmg: 32 },
    "Orichalcum": { c: '#e056fd', pwr: 11, dmg: 33 },
    "Adamantite": { c: '#e74c3c', pwr: 12, dmg: 36 },
    "Titanium": { c: '#95a5a6', pwr: 12, dmg: 37 },
    "Chlorophyte": { c: '#27ae60', pwr: 13, dmg: 45 },
};

export const mapItemProperties = (id: number, name: string): ItemProp => {
    const prop: ItemProp = {
        id,
        name,
        c: '#fff',
        icon: '❓',
        solid: 0,
        type: 'material'
    };

    const lowerName = name.toLowerCase();
    
    let mat = { c: '#aaa', pwr: 2, dmg: 5 };
    for (const [mName, mData] of Object.entries(MATERIALS)) {
        if (name.includes(mName)) {
            mat = mData;
            prop.c = mat.c;
            break;
        }
    }

    // Tools & Weapons
    if (lowerName.includes("pickaxe") || lowerName.includes("drill")) {
        prop.tool = 'pick';
        prop.pwr = mat.pwr;
        prop.icon = '⛏️';
    } else if (lowerName.includes("axe") || lowerName.includes("chainsaw") || lowerName.includes("hamaxe")) {
        prop.tool = 'axe';
        prop.pwr = mat.pwr;
        prop.icon = '🪓';
    } else if (lowerName.includes("hammer")) {
        prop.tool = 'hammer';
        prop.pwr = mat.pwr;
        prop.icon = '🔨';
    } else if (lowerName.includes("sword") || lowerName.includes("blade") || lowerName.includes("saber")) {
        prop.tool = 'sword';
        prop.dmg = mat.dmg;
        prop.icon = '🗡️';
    } else if (lowerName.includes("bow") && !lowerName.includes("bowl")) {
        prop.dmg = mat.dmg;
        prop.icon = '🏹';
    } else if (lowerName.includes("arrow")) {
        prop.dmg = mat.dmg;
        prop.icon = '🏹';
    } 
    
    // Armor
    else if (lowerName.includes("helmet") || lowerName.includes("mask") || lowerName.includes("hood") || lowerName.includes("hat") || lowerName.includes("cap") || lowerName.includes("headgear")) {
        prop.type = 'armor';
        prop.slot = 0;
        prop.defense = mat.pwr || 1;
        prop.icon = '🧢';
        prop.tint = mat.c;
    } else if (lowerName.includes("breastplate") || lowerName.includes("shirt") || lowerName.includes("coat") || lowerName.includes("mail") || lowerName.includes("robe") || lowerName.includes("tunic")) {
        prop.type = 'armor';
        prop.slot = 1;
        prop.defense = (mat.pwr || 1) + 1;
        prop.icon = '👕';
        prop.tint = mat.c;
    } else if (lowerName.includes("leggings") || lowerName.includes("greaves") || lowerName.includes("pants") || lowerName.includes("boots")) {
        prop.type = 'armor';
        prop.slot = 2;
        prop.defense = mat.pwr || 1;
        prop.icon = '👖';
        prop.tint = mat.c;
    }

    // Blocks & Furniture
    else if (lowerName.includes("platform")) {
        prop.solid = 0;
        prop.icon = '🪜'; 
        prop.tint = mat.c; 
        prop.type = 'block';
    } else if (lowerName.includes("wall") && !lowerName.includes("place")) {
        prop.type = 'wall';
        prop.icon = '🏽';
        prop.tint = mat.c;
        prop.placeWall = id;
    } else if (lowerName.includes("ore")) {
        prop.solid = 1;
        prop.hardness = mat.pwr;
        prop.icon = '🌑'; 
        prop.tint = mat.c; 
        prop.c = mat.c; 
        prop.type = 'block';
    } else if (lowerName.includes("block") || lowerName.includes("brick") || lowerName.includes("stone") || lowerName.includes("dirt") || lowerName.includes("mud") || lowerName.includes("sand") || lowerName.includes("clay") || lowerName.includes("wood") || lowerName.includes("plank")) {
        if(!lowerName.includes("sword") && prop.type === 'material') { 
            prop.solid = 1;
            prop.hardness = 2;
            prop.icon = '🟫'; 
            prop.c = mat.c;
            prop.type = 'block';
            
            if(lowerName.includes("stone")) prop.icon = '🌑';
            if(lowerName.includes("brick")) prop.icon = '🧱';
            if(lowerName.includes("wood")) { prop.icon = '🪵'; prop.tint = mat.c; }
            if(lowerName.includes("sand")) { prop.icon = '🟨'; prop.c = '#fdd835'; }
            if(lowerName.includes("snow")) { prop.icon = '⬜'; prop.c = '#fff'; }
            if(lowerName.includes("ice")) { prop.icon = '🧊'; prop.c = '#b2ebf2'; }
        }
    } else if (lowerName.includes("torch")) {
        prop.solid = 0;
        prop.light = 15;
        prop.icon = '🔥';
        prop.bg = true;
        if(lowerName.includes("ice")) prop.c = '#00ffff';
    } else if (lowerName.includes("chest") && !lowerName.includes("plate")) {
            prop.solid = 0;
            prop.icon = '🧳';
            prop.c = mat.c;
            prop.interact = 1;
    } else if (lowerName.includes("bench")) {
        prop.solid = 0;
        prop.icon = '🪑';
        prop.c = mat.c;
        prop.type = 'block';
    } else if (lowerName.includes("anvil")) {
        prop.solid = 0;
        prop.icon = '🛡️';
        prop.c = '#555';
        prop.type = 'block';
    } else if (lowerName.includes("furnace") || lowerName.includes("forge")) {
        prop.solid = 0;
        prop.icon = '♨️';
        prop.c = '#444';
        prop.type = 'block';
    } else if (lowerName.includes("camp fire") || lowerName.includes("campfire")) {
        prop.solid = 0;
        prop.icon = '🪔';
        prop.c = '#444';
        prop.type = 'block';
    }

    if (lowerName.includes("coin")) {
        prop.icon = '🪙';
    }
    if (lowerName.includes("star") && !lowerName.includes("statue")) {
        prop.icon = '⭐';
    }
    if (lowerName.includes("heart") && !lowerName.includes("statue")) {
        prop.icon = '❤️';
    }
    if (lowerName.includes("bullet") || lowerName.includes("shot")) {
        prop.icon = '⚫';
    }
    if (lowerName.includes("gel")) {
        prop.icon = '💧';
    }
    
    return prop;
};
