export class PlatformManager {
    constructor(engine) {
      this.engine = engine;
      
      this.capabilities = {
        touch: false,
        highPerformance: false,
        batteryOptimization: false,
        webGL2: false,
        deviceMemory: 0,
        deviceCores: 0,
        devicePixelRatio: 1
      };
      
      this.detectCapabilities();
    }
    
    detectCapabilities() {
      this.capabilities.touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      this.capabilities.webGL2 = !!window.WebGL2RenderingContext;
      this.capabilities.devicePixelRatio = window.devicePixelRatio || 1;
      
      if (window.navigator) {
        if (navigator.deviceMemory) {
          this.capabilities.deviceMemory = navigator.deviceMemory;
        }
        
        if (navigator.hardwareConcurrency) {
          this.capabilities.deviceCores = navigator.hardwareConcurrency;
        }
        
        this.capabilities.highPerformance = (
          this.capabilities.deviceMemory >= 4 && 
          this.capabilities.deviceCores >= 4 &&
          this.capabilities.webGL2
        );
        
        if (navigator.getBattery) {
          navigator.getBattery().then(battery => {
            this.capabilities.batteryOptimization = (
              this.capabilities.touch && !battery.charging
            );
          }).catch(() => {
            this.capabilities.batteryOptimization = false;
          });
        }
      }
      
      return this;
    }
    
    isMobile() {
      return this.capabilities.touch;
    }
    
    shouldOptimizeForBattery() {
      return this.capabilities.batteryOptimization;
    }
    
    isHighPerformanceDevice() {
      return this.capabilities.highPerformance;
    }
  }