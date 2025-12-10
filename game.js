// ... (Previous Global Vars) ...
let smartCursorActive = false;
let smartTarget = null;

function initWorld() {
    console.log("Generating world...");

    // 1. Basic Terrain
    for (let x = 0; x < CHUNK_W; x++) {
        const baseHeight = Math.floor(CHUNK_H * 0.42);
        const h = baseHeight +
                  Math.floor(Math.sin(x * 0.04) * 12 + Math.sin(x * 0.15) * 5 + Math.cos(x * 0.08) * 3);

        for (let y = 0; y < CHUNK_H; y++) {
            const idx = y * CHUNK_W + x;

            if (y < h) {
                world[idx] = IDS.AIR;
            } else if (y < h + 6) {
                world[idx] = IDS.DIRT_BLOCK;
            } else {
                world[idx] = IDS.STONE_BLOCK;
            }

            // Caves
            if (y > h + 10 && y < CHUNK_H - 5) {
                const noise1 = Math.sin(x * 0.08 + y * 0.12) * Math.cos(x * 0.15 - y * 0.09);
                const noise2 = Math.sin(x * 0.22 - y * 0.18);
                if (noise1 + noise2 > 1.3) {
                    world[idx] = IDS.AIR;
                }
            }
        }
    }

    // 2. Ore Generation
    generateOre(IDS.COPPER_ORE, 60, 0.5);
    generateOre(IDS.IRON_ORE, 40, 0.6);
    generateOre(IDS.GOLD_ORE, 25, 0.7);

    // 3. Trees
    for (let x = 0; x < CHUNK_W; x++) {
        const h = getGroundHeight(x);
        if (x > 15 && x < CHUNK_W - 15 && world[h * CHUNK_W + x] === IDS.GRASS_BLOCK && Math.random() < 0.08) {
             const treeHeight = 5 + Math.floor(Math.random() * 5);
             for (let i = 1; i <= treeHeight; i++) {
                 if (h - i >= 0) world[(h - i) * CHUNK_W + x] = IDS.WOOD;
             }
             const leafTop = h - treeHeight;
             for (let ly = leafTop - 2; ly <= leafTop; ly++) {
                 for (let lx = x - 2; lx <= x + 2; lx++) {
                     if (lx >= 0 && lx < CHUNK_W && ly >= 0 && ly < CHUNK_H) {
                         const dist = Math.abs(lx - x) + Math.abs(ly - leafTop);
                         if (dist <= 2 && world[ly * CHUNK_W + lx] === IDS.AIR) {
                             world[ly * CHUNK_W + lx] = IDS.LEAVES_BLOCK;
                         }
                     }
                 }
             }
        }
    }

    // 4. Cabins
    for (let i = 0; i < 6; i++) {
        const cx = 25 + Math.floor(Math.random() * (CHUNK_W - 50));
        const cy = Math.floor(CHUNK_H * 0.55) + Math.floor(Math.random() * (CHUNK_H * 0.3));
        generateCabin(cx, cy);
    }

    player = new Player(CHUNK_W * TILE / 2, 10 * TILE);
    updateInv();
    console.log("World generated!");
}

function getGroundHeight(x) {
    for (let y = 0; y < CHUNK_H; y++) {
        const t = world[y * CHUNK_W + x];
        if (t && PROPS[t].solid) return y;
    }
    return CHUNK_H;
}

function generateOre(id, attempts, depthFactor) {
    for (let i = 0; i < attempts; i++) {
        const x = Math.floor(Math.random() * CHUNK_W);
        const minY = Math.floor(CHUNK_H * 0.2);
        const y = minY + Math.floor(Math.random() * (CHUNK_H * depthFactor));

        if (x >= 0 && x < CHUNK_W && y >= 0 && y < CHUNK_H) {
            const size = 3 + Math.floor(Math.random() * 5);
            for (let j = 0; j < size; j++) {
                const ox = x + Math.floor(Math.random() * 3) - 1;
                const oy = y + Math.floor(Math.random() * 3) - 1;
                const idx = oy * CHUNK_W + ox;
                if (ox >= 0 && ox < CHUNK_W && oy >= 0 && oy < CHUNK_H) {
                    const t = world[idx];
                    if (t === IDS.STONE_BLOCK || t === IDS.DIRT_BLOCK) {
                        world[idx] = id;
                    }
                }
            }
        }
    }
}

