const TILE = 32;
const CHUNK_W = 220;
const CHUNK_H = 100;
const GRAVITY = 0.42;
const TERM_VEL = 14;
const PLAYER_REACH = 180;

/* ======================== ITEM/BLOCK IDS ======================== */
const IDS = {
    AIR: 0,
    // Blocks
    DIRT: 1, STONE: 2, GRASS: 3, WOOD: 4, LEAVES: 5,
    PLANKS: 6, BRICK: 7, SAND: 8, BEDROCK: 99,

    // Ores
    ORE_COPPER: 20, ORE_IRON: 21, ORE_GOLD: 22,

    // Stations / Furniture
    WORKBENCH: 10, TORCH: 11, CHEST: 12, DOOR: 13,
    FURNACE: 14, ANVIL: 15,

    // Tools - Wood
    PICK_WOOD: 100, AXE_WOOD: 101, SWORD_WOOD: 102,
    // Tools - Copper
    PICK_COPPER: 110, AXE_COPPER: 111, SWORD_COPPER: 112,
    // Tools - Iron
    PICK_IRON: 120, AXE_IRON: 121, SWORD_IRON: 122,
    // Tools - Gold
    PICK_GOLD: 130, AXE_GOLD: 131, SWORD_GOLD: 132,

    // Armor - Wood
    HELMET_WOOD: 150, CHEST_WOOD: 151, LEGS_WOOD: 152,
    // Armor - Copper
    HELMET_COPPER: 160, CHEST_COPPER: 161, LEGS_COPPER: 162,
    // Armor - Iron
    HELMET_IRON: 170, CHEST_IRON: 171, LEGS_IRON: 172,
    // Armor - Gold
    HELMET_GOLD: 180, CHEST_GOLD: 181, LEGS_GOLD: 182,

    // Materials / Misc
    GEL: 200, COIN: 201, POTION: 202, HEART: 203, STAR: 204,
    BAR_COPPER: 210, BAR_IRON: 211, BAR_GOLD: 212
};

