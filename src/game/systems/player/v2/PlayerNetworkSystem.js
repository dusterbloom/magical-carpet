import { System } from '../../../core/v2/System';

/**
 * Handles network synchronization for player entities
 */
export class PlayerNetworkSystem extends System {
  constructor(engine) {
    super(engine, 'playerNetwork');
    this.requireDependencies(['playerState', 'network']);
    
    // Network synchronization settings
    this.syncInterval = 0.1; // 10 times per second
    this.syncTimer = 0;
  }
  
  async _initialize() {
    // Register for network update events
    const network = this.engine.systems.network;
    
    // Listen for network events from other players
    network.on('player_update', (data) => {
      this.handleNetworkPlayerUpdate(data);
    });
    
    console.log("PlayerNetworkSystem initialized");
  }
  
  _update(delta) {
    // Update sync timer
    this.syncTimer += delta;
    
    // Sync player data at regular intervals
    if (this.syncTimer >= this.syncInterval) {
      this.syncTimer = 0;
      this.syncPlayerData();
    }
  }
  
  /**
   * Sync local player data to network
   */
  syncPlayerData() {
    const playerState = this.engine.systems.playerState;
    const network = this.engine.systems.network;
    
    if (!playerState || !playerState.localPlayer || !network) return;
    
    const player = playerState.localPlayer;
    
    // Send player update to network
    network.sendPlayerUpdate({
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      rotationY: player.rotation.y,
      mana: player.mana,
      health: player.health
    });
  }
  
  /**
   * Handle updates for network players
   */
  handleNetworkPlayerUpdate(data) {
    const playerState = this.engine.systems.playerState;
    if (!playerState) return;
    
    // Forward the update to the playerState system
    playerState.updateNetworkPlayer(data);
  }
}
