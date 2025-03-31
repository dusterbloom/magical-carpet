/**
 * PlayerList.js
 * Shows a list of connected players in multiplayer mode
 */
export class PlayerList {
  constructor(engine) {
    this.engine = engine;
    this.container = document.createElement('div');
    this.visible = false;
    this.initialized = false;
    this.playerElements = new Map();
  }
  
  /**
   * Initialize the player list
   */
  initialize() {
    // Create container
    this.container.id = 'player-list';
    this.container.style.position = 'absolute';
    this.container.style.top = '20px';
    this.container.style.left = '20px';
    this.container.style.backgroundColor = 'rgba(0, 0, 30, 0.7)';
    this.container.style.borderRadius = '10px';
    this.container.style.padding = '10px';
    this.container.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.3)';
    this.container.style.color = 'white';
    this.container.style.fontFamily = 'Arial, sans-serif';
    this.container.style.zIndex = '100';
    this.container.style.maxHeight = '300px';
    this.container.style.overflowY = 'auto';
    this.container.style.minWidth = '200px';
    
    // Create header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '10px';
    header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
    header.style.paddingBottom = '5px';
    
    const title = document.createElement('div');
    title.textContent = 'Players';
    title.style.fontWeight = 'bold';
    
    const pingIndicator = document.createElement('div');
    pingIndicator.textContent = 'Ping: --';
    pingIndicator.style.fontSize = '12px';
    pingIndicator.style.opacity = '0.7';
    this.pingIndicator = pingIndicator;
    
    header.appendChild(title);
    header.appendChild(pingIndicator);
    
    // Create player list container
    const listContainer = document.createElement('div');
    listContainer.style.display = 'flex';
    listContainer.style.flexDirection = 'column';
    listContainer.style.gap = '5px';
    this.listContainer = listContainer;
    
    // Append all elements
    this.container.appendChild(header);
    this.container.appendChild(listContainer);
    
    // Add to UI container
    document.getElementById('ui-container').appendChild(this.container);
    
    // Hide by default
    this.hide();
    this.initialized = true;
  }
  
  /**
   * Show the player list
   */
  show() {
    if (!this.initialized) {
      this.initialize();
    }
    
    this.container.style.display = 'block';
    this.visible = true;
  }
  
  /**
   * Hide the player list
   */
  hide() {
    if (!this.initialized) return;
    
    this.container.style.display = 'none';
    this.visible = false;
  }
  
  /**
   * Toggle visibility of the player list
   */
  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  /**
   * Update the player list with current players
   * @param {Array} players - Array of player objects
   * @param {string} localPlayerId - ID of the local player
   */
  updatePlayerList(players, localPlayerId) {
    if (!this.initialized) {
      this.initialize();
    }
    
    // Track existing player IDs
    const currentPlayerIds = new Set();
    
    // Update or add players
    players.forEach(player => {
      currentPlayerIds.add(player.id);
      
      // Check if player element already exists
      if (this.playerElements.has(player.id)) {
        // Update existing player
        this.updatePlayer(player, player.id === localPlayerId);
      } else {
        // Add new player
        this.addPlayer(player, player.id === localPlayerId);
      }
    });
    
    // Remove players that are no longer in the list
    this.playerElements.forEach((element, id) => {
      if (!currentPlayerIds.has(id)) {
        this.removePlayer(id);
      }
    });
  }
  
  /**
   * Add a new player to the list
   * @param {Object} player - Player object
   * @param {boolean} isLocal - Whether this is the local player
   */
  addPlayer(player, isLocal) {
    // Create player element
    const playerElement = document.createElement('div');
    playerElement.style.display = 'flex';
    playerElement.style.alignItems = 'center';
    playerElement.style.padding = '5px';
    playerElement.style.borderRadius = '5px';
    playerElement.style.backgroundColor = isLocal ? 'rgba(224, 170, 255, 0.2)' : 'transparent';
    
    // Create player avatar
    const avatar = document.createElement('div');
    avatar.style.width = '24px';
    avatar.style.height = '24px';
    avatar.style.borderRadius = '50%';
    avatar.style.backgroundColor = this.getPlayerColor(player.id);
    avatar.style.marginRight = '10px';
    avatar.style.display = 'flex';
    avatar.style.justifyContent = 'center';
    avatar.style.alignItems = 'center';
    avatar.style.color = 'white';
    avatar.style.fontSize = '12px';
    avatar.style.fontWeight = 'bold';
    avatar.textContent = player.name ? player.name.charAt(0).toUpperCase() : '?';
    
    // Create player name
    const name = document.createElement('div');
    name.textContent = player.name || 'Unknown Player';
    if (isLocal) {
      name.textContent += ' (You)';
      name.style.fontWeight = 'bold';
    }
    
    // Append to player element
    playerElement.appendChild(avatar);
    playerElement.appendChild(name);
    
    // Store reference to player element
    this.playerElements.set(player.id, {
      element: playerElement,
      avatar: avatar
    });
    
    // Add to list container
    this.listContainer.appendChild(playerElement);
  }
  
  /**
   * Update an existing player in the list
   * @param {Object} player - Player object
   * @param {boolean} isLocal - Whether this is the local player
   */
  updatePlayer(player, isLocal) {
    const playerData = this.playerElements.get(player.id);
    if (!playerData) return;
    
    // No updates needed for now, but could update player status here
  }
  
  /**
   * Remove a player from the list
   * @param {string} playerId - ID of player to remove
   */
  removePlayer(playerId) {
    const playerData = this.playerElements.get(playerId);
    if (!playerData) return;
    
    // Remove from DOM
    this.listContainer.removeChild(playerData.element);
    
    // Remove from map
    this.playerElements.delete(playerId);
  }
  
  /**
   * Update ping display
   * @param {number} ping - Current ping in milliseconds
   */
  updatePing(ping) {
    if (!this.initialized) return;
    
    // Update ping text
    this.pingIndicator.textContent = `Ping: ${ping}ms`;
    
    // Change color based on ping
    if (ping < 100) {
      this.pingIndicator.style.color = '#72e176'; // Green for good ping
    } else if (ping < 200) {
      this.pingIndicator.style.color = '#e0aaff'; // Purple for okay ping
    } else {
      this.pingIndicator.style.color = '#ff6b6b'; // Red for bad ping
    }
  }
  
  /**
   * Generate a consistent color based on player ID
   * @param {string} playerId - Player ID
   * @returns {string} - CSS color string
   */
  getPlayerColor(playerId) {
    // Simple hash function to generate a number from the player ID
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Create a color from the hash
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 60%)`;
  }
}