/* ======================== PROPERTIES ======================== */
const PROPS = {
    // Blocks
    [IDS.DIRT]:  { c: '#5d4037', solid: 1, name: "Dirt", hardness: 1, icon: '🟫' },
    [IDS.STONE]: { c: '#78909c', solid: 1, name: "Stone", hardness: 2, icon: '🌑' },
    [IDS.GRASS]: { c: '#558b2f', solid: 1, name: "Grass Block", hardness: 1, icon: '🟩' },
    [IDS.WOOD]:  { c: '#6d4c41', solid: 1, name: "Wood", hardness: 2, icon: '🪵' },
    [IDS.LEAVES]:{ c: '#33691e', solid: 0, name: "Leaves", hardness: 1, icon: '🍃' },
    [IDS.PLANKS]:{ c: '#8d6e63', solid: 1, name: "Wood Planks", hardness: 2, icon: '🛖' },
    [IDS.BRICK]: { c: '#546e7a', solid: 1, name: "Gray Brick", hardness: 3, icon: '🧱' },
    [IDS.SAND]:  { c: '#fdd835', solid: 1, name: "Sand", hardness: 1, icon: '🟨' },
    [IDS.BEDROCK]:{ c: '#212121', solid: 1, name: "Bedrock", hardness: 999, icon: '⬛' },

    // Ores
    [IDS.ORE_COPPER]: { c: '#e78a61', solid: 1, name: "Copper Ore", hardness: 2, icon: '🟠' },
    [IDS.ORE_IRON]:   { c: '#a19d94', solid: 1, name: "Iron Ore", hardness: 3, icon: '⚪' },
    [IDS.ORE_GOLD]:   { c: '#ffeb3b', solid: 1, name: "Gold Ore", hardness: 3, icon: '🟡' },

    // Stations
    [IDS.WORKBENCH]: { c: '#a1887f', solid: 0, interact: 1, name: "Work Bench", icon: '🛠️' },
    [IDS.FURNACE]:   { c: '#757575', solid: 0, interact: 1, name: "Furnace", icon: '♨️' },
    [IDS.ANVIL]:     { c: '#546e7a', solid: 0, interact: 1, name: "Iron Anvil", icon: '⚓' },
    [IDS.TORCH]:     { c: '#ffeb3b', solid: 0, light: 10, name: "Torch", icon: '🔥' },
    [IDS.CHEST]:     { c: '#ff8f00', solid: 0, interact: 1, name: "Chest", icon: '📦' },
    [IDS.DOOR]:      { c: '#795548', solid: 0, interact: 1, name: "Door", icon: '🚪' },

    // Tools - Wood
    [IDS.PICK_WOOD]:  { c: '#a1887f', tool: 'pick', pwr: 2, name: "Wooden Pickaxe", icon: '⛏️' },
    [IDS.AXE_WOOD]:   { c: '#a1887f', tool: 'axe', pwr: 2, name: "Wooden Axe", icon: '🪓' },
    [IDS.SWORD_WOOD]: { c: '#bcaaa4', tool: 'sword', dmg: 7, name: "Wooden Sword", icon: '🗡️' },

    // Tools - Copper
    [IDS.PICK_COPPER]:  { c: '#e78a61', tool: 'pick', pwr: 3, name: "Copper Pickaxe", icon: '⛏️' },
    [IDS.AXE_COPPER]:   { c: '#e78a61', tool: 'axe', pwr: 3, name: "Copper Axe", icon: '🪓' },
    [IDS.SWORD_COPPER]: { c: '#e78a61', tool: 'sword', dmg: 9, name: "Copper Broadsword", icon: '🗡️' },

    // Tools - Iron
    [IDS.PICK_IRON]:  { c: '#cfd8dc', tool: 'pick', pwr: 5, name: "Iron Pickaxe", icon: '⛏️' },
    [IDS.AXE_IRON]:   { c: '#cfd8dc', tool: 'axe', pwr: 5, name: "Iron Axe", icon: '🪓' },
    [IDS.SWORD_IRON]: { c: '#cfd8dc', tool: 'sword', dmg: 14, name: "Iron Broadsword", icon: '🗡️' },

    // Tools - Gold
    [IDS.PICK_GOLD]:  { c: '#fff176', tool: 'pick', pwr: 7, name: "Gold Pickaxe", icon: '⛏️' },
    [IDS.AXE_GOLD]:   { c: '#fff176', tool: 'axe', pwr: 7, name: "Gold Axe", icon: '🪓' },
    [IDS.SWORD_GOLD]: { c: '#fff176', tool: 'sword', dmg: 18, name: "Gold Broadsword", icon: '🗡️' },

    // Armor - Wood
    [IDS.HELMET_WOOD]: { c: '#8d6e63', type: 'armor', slot: 0, defense: 1, name: "Wood Helmet", icon: '🧢' },
    [IDS.CHEST_WOOD]:  { c: '#8d6e63', type: 'armor', slot: 1, defense: 1, name: "Wood Breastplate", icon: '👕' },
    [IDS.LEGS_WOOD]:   { c: '#8d6e63', type: 'armor', slot: 2, defense: 1, name: "Wood Greaves", icon: '👖' },

    // Armor - Copper
    [IDS.HELMET_COPPER]: { c: '#e78a61', type: 'armor', slot: 0, defense: 2, name: "Copper Helmet", icon: '🧢' },
    [IDS.CHEST_COPPER]:  { c: '#e78a61', type: 'armor', slot: 1, defense: 2, name: "Copper Chainmail", icon: '👕' },
    [IDS.LEGS_COPPER]:   { c: '#e78a61', type: 'armor', slot: 2, defense: 2, name: "Copper Greaves", icon: '👖' },

    // Armor - Iron
    [IDS.HELMET_IRON]: { c: '#90a4ae', type: 'armor', slot: 0, defense: 3, name: "Iron Helmet", icon: '🪖' },
    [IDS.CHEST_IRON]:  { c: '#90a4ae', type: 'armor', slot: 1, defense: 4, name: "Iron Chainmail", icon: '🥋' },
    [IDS.LEGS_IRON]:   { c: '#90a4ae', type: 'armor', slot: 2, defense: 3, name: "Iron Greaves", icon: '👖' },

    // Materials
    [IDS.GEL]:    { c: '#42a5f5', name: "Gel", icon: '💧' },
    [IDS.COIN]:   { c: '#ffd700', name: "Gold Coin", icon: '🪙' },
    [IDS.POTION]: { c: '#e53935', name: "Health Potion", consumable: 1, icon: '🧪' },
    [IDS.HEART]:  { c: '#f44336', name: "Heart", icon: '❤️' },
    [IDS.STAR]:   { c: '#7e57c2', name: "Fallen Star", icon: '⭐' },

    [IDS.BAR_COPPER]: { c: '#e78a61', name: "Copper Bar", icon: '🟧' },
    [IDS.BAR_IRON]:   { c: '#b0bec5', name: "Iron Bar", icon: '⬜' },
    [IDS.BAR_GOLD]:   { c: '#fbc02d', name: "Gold Bar", icon: '🟨' }
};

