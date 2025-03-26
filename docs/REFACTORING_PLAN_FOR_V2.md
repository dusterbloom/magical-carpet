# REFACTORING_FOR_V2.md

## Introduction

This document provides a detailed implementation plan for refactoring the Magical Carpet game. The goal is to reduce complexity, eliminate code duplication, and improve maintainability while preserving all existing functionality and performance optimizations.

## Objectives

1. Reduce all files to a maximum of 200 lines
2. Eliminate redundant code and patterns
3. Improve separation of concerns
4. Standardize system interfaces
5. Enhance code reusability
6. Maintain or improve performance

## Prerequisites

Before beginning the refactoring:

1. Ensure comprehensive test coverage for core functionality
2. Create a dedicated branch for refactoring
3. Document current performance baselines
4. Back up the current implementation

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

#### 1.1 Create System Base Class

```javascript
// src/game/core/System.js
export class System {
  constructor(engine, name) {
    this.engine = engine;
    this.name = name;
    this.initialized = false;
    this.dependencies = [];
  }
  
  requireDependencies(dependencies) {
    this.dependencies = dependencies;
    return this;
  }
  
  async initialize() {
    // Implementation details as specified in the report
  }
  
  update(delta, elapsed) {
    // Implementation details as specified in the report
  }
  
  // Abstract methods to be implemented by subclasses
  async _initialize() {}
  _update(delta, elapsed) {}
  
  handleVisibilityChange(visible) {}
  destroy() {}
}
```

#### 1.2 Implement ConfigManager

Create a centralized configuration system to handle device detection and settings management.

```javascript
// src/game/core/ConfigManager.js
export class ConfigManager {
  constructor(engine) {
    this.engine = engine;
    this.configs = {
      // Categorized configurations as specified in the report
    };
    
    this.detectDeviceCapabilities();
    this.applyDeviceSpecificSettings();
  }
  
  // Methods as specified in the report
}
```

#### 1.3 Create EventBus

Implement an event-driven communication system to reduce direct dependencies between systems.

```javascript
// src/game/core/EventBus.js
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }
  
  // Methods as specified in the report
}
```

#### 1.4 Develop ObjectPool

Create a standardized object pooling system for efficient resource reuse.

```javascript
// src/game/core/ObjectPool.js
export class ObjectPool {
  constructor(objectFactory, initialSize = 10) {
    // Implementation details as specified in the report
  }
  
  // Methods as specified in the report
}
```

### Phase 2: Engine Refactoring (Week 2)

#### 2.1 Create ManagerClasses

Extract specific responsibilities from Engine.js into dedicated manager classes:

##### 2.1.1 SystemManager

```javascript
// src/game/core/SystemManager.js
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
        system.update(delta, elapsed);
      }
    }
  }
}
```

##### 2.1.2 RendererManager

```javascript
// src/game/core/RendererManager.js
export class RendererManager {
  constructor(engine, canvas) {
    this.engine = engine;
    this.canvas = canvas;
    this.renderer = null;
    this.setup();
  }
  
  setup() {
    // Initialize THREE.js renderer with all configurations
    // from current Engine.js
  }
  
  updateResolution() {
    // Resolution scaling code from Engine.js
  }
  
  applyQualitySettings(qualityLevel) {
    // Apply settings based on quality level
  }
  
  render(scene, camera) {
    this.renderer.render(scene, camera);
  }
}
```

##### 2.1.3 QualityManager

```javascript
// src/game/core/QualityManager.js
export class QualityManager {
  constructor(engine) {
    this.engine = engine;
    
    // Quality management properties from Engine.js
    this.targetFPS = 60;
    this.currentFPS = 60;
    this.sampleSize = 20;
    this.fpsHistory = [];
    this.resolutionScale = 1.0;
    // ...more properties
  }
  
  update(delta) {
    // Quality update logic from Engine.js
  }
  
  setBatterySavingMode(enabled) {
    // Battery saving implementation
  }
  
  toggleHighQualityMode() {
    // High quality toggle implementation
  }
}
```

#### 2.2 Refactor Engine.js

After extracting all manager classes, simplify Engine.js to use these managers.

```javascript
// src/game/core/Engine.js
export class Engine {
  constructor() {
    // Simplified implementation using managers
  }
  
  async initialize() {
    // Simplified initialization using managers
  }
  
  animate() {
    // Simplified game loop using managers
  }
  
  // Minimal helper methods
}
```

### Phase 3: System Refactoring (Weeks 3-4)

#### 3.1 Convert Basic Systems

Convert these systems to extend the System base class:
- WorldSystem
- AtmosphereSystem
- VegetationSystem
- WaterSystem
- UISystem
- NetworkManager
- MinimapSystem
- LandmarkSystem
- CarpetTrailSystem

