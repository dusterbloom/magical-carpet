/**
 * Game settings manager
 * Handles quality settings, performance optimizations, and user preferences
 */
export class Settings {
  constructor() {
    this.quality = {
      water: 'high',      // 'high', 'medium', 'low'
      vegetation: 'high', // 'high', 'medium', 'low'
      shadows: 'high',    // 'high', 'medium', 'low', 'off'
      effects: 'high'     // 'high', 'medium', 'low'
    };
    
    this.performance = {
      autoAdjust: true,   // Automatically adjust settings based on performance
      targetFPS: 30,      // Target FPS for auto-adjustment
      lowFPSThreshold: 20 // FPS threshold for quality reduction
    };
    
    // Detect if running on mobile device
    this.isMobile = this._detectMobile();
    
    // Apply initial settings based on platform
    this._applyInitialSettings();
  }
  
  /**
   * Simple mobile detection based on user agent and screen size
   * @returns {boolean} True if device is likely a mobile device
   */
  _detectMobile() {
    // Check user agent for common mobile keywords
    const userAgent = navigator.userAgent.toLowerCase();
    if (/(android|iphone|ipad|ipod|blackberry|windows phone)/g.test(userAgent)) {
      return true;
    }
    
    // Check screen size (devices under 768px width are likely mobile)
    if (window.innerWidth < 768) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Apply initial settings based on device capabilities
   */
  _applyInitialSettings() {
    if (this.isMobile) {
      console.log('Mobile device detected, applying optimized settings');
      
      // Lower quality settings for mobile
      this.quality.water = 'low';
      this.quality.vegetation = 'medium';
      this.quality.shadows = 'low';
      this.quality.effects = 'medium';
    }
  }
  
  /**
   * Update settings based on current performance
   * @param {object} performanceData - Current performance metrics
   */
  updateFromPerformance(performanceData) {
    // Only adjust performance on mobile devices
    if (!this.performance.autoAdjust || !this.isMobile) return false;
    
    const currentFPS = performanceData.current.fps;
    
    // Low performance detected, reduce quality
    if (currentFPS < this.performance.lowFPSThreshold) {
      this._reduceQuality();
      return true; // Settings changed
    }
    
    return false; // No settings changed
  }
  
  /**
   * Reduce quality settings to improve performance
   */
  _reduceQuality() {
    // Water has the biggest impact, reduce first
    if (this.quality.water === 'high') {
      this.quality.water = 'medium';
      console.log('Reduced water quality to medium');
      return;
    } else if (this.quality.water === 'medium') {
      this.quality.water = 'low';
      console.log('Reduced water quality to low');
      return;
    }
    
    // Then vegetation
    if (this.quality.vegetation === 'high') {
      this.quality.vegetation = 'medium';
      console.log('Reduced vegetation quality to medium');
      return;
    } else if (this.quality.vegetation === 'medium') {
      this.quality.vegetation = 'low';
      console.log('Reduced vegetation quality to low');
      return;
    }
    
    // Then shadows
    if (this.quality.shadows === 'high') {
      this.quality.shadows = 'medium';
      console.log('Reduced shadow quality to medium');
      return;
    } else if (this.quality.shadows === 'medium') {
      this.quality.shadows = 'low';
      console.log('Reduced shadow quality to low');
      return;
    } else if (this.quality.shadows === 'low') {
      this.quality.shadows = 'off';
      console.log('Turned shadows off');
      return;
    }
    
    // Finally effects
    if (this.quality.effects === 'high') {
      this.quality.effects = 'medium';
      console.log('Reduced effects quality to medium');
      return;
    } else if (this.quality.effects === 'medium') {
      this.quality.effects = 'low';
      console.log('Reduced effects quality to low');
      return;
    }
  }
  
  /**
   * Set a specific quality setting
   * @param {string} setting - Setting name ('water', 'vegetation', 'shadows', 'effects')
   * @param {string} value - Quality level ('high', 'medium', 'low', 'off' for shadows)
   */
  setQuality(setting, value) {
    if (this.quality.hasOwnProperty(setting)) {
      // Validate value based on setting
      if (setting === 'shadows') {
        if (['high', 'medium', 'low', 'off'].includes(value)) {
          this.quality[setting] = value;
          return true;
        }
      } else {
        if (['high', 'medium', 'low'].includes(value)) {
          this.quality[setting] = value;
          return true;
        }
      }
    }
    return false;
  }
  
  /**
   * Initialize method - added for compatibility with engine systems
   * This is a no-op since Settings is initialized in the constructor
   */
  async initialize() {
    console.log('Settings already initialized');
    return true;
  }
  
  /**
   * Update method - added for compatibility with engine systems
   * This is a no-op since Settings doesn't need regular updates
   */
  update() {
    // No-op - Settings doesn't need regular updates
    return;
  }
}