function generateCabin(cx, cy) {
    const w = 9, h = 6;
    for (let y = cy; y < cy + h; y++) {
        for (let x = cx; x < cx + w; x++) {
            if (x < 0 || x >= CHUNK_W || y < 0 || y >= CHUNK_H) continue;
            const idx = y * CHUNK_W + x;
            if (y === cy || y === cy + h - 1) world[idx] = IDS.WOOD;
            else if (x === cx || x === cx + w - 1) world[idx] = IDS.WOOD;
            else world[idx] = IDS.AIR;
        }
    }
    const torchX = cx + 1, torchY = cy + 1;
    if (torchX < CHUNK_W && torchY < CHUNK_H) world[torchY * CHUNK_W + torchX] = IDS.TORCH;

    const chestX = cx + Math.floor(w / 2), chestY = cy + h - 2;
    if (chestX < CHUNK_W && chestY < CHUNK_H) {
        world[chestY * CHUNK_W + chestX] = IDS.CHEST;
        chests[`${chestX},${chestY}`] = [
            { id: IDS.LESSER_HEALING_POTION, n: 2 },
            { id: IDS.COPPER_BAR, n: 3 + Math.floor(Math.random()*5) },
            { id: IDS.GOLD_COIN, n: 1 + Math.floor(Math.random()*5) }
        ];
    }
}

function loop() {
    time = (time + 1) % 24000;
    const isNight = time > 13000 && time < 23000;

    if (entities.length < 15 && Math.random() < (isNight ? 0.025 : 0.015)) {
        const spawnSide = Math.random() > 0.5 ? 1 : -1;
        const sx = player.x + spawnSide * (350 + Math.random() * 250);
        const tx = Math.floor(sx / TILE);

        if (tx > 5 && tx < CHUNK_W - 5) {
            let sy = 0;
            for (let y = 0; y < CHUNK_H - 5; y++) {
                const idx = y * CHUNK_W + tx;
                if (world[idx] && PROPS[world[idx]].solid) {
                    sy = (y - 3) * TILE;
                    break;
                }
            }
            if (sy > 0) {
                if (isNight && Math.random() > 0.3) entities.push(new Zombie(sx, sy));
                else entities.push(new Slime(sx, sy, Math.random() > 0.75));
            }
        }
    }

    if (isNight && Math.random() < 0.005) {
        const sx = player.x + (Math.random() - 0.5) * 600;
        const sy = Math.max(0, player.y - 400);
        entities.push(new FallenStar(sx, sy));
    }

    player.update();
    entities = entities.filter(e => !e.dead);
    entities.forEach(e => e.update());
    loot = loot.filter(l => !l.dead);
    loot.forEach(l => l.update());
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += GRAVITY * 0.3; p.life--;
    });

    camera.x += (player.x - W / 2 - camera.x) * 0.1;
    camera.y += (player.y - H / 2 - camera.y) * 0.1;
    camera.x = Math.max(0, Math.min(camera.x, CHUNK_W * TILE - W));
    camera.y = Math.max(0, Math.min(camera.y, CHUNK_H * TILE - H));

    handleInput();
    updateSmartCursor();
    draw(isNight);
    updateUI(isNight);

    requestAnimationFrame(loop);
}

