export class SystemManager {
  constructor(engine) {
    this.engine = engine;
    this.systems = new Map();
    this.updateOrder = [];
  }
  
  register(system) {
    // Make system accessible both via Map and direct property for compatibility
    this.systems.set(system.id, system);
    this[system.id] = system;
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
    console.log("SystemManager update start");
    for (const systemName of this.updateOrder) {
      const system = this.get(systemName);
      if (system) {
        console.log(`Updating system: ${systemName}`);
        try {
          if (this.engine.performance) {
            this.engine.performance.startSystemTimer(systemName);
          }
          
          system.update(delta, elapsed);
          
          if (this.engine.performance) {
            this.engine.performance.endSystemTimer(systemName);
          }
        } catch (error) {
          console.error(`Error updating system ${systemName}:`, error);
          this.engine.error.logError(`system_${systemName}`, error);
        }
      } else {
        console.warn(`System not found: ${systemName}`);
      }
    }
    console.log("SystemManager update complete");
  }
  
  handleVisibilityChange(visible) {
    for (const [name, system] of this.systems) {
      if (typeof system.handleVisibilityChange === 'function') {
        system.handleVisibilityChange(visible);
      }
    }
  }
}