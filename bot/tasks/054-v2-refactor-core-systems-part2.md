
The SystemManager is responsible for managing all game systems:

```javascript
// src/game/core/v2/SystemManager.js
export class SystemManager {
  constructor(engine) {
    this.engine = engine;
    this.systems = new Map();
    this.updateOrder = [];
  }
  
  register(system) {
    this.systems.set(system.name, system);
    return this;
  }
  
  get(name) {
    return this.systems.get(name);
  }
  
  setUpdateOrder(orderArray) {
    this.updateOrder = orderArray;
    return this;
  }
  
  async initialize() {
    for (const systemName of this.updateOrder) {
      const system = this.get(systemName);
      if (system) {
        await system.initialize();
      }
    }
  }
  
  update(delta, elapsed) {
    for (const systemName of this.updateOrder) {
      const system = this.get(systemName);
      if (system) {
        // Start performance monitoring for this system
        if (this.engine.performance) {
          this.engine.performance.startSystemTimer(systemName);
        }
        
        system.update(delta, elapsed);
        
        // End performance monitoring for this system
        if (this.engine.performance) {
          this.engine.performance.endSystemTimer(systemName);
        }
      }
    }
  }
  
  handleVisibilityChange(visible) {
    for (const [name, system] of this.systems) {
      if (typeof system.handleVisibilityChange === 'function') {
        system.handleVisibilityChange(visible);
      }
    }
  }
}
```

The RendererManager will handle all rendering responsibilities:

```javascript
// src/game/core/v2/RendererManager.js
import * as THREE from "three";

export class RendererManager {
  constructor(engine, canvas) {
    this.engine = engine;
    this.canvas = canvas;
    this.renderer = null;
  }
  
  setup() {
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    
    // Configure renderer
    this.renderer.setClearColor(0x88ccff);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    THREE.ColorManagement.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    return this;
  }
  
  updateResolution(resolutionScale = 1.0) {
    // Update renderer resolution
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * resolutionScale);
    
    return this;
  }
  
  handleResize() {
    this.updateResolution();
    
    // Update camera if available
    if (this.engine.camera) {
      this.engine.camera.aspect = window.innerWidth / window.innerHeight;
      this.engine.camera.updateProjectionMatrix();
    }
    
    return this;
  }
  
  render(scene, camera) {
    if (!this.renderer || !scene || !camera) {
      return;
    }
    
    this.renderer.render(scene, camera);
    
    return this;
  }
}
```

The ConfigManager will handle game configuration:

```javascript
// src/game/core/v2/ConfigManager.js
export class ConfigManager {
  constructor(engine) {
    this.engine = engine;
    
    // Default configurations
    this.configs = {
      graphics: {
        quality: 'auto',
        shadows: true,
        antialiasing: true,
        resolution: 1.0
      },
      audio: {
        enabled: true,
        volume: 0.8,
        music: 0.5,
        effects: 1.0
      },
      gameplay: {
        difficulty: 'normal',
        controlSensitivity: 1.0
      },
      device: {
        isMobile: false,
        isTouch: false,
        isBrowserSupported: true,
        hasLowMemory: false,
        hasLowCPU: false
      }
    };
    
    // Detect device capabilities
    this.detectDeviceCapabilities();
    this.applyDeviceSpecificSettings();
  }
  
  detectDeviceCapabilities() {
    // Detect mobile devices
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    this.configs.device.isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    
    // Detect touch capability
    this.configs.device.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Detect memory constraints (simplified)
    if (this.configs.device.isMobile) {
      this.configs.device.hasLowMemory = true;
      this.configs.device.hasLowCPU = true;
    }
    
    return this;
  }
  
  applyDeviceSpecificSettings() {
    // Apply mobile-specific settings
    if (this.configs.device.isMobile) {
      this.configs.graphics.quality = 'low';
      this.configs.graphics.shadows = false;
      this.configs.graphics.resolution = 0.75;
    }
    
    return this;
  }
  
  get(category, key) {
    if (category && key && this.configs[category]) {
      return this.configs[category][key];
    } else if (category && this.configs[category]) {
      return this.configs[category];
    }
    return null;
  }
  
  set(category, key, value) {
    if (category && key && this.configs[category]) {
      this.configs[category][key] = value;
      return true;
    }
    return false;
  }
  
  save() {
    try {
      localStorage.setItem('gameConfig', JSON.stringify(this.configs));
      return true;
    } catch (error) {
      console.error('Failed to save game configuration:', error);
      return false;
    }
  }
  
  load() {
    try {
      const savedConfig = localStorage.getItem('gameConfig');
      if (savedConfig) {
        this.configs = {...this.configs, ...JSON.parse(savedConfig)};
      }
      return true;
    } catch (error) {
      console.error('Failed to load game configuration:', error);
      return false;
    }
  }
}
```
