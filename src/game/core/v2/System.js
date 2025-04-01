/**
 * Base class for all game systems in V2 architecture
 */
export class System {
  /**
   * @param {object} engine - Reference to the game engine
   * @param {string} id - Unique identifier for this system
   */
  constructor(engine, id) {
    this.engine = engine;
    this.id = id;
    this.initialized = false;
    this._dependencies = [];
    this._dependenciesResolved = false;
  }

  /**
   * Require certain systems to be available before initialization
   * @param {string[]} systemIds - Array of system IDs that this system depends on
   */
  requireDependencies(systemIds) {
    this._dependencies = systemIds;
  }

  /**
   * Check if all required dependencies are available
   * @returns {boolean} - True if all dependencies are resolved
   */
  resolveDependencies() {
    if (this._dependenciesResolved) return true;
    
    // Check if all dependencies are available
    for (const systemId of this._dependencies) {
      if (!this.engine.systems[systemId]) {
        console.warn(`System ${this.id} depends on ${systemId}, but it's not available`);
        return false;
      }
    }
    
    this._dependenciesResolved = true;
    return true;
  }

  /**
   * Initialize the system - public method that checks dependencies
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;
    
    // Check dependencies
    if (this._dependencies.length > 0 && !this.resolveDependencies()) {
      console.warn(`Cannot initialize ${this.id}: dependencies not resolved`);
      return;
    }
    
    // Call protected initialization method
    await this._initialize();
    
    this.initialized = true;
  }

  /**
   * Update the system - public method that checks initialization
   * @param {number} delta - Time since last update
   * @param {number} elapsed - Total elapsed time
   */
  update(delta, elapsed) {
    if (!this.initialized) return;
    
    // Call protected update method
    this._update(delta, elapsed);
  }

  /**
   * Protected initialization method to be implemented by subclasses
   * @returns {Promise<void>}
   */
  async _initialize() {
    // To be implemented by subclasses
  }

  /**
   * Protected update method to be implemented by subclasses
   * @param {number} delta - Time since last update
   * @param {number} elapsed - Total elapsed time
   */
  _update(delta, elapsed) {
    // To be implemented by subclasses
  }
  
  /**
   * Handle visibility changes (when tab is hidden/shown)
   * @param {boolean} visible - Whether the game is visible
   */
  handleVisibilityChange(visible) {
    // Optional method to be implemented by subclasses if needed
  }
}
