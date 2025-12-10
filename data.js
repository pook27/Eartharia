const TILE = 16; // CHANGED: Smaller tiles = Bigger Field of View
const CHUNK_W = 400; // Increased width slightly to accommodate zooming out
const CHUNK_H = 200; // Increased height
const GRAVITY = 0.42;
const TERM_VEL = 14;
const PLAYER_REACH = 180;

const IDS = { AIR: 0 };
const PROPS = {};
const RECIPES = [];

/* ================= MANUAL PROPERTY DEFINITIONS =================
   Keys must match JSON "name" exactly.
*/
const ITEM_DEFINITIONS = {
    // Terrain
    "Dirt Block": { c: '#5d4037', solid: 1, hardness: 1, icon: '🟫' },
    "Stone Block": { c: '#78909c', solid: 1, hardness: 2, icon: '🌑' },
    "Clay Block": { c: '#bcaaa4', solid: 1, hardness: 1, icon: '🧱' },
    "Sand Block": { c: '#fdd835', solid: 1, hardness: 1, icon: '🟨' },
    "Mud Block":  { c: '#5d4037', solid: 1, hardness: 1, icon: '🏾' },
    "Wood":       { c: '#9f6a40', solid: 1, hardness: 2, icon: '🪵' },
    "Gray Brick": { c: '#546e7a', solid: 1, hardness: 3, icon: '🧱' },
    "Red Brick":  { c: '#d32f2f', solid: 1, hardness: 3, icon: '🧱' },

    // Ores
    "Copper Ore": { c: '#e78a61', solid: 1, hardness: 2, icon: '🟠' },
    "Iron Ore":   { c: '#a19d94', solid: 1, hardness: 3, icon: '⚪' },
    "Silver Ore": { c: '#e0e0e0', solid: 1, hardness: 3, icon: '⚪' },
    "Gold Ore":   { c: '#ffeb3b', solid: 1, hardness: 3, icon: '🟡' },
    "Demonite Ore":{ c: '#7b1fa2', solid: 1, hardness: 4, icon: '🟣' },

    // Stations
    "Work Bench": { c: '#a1887f', solid: 0, interact: 1, icon: '🛠️' },
    "Furnace":    { c: '#757575', solid: 0, interact: 1, icon: '♨️' },
    "Iron Anvil": { c: '#546e7a', solid: 0, interact: 1, icon: '⚓' },
    "Chest":      { c: '#ff8f00', solid: 0, interact: 1, icon: '📦' },
    "Torch":      { c: '#ffeb3b', solid: 0, light: 10, icon: '🔥' },
    "Wooden Door":{ c: '#795548', solid: 0, interact: 1, icon: '🚪' },
    "Sunflower":  { c: '#ffeb3b', solid: 0, icon: '🌻' },

    // Tools
    "Copper Pickaxe":    { c: '#e78a61', tool: 'pick', pwr: 3, icon: '⛏️' },
    "Copper Axe":        { c: '#e78a61', tool: 'axe', pwr: 3, icon: '🪓' },
    "Copper Shortsword": { c: '#e78a61', tool: 'sword', dmg: 5, icon: '🗡️' },
    "Copper Broadsword": { c: '#e78a61', tool: 'sword', dmg: 8, icon: '🗡️' },
    "Iron Pickaxe":      { c: '#cfd8dc', tool: 'pick', pwr: 5, icon: '⛏️' },
    "Iron Axe":          { c: '#cfd8dc', tool: 'axe', pwr: 5, icon: '🪓' },
    "Iron Broadsword":   { c: '#cfd8dc', tool: 'sword', dmg: 10, icon: '🗡️' },
    "Silver Pickaxe":    { c: '#e0e0e0', tool: 'pick', pwr: 6, icon: '⛏️' },
    "Gold Pickaxe":      { c: '#ffeb3b', tool: 'pick', pwr: 8, icon: '⛏️' },

    // Materials
    "Gel":         { c: '#42a5f5', icon: '💧' },
    "Lens":        { c: '#424242', icon: '👁️' },
    "Fallen Star": { c: '#7e57c2', icon: '⭐' },
    "Copper Coin": { c: '#bcaaa4', icon: '🪙' },
    "Silver Coin": { c: '#e0e0e0', icon: '🪙' },
    "Gold Coin":   { c: '#ffd700', icon: '🪙' },
    "Heart":       { c: '#f44336', icon: '❤️' },

    // Bars
    "Copper Bar": { c: '#e78a61', icon: '🟧' },
    "Iron Bar":   { c: '#b0bec5', icon: '⬜' },
    "Silver Bar": { c: '#e0e0e0', icon: '⬜' },
    "Gold Bar":   { c: '#fbc02d', icon: '🟨' },

    // Consumables
    "Mushroom": { c: '#ffe0b2', consumable: 1, icon: '🍄' },
    "Lesser Healing Potion": { c: '#e53935', consumable: 1, icon: '🧪' },
};

