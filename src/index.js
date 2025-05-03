const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
  },
});

let rooms = [];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('get-rooms', () => {
    socket.emit('rooms-list', rooms);
  });

  socket.on('create-room', ({ username }) => {
    const roomId = Math.random().toString(36).substr(2, 9);
    const room = {
      id: roomId,
      owner: username,
      public: true,
      players: [{ id: socket.id, name: username }],
      gameStarted: false,
    };
    rooms.push(room);
    socket.join(roomId);
    io.emit('rooms-list', rooms);
    socket.emit('room-created', { roomId });
    io.to(roomId).emit('room-info', { players: room.players.map(p => p.name), owner: room.owner });
  });

  socket.on('join-room', ({ roomId, username }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      if (room.gameStarted) {
        socket.emit('error', 'Game has already started');
        return;
      }
      room.players.push({ id: socket.id, name: username });
      socket.join(roomId);
      io.emit('rooms-list', rooms);
      socket.emit('room-joined', { roomId });
      io.to(roomId).emit('room-info', { players: room.players.map(p => p.name), owner: room.owner });
    } else {
      socket.emit('error', 'Room not found');
    }
  });

  socket.on('get-room-info', ({ roomId }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      io.to(roomId).emit('room-info', { players: room.players.map(p => p.name), owner: room.owner });
    }
  });

  socket.on('start-game', ({ roomId, username }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      if (room.owner !== username) {
        socket.emit('error', 'Only the owner can start the game');
        return;
      }
      room.gameStarted = true;
      io.to(roomId).emit('game-started');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    rooms.forEach((room) => {
      room.players = room.players.filter((p) => p.id !== socket.id);
      io.to(room.id).emit('room-info', { players: room.players.map(p => p.name), owner: room.owner });
    });
    rooms = rooms.filter((room) => room.players.length > 0);
    io.emit('rooms-list', rooms);
  });
});

server.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
