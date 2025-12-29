import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './engine/GameEngine';
import { CHUNK_W, CHUNK_H, TILE_SIZE, NIGHT_START, WORLD_SIZES } from './constants';
import { PROPS, IDS, RECIPES, initializeGameData } from './data/items';
import { MODIFIERS } from './data/modifiers';
import { InventorySlot, ActiveChest, CharacterData, WorldData, Difficulty, WorldSize, GameMode, WorldEvil } from './types';

// --- Menu Components ---
const Button: React.FC<{ children: React.ReactNode, onClick: () => void, className?: string, disabled?: boolean }> = ({ children, onClick, className, disabled }) => (
    <button 
        onClick={onClick} 
        disabled={disabled}
        className={`px-4 py-2 bg-slate-700 border-2 border-slate-500 text-white font-bold text-lg hover:text-yellow-300 hover:border-yellow-400 hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
        {children}
    </button>
);

const Input: React.FC<{ value: string, onChange: (s: string) => void, placeholder?: string, className?: string }> = ({ value, onChange, placeholder, className }) => (
    <input 
        type="text" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`px-3 py-2 bg-slate-800 border-2 border-slate-600 text-white text-lg focus:border-yellow-400 outline-none ${className}`}
    />
);

const MainMenu: React.FC<{ onStart: () => void }> = ({ onStart }) => (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-blue-400 to-blue-600 relative overflow-hidden">
        {/* Parallax Background Elements (Mock) */}
        <div className="absolute bottom-0 w-full h-32 bg-green-800 opacity-80"></div>
        <div className="absolute bottom-10 w-full h-40 bg-green-700 opacity-60 transform scale-110"></div>
        
        <div className="z-10 flex flex-col items-center gap-6">
            <h1 className="text-6xl md:text-8xl font-extrabold text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] tracking-wider">EARTHARIA</h1>
            <div className="flex flex-col gap-4 w-64 mt-10">
                <Button onClick={onStart}>Single Player</Button>
                <Button onClick={() => alert("Multiplayer not implemented yet!")} disabled>Multiplayer</Button>
                <Button onClick={() => alert("Settings not implemented yet!")}>Settings</Button>
                <Button onClick={() => window.close()}>Exit</Button>
            </div>
        </div>
        <div className="absolute bottom-2 right-2 text-white opacity-50 text-xs">Terraria Web Clone v0.2</div>
    </div>
);

const CharacterSelect: React.FC<{ 
    chars: CharacterData[], 
    onSelect: (c: CharacterData) => void, 
    onCreate: () => void, 
    onBack: () => void 
}> = ({ chars, onSelect, onCreate, onBack }) => (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white">
        <h2 className="text-3xl font-bold mb-6 text-yellow-400">Select Character</h2>
        <div className="w-full max-w-2xl bg-slate-800 border-2 border-slate-600 p-4 h-96 overflow-y-auto mb-6 rounded custom-scrollbar">
            {chars.length === 0 && <div className="text-center text-gray-500 mt-10">No characters found. Create one!</div>}
            {chars.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 border-b border-slate-700 hover:bg-slate-700 cursor-pointer transition-colors group" onClick={() => onSelect(c)}>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center text-2xl">👤</div>
                        <div>
                            <div className="font-bold text-lg group-hover:text-yellow-300">{c.name}</div>
                            <div className="text-xs text-gray-400">{c.difficulty}</div>
                        </div>
                    </div>
                    <div className="text-gray-500">▶</div>
                </div>
            ))}
        </div>
        <div className="flex gap-4">
            <Button onClick={onBack}>Back</Button>
            <Button onClick={onCreate}>New</Button>
        </div>
    </div>
);

const CreateCharacter: React.FC<{ onSave: (c: CharacterData) => void, onCancel: () => void }> = ({ onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [diff, setDiff] = useState<Difficulty>('Softcore');
    
    // Mock colors for now
    const colors = { skin: '#ffccbc', hair: '#5d4037', shirt: '#00acc1', undershirt: '#fff', pants: '#1e88e5', shoes: '#3e2723' };

    const handleSave = () => {
        if(!name) return;
        const newChar: CharacterData = {
            id: Date.now().toString(),
            name,
            difficulty: diff,
            hp: 100, maxHp: 100, mana: 20, maxMana: 20,
            colors,
            playTime: "0:00:00"
        };
        onSave(newChar);
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white">
            <h2 className="text-3xl font-bold mb-6 text-yellow-400">Create Character</h2>
            <div className="bg-slate-800 p-8 rounded border-2 border-slate-600 w-full max-w-md flex flex-col gap-4">
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Name</label>
                    <Input value={name} onChange={setName} placeholder="Player Name" className="w-full" />
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Difficulty</label>
                    <div className="flex gap-2">
                        {(['Softcore', 'Mediumcore', 'Hardcore'] as Difficulty[]).map(d => (
                            <button 
                                key={d}
                                onClick={() => setDiff(d)}
                                className={`flex-1 py-2 border-2 text-sm font-bold transition-all ${diff === d ? 'border-yellow-400 text-yellow-400 bg-slate-700' : 'border-slate-600 text-gray-400 hover:bg-slate-700'}`}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-2 h-8">
                        {diff === 'Softcore' && "Drop coins on death."}
                        {diff === 'Mediumcore' && "Drop items on death."}
                        {diff === 'Hardcore' && "Character deleted on death."}
                    </div>
                </div>
                <div className="flex gap-4 mt-4">
                    <Button onClick={onCancel} className="flex-1">Cancel</Button>
                    <Button onClick={handleSave} disabled={!name} className="flex-1">Create</Button>
                </div>
            </div>
        </div>
    );
};

const WorldSelect: React.FC<{ 
    worlds: WorldData[], 
    onSelect: (w: WorldData) => void, 
    onCreate: () => void, 
    onBack: () => void 
}> = ({ worlds, onSelect, onCreate, onBack }) => (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white">
        <h2 className="text-3xl font-bold mb-6 text-yellow-400">Select World</h2>
        <div className="w-full max-w-2xl bg-slate-800 border-2 border-slate-600 p-4 h-96 overflow-y-auto mb-6 rounded custom-scrollbar">
            {worlds.length === 0 && <div className="text-center text-gray-500 mt-10">No worlds found. Create one!</div>}
            {worlds.map(w => (
                <div key={w.id} className="flex items-center justify-between p-3 border-b border-slate-700 hover:bg-slate-700 cursor-pointer transition-colors group" onClick={() => onSelect(w)}>
                     <div>
                        <div className="font-bold text-lg group-hover:text-yellow-300">{w.name}</div>
                        <div className="text-xs text-gray-400 flex gap-2">
                            <span>{w.size}</span> | <span>{w.difficulty}</span> | <span className={w.evil === 'Crimson' ? 'text-red-400' : 'text-purple-400'}>{w.evil}</span>
                        </div>
                    </div>
                    <div className="text-gray-500">▶</div>
                </div>
            ))}
        </div>
        <div className="flex gap-4">
            <Button onClick={onBack}>Back</Button>
            <Button onClick={onCreate}>New</Button>
        </div>
    </div>
);

const CreateWorld: React.FC<{ onSave: (w: WorldData) => void, onCancel: () => void }> = ({ onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [seed, setSeed] = useState('');
    const [size, setSize] = useState<WorldSize>('Small');
    const [diff, setDiff] = useState<GameMode>('Classic');
    const [evil, setEvil] = useState<WorldEvil>('Corruption');

    const handleSave = () => {
        if(!name) return;
        const newWorld: WorldData = {
            id: Date.now().toString(),
            name,
            seed: seed || Math.random().toString(36).substring(7),
            size,
            difficulty: diff,
            evil,
            width: WORLD_SIZES[size].w,
            height: WORLD_SIZES[size].h,
            creationDate: new Date().toLocaleDateString()
        };
        onSave(newWorld);
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white">
            <h2 className="text-3xl font-bold mb-6 text-yellow-400">Create World</h2>
            <div className="bg-slate-800 p-6 rounded border-2 border-slate-600 w-full max-w-lg flex flex-col gap-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Name</label>
                    <Input value={name} onChange={setName} placeholder="World Name" className="w-full" />
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Seed (Optional)</label>
                    <Input value={seed} onChange={setSeed} placeholder="Random" className="w-full" />
                </div>
                
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Size</label>
                    <div className="flex gap-2">
                        {(['Small', 'Medium', 'Large'] as WorldSize[]).map(s => (
                            <button key={s} onClick={() => setSize(s)} className={`flex-1 py-1 border-2 text-sm font-bold ${size === s ? 'border-yellow-400 text-yellow-400 bg-slate-700' : 'border-slate-600'}`}>{s}</button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-gray-400 mb-1">Difficulty</label>
                    <div className="flex gap-2">
                         {(['Classic', 'Expert', 'Master', 'Journey'] as GameMode[]).map(d => (
                            <button key={d} onClick={() => setDiff(d)} className={`flex-1 py-1 border-2 text-xs font-bold ${diff === d ? 'border-yellow-400 text-yellow-400 bg-slate-700' : 'border-slate-600'}`}>{d}</button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-gray-400 mb-1">World Evil</label>
                    <div className="flex gap-2">
                         <button onClick={() => setEvil('Corruption')} className={`flex-1 py-2 border-2 text-sm font-bold ${evil === 'Corruption' ? 'border-purple-500 text-purple-400 bg-slate-700' : 'border-slate-600'}`}>Corruption</button>
                         <button onClick={() => setEvil('Crimson')} className={`flex-1 py-2 border-2 text-sm font-bold ${evil === 'Crimson' ? 'border-red-500 text-red-400 bg-slate-700' : 'border-slate-600'}`}>Crimson</button>
                    </div>
                </div>

                <div className="flex gap-4 mt-4">
                    <Button onClick={onCancel} className="flex-1">Cancel</Button>
                    <Button onClick={handleSave} disabled={!name} className="flex-1">Create</Button>
                </div>
            </div>
        </div>
    );
};

// --- Game Logic Components --- (Moved from old App)

const ItemIcon: React.FC<{ id: number; size?: number }> = ({ id, size = 40 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs || !id || !PROPS[id]) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;
        const prop = PROPS[id];
        ctx.clearRect(0, 0, size, size);
        const scale = size / TILE_SIZE; 
        ctx.save();
        ctx.scale(scale, scale);
        if (prop.c) {
            ctx.fillStyle = prop.c;
            ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        }
        if (prop.icon) {
            ctx.font = `${TILE_SIZE}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText(prop.icon, TILE_SIZE/2, TILE_SIZE/2 + 2);
        }
        if (prop.tint) {
            ctx.save();
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = prop.tint;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
            ctx.restore();
        }
        ctx.restore();
    }, [id, size]);
    if (!id || id === 0) return null;
    return <canvas ref={canvasRef} width={size} height={size} />;
};

