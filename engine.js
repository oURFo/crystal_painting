import { PhysicsWorld, PhysicsPoint } from './physics.js';
import { GameRenderer } from './renderer.js';

export class GameEngine {
    constructor(canvas, onWin) {
        this.canvas       = canvas;
        this.renderer     = new GameRenderer(canvas);
        this.world        = new PhysicsWorld();
        this.hooks        = []; // { x, y, color, targetPoint, point, correct }
        this.isRunning    = false;
        this.draggedPoint = null;
        this.mouse        = { x: 0, y: 0 };
        this.onWin        = onWin || (() => {});

        this.bindEvents();
    }

    bindEvents() {
        this.canvas.addEventListener('mousedown',  (e) => this.onStart(e.clientX, e.clientY));
        this.canvas.addEventListener('mousemove',  (e) => this.onMove(e.clientX, e.clientY));
        this.canvas.addEventListener('mouseup',    ()  => this.onEnd());
        this.canvas.addEventListener('mouseleave', ()  => this.onEnd());

        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.touches[0]; this.onStart(t.clientX, t.clientY); }, { passive: false });
        this.canvas.addEventListener('touchmove',  (e) => { e.preventDefault(); const t = e.touches[0]; this.onMove(t.clientX, t.clientY); },  { passive: false });
        this.canvas.addEventListener('touchend',   ()  => this.onEnd());
    }

    // ── 座標轉換：螢幕 → 世界空間 ─────────────────────────────
    screenToWorld(clientX, clientY) {
        const aspect = window.innerWidth / window.innerHeight;
        const halfH  = Math.tan(30 * Math.PI / 180) * 6; // ≈ 3.464
        const halfW  = halfH * aspect;
        const wx = (clientX / window.innerWidth  - 0.5) * 2 * halfW;
        const wy = (clientY / window.innerHeight - 0.5) * -2 * halfH;
        return { x: wx, y: wy };
    }

    onStart(clientX, clientY) {
        const w = this.screenToWorld(clientX, clientY);
        this.mouse = w;

        let minD  = 1.5; // 放寬滑鼠抓取半徑
        let found = null;

        // 優先尋找邊界光點
        for (const p of this.world.points) {
            if (!p.isBoundary) continue;
            const dx = p.pos.x - w.x;
            const dy = p.pos.y - w.y;
            const d  = Math.sqrt(dx * dx + dy * dy);
            if (d < minD) { minD = d; found = p; }
        }

        // 如果沒抓到邊界光點，再尋找內部網格點
        if (!found) {
            minD = 1.5; // 重置搜尋半徑
            for (const p of this.world.points) {
                if (p.isBoundary) continue;
                const dx = p.pos.x - w.x;
                const dy = p.pos.y - w.y;
                const d  = Math.sqrt(dx * dx + dy * dy);
                if (d < minD) { minD = d; found = p; }
            }
        }

        if (found) {
            this.draggedPoint = found;

            // ── 從掛鉤上拿起時，立即釋放該掛鉤（讓其他點可以掛上）──
            for (const hook of this.hooks) {
                if (hook.point === found) {
                    hook.point   = null;
                    hook.correct = false;
                    break;
                }
            }

            found.isPinned = true;
            this.draggedPoint.pinnedTo = { x: w.x, y: w.y };
        }
    }

    onMove(clientX, clientY) {
        const w = this.screenToWorld(clientX, clientY);
        this.mouse = w;
        if (this.draggedPoint) {
            this.draggedPoint.pinnedTo.x = w.x;
            this.draggedPoint.pinnedTo.y = w.y;
        }
    }

    onEnd() {
        if (!this.draggedPoint) return;
        const hooked = this.tryHook(this.draggedPoint);
        if (!hooked) this.draggedPoint.isPinned = false;
        this.draggedPoint = null;
    }

    tryHook(point) {
        // 全光點中，只有「邊界光點」才能被掛上
        if (!point.isBoundary) return false;

        for (const hook of this.hooks) {
            // ── 一個掛鉤同時只接受一個光點 ──
            if (hook.point) continue;

            const dx = point.pos.x - hook.x;
            const dy = point.pos.y - hook.y;
            if (Math.sqrt(dx * dx + dy * dy) < 1.2) {
                // 吸附至掛鉤位置
                point.pos.x    = hook.x;
                point.pos.y    = hook.y;
                point.oldPos.x = hook.x;
                point.oldPos.y = hook.y;
                point.isPinned = true;
                point.pinnedTo = { x: hook.x, y: hook.y };
                hook.point     = point;

                // ── 放寬勝利條件：不要求絕對同一個點 ──
                const du = point.uv.u - hook.targetPoint.uv.u;
                const dv = point.uv.v - hook.targetPoint.uv.v;
                const distUV = Math.sqrt(du * du + dv * dv);
                hook.correct = (distUV < 0.15);

                this.playCrystalSound();

                // 所有掛鉤都掛上了正確光點才過關
                if (this.hooks.every(h => h.correct)) {
                    setTimeout(() => this.onWin(), 600);
                }
                return true;
            }
        }
        return false;
    }

    playCrystalSound() {
        try {
            const ctx  = this.audioCtx || (this.audioCtx = new (window.AudioContext || window.webkitAudioContext)());
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880 + Math.random() * 660, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + 0.5);
        } catch (e) {}
    }

    // ── 載入關卡 ─────────────────────────────────────────────
    async loadLevel(levelData) {
        this.isRunning = false;
        this.world = new PhysicsWorld();
        this.world.boundaryStiffness = 0.5;
        this.hooks = [];
        this.renderer.clearHooks();

        // 載入圖片（?v= 破快取，確保換圖後立即生效）
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = levelData.image + '?v=' + Date.now();
        await img.decode();

        const imgAspect = img.naturalWidth / img.naturalHeight;

        // 縮圖取樣（調高解析度至 70，取得密度與效能的完美平衡）
        const SAMPLE_H = 70;
        const SAMPLE_W = Math.round(SAMPLE_H * imgAspect);

        const offscreen = document.createElement('canvas');
        offscreen.width  = SAMPLE_W;
        offscreen.height = SAMPLE_H;
        const ctx2d = offscreen.getContext('2d');
        ctx2d.drawImage(img, 0, 0, SAMPLE_W, SAMPLE_H);
        const data = ctx2d.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;

        // 計算世界空間尺寸
        const halfH    = Math.tan(30 * Math.PI / 180) * 6; // ≈ 3.464
        const totalH   = halfH * 2 * 0.78;
        const totalW   = totalH * imgAspect;
        const spacingY = totalH / SAMPLE_H;
        const spacingX = totalW / SAMPLE_W;
        const startX   = -totalW / 2;
        const startY   =  totalH / 2;

        // 建立光點網格與邊界檢測
        const grid = [];
        let ptIndex = 0;
        for (let y = 0; y < SAMPLE_H; y++) {
            grid[y] = [];
            for (let x = 0; x < SAMPLE_W; x++) {
                const idx = (y * SAMPLE_W + x) * 4;
                const a = data[idx+3];
                if (a > 30) {
                    const wx  = startX + x * spacingX;
                    const wy  = startY - y * spacingY;
                    const r = data[idx], g = data[idx+1], b = data[idx+2];
                    const col = (r << 16) | (g << 8) | b;
                    const p   = new PhysicsPoint(wx, wy, col);
                    p.uv.u = x / (SAMPLE_W - 1);
                    p.uv.v = 1.0 - (y / (SAMPLE_H - 1));
                    p.index = ptIndex++;
                    this.world.addPoint(p);
                    grid[y][x] = p;
                }
            }
        }

        // 邊界檢測：使用棋盤格空間座標 (x+y)%8 來均勻抽取，保證四面八方都不會漏掉
        for (let y = 0; y < SAMPLE_H; y++) {
            for (let x = 0; x < SAMPLE_W; x++) {
                const p = grid[y][x];
                if (!p) continue;
                let isEdge = false;
                if (x === 0 || x === SAMPLE_W - 1 || y === 0 || y === SAMPLE_H - 1) {
                    isEdge = true;
                } else {
                    if (!grid[y-1][x] || !grid[y+1][x] || !grid[y][x-1] || !grid[y][x+1]) {
                        isEdge = true;
                    }
                }
                
                // 只有落在交錯座標上的邊緣點才升級為大光點
                if (isEdge && (x + y) % 8 === 0) {
                    p.isBoundary = true;
                } else {
                    p.isBoundary = false;
                }
            }
        }

        // 建立結構約束（4方向相鄰與對角）
        const structDirs = [[1,0], [0,1], [1,1], [-1,1]];
        for (let y = 0; y < SAMPLE_H; y++) {
            for (let x = 0; x < SAMPLE_W; x++) {
                const p = grid[y][x];
                if (!p) continue;
                
                // 約束
                for (const [dx, dy] of structDirs) {
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && nx < SAMPLE_W && ny >= 0 && ny < SAMPLE_H) {
                        const q = grid[ny][nx];
                        if (q) {
                            const dist = Math.sqrt((p.pos.x-q.pos.x)**2 + (p.pos.y-q.pos.y)**2);
                            this.world.addConstraint(p, q, dist, 1.0);
                        }
                    }
                }
            }
        }

        // ── 天際線掃描，找出圖片頂部邊界的突出峰值作為掛鉤目標 ──
        const skyline = new Array(SAMPLE_W).fill(SAMPLE_H);
        let minX = SAMPLE_W, maxX = -1;
        for (let x = 0; x < SAMPLE_W; x++) {
            for (let y = 0; y < SAMPLE_H; y++) {
                if (grid[y][x]) { // 直接找真實邊界，不受光點稀疏化影響
                    skyline[x] = y;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    break;
                }
            }
        }

        // ── 計算天際線的平坦程度 ──
        let globalMinY = SAMPLE_H;
        let globalMaxY = 0;
        for (let x = minX; x <= maxX; x++) {
            if (skyline[x] === SAMPLE_H) continue;
            if (skyline[x] < globalMinY) globalMinY = skyline[x];
            if (skyline[x] > globalMaxY) globalMaxY = skyline[x];
        }
        const skylineRange  = globalMaxY - globalMinY;
        const flatThreshold = Math.ceil(SAMPLE_H * 0.06); // 6% 高度內視為平坦

        let finalAnchors;
        if (skylineRange <= flatThreshold) {
            // ── 平坦天際線（方形/矩形圖片）→ 只用左右兩個掛鉤 ──
            finalAnchors = [
                { x: minX, y: skyline[minX] },
                { x: maxX, y: skyline[maxX] }
            ];
        } else {
            // ── 不規則天際線 → 峰值偵測 ──
            const winSz      = Math.max(3, Math.floor(SAMPLE_W * 0.08));
            const candidates = [];
            for (let x = minX; x <= maxX; x++) {
                if (skyline[x] === SAMPLE_H) continue;
                let isPeak = true;
                for (let w = -winSz; w <= winSz; w++) {
                    const nx = x + w;
                    if (nx >= minX && nx <= maxX && nx !== x && skyline[nx] !== SAMPLE_H) {
                        if (skyline[nx] < skyline[x]) { isPeak = false; break; }
                    }
                }
                if (isPeak) candidates.push({ x, y: skyline[x] });
            }
            if (minX < SAMPLE_W) candidates.push({ x: minX, y: skyline[minX] });
            if (maxX > -1)       candidates.push({ x: maxX, y: skyline[maxX] });

            const mergeThresh = SAMPLE_W * 0.12;
            const anchors = [];
            for (const c of candidates) {
                let merged = false;
                for (const a of anchors) {
                    if (Math.abs(c.x - a.x) < mergeThresh) {
                        if (c.y < a.y) { a.x = c.x; a.y = c.y; }
                        merged = true; break;
                    }
                }
                if (!merged) anchors.push({ ...c });
            }
            anchors.sort((a, b) => a.x - b.x);
            finalAnchors = anchors.slice(0, 5);
        }

        // ── 建立掛鉤 ────────────────────────────────────────────
        // 掛鉤 X：對應圖片峰值的世界座標 X
        // 掛鉤 Y：固定在畫面頂部，讓玩家清楚看見
        const hookY      = halfH * 0.82;
        const hookColors = [0xffd700, 0x00e5ff, 0xff69b4, 0x7fff00, 0xff8c00];

        for (let i = 0; i < finalAnchors.length; i++) {
            const a           = finalAnchors[i];
            const targetPoint = grid[a.y][a.x];
            if (!targetPoint) continue;

            // 掛鉤的 X 位置對應圖片該峰值的世界 X
            const hookX = startX + a.x * spacingX;
            const color = hookColors[i % hookColors.length];
            this.addHook(hookX, hookY, color, targetPoint);
        }

        // 建立點雲（全光點版）
        this.renderer.createPointMesh(this.world.points);
        this.isRunning = true;

        // 開場：靜止 0.5 秒讓玩家看清圖片，再甩亂
        this.isFrozen = true;
        this.loop();

        setTimeout(() => {
            this.isFrozen = false;
            // ── 陣風吹落效果（強烈的同向隨機亂流，不向內收縮） ──
            for (const p of this.world.points) {
                if (p.isPinned) continue;
                
                // 平緩的陣風 + 微小的擾動
                const windX = 0.5;
                const windY = 0.5;
                const randomStr = 0.3; // 降低亂流，避免布料打結
                
                const vx = windX + (Math.random()-0.5)*randomStr;
                const vy = windY + (Math.random()-0.5)*randomStr;
                
                p.oldPos.x = p.pos.x - vx;
                p.oldPos.y = p.pos.y - vy;
            }
            // 重力保持開啟，讓布料自然往下墜落
        }, 500);
    }

    addHook(x, y, color, targetPoint) {
        this.hooks.push({ x, y, color, targetPoint, point: null, correct: false });
        this.renderer.addHookMesh(x, y, color);
    }

    loop() {
        if (!this.isRunning) return;
        requestAnimationFrame(() => this.loop());

        // 緩慢恢復邊界約束的硬度
        if (!this.draggedPoint && this.stiffnessTarget > this.world.boundaryStiffness) {
            this.world.boundaryStiffness += 0.02; 
            if (this.world.boundaryStiffness > 1.0) this.world.boundaryStiffness = 1.0;
        }

        const time   = performance.now() * 0.001;
        const aspect = window.innerWidth / window.innerHeight;
        const halfH  = Math.tan(30 * Math.PI / 180) * 6;
        const halfW  = halfH * aspect;

        if (!this.isFrozen) {
            this.world.step();

            // 世界邊界：上左右働列片
            // 底部改為「桃面平台」效果：跣到底部的點會向兩側滞開而不是堆疊
            const floorY = -halfH * 0.70; // 底部平台在畫面底部 30% 處
            for (const p of this.world.points) {
                if (p.isPinned) continue;
                // 左右倘
                if (p.pos.x < -halfW) { p.pos.x = -halfW; p.oldPos.x = p.pos.x + 0.01; }
                if (p.pos.x >  halfW) { p.pos.x =  halfW; p.oldPos.x = p.pos.x - 0.01; }
                // 上方倘
                if (p.pos.y >  halfH) { p.pos.y =  halfH; p.oldPos.y = p.pos.y; }
                // 底部「桃面平台」：落地時施加滯動應力，讓點向兩側散開
                if (p.pos.y < floorY) {
                    p.pos.y = floorY;
                    // 將垂直速度歸零，但保留一個微小的滯動力讓點正顯散開
                    const vx = p.pos.x - p.oldPos.x;
                    const scatter = (Math.random() - 0.5) * 0.04; // 滯動方向隨機
                    p.oldPos.x = p.pos.x - (vx * 0.85 + scatter); // 保留橫向施加滯動
                    p.oldPos.y = p.pos.y + 0.01; // 將垂直速度鞅为零
                }
            }
        }

        this.renderer.update(this.world.points, time);
    }
}
