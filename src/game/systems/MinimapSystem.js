import * as THREE from "three";

export class MinimapSystem {
  constructor(engine) {
    this.engine = engine;
    this.canvas = null;
    this.context = null;
    this.size = 150;             // Size in pixels
    this.range = 500;            // World units to show on map
    this.minimapContainer = null;
    this.initialized = false;
    this.lastUpdate = 0;         // For throttling updates
    this.updateInterval = 1/30;  // Update at 30fps max
    
    // Visual settings
    this.colors = {
      water: 'rgba(0, 100, 200, 0.8)',
      mountain: 'rgba(100, 100, 100, 0.8)',
      forest: 'rgba(0, 100, 0, 0.8)',
      desert: 'rgba(200, 180, 120, 0.8)',
      plains: 'rgba(0, 170, 0, 0.8)',
      snow: 'rgba(240, 240, 250, 0.8)',
      landmark: {
        ancient_ruins: 'rgba(200, 180, 100, 0.9)',
        magical_circle: 'rgba(180, 50, 180, 0.9)',
        crystal_formation: 'rgba(100, 220, 220, 0.9)',
        default: 'rgba(255, 255, 255, 0.8)'
      },
      mana: 'rgba(50, 150, 255, 0.8)',
      player: 'rgba(255, 255, 255, 1)',
      otherPlayer: 'rgba(255, 100, 100, 1)',
      background: 'rgba(0, 0, 20, 0.5)',
      border: 'rgba(255, 255, 255, 0.5)',
      direction: 'white'
    };
  }

  async initialize() {
    console.log("Initializing MinimapSystem...");
    
    // Create canvas for the minimap
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.canvas.style.borderRadius = '50%'; // Circular map
    
    // Create container for the minimap
    this.createContainer();
    
    this.initialized = true;
    console.log("MinimapSystem initialized");
  }
  
  createContainer() {
    // Remove any existing container
    const existingContainer = document.getElementById('minimap-container');
    if (existingContainer) {
      existingContainer.remove();
    }
    
    // Create new container
    this.minimapContainer = document.createElement('div');
    this.minimapContainer.id = 'minimap-container';
    this.minimapContainer.style.position = 'absolute';
    
    // Check if we're on mobile
    if (this.engine.isMobile) {
      // Mobile positioning
      this.minimapContainer.style.top = '10px';
      this.minimapContainer.style.left = '10px';
      // Smaller size on mobile
      this.size = 100;
      this.canvas.width = this.size;
      this.canvas.height = this.size;
    } else {
      // Desktop positioning
      this.minimapContainer.style.top = '70px'; // Position below FPS counter
      this.minimapContainer.style.left = '10px';
    }
    
    this.minimapContainer.style.width = `${this.size}px`;
    this.minimapContainer.style.height = `${this.size}px`;
    this.minimapContainer.style.border = `2px solid ${this.colors.border}`;
    this.minimapContainer.style.borderRadius = '50%';
    this.minimapContainer.style.overflow = 'hidden';
    this.minimapContainer.style.backgroundColor = this.colors.background;
    this.minimapContainer.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    this.minimapContainer.style.zIndex = '100'; // Ensure it's visible
    
    // Append canvas to container
    this.minimapContainer.appendChild(this.canvas);
    
    // Append container to the UI layer
    const uiContainer = document.getElementById('ui-container');
    if (uiContainer) {
      uiContainer.appendChild(this.minimapContainer);
    } else {
      document.body.appendChild(this.minimapContainer);
    }
  }
  
  /**
   * Convert world coordinates to minimap coordinates
   * @param {number} x - World X coordinate
   * @param {number} z - World Z coordinate
   * @returns {Object} - Minimap coordinates {x, z}
   */
  worldToMap(x, z) {
    if (!this.engine.systems.player?.localPlayer) return { x: this.size / 2, z: this.size / 2 };
    
    const player = this.engine.systems.player.localPlayer;
    const centerX = this.size / 2;
    const centerZ = this.size / 2;
    
    // Calculate relative position to player
    const relativeX = x - player.position.x;
    const relativeZ = z - player.position.z;
    
    // Scale and translate
    const mapX = centerX + (relativeX / this.range) * (this.size * 0.8);
    const mapZ = centerZ + (relativeZ / this.range) * (this.size * 0.8);
    
    return { x: mapX, z: mapZ };
  }
  
