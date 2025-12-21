import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './engine/GameEngine';
import { CHUNK_W, CHUNK_H, TILE_SIZE, DAY_LENGTH, NIGHT_START } from './constants';
import { PROPS, IDS, RECIPES, initializeGameData } from './data/items';
import { InventorySlot, NPC } from './types';

// --- Item Icon Component ---
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

        if (prop.icon) {
            ctx.font = `${TILE_SIZE}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(prop.icon, TILE_SIZE/2, TILE_SIZE/2 + 2);
            
            if (prop.tint) {
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = prop.tint;
                ctx.globalAlpha = 0.5;
                ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
                ctx.globalAlpha = 1.0;
                ctx.globalCompositeOperation = 'source-over';
            }
        } else {
            ctx.fillStyle = prop.c;
            ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        }
        ctx.restore();

    }, [id, size]);

    if (!id || id === 0) return null;

    return <canvas ref={canvasRef} width={size} height={size} />;
};

// --- Inventory Slot Component ---
const Slot: React.FC<{ 
    item: InventorySlot; 
    onSelect?: () => void; 
    isSelected?: boolean; 
    onMouseDown: () => void; 
    onMouseUp: () => void;
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
        {item.id !== 0 && (
            <>
                <ItemIcon id={item.id} size={small ? 32 : 40} />
                {item.n > 1 && <span className="absolute bottom-0 right-1 text-xs font-bold drop-shadow-md">{item.n}</span>}
            </>
        )}
    </div>
);


const App: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine>(new GameEngine());
    
    // UI State
    const [inv, setInv] = useState<InventorySlot[]>([]);
    const [armor, setArmor] = useState<InventorySlot[]>([]);
    const [coins, setCoins] = useState<InventorySlot[]>([]);
    const [ammo, setAmmo] = useState<InventorySlot[]>([]);
    const [stats, setStats] = useState({ hp: 100, maxHp: 100, mana: 20, maxMana: 20, def: 0 });
    
    const [selectedSlot, setSelectedSlot] = useState(0);
    const [showInv, setShowInv] = useState(false);
    const [craftables, setCraftables] = useState<any[]>([]);
    const [time, setTime] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [smartCursor, setSmartCursor] = useState(false);
    
    // Interaction States
    const [dragSource, setDragSource] = useState<{ list: string, index: number } | null>(null);
    const [hoverItem, setHoverItem] = useState<{name: string, x: number, y: number} | null>(null);
    const [dialogue, setDialogue] = useState<{name: string, text: string} | null>(null);
    
    const loadingRef = useRef(true);
    const loadedRef = useRef(false);

    useEffect(() => {
        if (loadedRef.current) return;
        loadedRef.current = true;

        const boot = async () => {
            try {
                await initializeGameData();
                engineRef.current.start();
                setInv([...engineRef.current.player.inv]);
                
                loadingRef.current = false;
                setLoading(false);
                
                let lastTime = performance.now();
                
                const loop = (timeNow: number) => {
                    const dt = (timeNow - lastTime) / 1000;
                    lastTime = timeNow;
                    update(dt);
                    draw();
                    requestAnimationFrame(loop);
                };
                requestAnimationFrame(loop);
            } catch (err: any) {
                console.error("Boot failed:", err);
                setError(err.message || "Unknown error occurred while loading.");
                loadingRef.current = false; 
                setLoading(false);
            }
        };
        boot();

        const handleResize = () => {
             if (canvasRef.current) {
                 canvasRef.current.width = window.innerWidth;
                 canvasRef.current.height = window.innerHeight;
             }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const keys = useRef<Record<string, boolean>>({});
    const mouse = useRef({ x: 0, y: 0, left: false, right: false });

    useEffect(() => {
        const onKD = (e: KeyboardEvent) => {
            keys.current[e.code] = true;
            if (e.code === 'Escape') {
                setShowInv(prev => !prev);
                setDialogue(null); 
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
             if (showInv) return; 
             if (dialogue) { setDialogue(null); return; }
             if (e.button === 0) mouse.current.left = true;
             if (e.button === 2) {
                 mouse.current.right = true;
                 const npc = engineRef.current.checkNPCInteract(e.clientX, e.clientY);
                 if (npc) {
                     setDialogue({
                         name: npc.type.toUpperCase(),
                         text: getNPCDialogue(npc.type)
                     });
                 }
             }
             const st = engineRef.current.getSmartTarget(e.clientX, e.clientY);
             engineRef.current.interact(e.clientX, e.clientY, e.button === 0, st);
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
    }, [showInv, dialogue]);

    const getNPCDialogue = (type: string) => {
        if (type === 'merchant') return "I've got the best goods! Check out my wares... if you have the coin.";
        if (type === 'nurse') return "Don't die on me! I can patch you up.";
        if (type === 'guide') return "Greetings! Need help? Try crafting a Workbench.";
        return "...";
    };

    useEffect(() => {
        const timer = setInterval(() => {
            if (!engineRef.current) return;
            const avail = RECIPES.filter(r => engineRef.current.canCraft(r));
            setCraftables(avail);
        }, 500);
        return () => clearInterval(timer);
    }, [inv]); 

    const update = (dt: number) => {
        if (loadingRef.current || error) return;
        
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
             setCoins(JSON.parse(JSON.stringify(p.coins)));
             setAmmo(JSON.parse(JSON.stringify(p.ammo)));
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
        
        if (loadingRef.current || error) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = error ? '#ff5555' : '#fff';
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(error || 'Loading...', width/2, height/2);
            return;
        }

        const game = engineRef.current;
        const t = game.time;
        let skyHex = '#87CEEB';
        if (t > NIGHT_START && t < 23000) skyHex = '#1a1a2e'; 
        else if (t >= 23000 || t < 1000) skyHex = '#ff9966';
        
        ctx.fillStyle = skyHex;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.translate(-Math.floor(game.camera.x), -Math.floor(game.camera.y));

        const sx = Math.max(0, Math.floor(game.camera.x / TILE_SIZE));
        const ex = Math.min(CHUNK_W, sx + Math.ceil(width / TILE_SIZE) + 1);
        const sy = Math.max(0, Math.floor(game.camera.y / TILE_SIZE));
        const ey = Math.min(CHUNK_H, sy + Math.ceil(height / TILE_SIZE) + 1);

        // Draw Walls
        for (let y = sy; y < ey; y++) {
            for (let x = sx; x < ex; x++) {
                const wid = game.walls[y * CHUNK_W + x];
                if (wid && PROPS[wid]) {
                    ctx.fillStyle = PROPS[wid].c;
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = 'rgba(0,0,0,0.4)';
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        // Draw Tiles
        for (let y = sy; y < ey; y++) {
            for (let x = sx; x < ex; x++) {
                const id = game.world[y * CHUNK_W + x];
                if (id !== IDS.AIR && PROPS[id]) {
                    const prop = PROPS[id];
                    const px = x * TILE_SIZE;
                    const py = y * TILE_SIZE;
                    
                    if (prop.solid) {
                        ctx.fillStyle = prop.c; 
                        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    }

                    if (prop.icon) {
                        ctx.font = `${TILE_SIZE}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(prop.icon, px + TILE_SIZE/2, py + TILE_SIZE/2 + 2);
                        if (prop.tint) {
                            ctx.globalCompositeOperation = 'source-atop';
                            ctx.fillStyle = prop.tint;
                            ctx.globalAlpha = 0.5; 
                            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                            ctx.globalAlpha = 1.0;
                            ctx.globalCompositeOperation = 'source-over';
                        }
                    } else {
                        ctx.fillStyle = prop.c;
                        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    }
                }
            }
        }

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

        // Mouse Cursor
        const mx = mouse.current.x + game.camera.x;
        const my = mouse.current.y + game.camera.y;
        
        const st = game.getSmartTarget(mouse.current.x, mouse.current.y);
        
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

    const drawEntity = (ctx: CanvasRenderingContext2D, e: any, type: string) => {
        const x = e.x;
        const y = e.y;
        
        ctx.save();
        if (e.immune && e.immune % 4 < 2) ctx.globalAlpha = 0.5;

        // Player Face direction logic
        // If not player, handle flipping normally. 
        // For player, flipping is handled by update logic but we check e.face
        if (e.face === -1) {
            ctx.translate(x + e.w, y);
            ctx.scale(-1, 1);
            ctx.translate(-x, -y);
        }
        
        const legOffset = Math.sin(e.walkFrame) * 4;

        if (type === 'player') {
             // Skin
             ctx.fillStyle = '#ffccbc'; 
             ctx.fillRect(x + 4, y + 2, 8, 8); // Head
             
             // Shirt
             ctx.fillStyle = '#00acc1'; 
             ctx.fillRect(x + 2, y + 10, 12, 14);
             
             // Pants
             ctx.fillStyle = '#1e88e5'; 
             ctx.fillRect(x + 4 - legOffset, y + 24, 4, 12);
             ctx.fillRect(x + 8 + legOffset, y + 24, 4, 12);
             
             // Shoes
             ctx.fillStyle = '#3e2723';
             ctx.fillRect(x + 3 - legOffset, y + 36, 6, 4);
             ctx.fillRect(x + 7 + legOffset, y + 36, 6, 4);
             
             // Hair
             ctx.fillStyle = '#5d4037'; 
             ctx.fillRect(x + 2, y, 12, 4);

             // Item Swing
             if (e.swinging > 0) {
                 ctx.save();
                 // Pivot at shoulder center approx
                 ctx.translate(x + e.w/2, y + e.h/2); 
                 
                 // If facing left, we mirrored the context already, so drawing "right" goes left visually.
                 // We need to account for rotation direction.
                 // e.targetAngle is absolute world angle.
                 // We need relative angle since context might be flipped.
                 
                 let angle = e.targetAngle;
                 if (e.face === -1) {
                     // Adjust angle for flipped context
                     // angle 0 (right) becomes PI (left). 
                     // The context is flipped horizontally.
                     // A point at (cos(a), sin(a)) becomes (-cos(a), sin(a)).
                     // So we need to mirror the angle calculation?
                     // Actually, since we flipped the context, drawing at 0 rad goes LEFT.
                     // But targetAngle is computed from raw world coords.
                     // Let's just use absolute rotation? No, the drawing context is flipped.
                     // Simplest: Undo flip for the weapon draw or adjust rotation.
                     
                     // Let's use simple logic: Swing starts back, goes forward.
                     // Forward is 0 degrees relative to face.
                     // But we want mouse aiming.
                     
                     // Reverting flip for weapon draw to handle absolute mouse angle easily:
                     ctx.scale(-1, 1);
                 }

                 // Now context is "normal" world orientation relative to pivot.
                 
                 // Animation progress 0 to 1
                 const progress = 1 - (e.swinging / 15);
                 
                 // Swing arc: +/- 60 degrees around target
                 const startAngle = e.targetAngle - Math.PI/3;
                 const endAngle = e.targetAngle + Math.PI/3;
                 
                 // Interpolate
                 const currentAngle = startAngle + (endAngle - startAngle) * progress;

                 ctx.rotate(currentAngle);
                 
                 // Draw Sword
                 ctx.fillStyle = '#bbb'; 
                 ctx.fillRect(0, -2, 40, 4); // Blade
                 ctx.fillStyle = '#5d4037';
                 ctx.fillRect(-6, -3, 6, 6); // Handle
                 
                 ctx.restore();
             }

        } else if (type === 'slime') {
             ctx.fillStyle = 'rgba(0, 150, 255, 0.8)';
             ctx.beginPath();
             ctx.arc(x + e.w/2, y + e.h/2 + 4, e.w/2, 0, Math.PI, true);
             ctx.fill();
        } else if (type === 'demon_eye') {
             // Sclera
             ctx.fillStyle = '#eee';
             ctx.beginPath();
             ctx.arc(x + e.w/2, y + e.h/2, e.w/2, 0, Math.PI*2);
             ctx.fill();
             // Iris
             ctx.fillStyle = '#b71c1c';
             ctx.beginPath();
             ctx.arc(x + e.w/2, y + e.h/2, e.w/4, 0, Math.PI*2);
             ctx.fill();
             // Veins
             ctx.strokeStyle = '#e57373';
             ctx.beginPath();
             ctx.moveTo(x+e.w/2, y); ctx.lineTo(x+e.w/2, y+10);
             ctx.stroke();
        } else if (type === 'merchant') {
             // Hat
             ctx.fillStyle = '#f57f17'; // Goldish hat
             ctx.fillRect(x + 2, y - 2, 12, 6);
             // Head
             ctx.fillStyle = '#ffccbc';
             ctx.fillRect(x + 4, y + 4, 8, 8);
             // Beard
             ctx.fillStyle = '#eee';
             ctx.fillRect(x + 4, y + 10, 8, 4);
             // Coat
             ctx.fillStyle = '#d84315';
             ctx.fillRect(x + 2, y + 14, 12, 14);
             // Legs
             ctx.fillStyle = '#3e2723';
             ctx.fillRect(x + 4 - legOffset, y + 28, 4, 12);
             ctx.fillRect(x + 8 + legOffset, y + 28, 4, 12);
        } else if (type === 'nurse') {
             // Hat
             ctx.fillStyle = '#fff';
             ctx.fillRect(x + 4, y, 8, 4);
             ctx.fillStyle = '#c62828'; // Cross
             ctx.fillRect(x + 7, y+1, 2, 2);
             // Head
             ctx.fillStyle = '#ffccbc';
             ctx.fillRect(x + 4, y + 4, 8, 8);
             // Shirt
             ctx.fillStyle = '#fff';
             ctx.fillRect(x + 3, y + 12, 10, 12);
             // Skirt
             ctx.fillStyle = '#fff';
             ctx.fillRect(x + 3, y + 24, 10, 10);
        } else if (type === 'guide') {
             // Hair
             ctx.fillStyle = '#795548'; 
             ctx.fillRect(x + 3, y, 10, 4);
             // Head
             ctx.fillStyle = '#ffccbc';
             ctx.fillRect(x + 4, y + 4, 8, 8);
             // Shirt
             ctx.fillStyle = '#8d6e63'; 
             ctx.fillRect(x + 2, y + 12, 12, 14);
             // Pants
             ctx.fillStyle = '#5d4037'; 
             ctx.fillRect(x + 4 - legOffset, y + 26, 4, 14);
             ctx.fillRect(x + 8 + legOffset, y + 26, 4, 14);
        } else if (type === 'zombie') {
             // Head
             ctx.fillStyle = '#689f38'; 
             ctx.fillRect(x + 4, y + 2, 8, 8);
             // Shirt
             ctx.fillStyle = '#558b2f'; 
             ctx.fillRect(x + 2, y + 10, 12, 14);
             // Pants
             ctx.fillStyle = '#1565c0'; 
             ctx.fillRect(x + 4 - legOffset, y + 24, 4, 12);
             ctx.fillRect(x + 8 + legOffset, y + 24, 4, 12);
             // Arms outstretched
             ctx.fillStyle = '#689f38';
             ctx.fillRect(x + 10, y + 12, 10, 4);
        }

        ctx.restore();
    };

    const handleCraft = (recipe: any) => {
        engineRef.current.craft(recipe);
    };

    const handleDragStart = (list: string, index: number) => {
        setDragSource({ list, index });
    };

    const handleDrop = (targetList: string, targetIdx: number) => {
        if (dragSource) {
            engineRef.current.swapInventory(dragSource.list, dragSource.index, targetList, targetIdx);
        }
        setDragSource(null);
    };

    const handleMouseEnter = (e: React.MouseEvent, item: InventorySlot) => {
        if (item.id !== 0 && PROPS[item.id]) {
            setHoverItem({name: PROPS[item.id].name, x: e.clientX, y: e.clientY});
        }
    };

    const handleMouseLeave = () => {
        setHoverItem(null);
    };

    const hotbar = inv.slice(0, 10);
    const mainInv = inv.slice(10);

    if (error) {
        return (
            <div className="flex items-center justify-center w-screen h-screen bg-black text-white p-4 text-center">
                <div>
                    <h2 className="text-xl text-red-500 font-bold mb-2">Failed to Load Game Data</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

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
            {!loading && (
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
            )}
            
            {/* HUD Right - Equipment Only */}
            {!loading && showInv && (
                 <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 p-2 bg-blue-900 bg-opacity-80 rounded-lg border-2 border-blue-800 z-30">
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
            )}

            {loading && <div className="absolute inset-0 bg-black text-white flex items-center justify-center text-2xl z-50">Loading Terraria Data...</div>}

            {!loading && (
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
                                </>
                            )}
                            <span className="absolute top-0 left-1 text-[10px] text-gray-400 font-mono">{i + 1 === 10 ? 0 : i + 1}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Inventory Grid + Coins/Ammo (Left) */}
            {!loading && showInv && (
                <>
                    <div className="absolute top-16 left-2 flex gap-2 bg-blue-900 bg-opacity-90 rounded-lg border-2 border-blue-800 backdrop-blur-sm z-20 p-2">
                        {/* Main Inventory */}
                        <div className="grid grid-cols-10 gap-1">
                            {mainInv.map((item, i) => {
                                const realIdx = i + 10;
                                return (
                                    <Slot 
                                        key={realIdx} 
                                        item={item}
                                        isSelected={selectedSlot === realIdx}
                                        onSelect={() => { engineRef.current.player.sel = realIdx; setSelectedSlot(realIdx); }}
                                        onMouseDown={() => handleDragStart('inv', realIdx)}
                                        onMouseUp={() => handleDrop('inv', realIdx)}
                                        onMouseEnter={(e) => handleMouseEnter(e, item)}
                                        onMouseLeave={handleMouseLeave}
                                        transparent={dragSource?.list === 'inv' && dragSource.index === realIdx}
                                    />
                                );
                            })}
                        </div>
                        
                        {/* Coins & Ammo Column */}
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

                    {/* Crafting Menu (Below Inventory) */}
                    <div className="absolute left-2 w-64 flex flex-col gap-2 z-30" style={{ top: '350px' }}> 
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider bg-black bg-opacity-50 p-1 rounded">Crafting</h3>
                        <div className="flex flex-col gap-1 overflow-y-auto max-h-[300px] pr-2 bg-blue-900 bg-opacity-80 p-2 rounded border border-blue-700">
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
                </>
            )}

            {/* Tooltip */}
            {hoverItem && (
                <div 
                    className="absolute bg-blue-900 border border-blue-500 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none z-50"
                    style={{ left: hoverItem.x + 10, top: hoverItem.y + 10 }}
                >
                    {hoverItem.name}
                </div>
            )}
            
            {/* NPC Dialogue */}
            {dialogue && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[600px] bg-blue-900 bg-opacity-95 border-2 border-white rounded-lg p-4 z-40 shadow-2xl">
                    <h3 className="text-yellow-400 font-bold mb-1">{dialogue.name}</h3>
                    <p className="text-white text-sm">{dialogue.text}</p>
                    <span className="text-xs text-gray-400 mt-2 block">(Press Esc to close)</span>
                </div>
            )}

            {!loading && <div className="absolute bottom-4 left-4 text-xs text-gray-400 drop-shadow-md">
                WASD: Move | Space: Jump | Click: Attack/Dig/Place | Esc: Inventory | Ctrl: Smart Cursor ({smartCursor ? 'ON' : 'OFF'}) | Right Click: Interact
            </div>}
        </div>
    );
};

export default App;
