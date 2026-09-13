const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const CATEGORIES = require('./categories');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ==========================================
// MONGODB CONFIGURATION & PROFILE STORAGE
// ==========================================
// Provide your MongoDB connection URI below or in environment variables:
// e.g. mongodb+srv://<username>:<password>@cluster0.mongodb.net/guesswho?retryWrites=true&w=majority
const MONGODB_URI = process.env.MONGODB_URI || null;

// In-memory profile storage (ready to seamlessly persist to MongoDB once URI is provided)
const storedProfiles = [];

app.get('/', (req, res) => {
  res.send({
    status: 'ok',
    game: 'Guess Who? Server',
    activeRooms: Object.keys(rooms).length,
    mongoConfigured: !!MONGODB_URI,
    registeredProfiles: storedProfiles.length,
  });
});

app.post('/api/profile', (req, res) => {
  const { name, birthDate, age, avatarCharacterId, avatarUrl, coins, xp, level, wins, losses } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Detective Name is required' });
  }

  // Update existing profile if found by name, else create new
  let profileRecord = storedProfiles.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (profileRecord) {
    profileRecord.birthDate = birthDate || profileRecord.birthDate;
    profileRecord.age = age !== undefined ? Number(age) : profileRecord.age;
    profileRecord.avatarCharacterId = avatarCharacterId || profileRecord.avatarCharacterId;
    profileRecord.avatarUrl = avatarUrl || profileRecord.avatarUrl;
    profileRecord.coins = coins !== undefined ? Number(coins) : profileRecord.coins;
    profileRecord.xp = xp !== undefined ? Number(xp) : profileRecord.xp;
    profileRecord.level = level !== undefined ? Number(level) : profileRecord.level;
    profileRecord.wins = wins !== undefined ? Number(wins) : profileRecord.wins;
    profileRecord.losses = losses !== undefined ? Number(losses) : profileRecord.losses;
    profileRecord.updatedAt = new Date().toISOString();
  } else {
    profileRecord = {
      id: `USER_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      birthDate: birthDate || null,
      age: Number(age) || null,
      avatarCharacterId: avatarCharacterId || 1,
      avatarUrl: avatarUrl || null,
      coins: coins !== undefined ? Number(coins) : 1000,
      xp: xp !== undefined ? Number(xp) : 0,
      level: level !== undefined ? Number(level) : 1,
      wins: wins !== undefined ? Number(wins) : 0,
      losses: losses !== undefined ? Number(losses) : 0,
      createdAt: new Date().toISOString(),
      mongoSynced: !!MONGODB_URI,
    };
    storedProfiles.push(profileRecord);
  }

  console.log(`[Detective Profile Saved]: "${name}", Level: ${profileRecord.level}, Coins: ${profileRecord.coins}`);
  res.json({ success: true, profile: profileRecord, mongoConfigured: !!MONGODB_URI });
});

app.get('/api/profiles', (req, res) => {
  res.json({ count: storedProfiles.length, profiles: storedProfiles, mongoConfigured: !!MONGODB_URI });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Active game rooms
const rooms = {};

// Single matchmaking queue for Guess Who (characters)
const matchmakingQueue = [];

const removeFromQueue = (socketId) => {
  const index = matchmakingQueue.findIndex(p => p.socketId === socketId);
  if (index !== -1) {
    matchmakingQueue.splice(index, 1);
  }
};

io.on('connection', (socket) => {
  console.log('User connected to Guess Who:', socket.id);

  // 1. RANDOM MATCHMAKING (1v1)
  socket.on('find_match', ({ playerName, playerAvatar }, callback) => {
    removeFromQueue(socket.id);

    if (matchmakingQueue.length > 0) {
      // Opponent found! Match them together
      const opponent = matchmakingQueue.shift();
      const roomId = `GW_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Join both players to the Socket.io room
      socket.join(roomId);
      const opponentSocket = io.sockets.sockets.get(opponent.socketId);
      if (opponentSocket) {
        opponentSocket.join(roomId);
      }

      rooms[roomId] = {
        id: roomId,
        category: 'characters',
        isMatchmaking: true,
        players: [
          {
            socketId: opponent.socketId,
            name: opponent.playerName || 'Player 1',
            avatar: opponent.playerAvatar || null,
            secretCharacter: null,
          },
          {
            socketId: socket.id,
            name: playerName || 'Player 2',
            avatar: playerAvatar || null,
            secretCharacter: null,
          },
        ],
        status: 'selecting',
        currentTurnIndex: 0,
      };

      console.log(`Matched players in room ${roomId}: ${opponent.playerName} vs ${playerName}`);
      io.to(roomId).emit('game_started', rooms[roomId]);
      if (callback) callback({ status: 'matched', room: rooms[roomId] });
    } else {
      // Put player in matchmaking queue
      matchmakingQueue.push({
        socketId: socket.id,
        playerName: playerName || 'Player',
        playerAvatar: playerAvatar || null,
      });
      if (callback) callback({ status: 'searching' });
    }
  });

  socket.on('cancel_matchmaking', () => {
    removeFromQueue(socket.id);
  });

  // 2. CUSTOM ROOMS
  socket.on('create_room', ({ roomId, playerName }, callback) => {
    const code = roomId ? roomId.trim().toUpperCase() : `ROOM_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    if (rooms[code]) {
      if (callback) callback({ error: 'Room code already in use! Try another code.' });
      return;
    }

    socket.join(code);
    rooms[code] = {
      id: code,
      category: 'characters',
      isMatchmaking: false,
      players: [{ socketId: socket.id, name: playerName || 'Player 1', secretCharacter: null }],
      status: 'waiting',
      currentTurnIndex: 0,
    };

    console.log(`Created custom room ${code} by ${playerName}`);
    if (callback) callback({ success: true, room: rooms[code] });
  });

  socket.on('join_room', ({ roomId, playerName }, callback) => {
    const code = (roomId || '').trim().toUpperCase();
    const room = rooms[code];
    if (!room) {
      if (callback) callback({ error: 'Room code not found! Check your code.' });
      return;
    }

    if (room.players.length >= 2) {
      if (callback) callback({ error: 'Room is already full with 2 players!' });
      return;
    }

    socket.join(code);
    room.players.push({ socketId: socket.id, name: playerName || 'Player 2', secretCharacter: null });
    room.status = 'selecting';

    console.log(`Player ${playerName} joined room ${code}`);
    io.to(code).emit('game_started', room);
    if (callback) callback({ success: true, room });
  });

  // 3. GAMEPLAY
  socket.on('select_character', ({ roomId, characterId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const categoryData = CATEGORIES.characters;
    const player = room.players.find(p => p.socketId === socket.id);
    if (player) {
      player.secretCharacter = categoryData.items.find(c => c.id === characterId);
      socket.emit('character_confirmed', player.secretCharacter);
    }

    const allSelected = room.players.length === 2 && room.players.every(p => p.secretCharacter !== null);
    if (allSelected) {
      room.status = 'playing';
      room.currentTurnIndex = 0;
      io.to(roomId).emit('start_guessing_phase', {
        category: 'characters',
        currentTurn: room.players[room.currentTurnIndex].socketId,
        currentTurnName: room.players[room.currentTurnIndex].name,
      });
    } else {
      socket.to(roomId).emit('opponent_character_selected');
    }
  });

  socket.on('ask_question', ({ roomId, question }) => {
    socket.to(roomId).emit('receive_question', { question, from: socket.id });
  });

  socket.on('send_chat', ({ roomId, message, senderName }) => {
    socket.to(roomId).emit('receive_chat', {
      message,
      senderName: senderName || 'Opponent',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('answer_question', ({ roomId, answer }) => {
    socket.to(roomId).emit('receive_answer', { answer, from: socket.id });
  });

  socket.on('pass_turn', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.players.length < 2) return;

    const me = room.players.find(p => p.socketId === socket.id);
    const passerName = me ? me.name : 'Player';

    room.currentTurnIndex = (room.currentTurnIndex + 1) % 2;
    const nextPlayer = room.players[room.currentTurnIndex];

    io.to(roomId).emit('player_passed_turn', {
      passerId: socket.id,
      passerName,
      nextTurn: nextPlayer.socketId,
      nextTurnName: nextPlayer.name,
    });
    io.to(roomId).emit('turn_changed', {
      currentTurn: nextPlayer.socketId,
      currentTurnName: nextPlayer.name,
    });
  });

  socket.on('make_guess', ({ roomId, characterId }) => {
    const room = rooms[roomId];
    if (!room || room.players.length < 2) return;

    const me = room.players.find(p => p.socketId === socket.id);
    const opponent = room.players.find(p => p.socketId !== socket.id);
    const categoryData = CATEGORIES.characters;
    const guessedChar = categoryData.items.find(c => c.id === characterId);

    if (opponent && opponent.secretCharacter && opponent.secretCharacter.id === characterId) {
      // Guesser was correct -> Guesser wins!
      io.to(roomId).emit('game_over', {
        winnerId: socket.id,
        winnerName: me.name,
        winningCharacter: opponent.secretCharacter,
        opponentCharacter: me.secretCharacter,
        reason: 'correct_guess',
      });
    } else {
      // Guesser was wrong -> Direct Loss! Opponent wins immediately!
      io.to(roomId).emit('game_over', {
        winnerId: opponent ? opponent.socketId : null,
        winnerName: opponent ? opponent.name : 'Opponent',
        winningCharacter: opponent ? opponent.secretCharacter : null,
        opponentCharacter: me ? me.secretCharacter : null,
        guesserId: socket.id,
        guesserName: me ? me.name : 'Player',
        guessedCharacter: guessedChar,
        reason: 'wrong_guess',
      });
    }
  });

  socket.on('restart_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.players.forEach(p => p.secretCharacter = null);
    room.status = 'selecting';
    room.currentTurnIndex = 0;
    io.to(roomId).emit('game_restarted', room);
  });

  // ==========================================
  // REAL-TIME WEBRTC VOICE CHAT SIGNALING
  // ==========================================
  socket.on('voice_join', ({ roomId }) => {
    if (roomId) socket.join(roomId);
    socket.to(roomId).emit('voice_peer_joined', { peerId: socket.id });
  });

  socket.on('voice_offer', ({ roomId, sdp }) => {
    socket.to(roomId).emit('voice_offer', { senderId: socket.id, sdp });
  });

  socket.on('voice_answer', ({ roomId, sdp }) => {
    socket.to(roomId).emit('voice_answer', { senderId: socket.id, sdp });
  });

  socket.on('voice_ice_candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('voice_ice_candidate', { senderId: socket.id, candidate });
  });

  socket.on('voice_speaking_state', ({ roomId, isSpeaking }) => {
    if (roomId) socket.join(roomId);
    socket.to(roomId).emit('voice_speaking_state', { peerId: socket.id, isSpeaking });
  });

  socket.on('voice_audio_stream', ({ roomId, audioBase64, senderName }) => {
    if (roomId) socket.join(roomId);
    console.log(`[Voice Audio Relay] Relaying audio from ${socket.id} (${senderName || 'Player'}) to room ${roomId}, payload size: ${audioBase64 ? audioBase64.length : 0}`);
    socket.to(roomId).emit('voice_audio_stream', {
      senderId: socket.id,
      senderName: senderName || 'Opponent',
      audioBase64,
    });
  });

  socket.on('voice_leave', ({ roomId }) => {
    socket.to(roomId).emit('voice_peer_left', { peerId: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    removeFromQueue(socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        io.to(roomId).emit('voice_peer_left', { peerId: socket.id });
        io.to(roomId).emit('opponent_disconnected');
        if (room.players.length === 0) {
          delete rooms[roomId];
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Guess Who Server listening on port ${PORT}`);
});