function updateSmartCursor() {
    const hl = document.getElementById('smart-cursor-highlight');
    if (!smartCursorActive) {
        smartTarget = null;
        hl.style.display = 'none';
        return;
    }

    const mx = mouse.x + camera.x;
    const my = mouse.y + camera.y;
    const cur = player.inv[player.sel];
    smartTarget = null;

    if (cur.id && PROPS[cur.id] && PROPS[cur.id].tool) {
        const tool = PROPS[cur.id].tool;
        const px = Math.floor((player.x + player.w/2) / TILE);
        const py = Math.floor((player.y + player.h/2) / TILE);

        if (tool === 'axe') {
            let bestDist = 9999;
            for (let y = py - 10; y < py + 10; y++) {
                for (let x = px - 10; x < px + 10; x++) {
                    if(x<0||x>=CHUNK_W||y<0||y>=CHUNK_H) continue;
                    const tile = world[y*CHUNK_W+x];
                    if (tile === IDS.WOOD) {
                        const d = Math.hypot(x*TILE - mx, y*TILE - my);
                        if (d < bestDist && d < 300) {
                            bestDist = d;
                            smartTarget = {x, y};
                        }
                    }
                }
            }
        } else if (tool === 'pick') {
            const angle = Math.atan2(my - (player.y+player.h/2), mx - (player.x+player.w/2));
            for(let r = 1; r < 5; r++) {
                const tx = Math.floor(px + Math.cos(angle) * r);
                const ty = Math.floor(py + Math.sin(angle) * r);
                if(tx<0||tx>=CHUNK_W||ty<0||ty>=CHUNK_H) continue;
                const tile = world[ty*CHUNK_W+tx];
                if (tile && PROPS[tile].solid) {
                    smartTarget = {x: tx, y: ty};
                    break;
                }
            }
        }
    }

    if (smartTarget) {
        hl.style.display = 'block';
        hl.style.left = (smartTarget.x * TILE - camera.x) + 'px';
        hl.style.top = (smartTarget.y * TILE - camera.y) + 'px';
    } else {
        hl.style.display = 'none';
    }
}

function handleInput() {
    if (isInventoryOpen) return;

    // Smart Cursor Override
    let tx, ty;
    if (smartCursorActive && smartTarget) {
        tx = smartTarget.x;
        ty = smartTarget.y;
    } else {
        tx = Math.floor((mouse.x + camera.x) / TILE);
        ty = Math.floor((mouse.y + camera.y) / TILE);
    }

    const targetPxX = tx * TILE + TILE/2;
    const targetPxY = ty * TILE + TILE/2;
    const dist = Math.hypot(player.x + player.w/2 - targetPxX, player.y + player.h/2 - targetPxY);

    if (dist > PLAYER_REACH) return;
    if (tx < 0 || tx >= CHUNK_W || ty < 0 || ty >= CHUNK_H) return;

    const idx = ty * CHUNK_W + tx;
    const tile = world[idx];
    const cur = player.inv[player.sel];

    // Mouse Left - Mining / Attack (With Timer for Auto-Use)
    if (mouse.l) {
        // If holding mouse, we act if timer is 0
        if (player.useTimer === 0) {

            // Attack with Sword
            if (cur.id && PROPS[cur.id] && PROPS[cur.id].tool === 'sword') {
                entities.forEach(e => {
                    if (Math.hypot(targetPxX - (e.x+e.w/2), targetPxY - (e.y+e.h/2)) < 60) {
                        e.hit(PROPS[cur.id].dmg, player.face);
                    }
                });
                player.useTimer = 20; // Sword swing delay
            }
            // Mining
            else if (tile !== IDS.BEDROCK_BLOCK) {
                const prop = PROPS[tile] || {};
                let canMine = false;

                if (cur.id && PROPS[cur.id] && PROPS[cur.id].tool) {
                    const tool = PROPS[cur.id].tool;
                    const pwr = PROPS[cur.id].pwr || 1;

                    if (tool === 'pick' && prop.solid) canMine = true;
                    if (tool === 'axe' && (tile === IDS.WOOD || tile === IDS.LEAVES_BLOCK || tile === IDS.WOOD_PLANKS_BLOCK)) canMine = true;

                    if (prop.hardness && pwr < prop.hardness) canMine = false;
                } else {
                    // Hand mining (weak)
                    if (prop.hardness <= 1) canMine = true;
                }

                if (canMine && tile !== IDS.AIR) {
                    if (tile === IDS.CHEST && chests[`${tx},${ty}`]) {
                        spawnFloatText(targetPxX, targetPxY, "Empty chest first!");
                        // Don't set timer here, let them try again immediately or UI feedback
                    } else {
                        world[idx] = IDS.AIR;
                        if (tile !== IDS.LEAVES_BLOCK && tile !== IDS.GRASS_BLOCK) {
                            spawnLoot(targetPxX, targetPxY, tile, 1);
                        }
                        spawnParticles(targetPxX, targetPxY, prop.c, 5);
                        if (tile === IDS.CHEST) delete chests[`${tx},${ty}`];

                        player.useTimer = 12; // Mining speed (lower = faster)
                    }
                }
            }
        }
    }

    // Mouse Right - Interact / Place (Single Click Only)
    if (mouse.r && !mouse.lastR) {
        mouse.lastR = true;

        if (tile === IDS.WORK_BENCH || tile === IDS.FURNACE || tile === IDS.IRON_ANVIL) {
            if (!isInventoryOpen) toggleInventory();
        }
        else if (tile === IDS.CHEST && chests[`${tx},${ty}`]) {
            const items = chests[`${tx},${ty}`];
            items.forEach(item => {
                player.add(item.id, item.n);
                spawnFloatText(targetPxX, targetPxY - 20, `+${item.n} ${PROPS[item.id].name}`);
            });
            delete chests[`${tx},${ty}`];
            spawnParticles(targetPxX, targetPxY, '#ffd700', 8);
        }
        else if (tile === IDS.AIR && cur.id) {
            if (PROPS[cur.id].consumable) {
                player.use(player.sel);
            }
            else if (PROPS[cur.id].solid !== undefined || PROPS[cur.id].light) {
                const bx1 = tx*TILE, bx2=(tx+1)*TILE, by1=ty*TILE, by2=(ty+1)*TILE;
                const px1 = player.x, px2=player.x+player.w, py1=player.y, py2=player.y+player.h;

                let colliding = (px1 < bx2 && px2 > bx1 && py1 < by2 && py2 > by1);
                if (!PROPS[cur.id].solid) colliding = false;

                if (!colliding) {
                    const placedId = cur.id;
                    if (player.rem(placedId, 1)) {
                        world[idx] = placedId;
                        spawnParticles(targetPxX, targetPxY, PROPS[placedId].c, 3);
                    }
                }
            }
        }
    }

    if (!mouse.l) mouse.lastL = false;
    if (!mouse.r) mouse.lastR = false;
}

