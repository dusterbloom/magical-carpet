import { io } from 'socket.io-client';
import { System } from '../core/v2/System';
import { EventEmitter } from '../../utils/EventEmitter';
import { IntroScreen } from '../ui/screens/IntroScreen';
import { PlayerList } from '../ui/components/PlayerList';

export class NetworkManager extends System {
  constructor(engine) {
    super(engine, 'network'); // Register with system ID 'network'
    
    // Initialize event emitter functionality
    this.eventEmitter = new EventEmitter();
    
    this.socket = null;
    this.players = new Map();
    this.localPlayerId = null;
    this.serverTimeDiff = 0;
    this.ping = 0;
    this.isConnected = false;
    
    // Create UI components
    this.introScreen = new IntroScreen(engine);
    this.playerList = new PlayerList(engine);
    
    // Set up development mode for local testing
    this.isDev = import.meta.env.DEV;
    this.useSimulation = this.isDev && import.meta.env.VITE_USE_NETWORK_SIMULATION === 'true';
  }
  
  async _initialize() {
    try {
      console.log("Initializing NetworkManager...");
      
      // Initialize and show intro screen
      await this.introScreen.initialize();
      this.introScreen.show();
      
      // Set up play button callback
      this.introScreen.onPlay(() => {
        this.connect();
      });
      
      // Set up server URL
      this.serverUrl = this.isDev 
        ? 'http://localhost:4000' 
        : (import.meta.env.VITE_SERVER_URL || window.location.origin);
      
      // Create socket but don't connect yet
      this.socket = io(this.serverUrl, {
        autoConnect: false,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000
      });
      
      // Set up socket event listeners
      this.setupEventListeners();
      
      // If in simulation mode, connect automatically after a short delay
      if (this.useSimulation) {
        console.log("Using network simulation mode");
        setTimeout(() => {
          this.simulateConnection();
        }, 500);
      }
      
      console.log("NetworkManager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize NetworkManager:", error);
      throw error;
    }
  }

  _update(deltaTime) {
    // If in simulation mode, simulate network updates for AI players
    if (this.useSimulation && Math.random() < 0.05) {
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

  // Event emitter methods
  on(event, callback) {
    this.eventEmitter.on(event, callback);
  }

  off(event, callback) {
    this.eventEmitter.off(event, callback);
  }

  emit(event, data) {
    this.eventEmitter.emit(event, data);
  }

  
  async initialize() {
    // Initialize and show intro screen
    this.introScreen.initialize();
    this.introScreen.show();
    
    // Set up play button callback
    this.introScreen.onPlay(() => {
      this.connect();
    });
    
    // Set up server URL
    this.serverUrl = this.isDev 
      ? 'http://localhost:4000' 
      : (import.meta.env.VITE_SERVER_URL || window.location.origin);
    
    // Create socket but don't connect yet
    this.socket = io(this.serverUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
    });
    
    // Set up socket event listeners
    this.setupEventListeners();
    
    // Update intro screen status
    // Don't show status message
    
    // If in simulation mode, connect automatically after a short delay
    if (this.useSimulation) {
      console.log("Using network simulation mode");
      setTimeout(() => {
        this.simulateConnection();
      }, 500);
    }
    
    console.log("Network manager initialized");
  }
  
  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.isConnected = true;
      this.introScreen.updateServerStatus('Connected to server', 'success');
      this.emit('connected');
      
      // Request player ID from server
      this.socket.emit('request_id');
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.isConnected = false;
      this.introScreen.updateServerStatus('Disconnected from server. Reconnecting...', 'error');
      this.emit('disconnected');
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.introScreen.updateServerStatus('Server connection error. Please try again.', 'error');
    });
    
    this.socket.on('player_id', (data) => {
      this.localPlayerId = data.id;
      console.log('Received player ID:', this.localPlayerId);
      this.emit('connected', { id: this.localPlayerId });
      
      // Hide intro screen after successful connection
      this.introScreen.hide();
      
      // Show player list
      this.playerList.show();
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
    
    // Handle server ping response
    this.socket.on('pong', (latency) => {
      this.ping = latency;
      this.playerList.updatePing(latency);
    });
    
    // Set up ping interval
    setInterval(() => {
      if (this.isConnected) {
        const start = Date.now();
        this.socket.emit('ping', () => {
          const latency = Date.now() - start;
          this.ping = latency;
          this.playerList.updatePing(latency);
        });
      }
    }, 5000);
  }
  
  connect() {
    if (this.useSimulation) {
      this.simulateConnection();
      return;
    }
    
    // Connect to real server
    this.introScreen.updateServerStatus('Connecting to server...', 'info');
    this.socket.connect();
  }
  
  simulateConnection() {
    console.log("Simulating network connection");
    this.introScreen.updateServerStatus('Connected to simulation server', 'success');
    
    setTimeout(() => {
      // Simulate receiving player ID
      this.localPlayerId = 'player_' + Math.floor(Math.random() * 10000);
      console.log('Simulated player ID:', this.localPlayerId);
      
      // Emit connected event
      this.isConnected = true;
      this.emit('connected', { id: this.localPlayerId });
      
      // Hide intro screen
      this.introScreen.hide();
      
      // Show player list
      this.playerList.show();
      
      // Add local player
      const localPlayer = {
        id: this.localPlayerId,
        name: 'Player',
        x: 0,
        y: 0,
        z: 0
      };
      this.handlePlayerJoin(localPlayer);
      
      // Simulate other players joining
      this.handlePlayerJoin({ id: 'player_ai_1', name: 'Magic Bot 1', x: 10, y: 5, z: 20 });
      this.handlePlayerJoin({ id: 'player_ai_2', name: 'Magic Bot 2', x: -15, y: 7, z: -5 });
      
      console.log("Network simulation initialized");
    }, 500);
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
  
  // Player event handlers
  handlePlayerJoin(data) {
    this.players.set(data.id, data);
    this.playerList.updatePlayerList(Array.from(this.players.values()), this.localPlayerId);
    this.emit('player_join', data);
  }
  
  handlePlayerLeave(data) {
    this.players.delete(data.id);
    this.playerList.updatePlayerList(Array.from(this.players.values()), this.localPlayerId);
    this.emit('player_leave', data);
  }
  
  handlePlayerUpdate(data) {
    if (this.players.has(data.id)) {
      const player = this.players.get(data.id);
      Object.assign(player, data);
      this.emit('player_update', player);
    }
  }
  
  handleGameState(data) {
    this.emit('game_state', data);
  }
  
  // Send player updates to server
  sendPlayerUpdate(data) {
    if (this.useSimulation) {
      // For simulation, handle locally
      if (this.localPlayerId) {
        data.id = this.localPlayerId;
        this.handlePlayerUpdate(data);
      }
      return;
    }
    
    // Send to real server
    if (this.isConnected) {
      this.socket.emit('player_update', data);
    }
  }
  
  // Send player actions to server
  sendPlayerAction(action, data) {
    if (this.useSimulation) {
      // For simulation, handle locally
      this.emit('player_action', { 
        playerId: this.localPlayerId,
        action, 
        ...data 
      });
      return;
    }
    
    // Send to real server
    if (this.isConnected) {
      this.socket.emit('player_action', { action, ...data });
    }
  }
  
  update(delta) {
    // If in simulation mode, simulate network updates for AI players
    if (this.useSimulation && Math.random() < 0.05) {
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
