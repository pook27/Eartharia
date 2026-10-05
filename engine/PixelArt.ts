import { ItemProp, InventorySlot } from '../types';

const clamp = (v: number, min = 0, max = 255) => Math.max(min, Math.min(max, Math.round(v)));

export const shade = (hex: string | undefined, amount: number): string => {
    const value = /^#([0-9a-f]{6})$/i.test(hex || '') ? (hex as string) : '#808080';
    const r = parseInt(value.slice(1, 3), 16);
    const g = parseInt(value.slice(3, 5), 16);
    const b = parseInt(value.slice(5, 7), 16);
    return '#' +
        clamp(r + amount).toString(16).padStart(2, '0') +
        clamp(g + amount).toString(16).padStart(2, '0') +
        clamp(b + amount).toString(16).padStart(2, '0');
};

const hash = (n: number): number => {
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    return (n ^ (n >>> 16)) >>> 0;
};

const pixelNoise = (id: number, x: number, y: number, salt: number) =>
    hash(id * 374761393 + x * 668265263 + y * 1442695041 + salt) / 4294967296;

const hasAny = (name: string, ...words: string[]) =>
    words.some(word => name.includes(word));

export const drawTile = (
    ctx: CanvasRenderingContext2D,
    id: number,
    prop: ItemProp | undefined,
    x: number,
    y: number,
    size: number
) => {
    if (!prop || id === 0) return;

    const name = (prop.name || '').toLowerCase();
    const base = prop.c || prop.tint || '#777';
    const xCell = Math.floor(x / Math.max(1, size));
    const yCell = Math.floor(y / Math.max(1, size));

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (prop.liquid) {
        ctx.fillStyle = base;
        ctx.globalAlpha = 0.72;
        ctx.fillRect(x, y, size, size);
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = shade(base, 28);
        ctx.fillRect(x, y, size, Math.max(1, Math.floor(size * 0.18)));
        ctx.fillStyle = shade(base, -25);
        ctx.fillRect(x, y + size - 2, size, 2);
        ctx.restore();
        return;
    }

    if (hasAny(name, 'tree', 'trunk', 'palm tree') || (id >= 9001 && id <= 9007 && id % 2 === 1)) {
        ctx.fillStyle = base;
        ctx.fillRect(x + 2, y, size - 4, size);
        ctx.fillStyle = shade(base, 30);
        ctx.fillRect(x + 3, y, Math.max(1, Math.floor(size * 0.22)), size);
        ctx.fillStyle = shade(base, -28);
        ctx.fillRect(x + size - 3, y, 2, size);
        ctx.fillStyle = shade(base, -45);
        ctx.fillRect(x + Math.floor(size * 0.5), y + 3, 1, size - 6);
        ctx.restore();
        return;
    }

    if (hasAny(name, 'leaves', 'leaf') || (id >= 9001 && id <= 9007 && id % 2 === 0)) {
        ctx.fillStyle = base;
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = shade(base, 24);
        ctx.fillRect(x + 2, y + 2, Math.max(2, size - 5), 2);
        ctx.fillStyle = shade(base, -22);
        ctx.fillRect(x, y + size - 3, size, 2);
        for (let i = 0; i < 4; i++) {
            const px = Math.floor(pixelNoise(id, xCell, yCell, i) * Math.max(1, size - 3)) + 1;
            const py = Math.floor(pixelNoise(id, xCell, yCell, i + 10) * Math.max(1, size - 3)) + 1;
            ctx.fillStyle = i % 2 ? shade(base, 42) : shade(base, -30);
            ctx.fillRect(x + px, y + py, 2, 2);
        }
        ctx.restore();
        return;
    }

    ctx.fillStyle = base;
    ctx.fillRect(x, y, size, size);

    if (hasAny(name, 'grass block')) {
        ctx.fillStyle = '#4caa45';
        ctx.fillRect(x, y, size, Math.max(3, Math.floor(size * 0.24)));
        ctx.fillStyle = '#2d7d32';
        ctx.fillRect(x, y + Math.max(2, Math.floor(size * 0.18)), size, 2);
        ctx.fillStyle = shade(base, -18);
        ctx.fillRect(x, y + size - 2, size, 2);
        for (let i = 0; i < 5; i++) {
            const px = Math.floor(pixelNoise(id, xCell, yCell, i) * Math.max(1, size - 2));
            const py = Math.max(4, Math.floor(pixelNoise(id, xCell, yCell, i + 20) * Math.max(1, size - 5)));
            ctx.fillStyle = i % 2 ? '#6d4f3b' : '#80604a';
            ctx.fillRect(x + px, y + py, 1, 2);
        }
    } else if (hasAny(name, 'dirt', 'mud')) {
        ctx.fillStyle = shade(base, -22);
        ctx.fillRect(x, y + size - 2, size, 2);
        for (let i = 0; i < 5; i++) {
            const px = Math.floor(pixelNoise(id, xCell, yCell, i) * Math.max(1, size - 2));
            const py = Math.floor(pixelNoise(id, xCell, yCell, i + 20) * Math.max(1, size - 2));
            ctx.fillStyle = i % 2 ? shade(base, 18) : shade(base, -35);
            ctx.fillRect(x + px, y + py, 1, 1);
        }
    } else if (hasAny(name, 'stone', 'ore', 'granite', 'marble')) {
        ctx.fillStyle = shade(base, 22);
        ctx.fillRect(x + 1, y + 1, size - 2, 2);
        ctx.fillStyle = shade(base, -28);
        ctx.fillRect(x, y + size - 2, size, 2);
        const oreColor = prop.tint || (name.includes('ore') ? shade(base, 38) : undefined);
        for (let i = 0; i < 4; i++) {
            const px = Math.floor(pixelNoise(id, xCell, yCell, i) * Math.max(1, size - 2)) + 1;
            const py = Math.floor(pixelNoise(id, xCell, yCell, i + 30) * Math.max(1, size - 3)) + 1;
            ctx.fillStyle = oreColor || (i % 2 ? shade(base, -12) : shade(base, 32));
            ctx.fillRect(x + px, y + py, 2, 1);
        }
    } else if (hasAny(name, 'sand')) {
        ctx.fillStyle = shade(base, 20);
        ctx.fillRect(x, y, size, 2);
        for (let i = 0; i < 4; i++) {
            const px = Math.floor(pixelNoise(id, xCell, yCell, i) * Math.max(1, size - 1));
            const py = Math.floor(pixelNoise(id, xCell, yCell, i + 40) * Math.max(1, size - 1));
            ctx.fillStyle = i % 2 ? shade(base, -15) : '#f4d77b';
            ctx.fillRect(x + px, y + py, 1, 1);
        }
    } else if (hasAny(name, 'snow')) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, size, Math.max(3, Math.floor(size * 0.3)));
        ctx.fillStyle = '#dceaf2';
        ctx.fillRect(x, y + size - 2, size, 2);
        ctx.fillStyle = '#b9d4e4';
        for (let i = 0; i < 3; i++) {
            const px = Math.floor(pixelNoise(id, xCell, yCell, i + 50) * Math.max(1, size - 2)) + 1;
            ctx.fillRect(x + px, y + 5, 1, 1);
        }
    } else if (hasAny(name, 'ice')) {
        ctx.fillStyle = '#d2f4ff';
        ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.fillRect(x + 2, y + 2, Math.max(1, size - 6), 2);
        ctx.fillStyle = '#75bad0';
        ctx.fillRect(x + size - 3, y, 2, size);
    } else if (hasAny(name, 'brick')) {
        ctx.fillStyle = shade(base, -28);
        for (let row = 0; row < 3; row++) {
            const yy = y + Math.floor(row * size / 3);
            ctx.fillRect(x, yy, size, 1);
            const offset = row % 2 ? Math.floor(size / 2) : 0;
            ctx.fillRect(x + offset, yy, 1, Math.ceil(size / 3));
        }
        ctx.fillStyle = shade(base, 20);
        ctx.fillRect(x + 1, y + 1, size - 3, 1);
    } else if (hasAny(name, 'wood', 'plank', 'platform')) {
        ctx.fillStyle = shade(base, 22);
        ctx.fillRect(x, y, size, 2);
        ctx.fillStyle = shade(base, -28);
        ctx.fillRect(x, y + size - 2, size, 2);
        ctx.fillStyle = shade(base, -8);
        for (let yy = 4; yy < size; yy += 5) ctx.fillRect(x + 2, y + yy, size - 4, 1);
    } else if (hasAny(name, 'chest')) {
        ctx.fillStyle = '#6b4528';
        ctx.fillRect(x + 2, y + 5, size - 4, size - 6);
        ctx.fillStyle = '#a86d36';
        ctx.fillRect(x + 2, y + 3, size - 4, 4);
        ctx.fillStyle = '#d7ab4d';
        ctx.fillRect(x + Math.floor(size / 2) - 1, y + Math.floor(size / 2), 2, 3);
        ctx.fillStyle = '#3d291b';
        ctx.fillRect(x + 3, y + size - 3, size - 6, 1);
    } else if (hasAny(name, 'torch')) {
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(x + Math.floor(size / 2) - 1, y + 6, 2, size - 6);
        ctx.fillStyle = '#ffec7a';
        ctx.fillRect(x + Math.floor(size / 2) - 3, y + 2, 6, 5);
        ctx.fillStyle = '#ff8f00';
        ctx.fillRect(x + Math.floor(size / 2) - 2, y + 3, 4, 4);
        ctx.fillStyle = '#ff3d00';
        ctx.fillRect(x + Math.floor(size / 2) - 1, y + 4, 2, 3);
    } else if (prop.type === 'wall') {
        ctx.fillStyle = shade(base, -26);
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x, y, size, size);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,.10)';
        ctx.strokeRect(x + .5, y + .5, size - 1, size - 1);
    } else if (hasAny(name, 'door', 'chair', 'table', 'work bench', 'bench', 'anvil', 'furnace', 'campfire')) {
        ctx.fillStyle = shade(base, 24);
        ctx.fillRect(x + 2, y + 2, size - 4, Math.max(2, Math.floor(size * 0.2)));
        ctx.fillStyle = shade(base, -25);
        ctx.fillRect(x + 2, y + size - 3, size - 4, 2);
    } else {
        ctx.fillStyle = shade(base, 25);
        ctx.fillRect(x + 1, y + 1, size - 3, 1);
        ctx.fillStyle = shade(base, -22);
        ctx.fillRect(x, y + size - 2, size, 2);
    }

    ctx.restore();
};

