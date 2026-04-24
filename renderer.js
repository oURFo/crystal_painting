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

    // ── 建立雙層光點雲（邊界與內部畫布） ───────────────────────────
    createPointMesh(physicsPoints) {
        if (this.pointsMesh) {
            this.scene.remove(this.pointsMesh);
            this.pointsGeometry?.dispose();
            this.pointsMaterial?.dispose();
            this.pointsMesh = null;
        }
        if (this.clothMesh) {
            this.scene.remove(this.clothMesh);
            this.clothGeometry?.dispose();
            this.clothMaterial?.dispose();
            this.clothMesh = null;
        }

        // 分離內部點與邊界點
        const boundaryPoints = physicsPoints.filter(p => p.isBoundary);
        const clothPoints    = physicsPoints.filter(p => !p.isBoundary);

        this.boundaryPointIndices = boundaryPoints.map(p => p.index);
        this.clothPointIndices    = clothPoints.map(p => p.index);

        // 1. 建立邊界光點 (巨大、閃爍、可操作)
        const bCount = boundaryPoints.length;
        const bPositions = new Float32Array(bCount * 3);
        const bColors    = new Float32Array(bCount * 3);

        boundaryPoints.forEach((p, i) => {
            bPositions[i*3] = p.pos.x; bPositions[i*3+1] = p.pos.y; bPositions[i*3+2] = 0;
            const c = new THREE.Color(p.color);
            const hsl = { h: 0, s: 0, l: 0 };
            c.getHSL(hsl);
            c.setHSL(hsl.h, Math.max(0.6, hsl.s), 0.70);
            bColors[i*3] = c.r; bColors[i*3+1] = c.g; bColors[i*3+2] = c.b;
        });

        this.pointsGeometry = new THREE.BufferGeometry();
        this.pointsGeometry.setAttribute('position', new THREE.BufferAttribute(bPositions, 3));
        this.pointsGeometry.setAttribute('color',    new THREE.BufferAttribute(bColors, 3));

        this.pointsMaterial = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: `
                uniform float uTime;
                varying vec3 vColor;
                varying float vPhase;
                void main() {
                    vColor = color; 
                    float hash = fract(sin(position.x * 127.1 + position.y * 311.7) * 43758.5);
                    vPhase = fract(hash + uTime * 0.5);
                    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                    float shimmer = 1.0 + 0.15 * sin(vPhase * 6.2832);
                    gl_PointSize = 120.0 * shimmer * (1.0 / -mvPos.z); // 巨大邊界點
                    gl_Position = projectionMatrix * mvPos;
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying vec3 vColor;
                varying float vPhase;
                void main() {
                    vec2 uv = gl_PointCoord * 2.0 - 1.0;
                    float r = dot(uv, uv);
                    if (r > 1.0) discard;
                    float disc = 1.0 - smoothstep(0.5, 0.8, r);
                    float angle = atan(uv.y, uv.x);
                    float facet = 0.5 + 0.5 * abs(sin(angle * 4.0 + uTime + vPhase * 6.28));
                    float facetR = smoothstep(0.25, 0.5, r) * (1.0 - smoothstep(0.5, 0.8, r));
                    float core = 1.0 - smoothstep(0.0, 0.15, r);
                    vec3 col = vColor * disc + vColor * facet * facetR * 0.4 + vec3(1.0) * core * 0.5;
                    gl_FragColor = vec4(col, disc);
                }
            `,
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true
        });

        this.pointsMesh = new THREE.Points(this.pointsGeometry, this.pointsMaterial);
        this.pointsMesh.renderOrder = 2; // 最上層
        this.scene.add(this.pointsMesh);

        // 2. 建立畫布內部光點 (細小、密集、保留原色)
        const cCount = clothPoints.length;
        const cPositions = new Float32Array(cCount * 3);
        const cColors    = new Float32Array(cCount * 3);

        clothPoints.forEach((p, i) => {
            cPositions[i*3] = p.pos.x; cPositions[i*3+1] = p.pos.y; cPositions[i*3+2] = 0;
            const c = new THREE.Color(p.color);
            cColors[i*3] = c.r; cColors[i*3+1] = c.g; cColors[i*3+2] = c.b;
        });

        this.clothGeometry = new THREE.BufferGeometry();
        this.clothGeometry.setAttribute('position', new THREE.BufferAttribute(cPositions, 3));
        this.clothGeometry.setAttribute('color',    new THREE.BufferAttribute(cColors, 3));

        this.clothMaterial = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: `
                uniform float uTime;
                varying vec3 vColor;
                varying float vPhase;
                void main() {
                    vColor = color; 
                    float hash = fract(sin(position.x * 127.1 + position.y * 311.7) * 43758.5);
                    vPhase = fract(hash + uTime * 0.5);
                    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                    // 細小點，微微閃動
                    float shimmer = 1.0 + 0.1 * sin(vPhase * 6.2832);
                    gl_PointSize = 12.0 * shimmer * (1.0 / -mvPos.z); // 細小內部點
                    gl_Position = projectionMatrix * mvPos;
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying vec3 vColor;
                varying float vPhase;
                void main() {
                    vec2 uv = gl_PointCoord * 2.0 - 1.0;
                    float r = dot(uv, uv);
                    if (r > 1.0) discard;
                    
                    // 內部點為柔和圓點，帶微光
                    float disc = 1.0 - smoothstep(0.4, 0.9, r);
                    vec3 col = vColor * disc * 1.5; // 稍微增亮
                    gl_FragColor = vec4(col, disc * 0.8);
                }
            `,
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true
        });

        this.clothMesh = new THREE.Points(this.clothGeometry, this.clothMaterial);
        this.clothMesh.renderOrder = 1;
        this.scene.add(this.clothMesh);
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
        if (!this.clothMesh || !this.pointsMesh) return;

        // 更新內部畫布光點座標
        const cPos = this.clothGeometry.attributes.position.array;
        this.clothPointIndices.forEach((physicsIndex, i) => {
            const p = physicsPoints[physicsIndex];
            cPos[i * 3]     = p.pos.x;
            cPos[i * 3 + 1] = p.pos.y;
        });
        this.clothGeometry.attributes.position.needsUpdate = true;
        this.clothMaterial.uniforms.uTime.value = time;

        // 更新邊界可互動光點座標
        const bPos = this.pointsGeometry.attributes.position.array;
        this.boundaryPointIndices.forEach((physicsIndex, i) => {
            const p = physicsPoints[physicsIndex];
            bPos[i * 3]     = p.pos.x;
            bPos[i * 3 + 1] = p.pos.y;
        });
        this.pointsGeometry.attributes.position.needsUpdate = true;
        this.pointsMaterial.uniforms.uTime.value = time;

        // 更新掛鉤脈衝
        for (const m of this.hookMats) {
            m.uniforms.uTime.value = time;
        }

        this.renderer.render(this.scene, this.camera);
    }
}
