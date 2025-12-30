
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
    "Ebonstone": { c: '#7b1fa2', pwr: 2, dmg: 7 },
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
    // Initial prop with undefined color to avoid solid backgrounds on non-blocks
    const prop: ItemProp = {
        id,
        name,
        c: undefined as any, 
        icon: '❓',
        solid: 0,
        type: 'material',
        value: 0
    };

    // Skip mapping for internal system IDs if they come through here (unlikely but safe)
    if (id >= 9000) return prop;

    const lowerName = name.toLowerCase();
    
    let mat = { c: '#aaa', pwr: 2, dmg: 5 };
    let hasMaterial = false;

    for (const [mName, mData] of Object.entries(MATERIALS)) {
        if (name.includes(mName)) {
            mat = mData;
            hasMaterial = true;
            break;
        }
    }
    
    // Base value heuristic
    prop.value = (mat.pwr || 1) * 50;

    // Tools & Weapons
    if (lowerName.includes("pickaxe") || lowerName.includes("drill")) {
        prop.tool = 'pick';
        prop.pwr = mat.pwr;
        prop.icon = '⛏️';
        prop.tint = mat.c; // Tint icon
        prop.value = (mat.pwr || 1) * 500;
    } else if (lowerName.includes("axe") || lowerName.includes("chainsaw") || lowerName.includes("hamaxe")) {
        prop.tool = 'axe';
        prop.pwr = mat.pwr;
        prop.icon = '🪓';
        prop.tint = mat.c;
        prop.value = (mat.pwr || 1) * 400;
    } else if (lowerName.includes("hammer")) {
        prop.tool = 'hammer';
        prop.pwr = mat.pwr;
        prop.icon = '🔨';
        prop.tint = mat.c;
        prop.value = (mat.pwr || 1) * 400;
    } else if (lowerName.includes("sword") || lowerName.includes("blade") || lowerName.includes("saber")) {
        prop.tool = 'sword';
        prop.dmg = mat.dmg;
        prop.icon = '🗡️';
        prop.tint = mat.c;
        prop.value = (mat.dmg || 5) * 100;
    } else if (lowerName.includes("bow") && !lowerName.includes("bowl")) {
        prop.dmg = mat.dmg;
        prop.icon = '🏹';
        prop.tint = mat.c;
        prop.value = (mat.dmg || 5) * 80;
    } else if (lowerName.includes("arrow")) {
        prop.dmg = mat.dmg;
        prop.icon = '🏹';
        prop.value = 5;
        prop.ammo = true;
    } 
    
    // Armor
    else if (lowerName.includes("helmet") || lowerName.includes("mask") || lowerName.includes("hood") || lowerName.includes("hat") || lowerName.includes("cap") || lowerName.includes("headgear")) {
        prop.type = 'armor';
        prop.slot = 0;
        prop.defense = mat.pwr || 1;
        prop.icon = '🧢';
        prop.tint = mat.c;
        prop.value = (mat.pwr || 1) * 1000;
        if(lowerName.includes("mining")) prop.value = 5000; 
    } else if (lowerName.includes("breastplate") || lowerName.includes("shirt") || lowerName.includes("coat") || lowerName.includes("mail") || lowerName.includes("robe") || lowerName.includes("tunic")) {
        prop.type = 'armor';
        prop.slot = 1;
        prop.defense = (mat.pwr || 1) + 1;
        prop.icon = '👕';
        prop.tint = mat.c;
        prop.value = (mat.pwr || 1) * 1500;
    } else if (lowerName.includes("leggings") || lowerName.includes("greaves") || lowerName.includes("pants")) {
        prop.type = 'armor';
        prop.slot = 2;
        prop.defense = mat.pwr || 1;
        prop.icon = '👖';
        prop.tint = mat.c;
        prop.value = (mat.pwr || 1) * 1200;
    }

    // Blocks & Furniture
    else if (lowerName.includes("platform")) {
        prop.solid = 0;
        prop.icon = '🪜'; 
        prop.tint = mat.c; 
        prop.type = 'block';
        prop.value = 10;
    } else if (lowerName.includes("wall") && !lowerName.includes("place")) {
        prop.type = 'wall';
        prop.icon = '🏽';
        prop.value = 5;
        
        if (lowerName.includes("stone") || lowerName.includes("brick")) {
            prop.c = '#7d7d7d'; 
            if(hasMaterial) prop.tint = mat.c;
        } else if (lowerName.includes("wood") || lowerName.includes("plank")) {
            prop.c = '#6d4c41';
            if(hasMaterial) prop.tint = mat.c;
        } else {
             prop.c = mat.c || '#555';
        }
        prop.placeWall = id;

    } else if (lowerName.includes("bar")) {
        prop.solid = 1;
        prop.hardness = mat.pwr;
        prop.icon = '📏'; 
        prop.tint = mat.c; 
        // Bars have default icon color usually, but let's tint them
        prop.type = 'block';
        prop.value = (mat.pwr || 1) * 50;
    } else if (lowerName.includes("ore")) {
        prop.solid = 1;
        prop.hardness = mat.pwr;
        prop.icon = '🌑'; 
        prop.tint = mat.c; 
        prop.c = '#555'; // Dark gray base for ores
        prop.type = 'block';
        prop.value = (mat.pwr || 1) * 100;
    } else if (lowerName.includes("block") || lowerName.includes("brick") || lowerName.includes("stone") || lowerName.includes("dirt") || lowerName.includes("mud") || lowerName.includes("sand") || lowerName.includes("clay") || lowerName.includes("wood") || lowerName.includes("plank")) {
        if(!lowerName.includes("sword") && prop.type === 'material') { 
            prop.solid = 1;
            prop.hardness = 2;
            prop.type = 'block';
            prop.value = 1;
            
            // Define Base Appearance
            if (lowerName.includes("dirt")) {
                prop.c = '#5d4037'; // Dirt Brown
                prop.icon = '🟫';
            } else if (lowerName.includes("stone") || lowerName.includes("granite") || lowerName.includes("marble")) {
                prop.c = '#808080'; // Stone Gray
                prop.icon = '🪨';
                if(hasMaterial) prop.tint = mat.c;
            } else if (lowerName.includes("brick")) {
                prop.c = '#a0a0a0'; // Brick Gray
                prop.icon = '🧱';
                if(hasMaterial) prop.tint = mat.c;
            } else if (lowerName.includes("wood") || lowerName.includes("plank")) {
                prop.c = '#8d6e63'; // Wood Brown
                prop.icon = '🪵';
                if(hasMaterial) prop.tint = mat.c;
            } else if (lowerName.includes("sand")) {
                prop.c = '#fdd835'; // Sand Yellow
                prop.icon = '🟨';
                if(hasMaterial) prop.tint = mat.c; // For ebonsand etc
            } else if (lowerName.includes("mud")) {
                prop.c = '#5d4037'; 
                prop.icon = '🟫';
            } else if (lowerName.includes("snow")) {
                prop.c = '#fff';
                prop.icon = '⬜';
            } else if (lowerName.includes("ice")) {
                prop.c = '#b2ebf2';
                prop.icon = '🧊';
                if(hasMaterial) prop.tint = mat.c; // Pink ice etc
            } else {
                prop.c = mat.c || '#808080';
                prop.icon = '🟫';
            }
        }
    } else if (lowerName.includes("torch")) {
        prop.solid = 0;
        prop.light = 15;
        prop.icon = '🕯️';
        prop.bg = true;
        prop.type = 'block';
        prop.value = 10;
        prop.tint = mat.c;
        if(lowerName.includes("ice")) { prop.tint = '#00ffff'; }
        if(lowerName.includes("demon")) { prop.tint = '#7b1fa2'; }
    } else if (lowerName.includes("chest") && !lowerName.includes("plate")) {
            prop.solid = 0;
            prop.icon = '🧳';
            prop.tint = mat.c;
            prop.interact = 1;
            prop.type = 'block';
            prop.value = 1000;
    } else if (lowerName.includes("bench")) {
        prop.solid = 0;
        prop.icon = '🪑';
        prop.tint = mat.c;
        prop.type = 'block';
        prop.value = 300;
    } else if (lowerName.includes("chair")) {
        prop.solid = 0;
        prop.icon = '🪑';
        prop.tint = mat.c;
        prop.type = 'block';
        prop.value = 150;
    } else if (lowerName.includes("table")) {
        prop.solid = 0;
        prop.icon = '┬';
        prop.tint = mat.c;
        prop.type = 'block';
        prop.value = 200;
    } else if (lowerName.includes("anvil")) {
        prop.solid = 0;
        prop.icon = '🛡️';
        prop.c = '#555';
        prop.type = 'block';
        prop.value = 2000; // 20 Silver
    } else if (lowerName.includes("furnace") || lowerName.includes("forge")) {
        prop.solid = 0;
        prop.icon = '♨️';
        prop.c = '#444';
        prop.type = 'block';
        prop.value = 500;
    } else if (lowerName.includes("camp fire") || lowerName.includes("campfire")) {
        prop.solid = 0;
        prop.icon = '🪔';
        prop.type = 'block';
        prop.value = 200;
    } else if (lowerName.includes("corn")) {
        prop.icon = '🌰';
    } else if (lowerName.includes("ball")) {
         prop.icon = '🏐';
    }

    if (lowerName.includes("coin")) {
        prop.icon = '🪙';
        prop.coin = true;
        if (lowerName.includes("copper")) {
            prop.value = 1;
            prop.tint = '#e67e22';
        }
        if (lowerName.includes("silver")) {
            prop.value = 100;
            prop.tint = '#c0c0c0';
        }
        if (lowerName.includes("gold")) {
            prop.value = 10000;
            prop.tint = '#f1c40f';
        }
        if (lowerName.includes("platinum")) {
            prop.value = 1000000;
            prop.tint = '#a9cce3';
        }
    }
    if (lowerName.includes("star") && !lowerName.includes("statue")) {
        prop.icon = '⭐';
        prop.value = 50;
        prop.ammo = true;
    }
    if (lowerName.includes("heart") && !lowerName.includes("statue")) {
        prop.icon = '❤️';
    }
    if (lowerName.includes("bullet") || lowerName.includes("shot")) {
        prop.icon = '⚫';
        prop.value = 7;
        prop.ammo = true;
    }
    if (lowerName.includes("rocket") && !lowerName.includes("boots")) {
        prop.ammo = true;
    }
    if (lowerName.includes("gel")) {
        prop.icon = '💧';
        prop.value = 5;
        prop.ammo = true;
    }
    if (lowerName.includes("potion")) {
        prop.icon = '🧪';
        prop.value = 300;
    }
    if (lowerName.includes("dart") && !lowerName.includes("trap")) {
        prop.ammo = true;
    }
    if (lowerName.includes("solution") || lowerName.includes("flare") || lowerName.includes("stake") || lowerName.includes("nail") || lowerName.includes("snowball")) {
        prop.ammo = true;
    }
    
    return prop;
};