const drawOutlinedRect = (
    ctx: CanvasRenderingContext2D,
    fill: string,
    stroke: string,
    x: number,
    y: number,
    w: number,
    h: number
) => {
    ctx.fillStyle = stroke;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x + 1, y + 1, Math.max(1, w - 2), Math.max(1, h - 2));
};

export const drawItemIcon = (
    ctx: CanvasRenderingContext2D,
    id: number,
    prop: ItemProp,
    size: number
) => {
    const name = (prop.name || '').toLowerCase();
    const c = prop.tint || prop.c || '#8aa0b5';

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (hasAny(name, 'pickaxe', 'drill')) {
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(size * .42, size * .42, size * .10, size * .50);
        ctx.fillStyle = '#c7d0d8';
        ctx.fillRect(size * .17, size * .20, size * .56, size * .10);
        ctx.fillRect(size * .22, size * .14, size * .08, size * .20);
        ctx.fillRect(size * .59, size * .14, size * .08, size * .20);
        ctx.fillStyle = shade(c, 45);
        ctx.fillRect(size * .20, size * .20, size * .50, size * .06);
    } else if (hasAny(name, 'axe', 'chainsaw')) {
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(size * .47, size * .26, size * .10, size * .62);
        ctx.fillStyle = '#d8e0e7';
        ctx.fillRect(size * .22, size * .15, size * .46, size * .14);
        ctx.fillRect(size * .22, size * .15, size * .12, size * .34);
        ctx.fillStyle = shade(c, 40);
        ctx.fillRect(size * .25, size * .16, size * .38, size * .05);
    } else if (hasAny(name, 'hammer')) {
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(size * .46, size * .32, size * .10, size * .56);
        ctx.fillStyle = '#bfc9d2';
        ctx.fillRect(size * .20, size * .18, size * .58, size * .18);
        ctx.fillStyle = shade(c, 35);
        ctx.fillRect(size * .26, size * .19, size * .45, size * .05);
    } else if (hasAny(name, 'bow')) {
        ctx.strokeStyle = '#7b4b2f';
        ctx.lineWidth = Math.max(2, size * .07);
        ctx.beginPath();
        ctx.arc(size * .47, size * .50, size * .32, Math.PI * .65, Math.PI * 1.35, true);
        ctx.stroke();
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(size * .27, size * .24);
        ctx.lineTo(size * .27, size * .76);
        ctx.stroke();
        ctx.strokeStyle = '#9ca3af';
        ctx.beginPath();
        ctx.moveTo(size * .26, size * .50);
        ctx.lineTo(size * .82, size * .50);
        ctx.stroke();
    } else if (hasAny(name, 'sword', 'blade', 'saber', 'broadsword')) {
        ctx.fillStyle = '#4b3425';
        ctx.fillRect(size * .44, size * .64, size * .10, size * .24);
        ctx.fillStyle = '#dbe4ec';
        ctx.beginPath();
        ctx.moveTo(size * .49, size * .08);
        ctx.lineTo(size * .67, size * .66);
        ctx.lineTo(size * .49, size * .60);
        ctx.lineTo(size * .33, size * .66);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(size * .47, size * .12, size * .05, size * .45);
        ctx.fillStyle = shade(c, -15);
        ctx.fillRect(size * .30, size * .66, size * .40, size * .08);
    } else if (hasAny(name, 'helmet', 'mask', 'hood', 'hat', 'cap', 'headgear')) {
        drawOutlinedRect(ctx, c, '#1e293b', size * .16, size * .28, size * .68, size * .40);
        ctx.fillStyle = shade(c, 35);
        ctx.fillRect(size * .22, size * .33, size * .52, size * .07);
        ctx.fillStyle = '#101827';
        ctx.fillRect(size * .29, size * .52, size * .40, size * .06);
    } else if (hasAny(name, 'breastplate', 'shirt', 'coat', 'mail', 'robe', 'tunic')) {
        drawOutlinedRect(ctx, c, '#1e293b', size * .22, size * .18, size * .56, size * .64);
        ctx.fillStyle = shade(c, 28);
        ctx.fillRect(size * .28, size * .24, size * .44, size * .08);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(size * .47, size * .30, size * .06, size * .45);
    } else if (hasAny(name, 'leggings', 'greaves', 'pants')) {
        drawOutlinedRect(ctx, c, '#1e293b', size * .25, size * .26, size * .50, size * .58);
        ctx.fillStyle = shade(c, 25);
        ctx.fillRect(size * .31, size * .31, size * .18, size * .08);
        ctx.fillRect(size * .51, size * .31, size * .18, size * .08);
    } else if (hasAny(name, 'coin')) {
        ctx.fillStyle = '#7a4c21';
        ctx.beginPath();
        ctx.arc(size * .50, size * .50, size * .32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(size * .50, size * .50, size * .25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shade(c, 45);
        ctx.fillRect(size * .44, size * .30, size * .07, size * .30);
    } else if (hasAny(name, 'potion')) {
        ctx.fillStyle = '#cfd8dc';
        ctx.fillRect(size * .38, size * .16, size * .24, size * .16);
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(size * .42, size * .12, size * .16, size * .06);
        ctx.fillStyle = c;
        ctx.fillRect(size * .28, size * .32, size * .44, size * .48);
        ctx.fillStyle = shade(c, 35);
        ctx.fillRect(size * .34, size * .36, size * .10, size * .28);
    } else if (hasAny(name, 'gem', 'amethyst', 'topaz', 'sapphire', 'emerald', 'ruby', 'diamond')) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(size * .50, size * .12);
        ctx.lineTo(size * .78, size * .42);
        ctx.lineTo(size * .62, size * .78);
        ctx.lineTo(size * .38, size * .78);
        ctx.lineTo(size * .22, size * .42);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = shade(c, 60);
        ctx.fillRect(size * .40, size * .24, size * .09, size * .24);
    } else {
        drawTile(ctx, id, prop, 0, 0, size);
        ctx.strokeStyle = 'rgba(15,23,42,.65)';
        ctx.lineWidth = Math.max(1, size * .04);
        ctx.strokeRect(1, 1, size - 2, size - 2);
    }

    ctx.restore();
};

export const drawPlayerSprite = (
    ctx: CanvasRenderingContext2D,
    player: any,
    x: number,
    y: number
) => {
    const w = player.w || 16;
    const h = player.h || 48;
    const colors = player.colors || {};
    const skin = colors.skin || '#efc3a7';
    const hair = colors.hair || '#4e342e';
    const shirt = colors.shirt || '#2196a8';
    const pants = colors.pants || '#315bb5';
    const shoes = colors.shoes || '#4b3025';

    const legSwing = Math.sin(player.walkFrame || 0) * 1.6;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Strong pixel outline / silhouette.
    ctx.fillStyle = '#17202a';
    ctx.fillRect(x + 3, y + 1, w - 6, 12);
    ctx.fillRect(x + 2, y + 11, w - 4, 15);
    ctx.fillRect(x + 3, y + 25, w - 6, 13);
    ctx.fillRect(x + 2, y + 36, w - 4, 7);

    // Hair + head.
    ctx.fillStyle = hair;
    ctx.fillRect(x + 4, y + 1, 8, 4);
    ctx.fillRect(x + 3, y + 5, 10, 4);
    ctx.fillStyle = skin;
    ctx.fillRect(x + 4, y + 5, 8, 7);
    ctx.fillRect(x + 3, y + 7, 1, 4);
    ctx.fillStyle = '#17202a';
    ctx.fillRect(x + (player.face === -1 ? 5 : 10), y + 7, 2, 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + (player.face === -1 ? 5 : 10), y + 7, 1, 1);

    // Neck + torso.
    ctx.fillStyle = skin;
    ctx.fillRect(x + 6, y + 11, 4, 3);
    ctx.fillStyle = shirt;
    ctx.fillRect(x + 3, y + 13, w - 6, 12);
    ctx.fillStyle = shade(shirt, 22);
    ctx.fillRect(x + 4, y + 14, w - 8, 2);
    ctx.fillStyle = shade(shirt, -24);
    ctx.fillRect(x + 3, y + 23, w - 6, 2);

    // Arms.
    ctx.fillStyle = shade(shirt, -12);
    ctx.fillRect(x + 1, y + 14, 3, 9);
    ctx.fillRect(x + w - 4, y + 14, 3, 9);
    ctx.fillStyle = skin;
    ctx.fillRect(x + 1, y + 22, 3, 3);
    ctx.fillRect(x + w - 4, y + 22, 3, 3);

    // Pants + legs.
    ctx.fillStyle = pants;
    ctx.fillRect(x + 4, y + 25, 4, 12);
    ctx.fillRect(x + 8, y + 25, 4, 12);
    ctx.fillStyle = shade(pants, 18);
    ctx.fillRect(x + 4, y + 26, 2, 8);
    ctx.fillRect(x + 9, y + 26, 2, 8);

    // Shoes with walking offset.
    ctx.fillStyle = shoes;
    ctx.fillRect(x + 2 - legSwing, y + 37, 6, 5);
    ctx.fillRect(x + 8 + legSwing, y + 37, 6, 5);
    ctx.fillStyle = shade(shoes, 28);
    ctx.fillRect(x + 3 - legSwing, y + 37, 4, 1);
    ctx.fillRect(x + 9 + legSwing, y + 37, 4, 1);

    // Belt / undershirt detail.
    ctx.fillStyle = colors.undershirt || '#eeeeee';
    ctx.fillRect(x + 5, y + 14, 6, 2);
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(x + 5, y + 24, 6, 2);

    ctx.restore();
};

export const drawNpcSprite = (
    ctx: CanvasRenderingContext2D,
    e: any,
    type: string
) => {
    const x = e.x;
    const y = e.y;
    const w = e.w || 24;
    const h = e.h || 42;
    const bob = Math.sin((e.walkFrame || 0) * 0.6) * 1.5;

    ctx.save();
    ctx.translate(0, bob);
    ctx.imageSmoothingEnabled = false;

    if (type === 'slime') {
        ctx.fillStyle = '#173a28';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2 + 3, w / 2, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#46b978';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2 + 2, w / 2 - 2, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#173a28';
        ctx.fillRect(x + w * .30, y + h * .45, 3, 4);
        ctx.fillRect(x + w * .60, y + h * .45, 3, 4);
    } else if (type === 'demon_eye') {
        ctx.fillStyle = '#2a1820';
        ctx.beginPath();
        ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.ellipse(x + w/2, y + h/2, w/2 - 2, h/2 - 2, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#b71c1c';
        ctx.beginPath();
        ctx.arc(x + w*.55, y + h*.52, Math.max(2, w*.15), 0, Math.PI*2);
        ctx.fill();
    } else {
        const skin = type === 'zombie' ? '#7a9f65' : '#efc3a7';
        const cloth = type === 'merchant' ? '#b56a1e' : type === 'guide' ? '#7c5944' : '#c7d1d9';
        ctx.fillStyle = '#1b2530';
        ctx.fillRect(x + 4, y + 1, w - 8, h - 2);
        ctx.fillStyle = skin;
        ctx.fillRect(x + 6, y + 4, w - 12, 9);
        ctx.fillStyle = '#3e2a22';
        ctx.fillRect(x + 5, y + 2, w - 10, 3);
        ctx.fillStyle = cloth;
        ctx.fillRect(x + 4, y + 13, w - 8, h - 25);
        ctx.fillStyle = '#5b4639';
        ctx.fillRect(x + 4, y + h - 12, 5, 10);
        ctx.fillRect(x + w - 9, y + h - 12, 5, 10);
        if (type === 'nurse') {
            ctx.fillStyle = '#d32f2f';
            ctx.fillRect(x + w/2 - 1, y + 2, 2, 6);
            ctx.fillRect(x + w/2 - 3, y + 4, 6, 2);
        }
    }

    ctx.restore();
};

export const formatItemName = (name: string): string =>
    name.replace(/\b(wood|stone|block|wall)\b/gi, match => match[0].toUpperCase() + match.slice(1));
