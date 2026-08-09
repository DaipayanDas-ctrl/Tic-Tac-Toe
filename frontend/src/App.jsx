import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_JOINED: 'room:joined',
  ROOM_STATE: 'room:state',
  GAME_MOVE: 'game:move',
  GAME_RESTART: 'game:restart',
  GAME_REMATCH: 'game:rematch',
  PLAYER_LEFT: 'player:left',
  ERROR_MESSAGE: 'error:message',
  GAME_END: 'game:end',
};

const CONFETTI_COLORS = ['#ff6f61', '#4cd1c0', '#ffd54f', '#7c5cff', '#ff8a65', '#64b5f6'];

function winLineGeometry(line) {
  const [[r0, c0]] = line;
  const center = (i) => ((i + 0.5) / 3) * 100;
  const inset = 8;

  const sameRow = line.every(([r]) => r === r0);
  const sameCol = line.every(([, c]) => c === c0);

  if (sameRow) {
    const y = center(r0);
    return { x1: inset, y1: y, x2: 100 - inset, y2: y };
  }
  if (sameCol) {
    const x = center(c0);
    return { x1: x, y1: inset, x2: x, y2: 100 - inset };
  }
  if (r0 + c0 === 2) {
    return { x1: 100 - inset, y1: inset, x2: inset, y2: 100 - inset };
  }
  return { x1: inset, y1: inset, x2: 100 - inset, y2: 100 - inset };
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.8 + Math.random() * 1.6,
        size: 6 + Math.random() * 7,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        drift: Math.random() * 60 - 30,
        rotate: Math.random() * 360,
      })),
    []
  );

  return (
    <div className="confetti-container" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            '--left': `${p.left}%`,
            '--delay': `${p.delay}s`,
            '--duration': `${p.duration}s`,
            '--size': `${p.size}px`,
            '--color': p.color,
            '--drift': `${p.drift}px`,
            '--rotate': `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}

function GameScreen({ socket, room, playerSymbol, onRestart, onRematch }) {
  const [board, setBoard] = useState(room.board);
  const [currentTurn, setCurrentTurn] = useState(room.currentTurn);
  const [winner, setWinner] = useState(room.winner);
  const [isDraw, setIsDraw] = useState(room.isDraw);
  const [status, setStatus] = useState(room.status);
  const [players, setPlayers] = useState(room.players);
  const [winningLine, setWinningLine] = useState(room.winningLine);
  const [playAgain, setPlayAgain] = useState(room.playAgain || { X: false, O: false });
  const [opponentLeft, setOpponentLeft] = useState(false);

  useEffect(() => {
    const onState = (state) => {
      setBoard(state.board);
      setCurrentTurn(state.currentTurn);
      setWinner(state.winner);
      setIsDraw(state.isDraw);
      setStatus(state.status);
      setPlayers(state.players);
      setWinningLine(state.winningLine);
      setPlayAgain(state.playAgain || { X: false, O: false });
      setOpponentLeft(false);
    };

    const onPlayerLeft = () => {
      setOpponentLeft(true);
    };

    socket.on(SOCKET_EVENTS.ROOM_STATE, onState);
    socket.on(SOCKET_EVENTS.PLAYER_LEFT, onPlayerLeft);

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_STATE, onState);
      socket.off(SOCKET_EVENTS.PLAYER_LEFT, onPlayerLeft);
    };
  }, [socket]);

  const handleCellClick = (row, col) => {
    if (status !== 'playing') return;
    if (winner || isDraw) return;
    if (board[row][col] !== null) return;
    if (currentTurn !== playerSymbol) return;
    socket.emit(SOCKET_EVENTS.GAME_MOVE, { row, col });
  };

  const myPlayer = players.find((p) => p.symbol === playerSymbol);
  const opponent = players.find((p) => p.symbol !== playerSymbol);
  const myRematchVote = Boolean(playAgain[playerSymbol]);
  const opponentRematchVote = Boolean(opponent && playAgain[opponent.symbol]);

  let statusMessage = '';
  if (opponentLeft) {
    statusMessage = 'Your opponent left the game. Waiting for a new player...';
  } else if (winner) {
    const winnerName = myPlayer && winner === playerSymbol ? myPlayer.name : opponent?.name;
    statusMessage =
      winner === playerSymbol
        ? 'You win!'
        : `${winnerName || 'Opponent'} wins!`;
  } else if (isDraw) {
    statusMessage = "It's a draw!";
  } else if (status === 'waiting') {
    statusMessage = 'Waiting for an opponent to join...';
  } else if (currentTurn === playerSymbol) {
    statusMessage = 'Your turn';
  } else {
    statusMessage = "Opponent's turn";
  }

  const gameOver = Boolean(winner) || isDraw;

  return (
    <div className="game-screen">
      <div className="game-header">
        <div className="room-code">
          <span className="label">Room Code</span>
          <span className="value">{room.code}</span>
        </div>
        <div className="players">
          <div className={`player-card ${myPlayer && myPlayer.symbol === 'X' ? 'active' : ''}`}>
            <span className={`symbol x-symbol`}>X</span>
            <span className="name">
              {players.find((p) => p.symbol === 'X')?.name || 'Waiting...'}
            </span>
          </div>
          <span className="vs">VS</span>
          <div className={`player-card ${myPlayer && myPlayer.symbol === 'O' ? 'active' : ''}`}>
            <span className={`symbol o-symbol`}>O</span>
            <span className="name">
              {players.find((p) => p.symbol === 'O')?.name || 'Waiting...'}
            </span>
          </div>
        </div>
      </div>

      <div className="status-bar">
        <span className={`status-message ${winner ? 'win' : ''}`}>
          {statusMessage}
        </span>
      </div>

      <div className="board-wrap">
        <div className="board">
          {board.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                className={`cell ${cell ? cell.toLowerCase() + '-cell' : ''}`}
                onClick={() => handleCellClick(r, c)}
                disabled={status !== 'playing' || cell !== null || Boolean(winner) || isDraw}
              >
                {cell}
              </button>
            ))
          )}
        </div>
        {winningLine && (
          <svg className="win-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line
              x1={winLineGeometry(winningLine).x1}
              y1={winLineGeometry(winningLine).y1}
              x2={winLineGeometry(winningLine).x2}
              y2={winLineGeometry(winningLine).y2}
            />
          </svg>
        )}
        {winner === playerSymbol && <Confetti />}
      </div>

      {gameOver && (
        <div className="rematch-panel">
          {myRematchVote ? (
            <p className="rematch-note">
              {opponentRematchVote
                ? 'Starting new game...'
                : `Waiting for ${opponent?.name || 'opponent'} to play again...`}
            </p>
          ) : (
            <>
              <p className="rematch-question">Play again?</p>
              <div className="rematch-buttons">
                <button className="rematch-btn yes" onClick={() => onRematch(true)}>
                  Yes
                </button>
                <button className="rematch-btn no" onClick={() => onRematch(false)}>
                  No
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {opponentLeft && !gameOver && (
        <button className="restart-btn" onClick={() => onRestart()}>
          Play Again
        </button>
      )}
    </div>
  );
}

function Lobby({ socket, onJoined }) {
  const [name, setName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const onError = ({ message }) => {
      setError(message);
      setJoining(false);
    };
    const handleJoinedEvent = (data) => {
      setError('');
      setJoining(false);
      onJoined(data);
    };

    socket.on(SOCKET_EVENTS.ERROR_MESSAGE, onError);
    socket.on(SOCKET_EVENTS.ROOM_JOINED, handleJoinedEvent);

    return () => {
      socket.off(SOCKET_EVENTS.ERROR_MESSAGE, onError);
      socket.off(SOCKET_EVENTS.ROOM_JOINED, handleJoinedEvent);
    };
  }, [socket, onJoined]);

  const createRoom = () => {
    const playerName = name.trim();
    if (!playerName) {
      setError('Please enter your name.');
      return;
    }
    setError('');
    setJoining(true);
    socket.emit(SOCKET_EVENTS.ROOM_CREATE, { name: playerName });
  };

  const joinRoom = () => {
    const playerName = name.trim();
    if (!playerName) {
      setError('Please enter your name.');
      return;
    }
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) {
      setError('Please enter a room code.');
      return;
    }
    setError('');
    setJoining(true);
    socket.emit(SOCKET_EVENTS.ROOM_JOIN, { code, name: playerName });
  };

  return (
    <div className="lobby">
      <h1 className="title">
        <span className="x-symbol title-symbol">X</span> Tic Tac Toe{' '}
        <span className="o-symbol title-symbol">O</span>
      </h1>
      <p className="subtitle">Play online against a friend in real time.</p>

      <div className="name-form">
        <input
          type="text"
          maxLength={20}
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') createRoom();
          }}
        />
      </div>

      <button className="primary-btn" onClick={createRoom} disabled={joining}>
        {joining ? 'Creating...' : 'Create New Room'}
      </button>

      <div className="divider">
        <span>or</span>
      </div>

      <div className="join-form">
        <input
          type="text"
          maxLength={6}
          placeholder="Enter room code"
          value={roomCodeInput}
          onChange={(e) =>
            setRoomCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter') joinRoom();
          }}
        />
        <button className="secondary-btn" onClick={joinRoom} disabled={joining}>
          {joining ? 'Joining...' : 'Join Room'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
    </div>
  );
}

function App() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);
  const [playerSymbol, setPlayerSymbol] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [view, setView] = useState('lobby');
  const playerSymbolRef = useRef(null);

  useEffect(() => {
    playerSymbolRef.current = playerSymbol;
  }, [playerSymbol]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on(SOCKET_EVENTS.CONNECT, () => {
      setConnected(true);
    });

    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      setConnected(false);
      setRoom(null);
      setPlayerSymbol(null);
      setView('lobby');
    });

    socket.on(SOCKET_EVENTS.ERROR_MESSAGE, ({ message }) => {
      setError(message);
    });

    socket.on(SOCKET_EVENTS.GAME_END, ({ declinedBy } = {}) => {
      setNotice(
        declinedBy && declinedBy !== playerSymbolRef.current
          ? 'Your opponent does not want to play anymore. Returning to home...'
          : 'You left the game. Returning to home...'
      );
      setError('');
      setRoom(null);
      setPlayerSymbol(null);
      setView('lobby');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleJoined = (data) => {
    setError('');
    setNotice('');
    setRoom({
      code: data.code,
      board: data.board,
      currentTurn: data.currentTurn,
      players: data.players,
      winner: data.winner,
      winningLine: data.winningLine,
      isDraw: data.isDraw,
      status: data.status,
    });
    setPlayerSymbol(data.symbol);
    setView('game');
  };

  const handleRestart = () => {
    socketRef.current.emit(SOCKET_EVENTS.GAME_RESTART);
  };

  const handleRematch = (yes) => {
    socketRef.current.emit(SOCKET_EVENTS.GAME_REMATCH, { yes });
  };

  if (!connected) {
    return (
      <div className="app">
        <div className="connecting-screen">
          <div className="spinner" />
          <p>Connecting to server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {view === 'lobby' && (
        <>
          {notice && <div className="notice-banner">{notice}</div>}
          <Lobby socket={socketRef.current} onJoined={handleJoined} />
        </>
      )}
      {view === 'game' && room && (
        <GameScreen
          socket={socketRef.current}
          room={room}
          playerSymbol={playerSymbol}
          onRestart={handleRestart}
          onRematch={handleRematch}
        />
      )}
      {error && view === 'lobby' && <div className="error-banner top-banner">{error}</div>}
    </div>
  );
}

export default App;