// ... (Rest of UI functions same) ...
function spawnLoot(x, y, id, n) { loot.push(new LootItem(x, y, id, n)); }
function spawnParticles(x, y, c, n) {
    for (let i = 0; i < n; i++) particles.push({ x, y, vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6-2, c, life: 25+Math.floor(Math.random()*15) });
}
function spawnFloatText(x, y, txt, color = '#ffd700') {
    const d = document.createElement('div'); d.className = 'float-text'; d.innerText = txt; d.style.left = (x - camera.x) + 'px'; d.style.top = (y - camera.y) + 'px'; d.style.color = color;
    document.body.appendChild(d); setTimeout(() => d.remove(), 1200);
}

function draw(isNight) {
    const dayCol = [135, 206, 250]; const nightCol = [15, 15, 35];
    const t = isNight ? Math.min(1, (time - 13000) / 2000) : Math.max(0, 1 - (time - 21000) / 2000);
    const sky = dayCol.map((d, i) => Math.floor(d + (nightCol[i] - d) * t));
    ctx.fillStyle = `rgb(${sky[0]},${sky[1]},${sky[2]})`; ctx.fillRect(0, 0, W, H);

    ctx.save(); ctx.translate(-Math.floor(camera.x), -Math.floor(camera.y));

    const sx = Math.max(0, Math.floor(camera.x / TILE) - 1); const ex = Math.min(CHUNK_W, Math.ceil((camera.x + W) / TILE) + 1);
    const sy = Math.max(0, Math.floor(camera.y / TILE) - 1); const ey = Math.min(CHUNK_H, Math.ceil((camera.y + H) / TILE) + 1);

    for (let y = sy; y < ey; y++) {
        for (let x = sx; x < ex; x++) {
            const idx = y * CHUNK_W + x; const t = world[idx];
            if (t && t !== IDS.AIR && PROPS[t]) {
                const prop = PROPS[t];
                ctx.fillStyle = prop.c;
                const px = x * TILE; const py = y * TILE;
                ctx.fillRect(px, py, TILE, TILE);
                if (prop.solid) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4); }
                if (t === IDS.TORCH) { ctx.fillStyle = '#ff6f00'; ctx.fillRect(px + 14, py + 8, 4, 8); }
                else if (t === IDS.CHEST) { ctx.fillStyle = '#000'; ctx.fillRect(px + 8, py + 14, 16, 4); }
                else if (t === IDS.FURNACE) { ctx.fillStyle = '#000'; ctx.fillRect(px+4, py+4, 24, 24); ctx.fillStyle = '#f44336'; ctx.fillRect(px+8, py+18, 16, 6); }
                else if (t === IDS.ANVIL) { ctx.fillStyle = '#263238'; ctx.fillRect(px+2, py+12, 28, 6); ctx.fillRect(px+8, py+18, 16, 14); }
            }
        }
    }

    [...loot, ...entities].forEach(e => {
        if(e instanceof LootItem || e instanceof FallenStar) {
            const prop = PROPS[e.id] || PROPS[IDS.STAR];
            if(prop) {
                ctx.font = '14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                if (e instanceof FallenStar) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10; ctx.save(); ctx.translate(e.x + 8, e.y + 8); ctx.rotate(e.rotation); ctx.fillText(prop.icon, 0, 0); ctx.restore(); }
                else { ctx.fillText(prop.icon, e.x, e.y); }
                ctx.shadowBlur = 0;
            }
        } else {
            if (e instanceof Slime) { ctx.fillStyle = e.color; ctx.beginPath(); ctx.ellipse(e.x + e.w/2, e.y + e.h/2, e.w/2, e.h/2, 0, 0, Math.PI * 2); ctx.fill(); }
            else if (e instanceof Zombie) { ctx.fillStyle = e.color; ctx.fillRect(e.x, e.y, e.w, e.h); ctx.fillStyle = '#2e7d32'; ctx.fillRect(e.x, e.y, e.w, 12); }
            if (e.hpBarTimer > 0 && e.hp < e.maxHp) { const barY = e.y - 8; ctx.fillStyle = 'red'; ctx.fillRect(e.x, barY, e.w, 4); ctx.fillStyle = '#4caf50'; ctx.fillRect(e.x, barY, e.w * (e.hp / e.maxHp), 4); }
        }
    });

    let shirtCol = '#e53935', pantsCol = '#1976d2', headCol = '#ffcc80';
    if (player.armor[1]) shirtCol = PROPS[player.armor[1].id].c;
    if (player.armor[2]) pantsCol = PROPS[player.armor[2].id].c;
    if (player.armor[0]) headCol = PROPS[player.armor[0].id].c;
    ctx.fillStyle = shirtCol; ctx.fillRect(player.x, player.y + 10, player.w, 24);
    ctx.fillStyle = headCol; ctx.fillRect(player.x, player.y, player.w, 10);
    ctx.fillStyle = pantsCol; ctx.fillRect(player.x, player.y + 34, player.w, 10);

    const held = player.inv[player.sel];
    if (held.id) {
        ctx.save(); ctx.translate(player.x + 10, player.y + 22);
        const swingAngle = mouse.l ? player.face * -0.6 : 0; ctx.rotate(swingAngle * player.face); ctx.scale(player.face, 1);
        ctx.font = '20px Arial'; ctx.textAlign = 'center'; ctx.fillText(PROPS[held.id].icon, 8, -8);
        ctx.restore();
    }
    particles.forEach(p => { ctx.fillStyle = p.c; ctx.globalAlpha = p.life / 40; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); ctx.globalAlpha = 1; });

    if (!smartCursorActive) {
        const hx = Math.floor((mouse.x+camera.x)/TILE)*TILE; const hy = Math.floor((mouse.y+camera.y)/TILE)*TILE;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(hx, hy, TILE, TILE);
    }
    ctx.restore();
}