Example conversion pattern:

```javascript
// Before
export class WorldSystem {
  constructor(engine) {
    this.engine = engine;
    // ...other properties
  }
  
  async initialize() {
    // Initialization code
  }
  
  update(delta) {
    // Update code
  }
}

// After
import { System } from '../core/System';

export class WorldSystem extends System {
  constructor(engine) {
    super(engine, 'world');
    // ...other properties
  }
  
  async _initialize() {
    // Initialization code (without duplicate error handling)
  }
  
  _update(delta, elapsed) {
    // Update code (without duplicate error handling)
  }
}
```

#### 3.2 Refactor PhysicsSystem

Split into separate classes:

##### 3.2.1 TerrainCacheManager

```javascript
// src/game/systems/terrain/TerrainCacheManager.js
import { System } from '../../core/System';

export class TerrainCacheManager extends System {
  constructor(engine) {
    super(engine, 'terrainCache');
    // Cache implementation
  }
  
  // Methods for terrain height and normal caching
}
```

##### 3.2.2 PhysicsSystem

```javascript
// src/game/systems/physics/PhysicsSystem.js
import { System } from '../../core/System';

export class PhysicsSystem extends System {
  constructor(engine) {
    super(engine, 'physics');
    this.requireDependencies(['terrainCache']);
    // Physics properties without caching logic
  }
  
  // Physics methods without caching responsibility
}
```

#### 3.3 Reorganize PlayerSystem

Break down into individual systems:

##### 3.3.1 PlayerStateManager

```javascript
// src/game/systems/player/PlayerStateManager.js
import { System } from '../../core/System';

export class PlayerStateManager extends System {
  constructor(engine) {
    super(engine, 'playerState');
    this.players = new Map();
    this.localPlayer = null;
  }
  
  // Player creation and state management
}
```

##### 3.3.2 PlayerPhysicsSystem

```javascript
// src/game/systems/player/PlayerPhysicsSystem.js
import { System } from '../../core/System';

export class PlayerPhysicsSystem extends System {
  constructor(engine) {
    super(engine, 'playerPhysics');
    this.requireDependencies(['playerState', 'physics']);
  }
  
  // Player physics methods
}
```

##### 3.3.3 PlayerInputSystem

```javascript
// src/game/systems/player/PlayerInputSystem.js
import { System } from '../../core/System';

export class PlayerInputSystem extends System {
  constructor(engine) {
    super(engine, 'playerInput');
    this.requireDependencies(['playerState', 'input']);
  }
  
  // Player input methods
}
```

##### 3.3.4 PlayerCameraSystem

```javascript
// src/game/systems/player/PlayerCameraSystem.js
import { System } from '../../core/System';

export class PlayerCameraSystem extends System {
  constructor(engine) {
    super(engine, 'playerCamera');
    this.requireDependencies(['playerState']);
  }
  
  // Camera management methods
}
```

##### 3.3.5 PlayerNetworkSystem

```javascript
// src/game/systems/player/PlayerNetworkSystem.js
import { System } from '../../core/System';

export class PlayerNetworkSystem extends System {
  constructor(engine) {
    super(engine, 'playerNetwork');
    this.requireDependencies(['playerState', 'network']);
  }
  
  // Network synchronization methods
}
```

### Phase 4: Mobile Optimization Refactoring (Week 5)

#### 4.1 PlatformManager

Create a centralized system for device detection and platform-specific features.

```javascript
// src/game/core/PlatformManager.js
export class PlatformManager {
  constructor(engine) {
    this.engine = engine;
    
    // Platform capabilities
    this.capabilities = {
      touch: false,
      highPerformance: false,
      batteryOptimization: false,
      // Other capabilities
    };
    
    this.detectCapabilities();
  }
  
  // Methods as specified in the report
}
```

#### 4.2 Update MobileUI

Refactor MobileUI to work with the new architecture.

```javascript
// src/game/ui/MobileUI.js
import { System } from '../core/System';

export class MobileUI extends System {
  constructor(engine) {
    super(engine, 'mobileUI');
    this.requireDependencies(['playerState', 'input']);
    
    // Only initialize when needed
    if (!this.engine.platform.capabilities.touch) {
      this.enabled = false;
    }
  }
  
  // Mobile UI methods
}
```

### Phase 5: Cleanup & Standardization (Week 6)

#### 5.1 Implement Standard Error Handling

Create a centralized error handling system.

