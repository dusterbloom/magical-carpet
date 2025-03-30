/**
 * This file serves as an adapter to smoothly transition from the old
 * AtmosphereSystem to the new modular implementation
 */

// Import the new AtmosphereSystem from the new modular architecture
import { AtmosphereSystem as NewAtmosphereSystem } from "./atmosphere";

// Export the new system as a replacement for the old one
export class AtmosphereSystem extends NewAtmosphereSystem {
  // The constructor and all methods are inherited directly
  // This adapter pattern allows us to swap implementations without changing imports elsewhere
}
