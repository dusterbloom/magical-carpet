export class PerformanceMonitor {
  constructor(engine) {
    this.engine = engine;
    this.metrics = {
      fps: [],
      frameTime: [],
      memoryUsage: [],
      systemTimes: new Map()
    };
    
    this.sampleSize = 60;
    this.enabled = true;
  }
  
  startFrame() {
    if (!this.enabled) return;
    this.frameStartTime = performance.now();
  }
  
  endFrame() {
    if (!this.enabled || !this.frameStartTime) return;
    
    const frameTime = performance.now() - this.frameStartTime;
    this.metrics.frameTime.push(frameTime);
    this.metrics.fps.push(1000 / frameTime);
    
    if (this.metrics.frameTime.length > this.sampleSize) {
      this.metrics.frameTime.shift();
      this.metrics.fps.shift();
    }
    
    if (performance.memory) {
      this.metrics.memoryUsage.push(performance.memory.usedJSHeapSize);
      if (this.metrics.memoryUsage.length > this.sampleSize) {
        this.metrics.memoryUsage.shift();
      }
    }
  }
  
  startSystemTimer(systemName) {
    if (!this.enabled) return;
    this._systemStartTimes = this._systemStartTimes || new Map();
    this._systemStartTimes.set(systemName, performance.now());
  }
  
  endSystemTimer(systemName) {
    if (!this.enabled || !this._systemStartTimes) return;
    
    const startTime = this._systemStartTimes.get(systemName);
    if (!startTime) return;
    
    const duration = performance.now() - startTime;
    
    if (!this.metrics.systemTimes.has(systemName)) {
      this.metrics.systemTimes.set(systemName, []);
    }
    
    const times = this.metrics.systemTimes.get(systemName);
    times.push(duration);
    
    if (times.length > this.sampleSize) {
      times.shift();
    }
  }
  
  getAverageFrameTime() {
    if (this.metrics.frameTime.length === 0) return 0;
    const sum = this.metrics.frameTime.reduce((a, b) => a + b, 0);
    return sum / this.metrics.frameTime.length;
  }
  
  getAverageFPS() {
    if (this.metrics.fps.length === 0) return 0;
    const sum = this.metrics.fps.reduce((a, b) => a + b, 0);
    return sum / this.metrics.fps.length;
  }
  
  getSystemReport() {
    const report = {};
    
    for (const [systemName, times] of this.metrics.systemTimes.entries()) {
      if (times.length === 0) continue;
      
      const sum = times.reduce((a, b) => a + b, 0);
      const avg = sum / times.length;
      
      report[systemName] = {
        averageTime: avg,
        percentage: avg / this.getAverageFrameTime() * 100
      };
    }
    
    return report;
  }

  addSystemTime(systemName, duration) {
    if (!this.enabled) return;
    
    if (!this.metrics.systemTimes.has(systemName)) {
      this.metrics.systemTimes.set(systemName, []);
    }
    
    const times = this.metrics.systemTimes.get(systemName);
    times.push(duration);
    
    if (times.length > this.sampleSize) {
      times.shift();
    }
  }

  generateReport() {
    const report = {
      current: {
        fps: this.metrics.fps[this.metrics.fps.length - 1] || 0
      },
      averages: {
        fps: this.getAverageFPS(),
        frameTime: this.getAverageFrameTime()
      },
      systems: this.getSystemReport()
    };
    
    // Add memory metrics if available
    if (this.metrics.memoryUsage.length > 0) {
      report.averages.memory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    }
    
    return report;
  }

    // Add compatibility method for Engine.js
    update(renderer, engine) {
      // This method was previously used to collect renderer stats
      // Now we handle most of this in startFrame/endFrame
      // but we'll keep it for compatibility
      if (!this.enabled) return;
      
      // If renderer stats are available, collect them
      if (renderer && renderer.info) {
        const info = renderer.info;
        if (!this.metrics.renderStats) {
          this.metrics.renderStats = {
            drawCalls: [],
            triangles: [],
            points: [],
            lines: []
          };
        }
        
        // Collect render stats
        this.metrics.renderStats.drawCalls.push(info.render?.calls || 0);
        this.metrics.renderStats.triangles.push(info.render?.triangles || 0);
        this.metrics.renderStats.points.push(info.render?.points || 0);
        this.metrics.renderStats.lines.push(info.render?.lines || 0);
        
        // Trim arrays to sample size
        Object.values(this.metrics.renderStats).forEach(array => {
          if (array.length > this.sampleSize) {
            array.shift();
          }
        });
      }
    }
    
    // Add compatibility method for MobileLODManager
    generateReport() {
      const report = {
        current: {
          fps: this.metrics.fps[this.metrics.fps.length - 1] || 0
        },
        averages: {
          fps: this.getAverageFPS(),
          frameTime: this.getAverageFrameTime()
        },
        systems: this.getSystemReport()
      };
      
      // Add renderer stats if available
      if (this.metrics.renderStats) {
        const getLastValue = (array) => array[array.length - 1] || 0;
        report.current.drawCalls = getLastValue(this.metrics.renderStats.drawCalls);
        report.current.triangles = getLastValue(this.metrics.renderStats.triangles);
        report.current.points = getLastValue(this.metrics.renderStats.points);
        report.current.lines = getLastValue(this.metrics.renderStats.lines);
      }
      
      // Add memory metrics if available
      if (this.metrics.memoryUsage.length > 0) {
        report.averages.memory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
      }
      
      return report;
    }
  
}