const Slot: React.FC<{ 
    item: InventorySlot; 
    onSelect?: () => void; 
    isSelected?: boolean; 
    onMouseDown?: () => void; 
    onMouseUp?: () => void;
    onMouseEnter: (e: any) => void;
    onMouseLeave: () => void;
    label?: string;
    transparent?: boolean;
    small?: boolean;
}> = ({ item, onSelect, isSelected, onMouseDown, onMouseUp, onMouseEnter, onMouseLeave, label, transparent, small }) => (
    <div 
        className={`${small ? 'w-10 h-10' : 'w-12 h-12'} border border-blue-700 bg-blue-950 flex items-center justify-center relative cursor-pointer hover:border-white transition-all
        ${isSelected ? 'ring-2 ring-yellow-400' : ''}
        ${transparent ? 'opacity-50' : ''}`}
        onClick={onSelect}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
    >
        {label && <span className="absolute inset-0 flex items-center justify-center text-[8px] text-gray-500 uppercase font-bold pointer-events-none opacity-50">{label}</span>}
        {item && item.id !== 0 && (
            <>
                <ItemIcon id={item.id} size={small ? 32 : 40} />
                {item.n > 1 && <span className="absolute bottom-0 right-1 text-xs font-bold drop-shadow-md">{item.n}</span>}
                {item.prefix && <span className="absolute top-0 right-0 w-2 h-2 bg-yellow-400 rounded-full" title="Modified"></span>}
            </>
        )}
    </div>
);

type AppState = 'LOADING_DATA' | 'MENU' | 'CHAR_SELECT' | 'CHAR_CREATE' | 'WORLD_SELECT' | 'WORLD_CREATE' | 'LOADING_GAME' | 'PLAYING';