```javascript
// src/game/core/ErrorHandler.js
export class ErrorHandler {
  constructor(engine) {
    this.engine = engine;
    this.errorLog = [];
  }
  
  logError(source, error, fatal = false) {
    const entry = {
      timestamp: Date.now(),
      source,
      message: error.message,
      stack: error.stack,
      fatal
    };
    
    this.errorLog.push(entry);
    console.error(`[${source}]`, error);
    
    if (fatal) {
      this.handleFatalError(entry);
    }
    
    return entry;
  }
  
  handleFatalError(error) {
    // Handle fatal errors (e.g., show error screen)
  }
}
```

#### 5.2 Add JSDoc Documentation

Add comprehensive documentation to all classes and methods.

Example:

```javascript
/**
 * Manages the player's physical movement and interactions with the world.
 * 
 * @class PlayerPhysicsSystem
 * @extends System
 */
export class PlayerPhysicsSystem extends System {
  /**
   * Creates a new PlayerPhysicsSystem.
   * 
   * @param {Engine} engine - The game engine instance.
   */
  constructor(engine) {
    super(engine, 'playerPhysics');
    this.requireDependencies(['playerState', 'physics']);
  }
  
  /**
   * Updates the player's physics state.
   * 
   * @param {number} delta - Time elapsed since last update in seconds.
   * @param {number} elapsed - Total elapsed time in seconds.
   * @protected
   */
  _update(delta, elapsed) {
    // Method implementation
  }
}
```

#### 5.3 Standardize Naming Conventions

Apply consistent naming across the codebase:
- Classes: PascalCase (e.g., `PlayerSystem`)
- Methods and properties: camelCase (e.g., `updatePhysics`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_ALTITUDE`)
- Private methods/properties: Prefixed with underscore (e.g., `_initialize`)

### Phase 6: Testing & Performance Tuning (Week 7)

#### 6.1 Implement Unit Tests

Add unit tests for core functionality.

```javascript
// tests/physics/TerrainCacheManager.test.js
describe('TerrainCacheManager', () => {
  let engine;
  let cacheManager;
  
  beforeEach(() => {
    engine = createMockEngine();
    cacheManager = new TerrainCacheManager(engine);
  });
  
  test('should cache terrain heights', () => {
    cacheManager.setHeight(100, 100, 50);
    expect(cacheManager.getHeight(100, 100)).toBe(50);
  });
  
  test('should handle cache misses', () => {
    expect(cacheManager.getHeight(200, 200)).toBeUndefined();
  });
  
  // More tests
});
```

#### 6.2 Performance Monitoring

Implement a performance monitoring system.

```javascript
// src/game/core/PerformanceMonitor.js
export class PerformanceMonitor {
  constructor(engine) {
    this.engine = engine;
    this.metrics = {
      fps: [],
      frameTime: [],
      memoryUsage: [],
      systemTimes: new Map()
    };
    
    this.sampleSize = 60; // 1 second at 60fps
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
    
    // Trim arrays to sample size
    if (this.metrics.frameTime.length > this.sampleSize) {
      this.metrics.frameTime.shift();
      this.metrics.fps.shift();
    }
    
    // Capture memory usage if available
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
}
```

## Migration Strategy

### 1. File-by-File Migration

1. Start by implementing the core infrastructure (System, ConfigManager, EventBus, ObjectPool)
2. Create one new manager at a time and integrate it into Engine.js
3. Migrate each system to extend System base class individually
4. Test thoroughly after each system migration

### 2. Integration Testing

After migrating each component:
1. Verify visual output matches the original
2. Confirm performance is maintained or improved
3. Test on both desktop and mobile platforms

### 3. Backward Compatibility

Create adapter functions where needed to maintain compatibility with any external code.

## Rollout Timeline

| Week | Phase | Focus Areas |
|------|-------|-------------|
| 1 | Core Infrastructure | System base class, ConfigManager, EventBus, ObjectPool |
| 2 | Engine Refactoring | SystemManager, RendererManager, QualityManager |
| 3-4 | System Refactoring | Convert systems to extend base class, split complex systems |
| 5 | Mobile Optimization | PlatformManager, MobileUI refactoring |
| 6 | Cleanup & Standardization | Error handling, documentation, naming conventions |
| 7 | Testing & Performance | Unit tests, performance monitoring |

## Conclusion

This refactoring plan will significantly improve the maintainability and clarity of the Magical Carpet codebase while preserving all functionality. By breaking down complex systems, standardizing interfaces, and centralizing common functionality, we'll achieve a more modular architecture that's easier to extend and debug.

The key principles guiding this refactoring are:
1. **Separation of concerns** - Each class should have a single responsibility
2. **Code reuse** - Extract common patterns into reusable components
3. **Standardization** - Use consistent patterns across the codebase
4. **Loose coupling** - Use events instead of direct references where appropriate
5. **Configuration over code** - Move configurable values to a central configuration system

By following this implementation plan, all files should remain under the target 200-line limit while making the codebase more maintainable for future development.
