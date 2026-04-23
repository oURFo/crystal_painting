import { PhysicsWorld, PhysicsPoint } from './physics.js';
import { GameRenderer } from './renderer.js';

export class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new GameRenderer(canvas);
        this.world = new PhysicsWorld();
        
        this.isRunning = false;
        this.draggedPoint = null;
        this.mouse = { x: 0, y: 0 };
        
        this.hooks = []; // { x, y, z, targetPointIndex, color }
        
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.onStart(e.clientX, e.clientY));
        this.canvas.addEventListener('mousemove', (e) => this.onMove(e.clientX, e.clientY));
        this.canvas.addEventListener('mouseup', () => this.onEnd());
        
        this.canvas.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            this.onStart(touch.clientX, touch.clientY);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            this.onMove(touch.clientX, touch.clientY);
        });
        this.canvas.addEventListener('touchend', () => this.onEnd());
    }

    onStart(x, y) {
        this.updateMouse(x, y);
        // 尋找最近的點
        let minDist = 0.5;
        let found = null;
        
        for (let p of this.world.points) {
            const dx = p.pos.x - this.mouse.x;
            const dy = p.pos.y - this.mouse.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < minDist) {
                minDist = d;
                found = p;
            }
        }
        
        if (found) {
            this.draggedPoint = found;
            this.draggedPoint.isPinned = true;
            this.draggedPoint.pinnedTo = { ...this.mouse, z: 0 };
        }
    }

    onMove(x, y) {
        this.updateMouse(x, y);
        if (this.draggedPoint) {
            this.draggedPoint.pinnedTo.x = this.mouse.x;
            this.draggedPoint.pinnedTo.y = this.mouse.y;
        }
    }

    onEnd() {
        if (this.draggedPoint) {
            // 檢查是否靠近掛鉤
            this.checkHook(this.draggedPoint);
            this.draggedPoint = null;
        }
    }

    updateMouse(clientX, clientY) {
        // 將屏幕座標轉為世界座標 (簡化版)
        this.mouse.x = (clientX / window.innerWidth) * 10 - 5;
        this.mouse.y = -(clientY / window.innerHeight) * 10 + 5;
    }

    checkHook(point) {
        for (let hook of this.hooks) {
            const dx = point.pos.x - hook.x;
            const dy = point.pos.y - hook.y;
            if (Math.sqrt(dx * dx + dy * dy) < 0.3) {
                point.pos.x = hook.x;
                point.pos.y = hook.y;
                point.isPinned = true;
                point.pinnedTo = { x: hook.x, y: hook.y, z: 0 };
                
                // 播放音效 (待實作)
                this.playCrystalSound();
                return;
            }
        }
        point.isPinned = false;
    }

    playCrystalSound() {
        // Web Audio API 簡單音效
        if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880 + Math.random() * 440, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.5);
    }

    async loadLevel(levelData) {
        this.isRunning = false;
        this.world = new PhysicsWorld();
        this.hooks = [];
        
        const img = new Image();
        img.src = levelData.image;
        await img.decode();
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 50; // 採樣密度
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        
        const pointsGrid = [];
        const spacing = 0.15;
        const offsetX = -(size * spacing) / 2;
        const offsetY = (size * spacing) / 2;

        for (let y = 0; y < size; y++) {
            pointsGrid[y] = [];
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;
                const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
                
                // 只處理非透明/非純白區域 (假設黑線是內容)
                if (a > 50 && (r < 200 || g < 200 || b < 200)) {
                    const px = offsetX + x * spacing;
                    const py = offsetY - y * spacing;
                    const color = (r << 16) | (g << 8) | b;
                    const p = new PhysicsPoint(px + (Math.random()-0.5)*2, py - 5, color);
                    this.world.addPoint(p);
                    pointsGrid[y][x] = p;
                }
            }
        }

        // 建立約束 (鄰近點相連)
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const p = pointsGrid[y][x];
                if (!p) continue;
                
                // 檢查右邊與下面
                if (x + 1 < size && pointsGrid[y][x+1]) {
                    this.world.addConstraint(p, pointsGrid[y][x+1], spacing);
                }
                if (y + 1 < size && pointsGrid[y+1][x]) {
                    this.world.addConstraint(p, pointsGrid[y+1][x], spacing);
                }
            }
        }

        // 設置掛鉤 (範例：四個角)
        this.addHook(offsetX, offsetY, 0xffffff);
        this.addHook(offsetX + (size-1)*spacing, offsetY, 0xffffff);
        
        this.renderer.createPointMesh(this.world.points);
        this.isRunning = true;
        this.loop();
    }

    addHook(x, y, color) {
        this.hooks.push({ x, y, z: 0, color });
        // 這裡可以通知渲染器增加掛鉤模型
    }

    loop() {
        if (!this.isRunning) return;
        const time = performance.now() * 0.001;
        this.world.step(0.016);
        this.renderer.update(this.world.points, time);
        requestAnimationFrame(() => this.loop());
    }
}
