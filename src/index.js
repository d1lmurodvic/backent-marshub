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
      ownerSocketId: socket.id,
      public: true,
      players: [{ id: socket.id, name: username, score: 0 }],
      gameStarted: false,
      answers: [], // store answers per player
    };
    rooms.push(room);
    socket.join(roomId);
    io.emit('rooms-list', rooms);
    socket.emit('room-created', { roomId });

    io.to(roomId).emit('room-info', {
      players: room.players.map((p) => p.name),
      owner: room.owner,
    });
  });

  socket.on('join-room', ({ roomId, username }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      if (room.gameStarted) {
        socket.emit('error', 'Game has already started');
        return;
      }
      room.players.push({ id: socket.id, name: username, score: 0 });
      socket.join(roomId);
      io.to(roomId).emit('room-info', {
        players: room.players.map((p) => p.name),
        owner: room.owner,
      });
    } else {
      socket.emit('error', 'Room not found');
    }
  });
  

  socket.on('get-room-info', ({ roomId }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      socket.emit('room-info', {
        players: room.players.map((p) => p.name),
        owner: room.owner,
      });
    }
  });

  socket.on('start-game', ({ roomId }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      const isOwner = room.ownerSocketId === socket.id;
      if (!isOwner) {
        socket.emit('error', 'Only the room owner can start the game');
        return;
      }
      
      room.gameStarted = false;  // Set the game to not started initially
  
      // Countdown before starting the game (25 seconds)
      let countdown = 15;
  
      // Emit countdown every second
      const countdownInterval = setInterval(() => {
        io.to(roomId).emit('countdown', countdown);
        countdown -= 1;
  
        if (countdown < 0) {
          clearInterval(countdownInterval);  // Stop the countdown
          room.gameStarted = true;  // Start the game
          io.to(roomId).emit('game-started');
        }
      }, 1000);  // Emit every second
    }
  });
  
  socket.on('submit-answer', ({ roomId, playerId, answer }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      const player = room.players.find((p) => p.id === playerId);
      if (player) {
        const correctAnswer = "JSON.parse()"; // Replace with dynamic answer checking logic
        if (answer === correctAnswer) {
          player.score += 1;
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    rooms.forEach((room) => {
      const beforeCount = room.players.length;
      room.players = room.players.filter((p) => p.id !== socket.id);

      if (room.players.length !== beforeCount) {
        io.to(room.id).emit('room-info', {
          players: room.players.map((p) => p.name),
          owner: room.owner,
        });
      }
    });

    rooms = rooms.filter((room) => room.players.length > 0);
    io.emit('rooms-list', rooms);
  });
});

server.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
