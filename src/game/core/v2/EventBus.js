export class EventBus {
    constructor() {
      this.listeners = new Map();
    }
    
    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event).add(callback);
      return this;
    }
    
    off(event, callback) {
      if (this.listeners.has(event)) {
        this.listeners.get(event).delete(callback);
      }
      return this;
    }
    
    emit(event, data) {
      if (this.listeners.has(event)) {
        for (const callback of this.listeners.get(event)) {
          callback(data);
        }
      }
      return this;
    }
    
    clear(event) {
      if (event) {
        this.listeners.delete(event);
      } else {
        this.listeners.clear();
      }
      return this;
    }
  }