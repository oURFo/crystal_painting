/**
 * 點畫 - 物理引擎 (Verlet Integration)
 * 重力向下、穩定的布料模擬
 */

export class PhysicsPoint {
    constructor(x, y, color = 0xffffff) {
        this.pos    = { x, y };
        this.oldPos = { x, y };
        this.color  = color;
        this.isPinned  = false;
        this.pinnedTo  = null;
        this.friction  = 0.985;
        this.uv        = { u: 0, v: 0 };
        this.isBoundary = false;
        this.index     = -1;
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

        const vx = (this.pos.x - this.oldPos.x) * this.friction;
        const vy = (this.pos.y - this.oldPos.y) * this.friction;

        this.oldPos.x = this.pos.x;
        this.oldPos.y = this.pos.y;

        // 邊界大光點稍重 (1.5x)，幫助布料向外垂落
        const pointGravity = this.isBoundary ? gravity * 1.5 : gravity;

        this.pos.x += vx;
        this.pos.y += vy + pointGravity;
    }
}

export class PhysicsConstraint {
    constructor(p1, p2, restLength, stiffness = 1.0) {
        this.p1 = p1;
        this.p2 = p2;
        this.restLength = restLength;
        this.stiffness  = stiffness;
    }

    solve() {
        let dx   = this.p2.pos.x - this.p1.pos.x;
        let dy   = this.p2.pos.y - this.p1.pos.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

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
        this.gravity     = -0.01;
    }

    addPoint(p) {
        this.points.push(p);
        return p;
    }

    addConstraint(p1, p2, len, stiffness = 1.0) {
        this.constraints.push(new PhysicsConstraint(p1, p2, len, stiffness));
    }

    step() {
        // 1. Verlet 積分
        for (const p of this.points) p.update(this.gravity);

        // 2. 解除約束 (15 次迭代)
        for (let i = 0; i < 15; i++) {
            for (const c of this.constraints) c.solve();
            // 固定被釘住的點
            for (const p of this.points) {
                if (p.isPinned && p.pinnedTo) {
                    p.pos.x = p.pinnedTo.x;
                    p.pos.y = p.pinnedTo.y;
                }
            }
        }
    }
}
