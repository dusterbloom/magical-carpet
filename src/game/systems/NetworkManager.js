import { io } from 'socket.io-client';
import { EventEmitter } from '../../utils/EventEmitter';

export class NetworkManager extends EventEmitter {
  constructor(engine) {
    super();
    this.engine = engine;
    this.socket = null;
    this.players = new Map();
    this.localPlayerId = null;
    this.serverTimeDiff = 0;
    this.ping = 0;
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
    
    this.socket.on('pong', (latency) => {
      this.ping = latency;
    });
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
    this.players.set(data.id, data);
    this.emit('player_join', data);
  }
  
  handlePlayerLeave(data) {
    this.players.delete(data.id);
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
    // In a real implementation, this would send to the server
    // this.socket.emit('player_update', data);
    
    // For now, we'll simulate local update
    if (this.localPlayerId) {
      data.id = this.localPlayerId;
      this.handlePlayerUpdate(data);
    }
  }
  
  // Send player actions to server
  sendPlayerAction(action, data) {
    // In a real implementation, this would send to the server
    // this.socket.emit('player_action', { action, ...data });
    
    // For now, we'll simulate locally
    this.emit('player_action', { 
      playerId: this.localPlayerId,
      action, 
      ...data 
    });
  }
  
  update(delta) {
    // Simulate network updates for AI players
    if (Math.random() < 0.05) {
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