  /**
   * Clear the minimap canvas
   */
  clear() {
    if (!this.context) return;
    
    this.context.fillStyle = this.colors.background;
    this.context.fillRect(0, 0, this.size, this.size);
    
    // Draw border
    this.context.strokeStyle = this.colors.border;
    this.context.lineWidth = 1;
    this.context.beginPath();
    this.context.arc(this.size/2, this.size/2, this.size/2 - 2, 0, Math.PI * 2);
    this.context.stroke();
  }
  
  /**
   * Draw terrain on the minimap
   */
  drawTerrain() {
    if (!this.context || !this.engine.systems.world) return;
    
    const worldSystem = this.engine.systems.world;
    const player = this.engine.systems.player?.localPlayer;
    if (!player) return;
    
    // Sample terrain heights and biomes around player
    const sampleSize = 30; // Number of samples in each direction
    const sampleStep = this.range / sampleSize;
    
    for (let i = 0; i < sampleSize; i++) {
      for (let j = 0; j < sampleSize; j++) {
        const worldX = player.position.x - (this.range / 2) + (i * sampleStep);
        const worldZ = player.position.z - (this.range / 2) + (j * sampleStep);
        
        // Get height and determine biome
        let height, biome;
        
        try {
          // Use the terrain height function if available
          height = worldSystem.getTerrainHeight ? 
                   worldSystem.getTerrainHeight(worldX, worldZ) : 
                   0;
                   
          // Try to get biome information through various methods
          if (worldSystem.getBiomeAt) {
            biome = worldSystem.getBiomeAt(worldX, worldZ);
          } else {
            // Estimate biome based on height if no direct method
            if (height < worldSystem.waterLevel || height < 0) {
              biome = 'water';
            } else if (height > 80) {
              biome = 'mountain';
            } else if (height > 60) {
              biome = 'forest';
            } else {
              biome = 'plains';
            }
          }
        } catch (error) {
          // Default fallback values
          height = 0;
          biome = 'plains';
        }
        
        // Convert to minimap coordinates
        const mapPos = this.worldToMap(worldX, worldZ);
        
        // Determine color based on height and biome
        let color;
        if (height < (worldSystem.waterLevel || 0)) {
          // Water
          color = this.colors.water;
        } else if (biome === 'mountain' || height > 80) {
          color = this.colors.mountain;
        } else if (biome === 'forest' || height > 60) {
          color = this.colors.forest;
        } else if (biome === 'desert') {
          color = this.colors.desert;
        } else if (biome === 'snow') {
          color = this.colors.snow;
        } else {
          // Default terrain
          color = this.colors.plains;
        }
        
        // Draw terrain pixel
        this.context.fillStyle = color;
        this.context.fillRect(mapPos.x, mapPos.z, 3, 3);
      }
    }
  }
  
  /**
   * Draw landmarks on the minimap
   */
  drawLandmarks() {
    if (!this.context) return;
    
    const landmarkSystem = this.engine.systems.landmarks;
    
    if (!landmarkSystem || !landmarkSystem.landmarks) return;
    
    // Draw each landmark
    landmarkSystem.landmarks.forEach(landmark => {
      const mapPos = this.worldToMap(landmark.position.x, landmark.position.z);
      
      // Check if landmark is within map range
      if (mapPos.x >= 0 && mapPos.x <= this.size && 
          mapPos.z >= 0 && mapPos.z <= this.size) {
        
        // Draw landmark based on type
        this.context.beginPath();
        
        // Select color based on landmark type
        const color = this.colors.landmark[landmark.type] || this.colors.landmark.default;
        this.context.fillStyle = color;
        
        // Draw landmark icon
        this.context.arc(mapPos.x, mapPos.z, 4, 0, Math.PI * 2);
        this.context.fill();
      }
    });
  }
  