function updateUI(isNight) {
    const hc = document.getElementById('hearts-container'); hc.innerHTML = '';
    const hearts = Math.ceil(player.hp / 20); for (let i = 0; i < hearts; i++) hc.innerHTML += '<div class="heart"></div>';
}

function updateInv() {
    try {
        const hotbar = document.getElementById('hotbar-container'); hotbar.innerHTML = '';
        for (let i = 0; i < 10; i++) hotbar.appendChild(createSlotElement(player.inv[i], i, i===player.sel));

        const extension = document.getElementById('inventory-extension');
        if (isInventoryOpen) {
            extension.style.display = 'block';
            const grid = document.getElementById('inv-grid-extended'); grid.innerHTML = '';
            for (let i = 10; i < 50; i++) {
                const slotEl = createSlotElement(player.inv[i], i, false);
                slotEl.onclick = () => handleInvClick(i, 'inv');
                slotEl.oncontextmenu = (e) => { e.preventDefault(); handleInvRightClick(i, 'inv'); };
                slotEl.onmouseover = (e) => showTooltip(e, player.inv[i]);
                slotEl.onmouseout = () => hideTooltip();
                grid.appendChild(slotEl);
            }
            const armorDiv = document.getElementById('armor-slots'); armorDiv.innerHTML = '';
            player.armor.forEach((item, i) => {
                const d = document.createElement('div'); d.className = 'slot armor-slot';
                if (item) { d.innerHTML = `<div class="slot-icon">${PROPS[item.id].icon}</div>`; d.onmouseover = (e) => showTooltip(e, item, `Def: ${PROPS[item.id].defense}`); }
                else { d.innerHTML = `<span style="opacity:0.3;font-size:9px">Eq</span>`; }
                d.onmouseout = hideTooltip; d.onclick = () => handleInvClick(i, 'armor');
                d.oncontextmenu = (e) => { e.preventDefault(); handleInvRightClick(i, 'armor'); };
                armorDiv.appendChild(d);
            });
            document.getElementById('def-display').innerText = `Def: ${player.defense}`;
            updateCraftingList();
        } else { extension.style.display = 'none'; hideTooltip(); }
    } catch(e) { console.error("UI Update Error", e); }
}