/* ======================== RECIPES ======================== */
// req: 10=Workbench, 14=Furnace, 15=Anvil
const RECIPES = [
    // Basics
    { out: IDS.WORKBENCH, n: 1, cost: { [IDS.WOOD]: 10 }, desc: "Crafting station" },
    { out: IDS.TORCH, n: 3, cost: { [IDS.WOOD]: 1, [IDS.GEL]: 1 }, desc: "Provides light" },
    { out: IDS.PLANKS, n: 1, cost: { [IDS.WOOD]: 1 }, desc: "Building material" },
    { out: IDS.FURNACE, n: 1, cost: { [IDS.STONE]: 20, [IDS.WOOD]: 4, [IDS.TORCH]: 3 }, req: IDS.WORKBENCH, desc: "Smelts ore" },
    { out: IDS.ANVIL, n: 1, cost: { [IDS.BAR_IRON]: 5 }, req: IDS.WORKBENCH, desc: "Crafts metal items" },

    // Smelting (Furnace)
    { out: IDS.BAR_COPPER, n: 1, cost: { [IDS.ORE_COPPER]: 3 }, req: IDS.FURNACE, desc: "Smelt ore" },
    { out: IDS.BAR_IRON, n: 1, cost: { [IDS.ORE_IRON]: 3 }, req: IDS.FURNACE, desc: "Smelt ore" },
    { out: IDS.BAR_GOLD, n: 1, cost: { [IDS.ORE_GOLD]: 3 }, req: IDS.FURNACE, desc: "Smelt ore" },
    { out: IDS.BRICK, n: 1, cost: { [IDS.STONE]: 2 }, req: IDS.FURNACE, desc: "Construction" },

    // Wood Gear
    { out: IDS.SWORD_WOOD, n: 1, cost: { [IDS.WOOD]: 7 }, req: IDS.WORKBENCH },
    { out: IDS.PICK_WOOD, n: 1, cost: { [IDS.WOOD]: 10 }, req: IDS.WORKBENCH },
    { out: IDS.AXE_WOOD, n: 1, cost: { [IDS.WOOD]: 9 }, req: IDS.WORKBENCH },
    { out: IDS.HELMET_WOOD, n: 1, cost: { [IDS.WOOD]: 20 }, req: IDS.WORKBENCH },
    { out: IDS.CHEST_WOOD, n: 1, cost: { [IDS.WOOD]: 30 }, req: IDS.WORKBENCH },
    { out: IDS.LEGS_WOOD, n: 1, cost: { [IDS.WOOD]: 25 }, req: IDS.WORKBENCH },

    // Copper Gear (Anvil)
    { out: IDS.SWORD_COPPER, n: 1, cost: { [IDS.BAR_COPPER]: 8 }, req: IDS.ANVIL },
    { out: IDS.PICK_COPPER, n: 1, cost: { [IDS.BAR_COPPER]: 12 }, req: IDS.ANVIL },
    { out: IDS.AXE_COPPER, n: 1, cost: { [IDS.BAR_COPPER]: 9 }, req: IDS.ANVIL },
    { out: IDS.HELMET_COPPER, n: 1, cost: { [IDS.BAR_COPPER]: 15 }, req: IDS.ANVIL },
    { out: IDS.CHEST_COPPER, n: 1, cost: { [IDS.BAR_COPPER]: 25 }, req: IDS.ANVIL },
    { out: IDS.LEGS_COPPER, n: 1, cost: { [IDS.BAR_COPPER]: 20 }, req: IDS.ANVIL },

    // Iron Gear (Anvil)
    { out: IDS.SWORD_IRON, n: 1, cost: { [IDS.BAR_IRON]: 8 }, req: IDS.ANVIL },
    { out: IDS.PICK_IRON, n: 1, cost: { [IDS.BAR_IRON]: 12 }, req: IDS.ANVIL },
    { out: IDS.AXE_IRON, n: 1, cost: { [IDS.BAR_IRON]: 9 }, req: IDS.ANVIL },
    { out: IDS.HELMET_IRON, n: 1, cost: { [IDS.BAR_IRON]: 20 }, req: IDS.ANVIL },
    { out: IDS.CHEST_IRON, n: 1, cost: { [IDS.BAR_IRON]: 30 }, req: IDS.ANVIL },
    { out: IDS.LEGS_IRON, n: 1, cost: { [IDS.BAR_IRON]: 25 }, req: IDS.ANVIL },

    // Misc
    { out: IDS.CHEST, n: 1, cost: { [IDS.WOOD]: 8, [IDS.BAR_IRON]: 2 }, req: IDS.WORKBENCH },
    { out: IDS.DOOR, n: 1, cost: { [IDS.WOOD]: 6 }, req: IDS.WORKBENCH },
    { out: IDS.POTION, n: 1, cost: { [IDS.GEL]: 2, [IDS.HEART]: 1 }, req: IDS.WORKBENCH }
];
