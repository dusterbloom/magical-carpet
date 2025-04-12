/**
 * DeviceCapabilities.js
 * 
 * Centralized utility for detecting and tracking device capabilities across the game.
 * Provides a single source of truth for device-specific optimizations and settings.
 */

export class DeviceCapabilities {
  constructor() {
    // Core device properties
    this.isMobile = false;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.gpuTier = 'unknown';
    this.memoryLimited = false;
    
    // WebGL capabilities
    this.supportsFloatTextures = true;
    this.supportsDepthTexture = true;
    this.supportsShadowMapType = true;
    this.maxTextureSize = 4096;
    
    // Detect all capabilities on initialization
    this.detect();
  }
  
  /**
   * Detect device capabilities using various browser APIs and heuristics
   */
  detect() {
    // Check if device is mobile
    this.isMobile = this._detectMobile();
    
    // Get detailed WebGL capabilities
    this._detectWebGLCapabilities();
    
    // Classify GPU tier based on detected information
    this._classifyGPUTier();
    
    // Log detection results
    this._logDetectionResults();
    
    return this.isMobile;
  }
  
  /**
   * Detect if device is mobile based on user agent and screen size
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
   * Detect WebGL capabilities using Canvas API
   */
  _detectWebGLCapabilities() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (gl) {
        // Check max texture size
        this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        
        // Check if float textures are supported
        const ext = gl.getExtension('OES_texture_float');
        this.supportsFloatTextures = !!ext;
        
        // Check for depth texture support
        const depthTextureExt = gl.getExtension('WEBGL_depth_texture');
        this.supportsDepthTexture = !!depthTextureExt;
        
        // Check available memory and GPU info (for some browsers)
        if (gl.getExtension('WEBGL_debug_renderer_info')) {
          const renderer = gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL);
          const vendor = gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_VENDOR_WEBGL);
          
          this.gpuInfo = {
            renderer,
            vendor
          };
          
          // Store the raw info for more detailed analysis
          this.rawRendererInfo = renderer.toLowerCase();
        }
      } else {
        console.warn('WebGL not supported - using fallback values');
        this.memoryLimited = true;
        this.maxTextureSize = 1024;
        this.supportsFloatTextures = false;
        this.supportsDepthTexture = false;
      }
    } catch (e) {
      console.warn('Failed to detect WebGL capabilities:', e);
      this.memoryLimited = true;
      this.maxTextureSize = 1024;
      this.supportsFloatTextures = false;
      this.supportsDepthTexture = false;
    }
  }
  
  /**
   * Classify GPU tier based on detected information
   */
  _classifyGPUTier() {
    // Start with a base classification
    if (this.isMobile) {
      this.gpuTier = 'medium'; // Default for mobile
      
      // Get more specific mobile info
      const ua = navigator.userAgent.toLowerCase();
      
      // Check for high-end indicators
      if (
        ua.includes('iphone 13') || ua.includes('iphone 14') || ua.includes('iphone 15') ||
        ua.includes('ipad pro') || ua.includes('sm-s') || ua.includes('sm-n') ||
        ua.includes('pixel 6') || ua.includes('pixel 7') || ua.includes('pixel 8')
      ) {
        this.gpuTier = 'high';
      }
      // Check for low-end indicators
      else if (
        ua.includes('sm-j') || ua.includes('sm-a') || ua.includes('redmi') || 
        ua.includes('mediatek') || ua.includes('wiko') || ua.includes('nokia')
      ) {
        this.gpuTier = 'low';
        this.memoryLimited = true;
      }
      
      // Limit texture size on mobile based on tier (prevents memory issues)
      this.maxTextureSize = 
        this.gpuTier === 'high' ? 4096 :
        this.gpuTier === 'medium' ? 2048 : 1024;
    } else {
      // Desktop detection
      this.gpuTier = 'high'; // Default for desktop
      
      // Check for low-end desktop GPUs using renderer info
      if (this.rawRendererInfo) {
        if (
          this.rawRendererInfo.includes('intel') && 
          !this.rawRendererInfo.includes('iris') && 
          !this.rawRendererInfo.includes('uhd')
        ) {
          this.gpuTier = 'low';
          this.memoryLimited = true;
        }
      }
    }
  }
  
  /**
   * Log detection results to console
   */
  _logDetectionResults() {
    console.log('Device Capabilities Detection Results:');
    console.log(`- Platform: ${this.isMobile ? 'Mobile' : 'Desktop'}`);
    console.log(`- GPU Tier: ${this.gpuTier}`);
    console.log(`- Memory Limited: ${this.memoryLimited}`);
    console.log(`- Max Texture Size: ${this.maxTextureSize}`);
    console.log(`- Float Textures: ${this.supportsFloatTextures ? 'Supported' : 'Not Supported'}`);
    console.log(`- Depth Textures: ${this.supportsDepthTexture ? 'Supported' : 'Not Supported'}`);
    
    if (this.gpuInfo) {
      console.log(`- GPU Info: ${this.gpuInfo.vendor} ${this.gpuInfo.renderer}`);
    }
    
    console.log('Additional Information:');
    console.log(`- Device Pixel Ratio: ${window.devicePixelRatio}`);
    console.log(`- Memory: ${navigator.deviceMemory ? navigator.deviceMemory + 'GB' : 'Unknown'}`);
    console.log(`- Cores: ${navigator.hardwareConcurrency || 'Unknown'}`);
  }
  
  /**
   * Get recommended texture size based on device capability
   * @param {number} baseSize - Base texture size
   * @returns {number} Adjusted texture size
   */
  getRecommendedTextureSize(baseSize) {
    if (!this.isMobile) {
      return baseSize;
    }
    
    // Scale down textures based on GPU tier
    switch (this.gpuTier) {
      case 'low':
        return Math.min(baseSize, 256);
      case 'medium':
        return Math.min(baseSize, 512);
      case 'high':
        return Math.min(baseSize, 1024);
      default:
        return Math.min(baseSize, 512);
    }
  }
  
  /**
   * Check if the device supports a specific feature
   * @param {string} feature - Feature to check ('shadows', 'reflections', 'postprocessing')
   * @returns {boolean} True if the feature is supported
   */
  supportsFeature(feature) {
    switch (feature.toLowerCase()) {
      case 'shadows':
        return !this.isMobile || this.gpuTier !== 'low';
      case 'reflections':
        return !this.isMobile || this.gpuTier !== 'low';
      case 'postprocessing':
        return !this.isMobile || this.gpuTier === 'high';
      default:
        return true;
    }
  }
}

// Create and export a singleton instance to be used across the game
export const deviceCapabilities = new DeviceCapabilities();