function updateCraftingList() {
    const list = document.getElementById('crafting-list'); list.innerHTML = '';
    let stations = { [IDS.WORK_BENCH]: false, [IDS.FURNACE]: false, [IDS.IRON_ANVIL]: false };
    const px = Math.floor((player.x+player.w/2)/TILE); const py = Math.floor((player.y+player.h/2)/TILE);
    const minX = Math.max(0, px-4), maxX = Math.min(CHUNK_W-1, px+4);
    const minY = Math.max(0, py-4), maxY = Math.min(CHUNK_H-1, py+4);

    for(let y=minY; y<=maxY; y++) {
        for(let x=minX; x<=maxX; x++) {
            const t = world[y*CHUNK_W+x];
            if(stations[t] !== undefined) stations[t] = true;
        }
    }

    RECIPES.forEach(r => {
        let canCraft = true;
        if(r.req && !stations[r.req]) canCraft = false;
        for(const [id, n] of Object.entries(r.cost)) if(!player.has(parseInt(id), n)) canCraft = false;

        if(canCraft) {
            const slot = document.createElement('div'); slot.className = 'slot';
            slot.innerHTML = `<div class="slot-icon">${PROPS[r.out].icon}</div>`;
            slot.onclick = () => {
                for(const [id, n] of Object.entries(r.cost)) player.rem(parseInt(id), n);
                player.add(r.out, r.n); updateInv();
            };
            slot.onmouseover = (e) => showTooltip(e, {id: r.out}, `Cost: ${Object.entries(r.cost).map(([id, n]) => `${n} ${PROPS[id].name}`).join(', ')}`);
            slot.onmouseout = hideTooltip;
            list.appendChild(slot);
        }
    });
}

