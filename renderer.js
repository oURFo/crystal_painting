import * as THREE from 'three';

export class GameRenderer {
    constructor(canvas) {
        this.canvas   = canvas;
        this.scene    = new THREE.Scene();
        this.camera   = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });

        this.pointsMesh = null;
        this.geometry   = null;
        this.material   = null;
        this.hookGroup  = new THREE.Group();
        this.hookMats   = []; // 用於動畫更新

        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.camera.position.set(0, 0, 6);
        this.camera.lookAt(0, 0, 0);

        // 只需要少量環境光，不要讓光源污染背景
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));

        this.scene.add(this.hookGroup);
        window.addEventListener('resize', () => this.onResize());
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // ── 清除掛鉤 ────────────────────────────────────────────
    clearHooks() {
        this.hookMats = [];
        while (this.hookGroup.children.length > 0) {
            const c = this.hookGroup.children[0];
            c.geometry?.dispose();
            c.material?.dispose();
            this.hookGroup.remove(c);
        }
    }

    // ── 建立圖片光點雲 ───────────────────────────────────────
    createPointMesh(physicsPoints) {
        if (this.pointsMesh) {
            this.scene.remove(this.pointsMesh);
            this.pointsMesh.geometry.dispose();
            this.pointsMesh.material.dispose();
        }

        const count     = physicsPoints.length;
        const positions = new Float32Array(count * 3);
        const colors    = new Float32Array(count * 3);

        physicsPoints.forEach((p, i) => {
            positions[i * 3]     = p.pos.x;
            positions[i * 3 + 1] = p.pos.y;
            positions[i * 3 + 2] = 0;

            // 在 HSL 空間提高飽和度與亮度，讓顏色鮮豔但保留原色相
            const c = new THREE.Color(p.color);
            const hsl = { h: 0, s: 0, l: 0 };
            c.getHSL(hsl);
            // 飽和度至少 60%，亮度固定 0.7（讓深色/黑色也能發光）
            c.setHSL(hsl.h, Math.max(0.6, hsl.s), 0.70);

            colors[i * 3]     = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        });

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

        // ── 水晶光點 Shader（AdditiveBlending + 保留原色）──
        this.material = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: `
                uniform float uTime;
                varying   vec3  vColor;
                varying   float vPhase;

                void main() {
                    vColor = color; // Three.js 自動注入，不需另宣告

                    // 用座標雜湊產生點獨立相位，避免 gl_VertexID (GLSL3)
                    float hash = fract(sin(position.x * 127.1 + position.y * 311.7) * 43758.5);
                    vPhase = fract(hash + uTime * 0.5);

                    vec4 mvPos    = modelViewMatrix * vec4(position, 1.0);
                    float shimmer = 1.0 + 0.15 * sin(vPhase * 6.2832);
                    // 基本大小 55，讓點明顯可見
                    gl_PointSize  = 55.0 * shimmer * (1.0 / -mvPos.z);
                    gl_Position   = projectionMatrix * mvPos;
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying vec3  vColor;
                varying float vPhase;

                void main() {
                    vec2  uv = gl_PointCoord * 2.0 - 1.0;
                    float r  = dot(uv, uv);
                    if (r > 1.0) discard;

                    // 主體：清晰的圓形（邊緣 smoothstep）
                    float disc = 1.0 - smoothstep(0.5, 0.8, r);

                    // 刻面：在外圍加入折射條紋，同色系，不搶色
                    float angle  = atan(uv.y, uv.x);
                    float facet  = 0.5 + 0.5 * abs(sin(angle * 4.0 + uTime + vPhase * 6.28));
                    float facetR = smoothstep(0.25, 0.5, r) * (1.0 - smoothstep(0.5, 0.8, r));

                    // 核心：極小的白色亮點，只佔 15% 半徑
                    float core = 1.0 - smoothstep(0.0, 0.15, r);

                    // 最終色：原色主體 + 同色系刻面 + 縮小白芯
                    // 用 Additive 模式，所以不需要 alpha 遮罩也能發光
                    vec3 col = vColor * disc
                             + vColor * facet * facetR * 0.4
                             + vec3(1.0) * core * 0.5;

                    // alpha：圓形邊界即可，核心補一點
                    gl_FragColor = vec4(col, disc);
                }
            `,
            transparent:  true,
            blending:     THREE.AdditiveBlending, // 加法混色：保留顏色且自然發光
            depthWrite:   false,
            vertexColors: true,
        });

        this.pointsMesh = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.pointsMesh);
    }

    // ── 掛鉤：純光點，無任何幾何實體 ────────────────────────
    addHookMesh(x, y, hexColor) {
        // 【只用 ShaderMaterial Points】──────────────────────
        // 不使用 Sprite（會渲染成方塊）
        // 不使用高強度 PointLight（會照亮背景）

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x, y, 0.2]), 3));

        const c = new THREE.Color(hexColor);
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime:  { value: 0 },
                uColor: { value: new THREE.Vector3(c.r, c.g, c.b) },
            },
            vertexShader: `
                uniform float uTime;
                void main() {
                    // 用 sin(time) 剂作脈衝感，完全避免 gl_VertexID
                    float pulse  = 1.0 + 0.35 * sin(uTime * 2.5);
                    vec4 mvPos   = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = 140.0 * pulse * (1.0 / -mvPos.z);
                    gl_Position  = projectionMatrix * mvPos;
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                void main() {
                    vec2  uv = gl_PointCoord * 2.0 - 1.0;
                    float r  = dot(uv, uv);
                    if (r > 1.0) discard;

                    // 外圍：原色光暈（大而柔）
                    float glow = 1.0 - smoothstep(0.0, 1.0, r);
                    // 中環：明亮的原色環
                    float ring = smoothstep(0.3, 0.45, r) * (1.0 - smoothstep(0.5, 0.65, r));
                    // 核心：純白亮點
                    float core = 1.0 - smoothstep(0.0, 0.2, r);

                    vec3 col = uColor * glow
                             + uColor * ring * 2.0
                             + vec3(1.0) * core;

                    gl_FragColor = vec4(col, glow * 0.9 + core * 0.1);
                }
            `,
            transparent: true,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        });

        this.hookMats.push(mat);
        this.hookGroup.add(new THREE.Points(geo, mat));
    }

    // ── 每幀更新 ──────────────────────────────────────────────
    update(physicsPoints, time) {
        if (!this.pointsMesh) return;

        const pos = this.geometry.attributes.position.array;
        physicsPoints.forEach((p, i) => {
            pos[i * 3]     = p.pos.x;
            pos[i * 3 + 1] = p.pos.y;
        });
        this.geometry.attributes.position.needsUpdate = true;
        this.material.uniforms.uTime.value = time;

        // 更新掛鉤脈衝
        for (const m of this.hookMats) {
            m.uniforms.uTime.value = time;
        }

        this.renderer.render(this.scene, this.camera);
    }
}
