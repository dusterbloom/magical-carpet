import { io } from 'socket.io-client';
import { EventEmitter } from '../../utils/EventEmitter';
import * as THREE from 'three';

export class NetworkManager extends EventEmitter {
  constructor(engine) {
    super();
    this.engine = engine;
    this.socket = null;
    this.players = new Map();
    this.localPlayerId = null;
    this.serverTimeDiff = 0;
    this.ping = 0;
    
    // Network optimization parameters
    this.updateFrequency = engine.isMobile ? 5 : 10; // Updates per second
    this.updateInterval = 1000 / this.updateFrequency; // ms between updates
    this.timeSinceLastUpdate = 0;
    this.connectionQuality = 'good'; // 'poor', 'good', 'excellent'
    
    // Adaptive network settings based on connection quality
    this.networkSettings = {
      poor: {
        updateFrequency: 3, // 3 updates per second
        interpolationAlpha: 0.1,
        batchingEnabled: true,
        deltaCompressionEnabled: true,
        compressionThreshold: 0.05, // Only send position if changed more than 5% of this value
      },
      good: {
        updateFrequency: 5, // 5 updates per second
        interpolationAlpha: 0.15,
        batchingEnabled: true,
        deltaCompressionEnabled: true,
        compressionThreshold: 0.03, // Only send position if changed more than 3% of this value
      },
      excellent: {
        updateFrequency: 10, // 10 updates per second (desktop)
        interpolationAlpha: 0.3,
        batchingEnabled: false,
        deltaCompressionEnabled: false,
        compressionThreshold: 0.01, // Only send position if changed more than 1% of this value
      }
    };
    
    // Message batching queue
    this.messageQueue = [];
    this.batchSize = 5; // Maximum number of messages to batch
    this.pendingHighPriorityUpdates = false;
    
    // Delta compression - store last sent values
    this.lastSentData = {};
  }
  
  async initialize() {
    // In a real implementation, this would connect to your actual server
    const serverUrl = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
    
    this.socket = io(serverUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
    });
    
    this.setupEventListeners();
    
    // Configure optimal network settings based on device capabilities
    this.configureNetworkSettings();
    
