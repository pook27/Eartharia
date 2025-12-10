const TILE = 32;
const CHUNK_W = 220;
const CHUNK_H = 100;
const GRAVITY = 0.42;
const TERM_VEL = 14;
const PLAYER_REACH = 180;

const IDS = { AIR: 0 };
const PROPS = {};
const RECIPES = [];

/* ================= MANUAL PROPERTY DEFINITIONS =================
   These provide game logic (physics, colors, stats) to the raw IDs loaded from JSON.
   Keys MUST match the "name" field in items.json exactly.
*/
const ITEM_DEFINITIONS = {
    // --- Terrain ---
    "Dirt Block": { c: '#5d4037', solid: 1, hardness: 1, icon: '🟫' },
    "Stone Block": { c: '#78909c', solid: 1, hardness: 2, icon: '🌑' },
    "Clay Block": { c: '#bcaaa4', solid: 1, hardness: 1, icon: '🧱' },
    "Sand Block": { c: '#fdd835', solid: 1, hardness: 1, icon: '🟨' },
    "Mud Block":  { c: '#5d4037', solid: 1, hardness: 1, icon: '🏾' },
    "Wood":       { c: '#6d4c41', solid: 1, hardness: 2, icon: '🪵' },
    "Gray Brick": { c: '#546e7a', solid: 1, hardness: 3, icon: '🧱' },
    "Red Brick":  { c: '#d32f2f', solid: 1, hardness: 3, icon: '🧱' },

    // --- Ores ---
    "Copper Ore": { c: '#e78a61', solid: 1, hardness: 2, icon: '🟠' },
    "Iron Ore":   { c: '#a19d94', solid: 1, hardness: 3, icon: '⚪' },
    "Silver Ore": { c: '#e0e0e0', solid: 1, hardness: 3, icon: '⚪' },
    "Gold Ore":   { c: '#ffeb3b', solid: 1, hardness: 3, icon: '🟡' },
    "Demonite Ore":{ c: '#7b1fa2', solid: 1, hardness: 4, icon: '🟣' },

    // --- Stations / Furniture ---
    "Work Bench": { c: '#a1887f', solid: 0, interact: 1, icon: '🛠️' },
    "Furnace":    { c: '#757575', solid: 0, interact: 1, icon: '♨️' },
    "Iron Anvil": { c: '#546e7a', solid: 0, interact: 1, icon: '⚓' },
    "Chest":      { c: '#ff8f00', solid: 0, interact: 1, icon: '📦' },
    "Torch":      { c: '#ffeb3b', solid: 0, light: 10, icon: '🔥' },
    "Wooden Door":{ c: '#795548', solid: 0, interact: 1, icon: '🚪' },
    "Sunflower":  { c: '#ffeb3b', solid: 0, icon: '🌻' },

    // --- Tools: Copper (Starter) ---
    "Copper Pickaxe":    { c: '#e78a61', tool: 'pick', pwr: 3, icon: '⛏️' },
    "Copper Axe":        { c: '#e78a61', tool: 'axe', pwr: 3, icon: '🪓' },
    "Copper Shortsword": { c: '#e78a61', tool: 'sword', dmg: 5, icon: '🗡️' },
    "Copper Broadsword": { c: '#e78a61', tool: 'sword', dmg: 8, icon: '🗡️' },

    // --- Tools: Iron ---
    "Iron Pickaxe":    { c: '#cfd8dc', tool: 'pick', pwr: 5, icon: '⛏️' },
    "Iron Axe":        { c: '#cfd8dc', tool: 'axe', pwr: 5, icon: '🪓' },
    "Iron Broadsword": { c: '#cfd8dc', tool: 'sword', dmg: 10, icon: '🗡️' },

    // --- Tools: Silver/Gold ---
    "Silver Pickaxe":  { c: '#e0e0e0', tool: 'pick', pwr: 6, icon: '⛏️' },
    "Gold Pickaxe":    { c: '#ffeb3b', tool: 'pick', pwr: 8, icon: '⛏️' },

    // --- Materials / Drops ---
    "Gel":         { c: '#42a5f5', icon: '💧' },
    "Lens":        { c: '#424242', icon: '👁️' },
    "Fallen Star": { c: '#7e57c2', icon: '⭐' },
    "Copper Coin": { c: '#bcaaa4', icon: '🪙' },
    "Silver Coin": { c: '#e0e0e0', icon: '🪙' },
    "Gold Coin":   { c: '#ffd700', icon: '🪙' },
    "Heart":       { c: '#f44336', icon: '❤️' }, // If dropping hearts as items

    // --- Bars ---
    "Copper Bar": { c: '#e78a61', icon: '🟧' },
    "Iron Bar":   { c: '#b0bec5', icon: '⬜' },
    "Silver Bar": { c: '#e0e0e0', icon: '⬜' },
    "Gold Bar":   { c: '#fbc02d', icon: '🟨' },

    // --- Consumables ---
    "Mushroom": { c: '#ffe0b2', consumable: 1, icon: '🍄' },
    "Lesser Healing Potion": { c: '#e53935', consumable: 1, icon: '🧪' },
};

/* ======================== ASYNC INITIALIZER ======================== */
async function initGameData() {
    console.log("Loading game data...");

    try {
        const [itemsRaw, recipesRaw, tablesRaw] = await Promise.all([
            fetch('./json/items.json').then(r => r.json()),
            fetch('./json/recipes.json').then(r => r.json()),
            fetch('./json/tables.json').then(r => r.json())
        ]);

        // 1. Process Items -> Populate IDS and PROPS from JSON
        itemsRaw.forEach(item => {
            const id = parseInt(item.id);
            const name = item.name;
            // Create CONSTANT_CASE key: "Iron Pickaxe" -> "IRON_PICKAXE"
            const key = name.toUpperCase().replace(/ /g, '_').replace(/[']/g, '');

            IDS[key] = id;

            PROPS[id] = {
                id: id,
                name: name,
                c: '#ffffff', // Default
                icon: '❓'
            };

            // Merge stats if defined manually
            if (ITEM_DEFINITIONS[name]) {
                Object.assign(PROPS[id], ITEM_DEFINITIONS[name]);
            }
        });

        // 2. Process Recipes
        const tableIdToName = {};
        tablesRaw.forEach(t => tableIdToName[t.id] = t.name);

        recipesRaw.forEach(r => {
            const outId = parseInt(r.name);
            const quantity = parseInt(r.quantity) || 1;
            const cost = {};
            for(let i=1; i<=6; i++) {
                const ingId = r[`ingredient${i}`];
                const amt = r[`amount${i}`];
                if(ingId) cost[parseInt(ingId)] = parseInt(amt);
            }
            let req = null;
            if (r.table && tableIdToName[r.table]) {
                const tableName = tableIdToName[r.table];
                // Map table Name to Item ID (e.g. "Work Bench" -> IDS.WORK_BENCH)
                const stationKey = tableName.toUpperCase().replace(/ /g, '_');
                if (IDS[stationKey]) req = IDS[stationKey];
            }
            RECIPES.push({ out: outId, n: quantity, cost: cost, req: req });
        });

        console.log("Data loaded!", { IDS_COUNT: Object.keys(IDS).length });
        return true;

    } catch (e) {
        console.error("Failed to load data:", e);
        return false;
    }
}