// Keyword mapping for automatic icon assignment
const ICON_RULES = [
    { key: "Mana Crystal", icon: "💠" },
    { key: "Heart Crystal", icon: "❣️" },
    { key: "Pickaxe", icon: "⛏️" },
    { key: "Axe", icon: "🪓" },
    { key: "Sword", icon: "🗡️" },
    { key: "Shortsword", icon: "🗡️" },
    { key: "Broadsword", icon: "🗡️" },
    { key: "Bow", icon: "🏹" },
    { key: "Gun", icon: "🔫" },
    { key: "Bullet", icon: "⚫" },
    { key: "Arrow", icon: "➹" },
    { key: "Helmet", icon: "🪖" },
    { key: "Mask", icon: "🎭" },
    { key: "Hood", icon: "🧢" },
    { key: "Breastplate", icon: "👕" },
    { key: "Shirt", icon: "👕" },
    { key: "Coat", icon: "🧥" },
    { key: "Leggings", icon: "👖" },
    { key: "Pants", icon: "👖" },
    { key: "Boots", icon: "👢" },
    { key: "Ore", icon: "🪨" },
    { key: "Bar", icon: "🧱" },
    { key: "Block", icon: "⬜" },
    { key: "Brick", icon: "🧱" },
    { key: "Wall", icon: "🧱" },
    { key: "Torch", icon: "🔥" },
    { key: "Chest", icon: "📦" },
    { key: "Work Bench", icon: "🛠️" },
    { key: "Table", icon: "🪑" },
    { key: "Chair", icon: "🪑" },
    { key: "Door", icon: "🚪" },
    { key: "Bed", icon: "🛏️" },
    { key: "Sofa", icon: "🛋️" },
    { key: "Bookcase", icon: "📚" },
    { key: "Piano", icon: "🎹" },
    { key: "Clock", icon: "🕰️" },
    { key: "Lantern", icon: "🏮" },
    { key: "Lamp", icon: "💡" },
    { key: "Candle", icon: "🕯️" },
    { key: "Candelabra", icon: "🕯️" },
    { key: "Banner", icon: "🏳️" },
    { key: "Trophy", icon: "🏆" },
    { key: "Music Box", icon: "🎵" },
    { key: "Bucket", icon: "🪣" },
    { key: "Potion", icon: "🧪" },
    { key: "Dye", icon: "🎨" },
    { key: "Paint", icon: "🖌️" },
    { key: "Seed", icon: "🌱" },
    { key: "Staff", icon: "🪄" },
    { key: "Wand", icon: "🪄" },
    { key: "Coin", icon: "🪙" },
    { key: "Soul", icon: "👻" },
    { key: "Wing", icon: "🕊️" },
    { key: "Platform", icon: "🪜" },
    { key: "Boulder", icon: "🪨" },
    { key: "Statue", icon: "🗿" },

];

/* ======================== ASYNC INITIALIZER ======================== */
async function initGameData() {
    console.log("Loading game data...");

    try {
        const [itemsRaw, recipesRaw, tablesRaw] = await Promise.all([
            fetch('./json/items.json').then(r => r.json()),
            fetch('./json/recipes.json').then(r => r.json()),
            fetch('./json/tables.json').then(r => r.json())
        ]);

        // 1. Process Items
        itemsRaw.forEach(item => {
            const id = parseInt(item.id);
            const name = item.name;
            const key = name.toUpperCase().replace(/ /g, '_').replace(/[']/g, '');

            IDS[key] = id;

            // Determine Icon based on rules if not manually defined
            let icon = '❓';
            if (ITEM_DEFINITIONS[name] && ITEM_DEFINITIONS[name].icon) {
                icon = ITEM_DEFINITIONS[name].icon;
            } else {
                for (const rule of ICON_RULES) {
                    if (name.includes(rule.key)) {
                        icon = rule.icon;
                        break;
                    }
                }
            }

            PROPS[id] = {
                id: id,
                name: name,
                c: '#ffffff',
                icon: icon
            };

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
                const stationKey = tableName.toUpperCase().replace(/ /g, '_');
                if (IDS[stationKey]) req = IDS[stationKey];
            }
            RECIPES.push({ out: outId, n: quantity, cost: cost, req: req });
        });

        IDS.LEAVES = 9002;
        PROPS[9002] = { name: "Leaves", c: '#33691e', solid: 0, hardness: 0, icon: '🍃' }; // Solid 0 for pass-through

        console.log("Data loaded!", { IDS_COUNT: Object.keys(IDS).length });
        return true;

    } catch (e) {
        console.error("Failed to load data:", e);
        return false;
    }
}
