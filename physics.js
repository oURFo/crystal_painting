/**
 * 點畫 - 物理引擎 (Verlet Integration)
 * 重力向下、穩定的布料模擬
 */

export class PhysicsPoint {
    constructor(x, y, color = 0xffffff) {
        this.pos    = { x, y };
        this.oldPos = { x, y }; // 初始 oldPos 等於 pos，代表靜止
        this.color  = color;
        this.isPinned  = false;
        this.pinnedTo  = null;
        this.friction  = 0.985; // 輕微空氣阻力
    }

    update(gravity) {
        if (this.isPinned) {
            if (this.pinnedTo) {
                this.pos.x = this.pinnedTo.x;
                this.pos.y = this.pinnedTo.y;
                this.oldPos.x = this.pinnedTo.x;
                this.oldPos.y = this.pinnedTo.y;
            }
            return;
        }

        // Verlet 積分
        const vx = (this.pos.x - this.oldPos.x) * this.friction;
        const vy = (this.pos.y - this.oldPos.y) * this.friction;

        // 速度上限，防止飛走
        const maxV = 0.4; // 提高速度上限，讓隨機分布更自然
        const speed = Math.sqrt(vx * vx + vy * vy);
        const scale = speed > maxV ? maxV / speed : 1;

        this.oldPos.x = this.pos.x;
        this.oldPos.y = this.pos.y;

        this.pos.x += vx * scale;
        this.pos.y += vy * scale + gravity;
    }
}

export class PhysicsConstraint {
    constructor(p1, p2, restLength, stiffness = 1.0) {
        this.p1 = p1;
        this.p2 = p2;
        this.restLength = restLength;
        this.stiffness  = stiffness; // 1.0 = 完全剛性，0.x = 彈性
    }

    solve() {
        let dx   = this.p2.pos.x - this.p1.pos.x;
        let dy   = this.p2.pos.y - this.p1.pos.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        
        // 避免完全重疊導致永久沾黏（當 dist 為 0 時給予微小擾動）
        if (dist === 0) {
            dx = (Math.random() - 0.5) * 0.01;
            dy = (Math.random() - 0.5) * 0.01;
            dist = Math.sqrt(dx * dx + dy * dy);
        }

        const diff = (this.restLength - dist) / dist;
        const corr = diff * 0.5 * this.stiffness;

        if (!this.p1.isPinned) {
            this.p1.pos.x -= dx * corr;
            this.p1.pos.y -= dy * corr;
        }
        if (!this.p2.isPinned) {
            this.p2.pos.x += dx * corr;
            this.p2.pos.y += dy * corr;
        }
    }
}

export class PhysicsWorld {
    constructor() {
        this.points      = [];
        this.constraints = [];
        this.gravity     = -0.002; // 預設重力，可由 engine 動態調整
    }

    addPoint(p) {
        this.points.push(p);
        return p;
    }

    addConstraint(p1, p2, len, stiffness = 1.0) {
        this.constraints.push(new PhysicsConstraint(p1, p2, len, stiffness));
    }

    step() {
        // 1. 更新位置 (Verlet)
        for (const p of this.points) p.update(this.gravity);

        // 2. 解除約束 (15次迭代 = 保留適度彈性，允許甩開)
        for (let i = 0; i < 15; i++) {
            for (const c of this.constraints) c.solve();
            // 強制固定釘住的點
            for (const p of this.points) {
                if (p.isPinned && p.pinnedTo) {
                    p.pos.x = p.pinnedTo.x;
                    p.pos.y = p.pinnedTo.y;
                }
            }
        }
    }
}
