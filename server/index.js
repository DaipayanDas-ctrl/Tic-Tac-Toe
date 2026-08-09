const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Serve the built frontend (when it exists) in production
const distPath = path.join(__dirname, "..", "frontend", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("/*splat", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const ROOM_CODE_LENGTH = 6;
const BOARD_SIZE = 3;

const rooms = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from(
      { length: ROOM_CODE_LENGTH },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  } while (rooms.has(code));
  return code;
}

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(null)
  );
}

function sanitizeName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").slice(0, 20);
}

function resetPlayAgain(room) {
  room.playAgain = { X: false, O: false };
}

function getWinningLine(board) {
  const lines = [
    [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [0, 2],
      [1, 2],
      [2, 2],
    ],
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    [
      [0, 2],
      [1, 1],
      [2, 0],
    ],
  ];

  for (const line of lines) {
    const [r, c] = line[0];
    const symbol = board[r][c];
    if (
      symbol &&
      symbol === board[line[1][0]][line[1][1]] &&
      symbol === board[line[2][0]][line[2][1]]
    ) {
      return line;
    }
  }
  return null;
}

function isBoardFull(board) {
  return board.every((row) => row.every((cell) => cell !== null));
}

function broadcastRoomState(code) {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit("room:state", {
    code,
    board: room.board,
    currentTurn: room.currentTurn,
    players: room.players,
    winner: room.winner,
    winningLine: room.winningLine,
    isDraw: room.isDraw,
    status: room.status,
    playAgain: room.playAgain,
  });
}

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("room:create", ({ name } = {}) => {
    if (socket.data.roomCode) {
      socket.emit("error:message", { message: "You are already in a room." });
      return;
    }
    const playerName = sanitizeName(name);
    if (!playerName) {
      socket.emit("error:message", { message: "Please enter your name." });
      return;
    }
    const code = generateRoomCode();
    const room = {
      code,
      players: [],
      board: createEmptyBoard(),
      currentTurn: "X",
      winner: null,
      winningLine: null,
      isDraw: false,
      status: "waiting",
      playAgain: { X: false, O: false },
    };
    rooms.set(code, room);

    room.players.push({ id: socket.id, symbol: "X", name: playerName });
    socket.data.roomCode = code;
    socket.join(code);

    socket.emit("room:joined", {
      code,
      symbol: "X",
      board: room.board,
      currentTurn: room.currentTurn,
      players: room.players,
      winner: room.winner,
      winningLine: room.winningLine,
      isDraw: room.isDraw,
      status: room.status,
      playAgain: room.playAgain,
    });

    broadcastRoomState(code);
  });

  socket.on("room:join", ({ code, name } = {}) => {
    if (!code) {
      socket.emit("error:message", { message: "A room code is required." });
      return;
    }

    if (socket.data.roomCode) {
      socket.emit("error:message", { message: "You are already in a room." });
      return;
    }

    const playerName = sanitizeName(name);
    if (!playerName) {
      socket.emit("error:message", { message: "Please enter your name." });
      return;
    }

    const normalized = String(code).toUpperCase();
    const room = rooms.get(normalized);

    if (!room) {
      socket.emit("error:message", { message: "Room not found." });
      return;
    }

    if (room.players.length >= 2) {
      socket.emit("error:message", { message: "Room is already full." });
      return;
    }

    room.players.push({ id: socket.id, symbol: "O", name: playerName });
    socket.data.roomCode = normalized;
    socket.join(normalized);

    if (room.players.length === 2) {
      room.status = "playing";
      room.currentTurn = "X";
    }

    socket.emit("room:joined", {
      code: normalized,
      symbol: "O",
      board: room.board,
      currentTurn: room.currentTurn,
      players: room.players,
      winner: room.winner,
      winningLine: room.winningLine,
      isDraw: room.isDraw,
      status: room.status,
      playAgain: room.playAgain,
    });

    broadcastRoomState(normalized);
  });

  socket.on("game:move", ({ row, col } = {}) => {
    const code = socket.data.roomCode;
    if (!code) {
      socket.emit("error:message", { message: "You are not in a room." });
      return;
    }

    const room = rooms.get(code);
    if (!room) return;

    if (room.status !== "playing") {
      socket.emit("error:message", { message: "The game is not active." });
      return;
    }

    if (room.winner || room.isDraw) {
      socket.emit("error:message", { message: "The game has already ended." });
      return;
    }

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      socket.emit("error:message", { message: "You are not part of this game." });
      return;
    }

    if (player.symbol !== room.currentTurn) {
      socket.emit("error:message", { message: "It is not your turn." });
      return;
    }

    if (
      typeof row !== "number" ||
      typeof col !== "number" ||
      row < 0 ||
      row >= BOARD_SIZE ||
      col < 0 ||
      col >= BOARD_SIZE
    ) {
      socket.emit("error:message", { message: "Invalid move position." });
      return;
    }

    if (room.board[row][col] !== null) {
      socket.emit("error:message", { message: "That cell is already occupied." });
      return;
    }

    room.board[row][col] = player.symbol;

    const winningLine = getWinningLine(room.board);
    if (winningLine) {
      room.winner = room.board[winningLine[0][0]][winningLine[0][1]];
      room.winningLine = winningLine;
      room.status = "finished";
    } else if (isBoardFull(room.board)) {
      room.isDraw = true;
      room.status = "finished";
    } else {
      room.currentTurn = player.symbol === "X" ? "O" : "X";
    }

    broadcastRoomState(code);
  });

  socket.on("game:restart", () => {
    const code = socket.data.roomCode;
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      socket.emit("error:message", { message: "You are not part of this game." });
      return;
    }

    room.board = createEmptyBoard();
    room.currentTurn = "X";
    room.winner = null;
    room.winningLine = null;
    room.isDraw = false;
    room.status = "playing";
    resetPlayAgain(room);

    broadcastRoomState(code);
  });

  socket.on("game:rematch", ({ yes } = {}) => {
    const code = socket.data.roomCode;
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    if (room.status !== "finished") return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      socket.emit("error:message", { message: "You are not part of this game." });
      return;
    }

    if (!yes) {
      // Player declined a rematch: end the game for everyone and return to lobby.
      io.to(code).emit("game:end", { declinedBy: player.symbol });
      rooms.delete(code);
      room.players.forEach((p) => {
        const s = io.sockets.sockets.get(p.id);
        if (s) {
          s.data.roomCode = null;
          s.leave(code);
        }
      });
      return;
    }

    room.playAgain[player.symbol] = true;

    const bothYes = room.players.every((p) => room.playAgain[p.symbol]);
    if (bothYes) {
      room.board = createEmptyBoard();
      room.currentTurn = "X";
      room.winner = null;
      room.winningLine = null;
      room.isDraw = false;
      room.status = "playing";
      resetPlayAgain(room);
    }

    broadcastRoomState(code);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    const index = room.players.findIndex((p) => p.id === socket.id);
    if (index !== -1) {
      const [left] = room.players.splice(index, 1);
      io.to(code).emit("player:left", { symbol: left.symbol });
    }

    if (room.players.length === 0) {
      rooms.delete(code);
      console.log(`Room ${code} deleted (empty).`);
      return;
    }

    room.status = "waiting";
    room.board = createEmptyBoard();
    room.winner = null;
    room.winningLine = null;
    room.isDraw = false;
    room.currentTurn = "X";
    resetPlayAgain(room);
    room.players.forEach((p) => {
      p.symbol = "X";
    });

    broadcastRoomState(code);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
