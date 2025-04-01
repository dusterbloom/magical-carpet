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
      
      this.detectDeviceCapabilities();
      this.applyDeviceSpecificSettings();
    }
    
    detectDeviceCapabilities() {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      this.configs.device.isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      this.configs.device.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      if (this.configs.device.isMobile) {
        this.configs.device.hasLowMemory = true;
        this.configs.device.hasLowCPU = true;
      }
      
      return this;
    }
    
    applyDeviceSpecificSettings() {
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