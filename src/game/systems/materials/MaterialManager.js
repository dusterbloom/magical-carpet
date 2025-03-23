// MaterialManager.js
import * as THREE from 'three';

export class MaterialManager {
    constructor(engine) {
        this.engine = engine;
        this.deviceTier = this.detectDeviceTier();
        this.proceduralMaterials = new Map();
        this.qualitySettings = this.initializeQualitySettings();
        this.materialCache = new Map();
        
        // Carpet material parameters
        this.carpetMaterialParams = {
            baseColor: new THREE.Color(0x8844ff),
            patternScale: this.deviceTier === 'low' ? 2 : 4,
            detailLevel: this.qualitySettings.proceduralDetail,
            glowIntensity: this.deviceTier === 'low' ? 0.3 : 0.5
        };
        
        // Trail material parameters
        this.trailMaterialParams = {
            baseOpacity: this.deviceTier === 'low' ? 0.4 : 0.7,
            glowIntensity: this.deviceTier === 'low' ? 0.3 : 0.5,
            particleSize: this.deviceTier === 'low' ? 0.07 : 0.1
        };
        
        // Performance monitoring
        this.stats = {
            proceduralTexturesGenerated: 0,
            cacheHits: 0,
            cacheMisses: 0,
            peakMemoryUsage: 0
        };
        
        // Initialize core materials
        this.initializeMaterials();
    }
    
    detectDeviceTier() {
        // GPU capability detection
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        
        if (!gl) return 'low';
        
        // Check for high-end capabilities
        const isHighEnd = gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 8192 &&
                         gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) >= 8192 &&
                         navigator.hardwareConcurrency >= 4;
                         
