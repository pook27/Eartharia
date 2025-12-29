
export const TILE_SIZE = 16;

// Default / Small Chunk Size
export const CHUNK_W = 800; 
export const CHUNK_H = 300; 

export const WORLD_SIZES = {
    Small: { w: 800, h: 300 },
    Medium: { w: 1200, h: 400 },
    Large: { w: 1600, h: 500 }
};

export const GRAVITY = 0.42;
export const TERM_VEL = 14;
export const PLAYER_REACH = 100;

export const DAY_LENGTH = 24000;
export const NIGHT_START = 13000;
export const NIGHT_END = 23000;

// Biome Boundaries (percentages of map width)
export const BIOME_SNOW_END = 0.15;
export const BIOME_JUNGLE_START = 0.75; // Jungle on the far right
export const BIOME_DESERT_START = 0.55; // Desert in the middle-right