// ... (Rest of UI functions) ...
function createSlotElement(item, i, isActive) {
    const d = document.createElement('div'); d.className = `slot ${isActive ? 'active' : ''}`;
    if(item && item.id && PROPS[item.id]) d.innerHTML = `<div class="slot-icon">${PROPS[item.id].icon}</div><span class="count">${item.n > 1 ? item.n : ''}</span>`;
    if (i < 10) {
        d.onclick = () => { if(isInventoryOpen) handleInvClick(i, 'inv'); else { player.sel = i; updateInv(); } }
        if(isInventoryOpen) {
            d.oncontextmenu = (e) => { e.preventDefault(); handleInvRightClick(i, 'inv'); }
            if(item && item.id) { d.onmouseover = (e) => showTooltip(e, item); d.onmouseout = hideTooltip; }
        }
    }
    return d;
}

function showTooltip(e, item, extra = '') {
    const tt = document.getElementById('item-tooltip'); if(!item || !item.id || !PROPS[item.id]) return;
    const name = PROPS[item.id].name;
    tt.style.display = 'block'; tt.style.left = (e.clientX + 15) + 'px'; tt.style.top = (e.clientY + 15) + 'px';
    tt.innerHTML = name + (extra ? `<br><span style="font-size:10px;font-weight:normal">${extra}</span>` : '');
}
function hideTooltip() { document.getElementById('item-tooltip').style.display = 'none'; }

function handleInvClick(index, type) {
    if (type === 'inv') {
        if (heldItem) { const temp = player.inv[index]; player.inv[index] = heldItem; heldItem = temp; }
        else if (player.inv[index].id) { heldItem = player.inv[index]; player.inv[index] = {id:0, n:0}; }
    } else if (type === 'armor') {
        if (player.armor[index] && !heldItem) { heldItem = player.armor[index]; player.armor[index] = null; }
        else if (heldItem && !player.armor[index]) {
            const prop = PROPS[heldItem.id];
            if (prop.type === 'armor' && prop.slot === index) { player.armor[index] = heldItem; heldItem = null; }
        }
    }
    updateCursorItem(); updateInv();
}

function handleInvRightClick(index, type) {
    if (type === 'inv') {
        const item = player.inv[index];
        if (item.id && PROPS[item.id] && PROPS[item.id].type === 'armor') {
            const slotIdx = PROPS[item.id].slot; const old = player.armor[slotIdx]; player.armor[slotIdx] = item; player.inv[index] = old || {id:0, n:0}; updateInv();
        }
    } else if (type === 'armor') {
        if(player.armor[index]) { player.add(player.armor[index].id, player.armor[index].n); player.armor[index] = null; updateInv(); }
    }
}

function updateCursorItem() {
    const c = document.getElementById('cursor-item');
    if(heldItem && heldItem.id && PROPS[heldItem.id]) { c.style.display = 'flex'; c.innerHTML = PROPS[heldItem.id].icon; }
    else c.style.display = 'none';
}

function toggleInventory() {
    isInventoryOpen = !isInventoryOpen; updateInv();
    if (!isInventoryOpen && heldItem) { player.add(heldItem.id, heldItem.n); heldItem = null; updateCursorItem(); }
}

window.onresize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }; window.onresize();
window.onkeydown = e => { if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') toggleInventory(); if (e.key === 'Control') smartCursorActive = !smartCursorActive; keys[e.key] = true; if(!isInventoryOpen && e.key >= '0' && e.key <= '9') { player.sel = e.key === '0' ? 9 : parseInt(e.key) - 1; updateInv(); } };
window.onkeyup = e => keys[e.key] = false;
window.onmousedown = e => { if(isInventoryOpen) return; if(e.button===0) mouse.l=true; if(e.button===2) mouse.r=true; };
window.onmouseup = e => { if(e.button===0) mouse.l=false; if(e.button===2) mouse.r=false; };
window.onmousemove = e => { mouse.x=e.clientX; mouse.y=e.clientY; if(heldItem) { const c = document.getElementById('cursor-item'); c.style.left = e.clientX+'px'; c.style.top = e.clientY+'px'; } };
window.onwheel = e => { if(isInventoryOpen) return; player.sel = (player.sel + (e.deltaY > 0 ? 1 : -1) + 10) % 10; updateInv(); };
window.oncontextmenu = e => e.preventDefault();

initGameData().then(success => {
    if (success) {
        initWorld(); // Generate world only after IDs are ready
        // start game loop, etc.
        updateInv(); // Refresh UI
        loop();
    }
});