        // Check for low-end indicators
        const isLowEnd = gl.getParameter(gl.MAX_TEXTURE_SIZE) <= 2048 ||
                        gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) <= 2048 ||
                        navigator.deviceMemory <= 2 ||
                        /Mobile|Android|iPhone/i.test(navigator.userAgent);
                        
        return isHighEnd ? 'high' : (isLowEnd ? 'low' : 'medium');
    }
    
    initializeQualitySettings() {
        const settings = {
            high: {
                textureSize: 2048,
                proceduralDetail: 1.0,
                mipLevels: 8,
                anisotropy: 16,
                shaderComplexity: 'high'
            },
            medium: {
                textureSize: 1024,
                proceduralDetail: 0.7,
                mipLevels: 6,
                anisotropy: 8,
                shaderComplexity: 'medium'
            },
            low: {
                textureSize: 512,
                proceduralDetail: 0.4,
                mipLevels: 4,
                anisotropy: 4,
                shaderComplexity: 'low'
            }
        };
        
        return settings[this.deviceTier];
    }
    
    initializeMaterials() {
        // Create core materials
        this.createCarpetMaterial();
        this.createTrailMaterials();
    }
    
    createCarpetMaterial() {
        // Generate base carpet texture
        const carpetTexture = this.generateProceduralTexture('carpet', {
            size: this.qualitySettings.textureSize,
            detail: this.carpetMaterialParams.patternScale,
            color: this.carpetMaterialParams.baseColor
        });
        
        // Create shader material
        const material = new THREE.ShaderMaterial({
            uniforms: {
                baseTexture: { value: carpetTexture },
                glowIntensity: { value: this.carpetMaterialParams.glowIntensity },
                time: { value: 0 }
            },
            vertexShader: this.getCarpetVertexShader(),
            fragmentShader: this.getCarpetFragmentShader()
        });
        
        this.materialCache.set('carpet', material);
    }
    
    createTrailMaterials() {
        // Create optimized trail materials
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ffff,
            transparent: true,
            opacity: this.trailMaterialParams.baseOpacity,
            depthWrite: false
        });
        
        const particleMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: this.trailMaterialParams.particleSize,
            transparent: true,
            opacity: this.trailMaterialParams.baseOpacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        this.materialCache.set('trail', trailMaterial);
        this.materialCache.set('particle', particleMaterial);
    }
    
    generateProceduralTexture(type, params) {
        const key = `${type}-${JSON.stringify(params)}`;
        
        // Check cache first
        if (this.proceduralMaterials.has(key)) {
            this.stats.cacheHits++;
            return this.proceduralMaterials.get(key);
        }
        
        // Create canvas for texture generation
        const size = Math.min(params.size || 512, this.qualitySettings.textureSize);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Generate based on type
        switch (type) {
            case 'carpet':
                this.generateCarpetPattern(ctx, params);
                break;
            case 'noise':
                this.generateNoiseTexture(ctx, params);
                break;
        }
        
        // Create THREE.js texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipMapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = this.qualitySettings.anisotropy;
        
        // Store in cache
        this.proceduralMaterials.set(key, texture);
        this.stats.proceduralTexturesGenerated++;
        
        return texture;
    }
    
    generateCarpetPattern(ctx, params) {
        const { size = 512, detail = 1, color = new THREE.Color(0x8844ff) } = params;
        
        // Base color
        ctx.fillStyle = color.getStyle();
        ctx.fillRect(0, 0, size, size);
        
        // Add pattern layers
        const patternDetail = Math.max(2, Math.floor(8 * detail * this.qualitySettings.proceduralDetail));
        const cellSize = size / patternDetail;
        
        // Generate deterministic pattern
        for (let y = 0; y < patternDetail; y++) {
            for (let x = 0; x < patternDetail; x++) {
                const hue = (x + y * patternDetail) * 137.5;
                const patternValue = Math.abs(Math.sin(hue));
                const alpha = 0.1 + (patternValue * 0.2);
                
                ctx.fillStyle = `rgba(255,255,255,${alpha})`;
                ctx.fillRect(
                    x * cellSize,
                    y * cellSize,
                    cellSize,
                    cellSize
                );
                
                // Add detail lines for higher quality settings
                if (this.deviceTier !== 'low') {
                    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.5})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x * cellSize, y * cellSize);
                    ctx.lineTo((x + 1) * cellSize, y * cellSize);
                    ctx.stroke();
                }
            }
        }
    }
    
    generateNoiseTexture(ctx, params) {
        const { size = 512, scale = 1, octaves = 4 } = params;
        const imageData = ctx.createImageData(size, size);
        
        // Generate Perlin noise
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                let noise = 0;
                let amplitude = 1;
                let frequency = scale;
                
                // Add octaves based on quality settings
                for (let o = 0; o < octaves * this.qualitySettings.proceduralDetail; o++) {
                    noise += this.perlinNoise(x * frequency / size, y * frequency / size) * amplitude;
                    amplitude *= 0.5;
                    frequency *= 2;
                }
                
                const idx = (y * size + x) * 4;
                const value = Math.floor((noise + 1) * 127.5);
                imageData.data[idx] = value;
                imageData.data[idx + 1] = value;
                imageData.data[idx + 2] = value;
                imageData.data[idx + 3] = 255;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    perlinNoise(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        // Fade functions
        const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
        const lerp = (t, a, b) => a + t * (b - a);
        
        // Generate gradients
        const grad = (hash, x, y) => {
            const h = hash & 15;
            const gradX = 1 + (h & 7);
            const gradY = (h & 8) ? -1 : 1;
            return gradX * x + gradY * y;
        };
        
        const p = new Array(512);
        for (let i = 0; i < 256; i++) {
            p[i] = p[i + 256] = (i * 16807) % 256;
        }
        
        // Calculate noise value
        const u = fade(x);
        const v = fade(y);
        
        const A = p[X] + Y;
        const B = p[X + 1] + Y;
        
        return lerp(v,
            lerp(u, grad(p[A], x, y), grad(p[B], x - 1, y)),
            lerp(u, grad(p[A + 1], x, y - 1), grad(p[B + 1], x - 1, y - 1))
        );
    }
    
    getCarpetVertexShader() {
        return `
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            
            void main() {
                vUv = uv;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                
                vNormal = normalize(normalMatrix * normal);
                vViewPosition = -mvPosition.xyz;
            }
        `;
    }
    
    getCarpetFragmentShader() {
        // Select shader complexity based on device tier
        switch (this.qualitySettings.shaderComplexity) {
            case 'low':
                return this.getLowQualityCarpetShader();
            case 'medium':
                return this.getMediumQualityCarpetShader();
            case 'high':
                return this.getHighQualityCarpetShader();
            default:
                return this.getMediumQualityCarpetShader();
        }
    }
    
    getLowQualityCarpetShader() {
        return `
            uniform sampler2D baseTexture;
            uniform float glowIntensity;
            varying vec2 vUv;
            
            void main() {
                vec4 texColor = texture2D(baseTexture, vUv);
                gl_FragColor = texColor;
            }
        `;
    }
    
    getMediumQualityCarpetShader() {
        return `
            uniform sampler2D baseTexture;
            uniform float glowIntensity;
            uniform float time;
            
            varying vec2 vUv;
            varying vec3 vNormal;
            
            void main() {
                vec4 texColor = texture2D(baseTexture, vUv);
                
                // Add simple lighting
                float lightIntensity = max(dot(vNormal, vec3(0.0, 1.0, 0.0)), 0.3);
                
                // Add subtle glow
                float glow = sin(time) * 0.5 + 0.5;
                vec3 finalColor = texColor.rgb * lightIntensity + (texColor.rgb * glow * glowIntensity);
                
                gl_FragColor = vec4(finalColor, texColor.a);
            }
        `;
    }
    
    getHighQualityCarpetShader() {
        return `
            uniform sampler2D baseTexture;
            uniform float glowIntensity;
            uniform float time;
            
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            
            void main() {
                vec4 texColor = texture2D(baseTexture, vUv);
                
                // Enhanced lighting with fresnel effect
                vec3 viewDir = normalize(vViewPosition);
                float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);
                
                // Multi-layered lighting
                float directLight = max(dot(vNormal, vec3(0.0, 1.0, 0.0)), 0.3);
                float rimLight = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.0) * 0.5;
                float lightIntensity = directLight + rimLight;
                
                // Complex glow effect
                float timeScale = time * 0.5;
                float glow = sin(timeScale) * 0.3 + cos(timeScale * 0.7) * 0.2 + 0.5;
                float patternGlow = sin(vUv.x * 20.0 + time) * sin(vUv.y * 20.0 + time) * 0.1;
                
                // Combine effects
                vec3 finalColor = texColor.rgb * lightIntensity;
                finalColor += texColor.rgb * (glow + patternGlow) * glowIntensity;
                finalColor += fresnel * texColor.rgb * 0.3;
                
                gl_FragColor = vec4(finalColor, texColor.a);
            }
        `;
    }
    
    // Material management methods
    getMaterial(type) {
        return this.materialCache.get(type);
    }
    
    updateMaterials(time) {
        // Update time-based uniforms
        const carpetMaterial = this.materialCache.get('carpet');
        if (carpetMaterial && carpetMaterial.uniforms) {
            carpetMaterial.uniforms.time.value = time;
        }
    }
    
    disposeTexture(type, params) {
        const key = `${type}-${JSON.stringify(params)}`;
        if (this.proceduralMaterials.has(key)) {
            const texture = this.proceduralMaterials.get(key);
            texture.dispose();
            this.proceduralMaterials.delete(key);
        }
    }
    
    resetMaterials() {
        // Reinitialize materials after visibility change or context loss
        console.log('Resetting materials due to visibility change');
        
        // Refresh procedural textures if needed
        this.proceduralMaterials.forEach((texture, key) => {
            // Ensure textures are valid and refreshed
            if (texture && texture.needsUpdate !== undefined) {
                texture.needsUpdate = true;
            }
        });
        
        // Refresh material uniforms
        this.materialCache.forEach(material => {
            if (material.uniforms) {
                // Reset time-based uniforms
                if (material.uniforms.time) {
                    material.uniforms.time.value = 0;
                }
                
                // Ensure textures are valid
                Object.values(material.uniforms).forEach(uniform => {
                    if (uniform.value && uniform.value.isTexture) {
                        uniform.value.needsUpdate = true;
                    }
                });
            }
        });
    }
    
    dispose() {
        // Dispose all cached materials and textures
        this.materialCache.forEach(material => {
            if (material.uniforms) {
                Object.values(material.uniforms).forEach(uniform => {
                    if (uniform.value && uniform.value.isTexture) {
                        uniform.value.dispose();
                    }
                });
            }
            material.dispose();
        });
        
        this.proceduralMaterials.forEach(texture => {
            texture.dispose();
        });
        
        this.materialCache.clear();
        this.proceduralMaterials.clear();
    }
}