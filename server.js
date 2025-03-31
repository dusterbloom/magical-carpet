import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app and HTTP server
const app = express();
const server = createServer(app);

// Create Socket.IO server with CORS enabled
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Route all requests to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Store connected players
const players = new Map();

// Handle socket connections
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);
  
  // Handle player ID request
  socket.on('request_id', () => {
    const playerId = uuidv4();
    
    // Get number of connected players to position them in a staggered formation
    const playerCount = players.size;
    
    // Create new player with staggered position
    const player = {
      id: playerId,
      name: `Player_${playerId.substring(0, 5)}`,
      x: playerCount * 8, // Space players horizontally
      y: 150, // Same altitude for all players
      z: playerCount * 8, // Stagger diagonally
      socketId: socket.id
    };
    
    // Store player data
    players.set(playerId, player);
    
    // Send player ID back to client
    socket.emit('player_id', { id: playerId });
    
    // Inform client about all existing players
    players.forEach((existingPlayer) => {
      if (existingPlayer.id !== playerId) {
        socket.emit('player_join', existingPlayer);
      }
    });
    
    // Broadcast new player to all other clients
    socket.broadcast.emit('player_join', player);
  });
  
  // Handle player updates
  socket.on('player_update', (data) => {
    const playerId = getPlayerIdBySocketId(socket.id);
    if (!playerId) return;
    
    // Update player data
    const player = players.get(playerId);
    if (player) {
      Object.assign(player, data);
      
      // Add player ID if not included
      data.id = playerId;
      
      // Broadcast update to all other clients
      socket.broadcast.emit('player_update', data);
    }
  });
  
  // Handle player actions
  socket.on('player_action', (data) => {
    const playerId = getPlayerIdBySocketId(socket.id);
    if (!playerId) return;
    
    // Add player ID if not included
    data.playerId = playerId;
    
    // Broadcast action to all other clients
    socket.broadcast.emit('player_action', data);
  });
  
  // Handle ping requests
  socket.on('ping', (callback) => {
    callback();
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    const playerId = getPlayerIdBySocketId(socket.id);
    if (playerId) {
      console.log(`Player disconnected: ${playerId}`);
      
      // Remove player from storage
      players.delete(playerId);
      
      // Broadcast player leave to all clients
      io.emit('player_leave', { id: playerId });
    }
  });
});

// Helper function to get player ID by socket ID
function getPlayerIdBySocketId(socketId) {
  for (const [id, player] of players.entries()) {
    if (player.socketId === socketId) {
      return id;
    }
  }
  return null;
}

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
