# Task 054: Initiate V2 Refactoring Targeting Core Systems

## 1. Task & Context
**Task:** Begin the major architectural refactoring outlined in docs/REFACTORING_PLAN_FOR_V2.md. This initial phase focuses on establishing the core V2 infrastructure and refactoring the three systems presumed largest/most complex (WorldSystem, PlayerSystem, AtmosphereSystem components) into the new architecture. Outline the next three systems for subsequent refactoring.

**Scope:** Create core V2 files (System.js, ConfigManager.js, EventBus.js, SystemManager.js, RendererManager.js, PlatformManager.js, ErrorHandler.js, PerformanceMonitor.js). Refactor src/game/core/Engine.js. Refactor src/game/systems/WorldSystem.js, src/game/systems/PlayerSystem.js (including its V2 split), and all components within src/game/systems/atmosphere/.

**Branch:** feature/v2-refactor (New branch required)

## 2. Quick Plan
**Approach:** Follow Phase 1 and parts of Phase 2 & 3 from docs/REFACTORING_PLAN_FOR_V2.md: Implement the core V2 infrastructure with System base class and managers, refactor Engine.js to use managers, refactor WorldSystem, PlayerSystem (split into sub-systems), and AtmosphereSystem components to extend the System base class. Finally, outline next systems for refactoring.

**Complexity:** 3 (Major architectural changes to core systems)
**Uncertainty:** 2 (Complex systems with potential integration challenges)
**Unknowns:** 
- How cleanly the logic in World/Player/Atmosphere systems will map to the new architecture
- Potential unforeseen dependencies between systems
- Whether current Engine initialization and update order will need adjustments

**Human Input Needed:** No (Following established refactoring plan document)

## 3. Implementation

### Step 1: Create Core V2 Infrastructure

First, we'll create the System base class as the foundation for all systems:

```javascript
// src/game/core/v2/System.js
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
    try {
      if (this.initialized) {
        console.warn(`System ${this.name} already initialized`);
        return;
      }
      
      // Check dependencies
      if (this.dependencies.length > 0) {
        for (const depName of this.dependencies) {
          const dependency = this.engine.systems.get(depName);
          if (!dependency) {
            throw new Error(`System ${this.name} requires dependency ${depName} which is not available`);
          }
          if (!dependency.initialized) {
            throw new Error(`System ${this.name} requires dependency ${depName} which is not initialized`);
          }
        }
      }
      
      // Call implementation-specific initialization
      await this._initialize();
      
      this.initialized = true;
      return this;
    } catch (error) {
      console.error(`Failed to initialize system ${this.name}:`, error);
      throw error;
    }
  }
  
  update(delta, elapsed) {
    if (!this.initialized) {
      return;
    }
    
    try {
      this._update(delta, elapsed);
    } catch (error) {
      console.error(`Error in system ${this.name} update:`, error);
      this.engine.error.logError(this.name, error);
    }
  }
  
  // Abstract methods to be implemented by subclasses
  async _initialize() {}
  _update(delta, elapsed) {}
  
  handleVisibilityChange(visible) {}
  destroy() {}
}
```

Next, we'll implement the event bus for decoupled communication between systems:

```javascript
// src/game/core/v2/EventBus.js
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }
  
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event).push(callback);
    return this;
  }
  
  off(event, callback) {
    if (!this.listeners.has(event)) {
      return this;
    }
    
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
    
    return this;
  }
  
  emit(event, data) {
    if (!this.listeners.has(event)) {
      return;
    }
    
    for (const callback of this.listeners.get(event)) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    }
    
    return this;
  }
  
  clear() {
    this.listeners.clear();
    return this;
  }
}
```
