
export interface Modifier {
    id: number;
    name: string;
    dmg?: number; // 1.15 = +15%
    speed?: number; // 1.1 = +10% speed
    crit?: number; // +5 flat
    def?: number; // +4 flat
    knockback?: number; // 1.1
    scale?: number; // 1.1
}

export const MODIFIERS: Record<number, Modifier> = {
    // Universal / Common
    1: { id: 1, name: "Large", scale: 1.15 },
    2: { id: 2, name: "Massive", scale: 1.25 },
    3: { id: 3, name: "Dangerous", dmg: 1.05, crit: 2 },
    4: { id: 4, name: "Savage", dmg: 1.1, knockback: 1.1 },
    5: { id: 5, name: "Sharp", dmg: 1.15 },
    6: { id: 6, name: "Pointy", dmg: 1.1 },
    7: { id: 7, name: "Tiny", scale: 0.8 },
    8: { id: 8, name: "Terrible", dmg: 0.85, knockback: 0.85 },
    9: { id: 9, name: "Small", scale: 0.9 },
    10: { id: 10, name: "Dull", dmg: 0.85 },
    11: { id: 11, name: "Unhappy", speed: 0.9, scale: 0.9 },
    12: { id: 12, name: "Bulky", dmg: 1.05, scale: 1.1, speed: 0.85 },
    13: { id: 13, name: "Shameful", dmg: 0.9, scale: 1.1, knockback: 0.8 },
    14: { id: 14, name: "Heavy", dmg: 1.1, speed: 0.9, knockback: 1.1 },
    15: { id: 15, name: "Light", speed: 1.15, knockback: 0.9 },
    
    // Best Weapons
    16: { id: 16, name: "Legendary", dmg: 1.15, speed: 1.1, crit: 5, scale: 1.1, knockback: 1.15 }, // Melee best
    17: { id: 17, name: "Godly", dmg: 1.15, crit: 5, knockback: 1.15 }, // General good
    18: { id: 18, name: "Demonic", dmg: 1.15, crit: 5 },
    19: { id: 19, name: "Unreal", dmg: 1.15, speed: 1.1, crit: 5, knockback: 1.15 }, // Ranged best (simplified)
    20: { id: 20, name: "Mythical", dmg: 1.15, speed: 1.1, crit: 5, knockback: 1.15 }, // Magic best (simplified)

    // Common Bad
    21: { id: 21, name: "Broken", dmg: 0.7, knockback: 0.8 },
    22: { id: 22, name: "Damaged", dmg: 0.85 },
    23: { id: 23, name: "Shoddy", dmg: 0.9, knockback: 0.85 },
    24: { id: 24, name: "Slow", speed: 0.85 },
    25: { id: 25, name: "Sluggish", speed: 0.8 },
    26: { id: 26, name: "Lazy", speed: 0.9 },

    // Accessory
    27: { id: 27, name: "Hard", def: 1 },
    28: { id: 28, name: "Guarding", def: 2 },
    29: { id: 29, name: "Armored", def: 3 },
    30: { id: 30, name: "Warding", def: 4 },
    31: { id: 31, name: "Precise", crit: 2 },
    32: { id: 32, name: "Lucky", crit: 4 },
    33: { id: 33, name: "Jagged", dmg: 1.01 },
    34: { id: 34, name: "Spiked", dmg: 1.02 },
    35: { id: 35, name: "Angry", dmg: 1.03 },
    36: { id: 36, name: "Menacing", dmg: 1.04 },
    37: { id: 37, name: "Brisk", speed: 1.01 },
    38: { id: 38, name: "Fleeting", speed: 1.02 },
    39: { id: 39, name: "Hasty", speed: 1.03 },
    40: { id: 40, name: "Quick", speed: 1.04 },
};

export const getRandomModifier = (type: 'melee' | 'ranged' | 'magic' | 'accessory' | 'universal'): number | undefined => {
    // 25% chance to have no modifier
    if (Math.random() < 0.25) return undefined;

    let pool: number[] = [];

    if (type === 'accessory') {
        pool = [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40];
    } else {
        // Weapons
        pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 21, 22, 23, 24, 25, 26];
        if (type === 'melee') pool.push(16);
        if (type === 'ranged') pool.push(19);
        if (type === 'magic') pool.push(20);
    }

    return pool[Math.floor(Math.random() * pool.length)];
};