    // For now, we'll simulate connection success locally
    // In a real implementation, this would be triggered by the server
    setTimeout(() => {
      this.localPlayerId = 'player_' + Math.floor(Math.random() * 10000);
      this.emit('connected', { id: this.localPlayerId });
      
      // Simulate other players joining
      this.handlePlayerJoin({ id: 'player_ai_1', name: 'Magic Bot 1', x: 10, y: 5, z: 20 });
      this.handlePlayerJoin({ id: 'player_ai_2', name: 'Magic Bot 2', x: -15, y: 7, z: -5 });
      
      console.log("Network simulation initialized");
    }, 500);
  }
  
  configureNetworkSettings() {
    // Set connection quality based on device and network conditions
    if (this.engine.isMobile && navigator.connection) {
      // Use Network Information API if available
      const connection = navigator.connection;
      if (connection.downlink < 1 || connection.rtt > 200) {
        this.connectionQuality = 'poor';
      } else if (connection.downlink < 5 || connection.rtt > 100) {
        this.connectionQuality = 'good';
      } else {
        this.connectionQuality = 'excellent';
      }
    } else if (this.engine.isMobile) {
      // Default to 'good' for mobile without Network API
      this.connectionQuality = 'good';
    } else {
      // Default to 'excellent' for desktop
      this.connectionQuality = 'excellent';
    }
    
    // Apply settings based on determined quality
    const settings = this.networkSettings[this.connectionQuality];
    this.updateFrequency = settings.updateFrequency;
    this.updateInterval = 1000 / this.updateFrequency;
    
    console.log(`Network configured for ${this.connectionQuality} connection: ${this.updateFrequency} updates/sec`);
  }
  
  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.emit('connected');
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.emit('disconnected');
    });
    
    this.socket.on('player_join', (data) => {
      this.handlePlayerJoin(data);
    });
    
    this.socket.on('player_leave', (data) => {
      this.handlePlayerLeave(data);
    });
    
    this.socket.on('player_update', (data) => {
      this.handlePlayerUpdate(data);
    });
    
    this.socket.on('game_state', (data) => {
      this.handleGameState(data);
    });
    
    this.socket.on('batch_update', (batchedData) => {
      // Process batched updates from server
      batchedData.forEach(data => {
        if (data.type === 'player_update') {
          this.handlePlayerUpdate(data.payload);
        } else if (data.type === 'game_state') {
          this.handleGameState(data.payload);
        }
      });
    });
    
    this.socket.on('pong', (latency) => {
      this.ping = latency;
      this.updateConnectionQuality(latency);
    });
  }
  
  updateConnectionQuality(latency) {
    // Update connection quality based on ping
    let newQuality = this.connectionQuality;
    
    if (latency > 200) {
      newQuality = 'poor';
    } else if (latency > 100) {
      newQuality = 'good';
    } else {
      newQuality = 'excellent';
    }
    
    // If connection quality changed, reconfigure network settings
    if (newQuality !== this.connectionQuality) {
      this.connectionQuality = newQuality;
      this.configureNetworkSettings();
    }
  }
  
  connect() {
    // In a real implementation, this would connect to the actual server
    // this.socket.connect();
    
    // For now we'll just simulate connection locally
    // This was done in initialize for simplicity
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
  
  // Player event handlers
  handlePlayerJoin(data) {
    // Create a new player object with interpolation properties
    const playerData = {
      ...data,
      currentPosition: new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0),
      targetPosition: new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0),
      currentRotation: data.rotationY || 0,
      targetRotation: data.rotationY || 0,
      lastUpdateTime: performance.now()
    };
    
    this.players.set(data.id, playerData);
    this.emit('player_join', data);
  }
  
  handlePlayerLeave(data) {
    this.players.delete(data.id);
    this.emit('player_leave', data);
  }
  
  handlePlayerUpdate(data) {
    if (this.players.has(data.id)) {
      const player = this.players.get(data.id);
      
      // For position updates, set target values for interpolation
      if (data.x !== undefined && data.y !== undefined && data.z !== undefined) {
        player.targetPosition = new THREE.Vector3(data.x, data.y, data.z);
        player.lastUpdateTime = performance.now();
      }
      
      // For rotation updates, set target values for interpolation
      if (data.rotationY !== undefined) {
        player.targetRotation = data.rotationY;
      }
      
      // Update non-interpolated properties immediately
      if (data.mana !== undefined) player.mana = data.mana;
      if (data.health !== undefined) player.health = data.health;
      
      // Store the updated player
      this.players.set(data.id, player);
      
      // Emit event with current state (not target state)
      const currentData = {
        ...data,
        x: player.currentPosition.x,
        y: player.currentPosition.y,
        z: player.currentPosition.z,
        rotationY: player.currentRotation
      };
      
      this.emit('player_update', currentData);
    }
  }
  
  handleGameState(data) {
    this.emit('game_state', data);
  }
  
  // Queue message for batching (used for non-critical updates)
  queueMessage(type, data, priority = 'normal') {
    // If high priority, mark for immediate sending
    if (priority === 'high') {
      this.pendingHighPriorityUpdates = true;
    }
    
    this.messageQueue.push({
      type,
      payload: data,
      priority
    });
    
    // Send immediately if we have enough messages or high priority
    if (this.messageQueue.length >= this.batchSize || this.pendingHighPriorityUpdates) {
      this.sendQueuedMessages();
    }
  }
  
  // Send all queued messages as a batch
  sendQueuedMessages() {
    if (this.messageQueue.length === 0) return;
    
    // In real implementation, this would send to server
    // this.socket.emit('batch_update', this.messageQueue);
    
    // For simulation, process each message locally
    this.messageQueue.forEach(message => {
      if (message.type === 'player_update') {
        this.handlePlayerUpdate(message.payload);
      } else if (message.type === 'player_action') {
        this.emit('player_action', message.payload);
      }
    });
    
    // Clear the queue
    this.messageQueue = [];
    this.pendingHighPriorityUpdates = false;
  }
  
  // Apply delta compression to position data
  applyDeltaCompression(data) {
    if (!this.lastSentData[data.id]) {
      // First update, send everything
      this.lastSentData[data.id] = {...data};
      return data;
    }
    
    const last = this.lastSentData[data.id];
    const settings = this.networkSettings[this.connectionQuality];
    const compressionThreshold = settings.compressionThreshold;
    const result = {id: data.id};
    
    // Only include position components that changed significantly
    if (Math.abs(data.x - last.x) > compressionThreshold) {
      result.x = data.x;
    }
    
    if (Math.abs(data.y - last.y) > compressionThreshold) {
      result.y = data.y;
    }
    
    if (Math.abs(data.z - last.z) > compressionThreshold) {
      result.z = data.z;
    }
    
    // Only include rotation if it changed significantly
    if (data.rotationY !== undefined && 
        Math.abs(data.rotationY - last.rotationY) > 0.02) {
      result.rotationY = data.rotationY;
    }
    
    // Always include health and mana changes
    if (data.health !== undefined && data.health !== last.health) {
      result.health = data.health;
    }
    
    if (data.mana !== undefined && data.mana !== last.mana) {
      result.mana = data.mana;
    }
    
    // Update last sent data
    this.lastSentData[data.id] = {...data};
    
    // If nothing changed significantly, send a minimal update
    if (Object.keys(result).length <= 1) {
      return null; // No significant changes
    }
    
    return result;
  }
  
  // Send player updates to server
  sendPlayerUpdate(data) {
    // In a real implementation, this would send to the server
    // this.socket.emit('player_update', data);
    
    if (this.localPlayerId) {
      data.id = this.localPlayerId;
      
      // Apply delta compression if enabled
      const settings = this.networkSettings[this.connectionQuality];
      if (settings.deltaCompressionEnabled) {
        const compressedData = this.applyDeltaCompression(data);
        if (compressedData) {
          // If batch enabled, queue the update
          if (settings.batchingEnabled) {
            this.queueMessage('player_update', compressedData);
          } else {
            // Otherwise send immediately
            this.handlePlayerUpdate(compressedData);
          }
        }
      } else {
        // No compression, send full update
        if (settings.batchingEnabled) {
          this.queueMessage('player_update', data);
        } else {
          this.handlePlayerUpdate(data);
        }
      }
    }
  }
  
  // Send player actions to server (always high priority)
  sendPlayerAction(action, data) {
    // In a real implementation, this would send to the server
    // this.socket.emit('player_action', { action, ...data });
    
    // For now, we'll simulate locally
    const actionData = { 
      playerId: this.localPlayerId,
      action, 
      ...data 
    };
    
    // Actions are high priority and should be sent immediately
    this.queueMessage('player_action', actionData, 'high');
  }
  
  // Interpolate player movement for smooth transitions
  interpolatePositions(delta) {
    const now = performance.now();
    const settings = this.networkSettings[this.connectionQuality];
    
    this.players.forEach((player, id) => {
      if (id !== this.localPlayerId && player.targetPosition) {
        // Calculate interpolation factor based on connection quality
        const alpha = settings.interpolationAlpha;
        
        // Interpolate position
        player.currentPosition.lerp(player.targetPosition, alpha);
        
        // Interpolate rotation (with shortest path)
        player.currentRotation = THREE.MathUtils.lerp(
          player.currentRotation,
          player.targetRotation,
          alpha
        );
        
        // Update the player's actual data with interpolated values
        player.x = player.currentPosition.x;
        player.y = player.currentPosition.y;
        player.z = player.currentPosition.z;
        player.rotationY = player.currentRotation;
      }
    });
  }
  
  update(delta) {
    // Convert delta to milliseconds
    const deltaMs = delta * 1000;
    
    // Interpolate player positions for smooth movement
    this.interpolatePositions(delta);
    
    // Increment timer since last network update
    this.timeSinceLastUpdate += deltaMs;
    
    // Check if it's time to send a network update
    if (this.timeSinceLastUpdate >= this.updateInterval) {
      // Send any pending batched messages
      if (this.messageQueue.length > 0) {
        this.sendQueuedMessages();
      }
      
      // Reset timer
      this.timeSinceLastUpdate = 0;
    }
    
    // Simulate network updates for AI players (reduced frequency on mobile)
    const updateChance = this.engine.isMobile ? 0.02 : 0.05;
    if (Math.random() < updateChance) {
      this.players.forEach((player, id) => {
        if (id !== this.localPlayerId) {
          // Simple random movement for AI players
          const update = {
            id,
            x: player.x + (Math.random() - 0.5) * 0.5,
            y: player.y + (Math.random() - 0.5) * 0.1,
            z: player.z + (Math.random() - 0.5) * 0.5
          };
          this.handlePlayerUpdate(update);
        }
      });
    }
  }
  
  getPlayers() {
    return Array.from(this.players.values());
  }
  
  getLocalPlayerId() {
    return this.localPlayerId;
  }
}
