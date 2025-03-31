/**
 * PerformanceMonitor
 * 
 * Tracks and analyzes game performance metrics including:
 * - FPS (frames per second)
 * - Renderer statistics (draw calls, triangles, etc.)
 * - System execution times
 * - Memory usage
 * 
 * Provides methods to generate reports for optimization purposes.
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fps: [],
      drawCalls: [],
      triangles: [],
      points: [],
      lines: [],
      geometries: [],
      textures: [],
      systemTimes: {
        network: [],
        world: [],
        water: [],
        vegetation: [],
        atmosphere: [],
        player: [],
        carpetTrail: [],
        landmarks: [],
        ui: [],
        minimap: [],
        render: []
      },
      memoryUsage: [],
      lastUpdate: Date.now()
    };
    
    this.sampleSize = 100; // Store last 100 samples
    this.sampleInterval = 1000; // Sample every second
  }

  /**
   * Updates performance metrics based on renderer and engine state
   * @param {THREE.WebGLRenderer} renderer - The Three.js renderer
   * @param {Engine} engine - The game engine instance
   */
  update(renderer, engine) {
    const now = Date.now();
    if (now - this.metrics.lastUpdate < this.sampleInterval) return;
    
    // Get renderer stats
    const info = renderer.info;
    
    // Calculate FPS - use a moving average to smooth out spikes
    // Get direct frame time from engine's delta time if available
    let fps = 0;
    if (engine && engine.delta > 0) {
      fps = 1 / engine.delta; // More accurate when using engine's delta time
    } else {
      const elapsed = now - this.metrics.lastUpdate;
      if (elapsed > 0) { // Avoid division by zero
        fps = 1000 / elapsed;
      }
    }
    
    // Cap FPS to reasonable values to avoid extreme spikes
    fps = Math.min(Math.max(fps, 1), 120);
    
    // Record metrics
    this.addMetric('fps', fps);
    this.addMetric('drawCalls', info.render.calls);
    this.addMetric('triangles', info.render.triangles);
    this.addMetric('points', info.render.points);
    this.addMetric('lines', info.render.lines);
    this.addMetric('geometries', info.memory.geometries);
    this.addMetric('textures', info.memory.textures);
    
    // Record memory usage
    if (window.performance && window.performance.memory) {
      this.addMetric('memoryUsage', window.performance.memory.usedJSHeapSize);
    }
    
    this.metrics.lastUpdate = now;
  }

  /**
   * Adds a metric value to the tracking arrays
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   */
  addMetric(name, value) {
    this.metrics[name].push(value);
    if (this.metrics[name].length > this.sampleSize) {
      this.metrics[name].shift();
    }
  }

  /**
   * Records system execution time
   * @param {string} system - System name
   * @param {number} time - Execution time in milliseconds
   */
  addSystemTime(system, time) {
    if (!this.metrics.systemTimes[system]) {
      // console.warn(`System "${system}" not found in metrics tracking`);
      return;
    }
    
    this.metrics.systemTimes[system].push(time);
    if (this.metrics.systemTimes[system].length > this.sampleSize) {
      this.metrics.systemTimes[system].shift();
    }
  }

  /**
   * Calculates average values for all metrics
   * @returns {Object} Average metrics
   */
  getAverages() {
    const averages = {};
    for (const [key, values] of Object.entries(this.metrics)) {
      if (key !== 'systemTimes' && key !== 'lastUpdate') {
        // For FPS, use a more stable calculation - focus on recent samples and remove outliers
        if (key === 'fps' && values.length > 0) {
          // Sort values to identify outliers
          const sortedValues = [...values].sort((a, b) => a - b);
          // Remove top and bottom 10% to get rid of spikes
          const trimStart = Math.floor(sortedValues.length * 0.1);
          const trimEnd = Math.ceil(sortedValues.length * 0.9);
          const trimmedValues = sortedValues.slice(trimStart, trimEnd);
          
          // Calculate average of trimmed values
          averages[key] = trimmedValues.length > 0 
            ? trimmedValues.reduce((a, b) => a + b, 0) / trimmedValues.length
            : (values.length > 0 ? values[values.length - 1] : 0); // Fall back to latest value
        } else {
          // Standard average for other metrics
          averages[key] = values.length > 0 
            ? values.reduce((a, b) => a + b, 0) / values.length 
            : 0;
        }
      }
    }
    
    averages.systemTimes = {};
    for (const [system, times] of Object.entries(this.metrics.systemTimes)) {
      averages.systemTimes[system] = times.length > 0
        ? times.reduce((a, b) => a + b, 0) / times.length
        : 0;
    }
    
    return averages;
  }

  /**
   * Generates a comprehensive performance report
   * @returns {Object} Performance report with averages, current values, and peaks
   */
  generateReport() {
    const averages = this.getAverages();
    const report = {
      averages,
      current: {
        fps: this.metrics.fps.length > 0 ? this.metrics.fps[this.metrics.fps.length - 1] : 0,
        drawCalls: this.metrics.drawCalls.length > 0 ? this.metrics.drawCalls[this.metrics.drawCalls.length - 1] : 0,
        triangles: this.metrics.triangles.length > 0 ? this.metrics.triangles[this.metrics.triangles.length - 1] : 0,
        systemTimes: {}
      },
      peaks: {
        maxDrawCalls: this.metrics.drawCalls.length > 0 ? Math.max(...this.metrics.drawCalls) : 0,
        minFps: this.metrics.fps.length > 0 ? Math.min(...this.metrics.fps) : 0,
      }
    };
    
    // Add current system times
    for (const system in this.metrics.systemTimes) {
      const times = this.metrics.systemTimes[system];
      if (times.length > 0) {
        report.current.systemTimes[system] = times[times.length - 1];
        report.peaks[`max${system.charAt(0).toUpperCase() + system.slice(1)}Time`] = Math.max(...times);
      }
    }
    
    return report;
  }
  
  /**
   * Clears all collected metrics
   */
  reset() {
    for (const key in this.metrics) {
      if (key === 'systemTimes') {
        for (const system in this.metrics.systemTimes) {
          this.metrics.systemTimes[system] = [];
        }
      } else if (key !== 'lastUpdate') {
        this.metrics[key] = [];
      }
    }
    this.metrics.lastUpdate = Date.now();
  }
}