  /**
   * Draw mana orbs on the minimap
   */
  drawMana() {
    if (!this.context) return;
    
    // Get mana nodes from world system
    const worldSystem = this.engine.systems.world;
    
    if (!worldSystem || !worldSystem.manaNodes) return;
    
    // Draw each mana orb
    worldSystem.manaNodes.forEach(orb => {
      // Skip collected orbs
      if (orb.userData && orb.userData.collected) return;
      
      const mapPos = this.worldToMap(orb.position.x, orb.position.z);
      
      // Check if orb is within map range
      if (mapPos.x >= 0 && mapPos.x <= this.size && 
          mapPos.z >= 0 && mapPos.z <= this.size) {
        
        // Draw mana orb
        this.context.beginPath();
        this.context.fillStyle = this.colors.mana;
        this.context.arc(mapPos.x, mapPos.z, 2, 0, Math.PI * 2);
        this.context.fill();
      }
    });
  }
  
  /**
   * Draw players on the minimap
   */
  drawPlayers() {
    if (!this.context) return;
    
    const playerSystem = this.engine.systems.player;
    if (!playerSystem) return;
    
    // Draw each player
    playerSystem.players.forEach(player => {
      // Convert world position to minimap position
      const mapPos = this.worldToMap(player.position.x, player.position.z);
      
      // Check if player is within map range
      if (mapPos.x >= 0 && mapPos.x <= this.size && 
          mapPos.z >= 0 && mapPos.z <= this.size) {
        
        // Draw player dot
        this.context.beginPath();
        if (player.isLocal) {
          this.context.fillStyle = this.colors.player;
          this.context.arc(mapPos.x, mapPos.z, 4, 0, Math.PI * 2);
        } else {
          this.context.fillStyle = this.colors.otherPlayer;
          this.context.arc(mapPos.x, mapPos.z, 3, 0, Math.PI * 2);
        }
        this.context.fill();
        
        // Draw direction indicator for local player
        if (player.isLocal) {
          const dirX = Math.sin(player.rotation.y) * 8;
          const dirZ = Math.cos(player.rotation.y) * 8;
          
          this.context.beginPath();
          this.context.moveTo(mapPos.x, mapPos.z);
          this.context.lineTo(mapPos.x + dirX, mapPos.z + dirZ);
          this.context.strokeStyle = this.colors.direction;
          this.context.lineWidth = 2;
          this.context.stroke();
          
          // Draw field of view indicator
          this.context.beginPath();
          this.context.fillStyle = 'rgba(255, 255, 255, 0.2)';
          this.context.moveTo(mapPos.x, mapPos.z);
          this.context.arc(mapPos.x, mapPos.z, 20, player.rotation.y - 0.4, player.rotation.y + 0.4);
          this.context.lineTo(mapPos.x, mapPos.z);
          this.context.fill();
        }
      }
    });
  }
  
  /**
   * Draw compass rose on the minimap
   */
  drawCompassRose() {
    if (!this.context) return;
    
    const centerX = this.size / 2;
    const centerY = this.size / 2;
    const radius = this.size * 0.45;
    
    // Get player rotation
    const player = this.engine.systems.player?.localPlayer;
    const playerRotation = player ? -player.rotation.y : 0;
    
    // Draw cardinal direction indicators
    const directions = [
      { label: "N", angle: Math.PI * 0.5 + playerRotation },
      { label: "E", angle: 0 + playerRotation },
      { label: "S", angle: Math.PI * 1.5 + playerRotation },
      { label: "W", angle: Math.PI + playerRotation }
    ];
    
    this.context.font = '10px Arial';
    this.context.fillStyle = 'rgba(255, 255, 255, 0.7)';
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    
    directions.forEach(dir => {
      const x = centerX + Math.cos(dir.angle) * radius;
      const y = centerY + Math.sin(dir.angle) * radius;
      this.context.fillText(dir.label, x, y);
    });
  }
  
  /**
   * Update the minimap display
   */
  update(delta, elapsed) {
    if (!this.initialized) return;
    
    // Throttle updates to improve performance
    this.lastUpdate += delta;
    if (this.lastUpdate < this.updateInterval) return;
    this.lastUpdate = 0;
    
    // Clear the canvas
    this.clear();
    
    // Draw map elements in order
    this.drawTerrain();
    this.drawLandmarks();
    this.drawMana();
    this.drawPlayers();
    this.drawCompassRose();
  }
}
