import * as THREE from 'three';

/**
 * Swarovski Crystal Shader
 * 提供折射感與動態閃爍
 */
const CrystalShader = {
    vertexShader: `
        attribute float size;
        attribute vec3 color;
        attribute float velocity;
        varying vec3 vColor;
        varying float vVelocity;
        varying vec2 vUv;

        void main() {
            vColor = color;
            vVelocity = velocity;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            
            // 根據點的動態調整大小，模擬閃爍
            float shimmer = sin(position.x * 10.0 + position.y * 10.0 + time * 5.0) * 0.2 + 1.0;
            gl_PointSize = size * (300.0 / -mvPosition.z) * shimmer;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform float time;
        varying vec3 vColor;
        varying float vVelocity;

        void main() {
            // 創建圓形點
            vec2 cxy = 2.0 * gl_PointCoord - 1.0;
            float r = dot(cxy, cxy);
            if (r > 1.0) discard;

            // 水晶折射感 (星狀光芒)
            float angle = atan(cxy.y, cxy.x);
            float strength = 0.5 + 0.5 * sin(angle * 6.0 + time * 2.0 + vVelocity * 10.0);
            float center = 1.0 - smoothstep(0.0, 0.8, r);
            
            // 閃爍色彩
            vec3 crystalColor = vColor + vec3(0.2, 0.3, 0.5) * strength * 0.5;
            
            // 核心高光
            float core = 1.0 - smoothstep(0.0, 0.2, r);
            crystalColor += vec3(1.0) * core;

            gl_FragColor = vec4(crystalColor, center);
        }
    `
};

export class GameRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        
        this.points = null;
        this.geometry = null;
        this.material = null;
        
        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.camera.position.z = 5;

        // 環境光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        window.addEventListener('resize', () => this.onResize());
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // 建立點陣雲
    createPointMesh(physicsPoints) {
        if (this.points) {
            this.scene.remove(this.points);
        }

        const count = physicsPoints.length;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        this.geometry = new THREE.BufferGeometry();
        
        physicsPoints.forEach((p, i) => {
            positions[i * 3] = p.pos.x;
            positions[i * 3 + 1] = p.pos.y;
            positions[i * 3 + 2] = p.pos.z;

            const c = new THREE.Color(p.color);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;

            sizes[i] = 0.15; // 點的基本大小
        });

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 }
            },
            vertexShader: `
                uniform float time;
                attribute float size;
                attribute vec3 color;
                varying vec3 vColor;
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    // 隨機閃爍
                    float shimmer = sin(time * 2.0 + position.x * 5.0) * 0.1 + 1.0;
                    gl_PointSize = size * (300.0 / -mvPosition.z) * shimmer;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                void main() {
                    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
                    float r = dot(cxy, cxy);
                    if (r > 1.0) discard;
                    
                    // 水晶核心
                    float strength = 1.0 - pow(r, 0.5);
                    // 模擬刻面閃光
                    float sparkle = step(0.8, sin(atan(cxy.y, cxy.x) * 6.0)) * 0.2;
                    
                    gl_FragColor = vec4(vColor + vec3(sparkle), strength);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.points);
    }

    update(physicsPoints, time) {
        if (!this.points) return;

        const positions = this.geometry.attributes.position.array;
        physicsPoints.forEach((p, i) => {
            positions[i * 3] = p.pos.x;
            positions[i * 3 + 1] = p.pos.y;
            positions[i * 3 + 2] = p.pos.z;
        });

        this.geometry.attributes.position.needsUpdate = true;
        this.material.uniforms.time.value = time;
        this.renderer.render(this.scene, this.camera);
    }
}
