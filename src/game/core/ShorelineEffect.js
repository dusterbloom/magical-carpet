
import * as THREE from 'three';

export class ShorelineEffect {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.camera = engine.camera;
    this.renderer = engine.renderer;
    
    // Water level from world system
    this.waterLevel = engine.systems.world?.waterLevel || 0;
    
    // Create a custom shader for the shoreline transition
    this.initializeShader();
  }
  
  initializeShader() {
    // Create the shader material for water-shore transition
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, // Will be set during rendering
        waterLevel: { value: this.waterLevel },
        waterColor: { value: new THREE.Color(0x2a5e95) },
        shoreColor: { value: new THREE.Color(0xe0d0b0) },
        transitionWidth: { value: 5.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float waterLevel;
        uniform vec3 waterColor;
        uniform vec3 shoreColor;
        uniform float transitionWidth;
        
        varying vec2 vUv;
        
        void main() {
          vec4 texColor = texture2D(tDiffuse, vUv);
          
          // We would need to calculate world position and depth
          // Since we can't easily do that in this post shader
          // We'll look for color characteristics that match the water/shore
          
          // Detect if this is the water edge by looking for specific colors
          float isWaterEdge = 0.0;
          
          // Look for blue colors (water) or tan colors (shore)
          float blueAmount = texColor.b - (texColor.r + texColor.g) * 0.4;
          float tanAmount = texColor.r - texColor.b;
          
          // If we have strong blue or tan components, likely water/shore boundary
          if (blueAmount > 0.2 || tanAmount > 0.2) {
            // Do color analysis to detect if we're at an edge
            vec2 texelSize = vec2(1.0) / vec2(textureSize(tDiffuse, 0));
            
            // Sample nearby pixels
            vec4 n1 = texture2D(tDiffuse, vUv + vec2(texelSize.x, 0.0));
            vec4 n2 = texture2D(tDiffuse, vUv - vec2(texelSize.x, 0.0));
            vec4 n3 = texture2D(tDiffuse, vUv + vec2(0.0, texelSize.y));
            vec4 n4 = texture2D(tDiffuse, vUv - vec2(0.0, texelSize.y));
            
            // Calculate blue difference in neighborhood
            float blueDiff = abs(n1.b - n2.b) + abs(n3.b - n4.b);
            
            // If we have high blue differences, we're at an edge
            isWaterEdge = smoothstep(0.1, 0.5, blueDiff);
            
            // Apply soft blending at edges
            if (isWaterEdge > 0.0) {
              vec3 blendedColor = mix(texColor.rgb, mix(waterColor, shoreColor, 0.5), isWaterEdge * 0.4);
              texColor.rgb = blendedColor;
            }
          }
          
          gl_FragColor = texColor;
        }
      `,
      transparent: true,
      depthWrite: false
    });
    
    // Create a fullscreen quad
    const plane = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(plane, this.material);
    this.quad.frustumCulled = false;
    
    // Scene for post-processing
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene.add(this.quad);
    
    // Render target for the effect
    this.renderTarget = new THREE.WebGLRenderTarget(
      window.innerWidth, 
      window.innerHeight, 
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        stencilBuffer: false
      }
    );
  }
  
  // Resize handler
  setSize(width, height) {
    if (this.renderTarget) {
      this.renderTarget.setSize(width, height);
    }
  }
  
  // Apply the effect during rendering
  render(renderer, scene, camera) {
    // First render the scene to our render target
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(scene, camera);
    
    // Now apply our shader effect
    this.material.uniforms.tDiffuse.value = this.renderTarget.texture;
    
    // Render to screen
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }
}