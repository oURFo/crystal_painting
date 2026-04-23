/**
 * 點畫 - 物理引擎 (Verlet Integration)
 * 模擬布料與彈性連接
 */

export class PhysicsPoint {
    constructor(x, y, color = 0xffffff) {
        this.pos = { x, y, z: 0 };
        this.oldPos = { x, y, z: 0 };
        this.originalPos = { x, y, z: 0 };
        this.accel = { x: 0, y: 0, z: 0 };
        this.color = color;
        this.isPinned = false;
        this.pinnedTo = null; // {x, y, z} or Hook object
        this.mass = 1;
        this.friction = 0.98;
    }

    update(dt) {
        if (this.isPinned) return;

        const vx = (this.pos.x - this.oldPos.x) * this.friction;
        const vy = (this.pos.y - this.oldPos.y) * this.friction;
        const vz = (this.pos.z - this.oldPos.z) * this.friction;

        this.oldPos.x = this.pos.x;
        this.oldPos.y = this.pos.y;
        this.oldPos.z = this.pos.z;

        this.pos.x += vx + this.accel.x * dt * dt;
        this.pos.y += vy + this.accel.y * dt * dt;
        this.pos.z += vz + this.accel.z * dt * dt;

        // 重置加速度
        this.accel.x = 0;
        this.accel.y = 0;
        this.accel.z = 0;
    }

    applyForce(fx, fy, fz) {
        this.accel.x += fx / this.mass;
        this.accel.y += fy / this.mass;
        this.accel.z += fz / this.mass;
    }
}

export class PhysicsConstraint {
    constructor(p1, p2, length) {
        this.p1 = p1;
        this.p2 = p2;
        this.length = length;
        this.stiffness = 0.8;
    }

    solve() {
        const dx = this.p2.pos.x - this.p1.pos.x;
        const dy = this.p2.pos.y - this.p1.pos.y;
        const dz = this.p2.pos.z - this.p1.pos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const diff = (this.length - dist) / dist;

        const offsetX = dx * diff * 0.5 * this.stiffness;
        const offsetY = dy * diff * 0.5 * this.stiffness;
        const offsetZ = dz * diff * 0.5 * this.stiffness;

        if (!this.p1.isPinned) {
            this.p1.pos.x -= offsetX;
            this.p1.pos.y -= offsetY;
            this.p1.pos.z -= offsetZ;
        }
        if (!this.p2.isPinned) {
            this.p2.pos.x += offsetX;
            this.p2.pos.y += offsetY;
            this.p2.pos.z += offsetZ;
        }
    }
}

export class PhysicsWorld {
    constructor() {
        this.points = [];
        this.constraints = [];
        this.gravity = { x: 0, y: -0.05, z: 0 };
    }

    addPoint(p) {
        this.points.push(p);
        return p;
    }

    addConstraint(p1, p2, length) {
        const c = new PhysicsConstraint(p1, p2, length);
        this.constraints.push(c);
        return c;
    }

    step(dt) {
        // 更新位置
        for (let p of this.points) {
            p.applyForce(this.gravity.x, this.gravity.y, this.gravity.z);
            p.update(dt);
        }

        // 解除約束 (迭代多次以增加穩定性)
        for (let i = 0; i < 5; i++) {
            for (let c of this.constraints) {
                c.solve();
            }
            
            // 強制釘住的點回到原位
            for (let p of this.points) {
                if (p.isPinned && p.pinnedTo) {
                    p.pos.x = p.pinnedTo.x;
                    p.pos.y = p.pinnedTo.y;
                    p.pos.z = p.pinnedTo.z;
                }
            }
        }
    }
}