const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>('LOADING_DATA');
    
    // Data Persistence (Mock)
    const [characters, setCharacters] = useState<CharacterData[]>([]);
    const [worlds, setWorlds] = useState<WorldData[]>([]);
    
    // Selection State
    const [selectedChar, setSelectedChar] = useState<CharacterData | null>(null);
    const [selectedWorld, setSelectedWorld] = useState<WorldData | null>(null);

    // Game Engine Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const lightCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
    const engineRef = useRef<GameEngine>(new GameEngine());
    
    // Game UI State
    const [inv, setInv] = useState<InventorySlot[]>([]);
    const [armor, setArmor] = useState<InventorySlot[]>([]);
    const [accessories, setAccessories] = useState<InventorySlot[]>([]);
    const [coins, setCoins] = useState<InventorySlot[]>([]);
    const [ammo, setAmmo] = useState<InventorySlot[]>([]);
    const [activeChest, setActiveChest] = useState<ActiveChest | null>(null);
    const [stats, setStats] = useState({ hp: 100, maxHp: 100, mana: 20, maxMana: 20, def: 0 });
    const [selectedSlot, setSelectedSlot] = useState(0);
    const [showInv, setShowInv] = useState(false);
    const [craftables, setCraftables] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [smartCursor, setSmartCursor] = useState(false);
    const [dragSource, setDragSource] = useState<{ list: string, index: number } | null>(null);
    const [hoverItem, setHoverItem] = useState<any>(null);
    const [dialogue, setDialogue] = useState<{name: string, text: string, type: string} | null>(null);
    const [showShop, setShowShop] = useState(false);
    const [time, setTime] = useState(4500);

    // Boot Data
    useEffect(() => {
        const boot = async () => {
            try {
                await initializeGameData();
                setAppState('MENU');
            } catch (err: any) {
                console.error(err);
                setError("Failed to load game data.");
            }
        };
        boot();
        
        // Load local mock data
        // In a real app, load from localStorage here
        setCharacters([{
            id: '1', name: "Terrarian", difficulty: "Softcore", hp: 100, maxHp: 100, mana: 20, maxMana: 20,
            colors: { skin: '#ffccbc', hair: '#5d4037', shirt: '#00acc1', undershirt: '#fff', pants: '#1e88e5', shoes: '#3e2723' },
            playTime: "0:00:00"
        }]);
        setWorlds([{
            id: '1', name: "World 1", seed: "Eartharia", size: 'Small', difficulty: 'Classic', evil: 'Corruption',
            width: WORLD_SIZES['Small'].w, height: WORLD_SIZES['Small'].h, creationDate: "Today"
        }]);

    }, []);

    // Game Loop Management
    useEffect(() => {
        if (appState !== 'PLAYING') return;

        let lastTime = performance.now();
        let frameId = 0;

        const loop = (timeNow: number) => {
            const dt = (timeNow - lastTime) / 1000;
            lastTime = timeNow;
            update(dt);
            draw();
            frameId = requestAnimationFrame(loop);
        };
        frameId = requestAnimationFrame(loop);

        const handleResize = () => {
             if (canvasRef.current) {
                 canvasRef.current.width = window.innerWidth;
                 canvasRef.current.height = window.innerHeight;
             }
        };
        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', handleResize);
        };
    }, [appState]);

    const startGame = () => {
        if (!selectedChar || !selectedWorld) return;
        setAppState('LOADING_GAME');
        setTimeout(() => {
            // Re-instantiate engine for clean state
            engineRef.current = new GameEngine();
            engineRef.current.start(selectedChar, selectedWorld);
            
            // Sync initial UI
            setInv([...engineRef.current.player.inv]);
            setStats({ hp: 100, maxHp: 100, mana: 20, maxMana: 20, def: 0 });
            
            setAppState('PLAYING');
        }, 100);
    };

    // --- Inputs Handling ---
    const keys = useRef<Record<string, boolean>>({});
    const mouse = useRef({ x: 0, y: 0, left: false, right: false });

    useEffect(() => {
        if (appState !== 'PLAYING') return;

        const onKD = (e: KeyboardEvent) => {
            keys.current[e.code] = true;
            if (e.code === 'Escape') {
                if (showShop) setShowShop(false);
                else if (activeChest) engineRef.current.activeChest = null;
                else if (dialogue) setDialogue(null);
                else setShowInv(prev => !prev);
            }
            if (e.code === 'ControlLeft') {
                engineRef.current.smartCursor = !engineRef.current.smartCursor;
                setSmartCursor(engineRef.current.smartCursor);
            }
            if (e.key >= '1' && e.key <= '0') {
                const idx = (parseInt(e.key) || 10) - 1;
                engineRef.current.player.sel = idx;
                setSelectedSlot(idx);
            }
        };
        const onKU = (e: KeyboardEvent) => keys.current[e.code] = false;
        
        const onMD = (e: MouseEvent) => {
             if (showInv || showShop || activeChest) return; 
             if (dialogue) { return; }
             if (e.button === 0) mouse.current.left = true;
             if (e.button === 2) {
                 mouse.current.right = true;
                 const npc = engineRef.current.checkNPCInteract(e.clientX, e.clientY);
                 if (npc) {
                     setDialogue({
                         name: npc.type.toUpperCase(),
                         text: getNPCDialogue(npc.type),
                         type: npc.type
                     });
                 }
             }
             const st = engineRef.current.getSmartTarget(e.clientX, e.clientY);
             engineRef.current.interact(e.clientX, e.clientY, e.button === 0, st, e.shiftKey);
        };
        const onMU = (e: MouseEvent) => {
             if (e.button === 0) mouse.current.left = false;
             if (e.button === 2) mouse.current.right = false;
        };
        const onMM = (e: MouseEvent) => {
            mouse.current.x = e.clientX;
            mouse.current.y = e.clientY;
        };
        const onWheel = (e: WheelEvent) => {
            const delta = Math.sign(e.deltaY);
            engineRef.current.changeSlot(delta);
            setSelectedSlot(engineRef.current.player.sel);
        };

        window.addEventListener('keydown', onKD);
        window.addEventListener('keyup', onKU);
        window.addEventListener('mousedown', onMD);
        window.addEventListener('mouseup', onMU);
        window.addEventListener('mousemove', onMM);
        window.addEventListener('wheel', onWheel);
        
        return () => {
            window.removeEventListener('keydown', onKD);
            window.removeEventListener('keyup', onKU);
            window.removeEventListener('mousedown', onMD);
            window.removeEventListener('mouseup', onMU);
            window.removeEventListener('mousemove', onMM);
            window.removeEventListener('wheel', onWheel);
        };
    }, [appState, showInv, dialogue, showShop, activeChest]);

    const getNPCDialogue = (type: string) => {
        if (type === 'merchant') return "I've got the best goods! Check out my wares... if you have the coin.";
        if (type === 'nurse') return "Don't die on me! I can patch you up.";
        if (type === 'guide') return "Greetings! Need help? Try crafting a Workbench.";
        return "...";
    };

    useEffect(() => {
        if (appState !== 'PLAYING') return;
        const timer = setInterval(() => {
            if (!engineRef.current) return;
            const avail = RECIPES.filter(r => engineRef.current.canCraft(r));
            setCraftables(avail);
        }, 500);
        return () => clearInterval(timer);
    }, [appState, inv]); 

    const update = (dt: number) => {
        const input = {
            left: keys.current['KeyA'] || keys.current['ArrowLeft'],
            right: keys.current['KeyD'] || keys.current['ArrowRight'],
            jump: keys.current['Space'] || keys.current['ArrowUp']
        };

        engineRef.current.update(input, dt);

        if (engineRef.current.invDirty) {
             const p = engineRef.current.player;
             setInv(JSON.parse(JSON.stringify(p.inv)));
             setArmor(JSON.parse(JSON.stringify(p.armor)));
             setAccessories(JSON.parse(JSON.stringify(p.accessories)));
             setCoins(JSON.parse(JSON.stringify(p.coins)));
             setAmmo(JSON.parse(JSON.stringify(p.ammo)));
             
             // Sync active chest
             if (engineRef.current.activeChest) {
                 setActiveChest(JSON.parse(JSON.stringify(engineRef.current.activeChest)));
             } else {
                 setActiveChest(null);
             }
             
             engineRef.current.invDirty = false;
        }
        
        const p = engineRef.current.player;
        setStats({ hp: p.hp, maxHp: p.maxHp, mana: p.mana, maxMana: p.maxMana, def: p.defense });
        setTime(engineRef.current.time);
    };

    const draw = () => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;
        const { width, height } = cvs;
        
        const game = engineRef.current;
        const t = game.time;
        
        // Sky Gradient Logic based on time
        let skyHex = '#87CEEB'; 
        if (t > NIGHT_START && t < 23000) skyHex = '#1a1a2e'; 
        else if (t >= 23000 || t < 1000) skyHex = '#ff9966';
        
        ctx.fillStyle = skyHex;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.translate(-Math.floor(game.camera.x), -Math.floor(game.camera.y));

        const sx = Math.max(0, Math.floor(game.camera.x / TILE_SIZE));
        const ex = Math.min(game.width, sx + Math.ceil(width / TILE_SIZE) + 1);
        const sy = Math.max(0, Math.floor(game.camera.y / TILE_SIZE));
        const ey = Math.min(game.height, sy + Math.ceil(height / TILE_SIZE) + 1);

        // --- Draw Walls & Tiles ---
        // (Same drawing logic as before, ensuring we use game.width instead of CHUNK_W constant if strictly needed, 
        // though index calc uses game.width inside loop)
        for (let y = sy; y < ey; y++) {
            for (let x = sx; x < ex; x++) {
                const idx = y * game.width + x;
                const px = x * TILE_SIZE;
                const py = y * TILE_SIZE;
                
                // Walls
                const wid = game.walls[idx];
                if (wid && PROPS[wid]) {
                    const wallProp = PROPS[wid];
                    ctx.fillStyle = wallProp.c || '#555';
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    if (wallProp.tint) {
                        ctx.fillStyle = wallProp.tint;
                        ctx.globalAlpha = 0.4;
                        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                        ctx.globalAlpha = 1.0;
                    }
                    ctx.fillStyle = 'rgba(0,0,0,0.4)';
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                }

                // Tiles
                const id = game.world[idx];
                if (id !== IDS.AIR && PROPS[id]) {
                    const prop = PROPS[id];
                    if (prop.liquid) {
                        ctx.save();
                        ctx.globalAlpha = 0.6; 
                        ctx.fillStyle = prop.c || '#00f';
                        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                        ctx.restore();
                    } else {
                        if (prop.solid && prop.c) {
                            ctx.fillStyle = prop.c; 
                            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                        }
                        if (prop.icon) {
                            ctx.font = `${TILE_SIZE}px sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(prop.icon, px + TILE_SIZE/2, py + TILE_SIZE/2 + 2);
                        } else if (!prop.solid && prop.c) {
                             ctx.fillStyle = prop.c;
                             ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                        }
                        if (prop.tint) {
                            ctx.fillStyle = prop.tint;
                            ctx.globalAlpha = 0.4;
                            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                            ctx.globalAlpha = 1.0;
                        }
                    }
                }
            }
        }

        // Entities
        const drawEntity = (ctx: CanvasRenderingContext2D, e: any, type: string) => {
            const x = e.x;
            const y = e.y;
            ctx.save();
            if (e.immune && e.immune % 4 < 2) ctx.globalAlpha = 0.5;
            if (e.face === -1) {
                ctx.translate(x + e.w, y);
                ctx.scale(-1, 1);
                ctx.translate(-x, -y);
            }
            const legOffset = Math.sin(e.walkFrame) * 4;

            if (type === 'player') {
                 // Skin
                 ctx.fillStyle = game.player.colors.skin || '#ffccbc'; 
                 ctx.fillRect(x + 4, y + 2, 8, 8); 
                 // Shirt
                 ctx.fillStyle = game.player.colors.shirt || '#00acc1'; 
                 ctx.fillRect(x + 2, y + 10, 12, 14);
                 // Pants
                 ctx.fillStyle = game.player.colors.pants || '#1e88e5'; 
                 ctx.fillRect(x + 4 - legOffset, y + 24, 4, 12);
                 ctx.fillRect(x + 8 + legOffset, y + 24, 4, 12);
                 // Shoes
                 ctx.fillStyle = game.player.colors.shoes || '#3e2723';
                 ctx.fillRect(x + 3 - legOffset, y + 36, 6, 4);
                 ctx.fillRect(x + 7 + legOffset, y + 36, 6, 4);
                 // Hair
                 ctx.fillStyle = game.player.colors.hair || '#5d4037'; 
                 ctx.fillRect(x + 2, y, 12, 4);

                 // Item Swing
                 if (e.swinging > 0) {
                     ctx.save();
                     ctx.translate(x + e.w/2, y + e.h/2); 
                     if (e.face === -1) { ctx.scale(-1, 1); }
                     const progress = 1 - (e.swinging / 15);
                     const startAngle = e.targetAngle - Math.PI/3;
                     const endAngle = e.targetAngle + Math.PI/3;
                     const currentAngle = startAngle + (endAngle - startAngle) * progress;
                     ctx.rotate(currentAngle);
                     ctx.fillStyle = '#bbb'; 
                     ctx.fillRect(0, -2, 40, 4); 
                     ctx.fillStyle = '#5d4037';
                     ctx.fillRect(-6, -3, 6, 6); 
                     ctx.restore();
                 }
            } else if (type === 'slime') {
                 ctx.fillStyle = 'rgba(0, 150, 255, 0.8)';
                 ctx.beginPath();
                 ctx.arc(x + e.w/2, y + e.h/2 + 4, e.w/2, 0, Math.PI, true);
                 ctx.fill();
            } else if (type === 'demon_eye') {
                 ctx.fillStyle = '#eee';
                 ctx.beginPath();
                 ctx.arc(x + e.w/2, y + e.h/2, e.w/2, 0, Math.PI*2);
                 ctx.fill();
                 ctx.fillStyle = '#b71c1c';
                 ctx.beginPath();
                 ctx.arc(x + e.w/2, y + e.h/2, e.w/4, 0, Math.PI*2);
                 ctx.fill();
            } else if (type === 'merchant') {
                 ctx.fillStyle = '#f57f17';
                 ctx.fillRect(x + 2, y - 2, 12, 6);
                 ctx.fillStyle = '#ffccbc';
                 ctx.fillRect(x + 4, y + 4, 8, 8);
                 ctx.fillStyle = '#eee';
                 ctx.fillRect(x + 4, y + 10, 8, 4);
                 ctx.fillStyle = '#d84315';
                 ctx.fillRect(x + 2, y + 14, 12, 14);
                 ctx.fillStyle = '#3e2723';
                 ctx.fillRect(x + 4 - legOffset, y + 28, 4, 12);
                 ctx.fillRect(x + 8 + legOffset, y + 28, 4, 12);
            } else if (type === 'nurse') {
                 ctx.fillStyle = '#fff';
                 ctx.fillRect(x + 4, y, 8, 4);
                 ctx.fillStyle = '#c62828';
                 ctx.fillRect(x + 7, y+1, 2, 2);
                 ctx.fillStyle = '#ffccbc';
                 ctx.fillRect(x + 4, y + 4, 8, 8);
                 ctx.fillStyle = '#fff';
                 ctx.fillRect(x + 3, y + 12, 10, 12);
                 ctx.fillStyle = '#fff';
                 ctx.fillRect(x + 3, y + 24, 10, 10);
            } else if (type === 'guide') {
                 ctx.fillStyle = '#795548'; 
                 ctx.fillRect(x + 3, y, 10, 4);
                 ctx.fillStyle = '#ffccbc';
                 ctx.fillRect(x + 4, y + 4, 8, 8);
                 ctx.fillStyle = '#8d6e63'; 
                 ctx.fillRect(x + 2, y + 12, 12, 14);
                 ctx.fillStyle = '#5d4037'; 
                 ctx.fillRect(x + 4 - legOffset, y + 26, 4, 14);
                 ctx.fillRect(x + 8 + legOffset, y + 26, 4, 14);
            } else if (type === 'zombie') {
                 ctx.fillStyle = '#689f38'; 
                 ctx.fillRect(x + 4, y + 2, 8, 8);
                 ctx.fillStyle = '#558b2f'; 
                 ctx.fillRect(x + 2, y + 10, 12, 14);
                 ctx.fillStyle = '#1565c0'; 
                 ctx.fillRect(x + 4 - legOffset, y + 24, 4, 12);
                 ctx.fillRect(x + 8 + legOffset, y + 24, 4, 12);
                 ctx.fillStyle = '#689f38';
                 ctx.fillRect(x + 10, y + 12, 10, 4);
            }
            ctx.restore();
        };

        drawEntity(ctx, game.player, 'player');

        game.npcs.forEach(npc => {
            drawEntity(ctx, npc, npc.type);
            if (npc.hp < npc.maxHp) {
                ctx.fillStyle = 'red';
                ctx.fillRect(npc.x, npc.y - 10, npc.w, 4);
                ctx.fillStyle = 'green';
                ctx.fillRect(npc.x, npc.y - 10, npc.w * (npc.hp / npc.maxHp), 4);
            }
        });

        game.loot.forEach(l => {
             const prop = PROPS[l.id];
             if (prop) {
                 ctx.font = '12px sans-serif';
                 ctx.fillText(prop.icon, l.x, l.y);
             }
        });

        game.particles.forEach(pt => {
            ctx.fillStyle = pt.c;
            ctx.globalAlpha = pt.life / 30;
            ctx.fillRect(pt.x, pt.y, 4, 4);
            ctx.globalAlpha = 1.0;
        });
        
        ctx.restore();

        // Lighting
        const lightW = ex - sx;
        const lightH = ey - sy;
        
        if (lightW > 0 && lightH > 0) {
            const lCvs = lightCanvasRef.current;
            if (lCvs.width !== lightW || lCvs.height !== lightH) {
                lCvs.width = lightW;
                lCvs.height = lightH;
            }
            const lCtx = lCvs.getContext('2d');
            if (lCtx) {
                const imgData = lCtx.createImageData(lightW, lightH);
                const data = imgData.data;
                for (let y = 0; y < lightH; y++) {
                    for (let x = 0; x < lightW; x++) {
                        const idx = (sy + y) * game.width + (sx + x);
                        const light = game.lightMap[idx];
                        const shadowAlpha = Math.floor((1.0 - light) * 255);
                        const ptr = (y * lightW + x) * 4;
                        data[ptr] = 0;     
                        data[ptr + 1] = 0; 
                        data[ptr + 2] = 0; 
                        data[ptr + 3] = shadowAlpha; 
                    }
                }
                lCtx.putImageData(imgData, 0, 0);
                ctx.save();
                const drawX = (sx * TILE_SIZE) - game.camera.x;
                const drawY = (sy * TILE_SIZE) - game.camera.y;
                ctx.scale(1, 1);
                ctx.drawImage(lCvs, 0, 0, lightW, lightH, drawX, drawY, lightW * TILE_SIZE, lightH * TILE_SIZE);
                ctx.restore();
            }
        }

        // Mouse Cursor
        ctx.save();
        const mx = mouse.current.x + game.camera.x;
        const my = mouse.current.y + game.camera.y;
        const st = game.getSmartTarget(mouse.current.x, mouse.current.y);
        ctx.translate(-Math.floor(game.camera.x), -Math.floor(game.camera.y));

        if (game.smartCursor && st) {
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 3;
            ctx.strokeRect(st.x, st.y, TILE_SIZE, TILE_SIZE);
            ctx.beginPath();
            ctx.moveTo(game.player.x + game.player.w/2, game.player.y + game.player.h/2);
            ctx.lineTo(st.x + TILE_SIZE/2, st.y + TILE_SIZE/2);
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.stroke();
        } else {
            const tx = Math.floor(mx / TILE_SIZE);
            const ty = Math.floor(my / TILE_SIZE);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
        ctx.restore();
    };
    
    // Inventory, HUD, Interaction logic... (Same as before but filtered by appState)

    const handleSell = (slotIdx: number) => engineRef.current.sellItem(slotIdx);
    const handleChestTransfer = (fromChest: boolean, index: number) => engineRef.current.transferItem(fromChest, index);
    const handleBuy = (item: any) => engineRef.current.buyItem(item.id, item.price);
    
    const handleInventoryClick = (slotIdx: number, item: InventorySlot) => {
        if (activeChest) handleChestTransfer(false, slotIdx);
        else if (showShop) handleSell(slotIdx);
        else {
            engineRef.current.player.sel = slotIdx; 
            setSelectedSlot(slotIdx);
        }
    };

    const handleDragStart = (list: string, index: number) => {
        setDragSource({ list, index });
    };

    const handleDrop = (destList: string, destIndex: number) => {
        if (!dragSource) return;
        engineRef.current.moveItem(dragSource.list, dragSource.index, destList, destIndex);
        setDragSource(null);
    };

    const handleCraft = (recipe: any) => {
        engineRef.current.craft(recipe);
    };
    
    const handleMouseEnter = (e: React.MouseEvent, item: InventorySlot) => {
        if (item.id !== 0 && PROPS[item.id]) {
            const p = PROPS[item.id];
            let prefixName = '';
            let finalDmg = p.dmg;
            let finalCrit: number | undefined = undefined;
            if (p.dmg || p.weaponClass) finalCrit = 4;

            if (item.prefix && MODIFIERS[item.prefix]) {
                const m = MODIFIERS[item.prefix];
                prefixName = m.name;
                if (finalDmg && m.dmg) finalDmg *= m.dmg;
                if (finalCrit !== undefined && m.crit) finalCrit += m.crit;
            }

            const stats: any = {};
            if(finalDmg) stats.damage = Math.round(finalDmg);
            if(p.weaponClass) stats.class = p.weaponClass;
            else if(p.tool === 'sword') stats.class = 'Melee';
            else if(p.icon === '🏹') stats.class = 'Ranged';
            
            if (finalCrit !== undefined) stats.crit = finalCrit;
            if(p.pwr) {
                if(p.tool === 'pick') stats.pickPower = p.pwr * 10;
                if(p.tool === 'axe') stats.axePower = p.pwr * 10;
                if(p.tool === 'hammer') stats.hammerPower = p.pwr * 10;
            }

            setHoverItem({
                name: p.name, 
                value: p.value,
                prefixName,
                stats,
                desc: p.observations || '',
                x: e.clientX, 
                y: e.clientY
            });
        }
    };

    const handleMouseLeave = () => setHoverItem(null);

    const hotbar = inv.slice(0, 10);
    const mainInv = inv.slice(10);
    const shopItems = showShop ? engineRef.current.getShopItems('merchant') : [];
    const playerMoney = engineRef.current?.countMoney() || 0;

    if (error) {
        return (
            <div className="flex items-center justify-center w-screen h-screen bg-black text-white p-4 text-center">
                <div>
                    <h2 className="text-xl text-red-500 font-bold mb-2">Error</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }
    
    // --- Render Logic Switch ---

    if (appState === 'LOADING_DATA') {
        return <div className="w-full h-screen bg-black text-white flex items-center justify-center font-bold text-2xl">Loading Game Data...</div>;
    }

    if (appState === 'MENU') {
        return <MainMenu onStart={() => setAppState('CHAR_SELECT')} />;
    }

    if (appState === 'CHAR_SELECT') {
        return (
            <CharacterSelect 
                chars={characters} 
                onSelect={(c) => { setSelectedChar(c); setAppState('WORLD_SELECT'); }}
                onCreate={() => setAppState('CHAR_CREATE')}
                onBack={() => setAppState('MENU')}
            />
        );
    }

    if (appState === 'CHAR_CREATE') {
        return (
            <CreateCharacter 
                onSave={(c) => { setCharacters([...characters, c]); setAppState('CHAR_SELECT'); }}
                onCancel={() => setAppState('CHAR_SELECT')}
            />
        );
    }

    if (appState === 'WORLD_SELECT') {
        return (
            <WorldSelect 
                worlds={worlds} 
                onSelect={(w) => { setSelectedWorld(w); startGame(); }}
                onCreate={() => setAppState('WORLD_CREATE')}
                onBack={() => setAppState('CHAR_SELECT')}
            />
        );
    }

    if (appState === 'WORLD_CREATE') {
        return (
            <CreateWorld 
                onSave={(w) => { setWorlds([...worlds, w]); setAppState('WORLD_SELECT'); }}
                onCancel={() => setAppState('WORLD_SELECT')}
            />
        );
    }
    
    if (appState === 'LOADING_GAME') {
        return <div className="w-full h-screen bg-black text-white flex items-center justify-center font-bold text-2xl">Generating World...</div>;
    }

    // PLAYING State
    return (
        <div className="relative w-screen h-screen overflow-hidden bg-black text-white font-sans select-none">
            <canvas ref={canvasRef} className="block cursor-none" onContextMenu={e => e.preventDefault()} />
            
            <div 
                className={`fixed pointer-events-none z-[100] ${smartCursor ? 'text-yellow-400' : 'text-white'}`}
                style={{ left: mouse.current.x, top: mouse.current.y, transform: 'translate(-50%, -50%)' }}
            >
                {smartCursor ? '⌖' : '+'}
            </div>

            {/* HUD */}
            <div className="absolute top-2 right-2 flex flex-col items-end z-20 pointer-events-none">
                 <div className="flex flex-wrap justify-end max-w-[300px]">
                     {Array.from({length: Math.ceil(stats.maxHp / 20)}).map((_, i) => (
                         <span key={i} className="text-red-500 text-xl drop-shadow-md">
                             {stats.hp >= (i+1)*20 ? '❤️' : '🖤'}
                         </span>
                     ))}
                 </div>
                 <div className="flex flex-col items-center mt-2">
                     {Array.from({length: Math.ceil(stats.maxMana / 20)}).map((_, i) => (
                         <span key={i} className="text-blue-400 text-lg drop-shadow-md">
                             {stats.mana >= (i+1)*20 ? '⭐' : '☆'}
                         </span>
                     ))}
                 </div>
            </div>
            
            {/* HUD Right - Equipment Only */}
            {(showInv || showShop || activeChest) && (
                 <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-row gap-2 p-2 bg-blue-900 bg-opacity-80 rounded-lg border-2 border-blue-800 z-30">
                     <div className="flex flex-col gap-2">
                         <div className="text-[10px] text-gray-300 font-bold text-center">EQUIP</div>
                         {armor.map((item, i) => (
                            <Slot 
                                key={`armor-${i}`} 
                                item={item}
                                label={i === 0 ? "HEAD" : i === 1 ? "BODY" : "LEGS"}
                                onMouseDown={() => handleDragStart('armor', i)}
                                onMouseUp={() => handleDrop('armor', i)}
                                onMouseEnter={(e) => handleMouseEnter(e, item)}
                                onMouseLeave={handleMouseLeave}
                                transparent={dragSource?.list === 'armor' && dragSource.index === i}
                            />
                        ))}
                        <div className="text-xs text-gray-300 mt-2 text-center">
                            Def: {stats.def}
                        </div>
                     </div>
                     
                     <div className="flex flex-col gap-2">
                         <div className="text-[10px] text-gray-300 font-bold text-center">ACCESSORY</div>
                         {accessories.map((item, i) => (
                            <Slot 
                                key={`acc-${i}`} 
                                item={item}
                                onMouseDown={() => handleDragStart('accessories', i)}
                                onMouseUp={() => handleDrop('accessories', i)}
                                onMouseEnter={(e) => handleMouseEnter(e, item)}
                                onMouseLeave={handleMouseLeave}
                                transparent={dragSource?.list === 'accessories' && dragSource.index === i}
                            />
                        ))}
                     </div>
                 </div>
            )}

            <div className="absolute top-2 left-2 flex gap-1 z-10">
                {hotbar.map((item, i) => (
                    <div 
                        key={i}
                        className={`w-12 h-12 border-2 bg-blue-900 bg-opacity-80 flex items-center justify-center relative cursor-pointer transition-transform
                        ${selectedSlot === i ? 'border-yellow-400 scale-105' : 'border-blue-800'}
                        ${dragSource?.list === 'inv' && dragSource.index === i ? 'opacity-50' : ''}`}
                        onClick={() => {
                            engineRef.current.player.sel = i;
                            setSelectedSlot(i);
                        }}
                        onMouseDown={() => handleDragStart('inv', i)}
                        onMouseUp={() => handleDrop('inv', i)}
                        onMouseEnter={(e) => handleMouseEnter(e, item)}
                        onMouseLeave={handleMouseLeave}
                    >
                        {item.id !== 0 && (
                            <>
                                <ItemIcon id={item.id} />
                                {item.n > 1 && <span className="absolute bottom-0 right-1 text-xs font-bold drop-shadow-md">{item.n}</span>}
                                {item.prefix && <span className="absolute top-0 right-0 w-2 h-2 bg-yellow-400 rounded-full" title="Modified"></span>}
                            </>
                        )}
                        <span className="absolute top-0 left-1 text-[10px] text-gray-400 font-mono">{i + 1 === 10 ? 0 : i + 1}</span>
                    </div>
                ))}
            </div>

            {/* Inventory Grid */}
            {(showInv || showShop || activeChest) && (
                <>
                    <div className="absolute top-16 left-2 flex gap-2 bg-blue-900 bg-opacity-90 rounded-lg border-2 border-blue-800 backdrop-blur-sm z-20 p-2">
                        <div className="grid grid-cols-10 gap-1">
                            {mainInv.map((item, i) => {
                                const realIdx = i + 10;
                                return (
                                    <Slot 
                                        key={realIdx} 
                                        item={item}
                                        isSelected={selectedSlot === realIdx}
                                        onSelect={() => handleInventoryClick(realIdx, item)}
                                        onMouseDown={() => handleDragStart('inv', realIdx)}
                                        onMouseUp={() => handleDrop('inv', realIdx)}
                                        onMouseEnter={(e) => handleMouseEnter(e, item)}
                                        onMouseLeave={handleMouseLeave}
                                        transparent={dragSource?.list === 'inv' && dragSource.index === realIdx}
                                    />
                                );
                            })}
                        </div>
                        
                        <div className="flex flex-col gap-2 border-l border-blue-700 pl-2">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-gray-300 font-bold text-center">COINS</span>
                                {coins.map((item, i) => (
                                     <Slot 
                                        key={`coins-${i}`} 
                                        item={item}
                                        onMouseDown={() => handleDragStart('coins', i)}
                                        onMouseUp={() => handleDrop('coins', i)}
                                        onMouseEnter={(e) => handleMouseEnter(e, item)}
                                        onMouseLeave={handleMouseLeave}
                                        transparent={dragSource?.list === 'coins' && dragSource.index === i}
                                        small
                                    />
                                ))}
                            </div>
                            <div className="h-1 bg-blue-800"></div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-gray-300 font-bold text-center">AMMO</span>
                                {ammo.map((item, i) => (
                                     <Slot 
                                        key={`ammo-${i}`} 
                                        item={item}
                                        onMouseDown={() => handleDragStart('ammo', i)}
                                        onMouseUp={() => handleDrop('ammo', i)}
                                        onMouseEnter={(e) => handleMouseEnter(e, item)}
                                        onMouseLeave={handleMouseLeave}
                                        transparent={dragSource?.list === 'ammo' && dragSource.index === i}
                                        small
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {!showShop && !activeChest && (
                        <div className="absolute left-2 w-64 flex flex-col gap-2 z-30" style={{ top: '350px' }}> 
                            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider bg-black bg-opacity-50 p-1 rounded">Crafting</h3>
                            <div className="flex flex-col gap-1 overflow-y-auto max-h-[350px] pr-2 pb-10 bg-blue-900 bg-opacity-80 p-2 rounded border border-blue-700 custom-scrollbar">
                                {craftables.length === 0 && <span className="text-gray-400 text-xs italic p-2">No recipes available.</span>}
                                {craftables.map((recipe, i) => (
                                    <div 
                                        key={i} 
                                        className="flex items-center gap-2 p-1 hover:bg-blue-700 rounded cursor-pointer transition-colors border border-transparent hover:border-blue-500"
                                        onClick={() => handleCraft(recipe)}
                                        onMouseEnter={(e) => setHoverItem({name: PROPS[recipe.out].name, x: e.clientX, y: e.clientY})}
                                        onMouseLeave={handleMouseLeave}
                                    >
                                        <div className="w-10 h-10 flex items-center justify-center bg-blue-950 rounded border border-blue-800 shrink-0">
                                            <ItemIcon id={recipe.out} size={32} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold truncate w-40">{PROPS[recipe.out]?.name}</span>
                                            <div className="flex gap-2 flex-wrap">
                                                {Object.entries(recipe.cost).map(([id, n]) => (
                                                    <span key={id} className="text-[10px] text-gray-300 flex items-center gap-1">
                                                        <ItemIcon id={parseInt(id)} size={12} /> {n as number}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {activeChest && (
                        <div className="absolute left-2 w-72 flex flex-col gap-2 z-30" style={{ top: '350px' }}>
                            <div className="flex justify-between items-center bg-black bg-opacity-50 p-1 rounded">
                                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Chest</h3>
                                <span className="text-xs text-gray-400">Esc to close</span>
                            </div>
                            <div className="grid grid-cols-5 gap-1 bg-blue-900 bg-opacity-80 p-2 rounded border border-blue-700">
                                {activeChest.slots.map((item, i) => (
                                    <Slot 
                                        key={`chest-${i}`} 
                                        item={item}
                                        onMouseDown={() => handleDragStart('chest', i)}
                                        onMouseUp={() => handleDrop('chest', i)}
                                        onSelect={() => handleChestTransfer(true, i)}
                                        onMouseEnter={(e) => handleMouseEnter(e, item)}
                                        onMouseLeave={handleMouseLeave}
                                        transparent={dragSource?.list === 'chest' && dragSource.index === i}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {showShop && (
                        <div className="absolute left-2 w-72 flex flex-col gap-2 z-30" style={{ top: '350px' }}> 
                            <div className="flex justify-between items-center bg-black bg-opacity-50 p-1 rounded">
                                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Shop</h3>
                                <span className="text-xs text-yellow-400 font-bold">Wealth: {playerMoney} cp</span>
                            </div>
                            <div className="flex flex-col gap-1 overflow-y-auto max-h-[300px] pr-2 bg-blue-900 bg-opacity-80 p-2 rounded border border-blue-700 custom-scrollbar">
                                {shopItems.map((item, i) => (
                                    <div 
                                        key={i} 
                                        className={`flex items-center gap-2 p-1 rounded cursor-pointer transition-colors border border-transparent 
                                            ${playerMoney >= item.price ? 'hover:bg-blue-700 hover:border-blue-500' : 'opacity-50'}`}
                                        onClick={() => handleBuy(item)}
                                        onMouseEnter={(e) => setHoverItem({name: PROPS[item.id].name, x: e.clientX, y: e.clientY})}
                                        onMouseLeave={handleMouseLeave}
                                    >
                                        <div className="w-10 h-10 flex items-center justify-center bg-blue-950 rounded border border-blue-800 shrink-0">
                                            <ItemIcon id={item.id} size={32} />
                                        </div>
                                        <div className="flex flex-col w-full">
                                            <div className="flex justify-between w-full">
                                                <span className="text-sm font-bold truncate w-32">{PROPS[item.id]?.name}</span>
                                                <span className="text-xs text-yellow-300 font-bold">{item.price} cp</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {hoverItem && (
                <div 
                    className="absolute bg-blue-900 border-2 border-blue-600 text-white text-xs p-2 rounded-lg shadow-xl pointer-events-none z-[60] flex flex-col gap-1 min-w-[150px]"
                    style={{ left: hoverItem.x + 12, top: hoverItem.y + 12 }}
                >
                    <div className="font-bold text-lg leading-tight">
                        {hoverItem.prefixName && <span className="text-yellow-300">{hoverItem.prefixName} </span>}
                        {hoverItem.name}
                    </div>
                    {hoverItem.stats && (
                        <div className="flex flex-col gap-0.5 text-gray-200">
                            {hoverItem.stats.damage && <span>{hoverItem.stats.damage} {hoverItem.stats.class || 'Melee'} Damage</span>}
                            {hoverItem.stats.crit !== undefined && <span>{hoverItem.stats.crit}% Critical Strike Chance</span>}
                            {hoverItem.stats.pickPower && <span>{hoverItem.stats.pickPower}% Pickaxe Power</span>}
                            {hoverItem.stats.axePower && <span>{hoverItem.stats.axePower}% Axe Power</span>}
                            {hoverItem.stats.hammerPower && <span>{hoverItem.stats.hammerPower}% Hammer Power</span>}
                        </div>
                    )}
                    {hoverItem.desc && <div className="text-gray-400 italic max-w-[200px]">{hoverItem.desc}</div>}
                    {hoverItem.value && hoverItem.value > 0 && (
                        <div className="text-yellow-300 font-bold mt-1 border-t border-blue-800 pt-1">
                            Sell Price: {hoverItem.value} cp
                        </div>
                    )}
                </div>
            )}
            
            {dialogue && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[600px] bg-blue-900 bg-opacity-95 border-2 border-white rounded-lg p-4 z-40 shadow-2xl">
                    <h3 className="text-yellow-400 font-bold mb-1">{dialogue.name}</h3>
                    <p className="text-white text-sm">{dialogue.text}</p>
                    <div className="mt-4 flex gap-4">
                        <button 
                            className="bg-blue-700 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded border border-blue-500"
                            onClick={() => setDialogue(null)}
                        >
                            Close
                        </button>
                        {dialogue.type === 'merchant' && (
                             <button 
                                className="bg-yellow-700 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded border border-yellow-500"
                                onClick={() => { setShowShop(true); setDialogue(null); }}
                             >
                                Shop
                             </button>
                        )}
                    </div>
                </div>
            )}

            <div className="absolute bottom-4 left-4 text-xs text-gray-400 drop-shadow-md">
                WASD: Move | Space: Jump | Click: Attack/Dig/Place | Esc: Inventory | Ctrl: Smart Cursor ({smartCursor ? 'ON' : 'OFF'}) | Right Click: Interact | Shift: Auto Torch
            </div>
        </div>
    );
};

export default App;