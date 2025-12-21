import { ItemProp, Recipe } from '../types';
import { mapItemProperties } from './itemMapping';

// --- Data Structures ---
export const IDS: Record<string, number> = { AIR: 0 };

// Internal IDs
IDS.TREE_TRUNK = 9001;
IDS.TREE_LEAVES = 9002;
IDS.PINE_TRUNK = 9003;
IDS.PINE_LEAVES = 9004;
IDS.PALM_TRUNK = 9005;
IDS.PALM_LEAVES = 9006;
IDS.CACTUS_TRUNK = 9007;

export const PROPS: Record<number, ItemProp> = {};
export const RECIPES: Recipe[] = [];
// Maps Item/Block ID -> Table ID (e.g. Work Bench Item ID -> Table ID 37)
export const STATION_LOOKUP: Record<number, number> = {};

// --- Initialization Logic ---
export const initializeGameData = async () => {
    console.log("Initializing Game Data...");
    try {
        const fetchJson = async (path: string) => {
            const res = await fetch(path);
            const contentType = res.headers.get("content-type");
            if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
            if (contentType && contentType.includes("text/html")) {
                throw new Error(`Failed to fetch ${path}. The server returned HTML instead of JSON. Please ensure the 'json' folder is in the 'public' directory of your project.`);
            }
            return await res.json();
        };

        const [itemsData, recipesData, tablesData] = await Promise.all([
            fetchJson('json/items.json'), 
            fetchJson('json/recipes.json'),
            fetchJson('json/tables.json')
        ]);

        console.log(`Loaded ${itemsData.length} items, ${recipesData.length} recipes, ${tablesData.length} tables.`);
        
        const NAME_TO_ID: Record<string, number> = {};

        // 1. Process Items using Mapping Helper
        itemsData.forEach((raw: any) => {
            const id = parseInt(raw.id);
            const name = raw.name;
            const key = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
            
            IDS[key] = id;
            NAME_TO_ID[name] = id;

            PROPS[id] = mapItemProperties(id, name);
        });

        // 2. Map Crafting Tables (BlockID -> TableID)
        tablesData.forEach((t: any) => {
            const tableId = parseInt(t.id);
            if (t.name && NAME_TO_ID[t.name]) {
                STATION_LOOKUP[NAME_TO_ID[t.name]] = tableId;
            }
            if (t.alternate_name && NAME_TO_ID[t.alternate_name]) {
                STATION_LOOKUP[NAME_TO_ID[t.alternate_name]] = tableId;
            }
        });
        
        // 3. Manual Overrides
        IDS.WOOD = 9;
        
        const TREE_BASE = { solid: 0, hardness: 2, icon: '🪵', c: '#8d6e63', bg: true, type: 'block' };
        const LEAF_BASE = { solid: 0, hardness: 0, icon: '🌿', c: '#388e3c', bg: true, type: 'block' };

        PROPS[IDS.TREE_TRUNK] = { ...TREE_BASE, id: IDS.TREE_TRUNK, name: "Tree" } as any;
        PROPS[IDS.TREE_LEAVES] = { ...LEAF_BASE, id: IDS.TREE_LEAVES, name: "Leaves" } as any;
        PROPS[IDS.PINE_TRUNK] = { ...TREE_BASE, id: IDS.PINE_TRUNK, name: "Pine Tree", c: '#5d4037', icon: '🌲' } as any;
        PROPS[IDS.PINE_LEAVES] = { ...LEAF_BASE, id: IDS.PINE_LEAVES, name: "Pine Leaves", c: '#a5d6a7', icon: '❄️' } as any;
        PROPS[IDS.PALM_TRUNK] = { ...TREE_BASE, id: IDS.PALM_TRUNK, name: "Palm Tree", c: '#d7ccc8', icon: '🌴' } as any;
        PROPS[IDS.PALM_LEAVES] = { ...LEAF_BASE, id: IDS.PALM_LEAVES, name: "Palm Leaves", c: '#81c784', icon: '🍃' } as any;
        PROPS[IDS.CACTUS_TRUNK] = { ...TREE_BASE, id: IDS.CACTUS_TRUNK, name: "Cactus Plant", c: '#66bb6a', icon: '🌵' } as any;

        if (!PROPS[9]) PROPS[9] = { id: 9, name: "Wood", c: '#8d6e63', icon: '🪵', solid: 1, type: 'material' };

        if (IDS.FALLEN_STAR) PROPS[IDS.FALLEN_STAR].consumable = 0; 
        if (IDS.LIFE_CRYSTAL) PROPS[IDS.LIFE_CRYSTAL].consumable = 1;
        if (IDS.MANA_CRYSTAL) PROPS[IDS.MANA_CRYSTAL].consumable = 1;

        // 4. Process Recipes
        RECIPES.length = 0;
        recipesData.forEach((r: any) => {
            const outID = parseInt(r.name);
            if (!PROPS[outID]) return;

            const cost: Record<number, number> = {};
            const add = (ing: string, amt: string) => {
                if (ing) cost[parseInt(ing)] = parseInt(amt) || 1;
            };
            add(r.ingredient1, r.amount1);
            add(r.ingredient2, r.amount2);
            add(r.ingredient3, r.amount3);
            add(r.ingredient4, r.amount4);

            let req = r.table ? parseInt(r.table) : undefined;
            if (req === 7) req = undefined;

            if (Object.keys(cost).length > 0) {
                RECIPES.push({
                    out: outID,
                    n: parseInt(r.quantity) || 1,
                    cost,
                    req 
                });
            }
        });
        
        console.log("Data loaded successfully.");
    } catch (e) {
        console.error("Failed to load game data:", e);
        throw e;
    }
};
