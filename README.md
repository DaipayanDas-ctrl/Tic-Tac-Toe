# Tic Tac Toe Online

A complete online multiplayer PvP Tic-Tac-Toe game.

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Real-time:** Socket.IO

## Features

- 3x3 game board
- Two-player room system
- Create a room or join one with a 6-character room code
- Players enter their name before creating/joining a room
- Real-time move synchronization
- Server-side turn and move validation
- Win/draw detection
- After each game both players are asked to play again; a new game
  starts only when both agree
- If a player answers **No**, they are sent back to the landing page and
  the opponent is notified that the other player does not want to play
  anymore and is redirected to the landing page too
- Player disconnect handling (opponent gets a message and the game resets)
- Responsive modern UI (works on mobile and desktop)

## Requirements

- Node.js 18 or later

## Setup

### 1. Install dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Run in development

Start the backend server (default port 3001):

```bash
cd server
npm run dev
```

In a separate terminal, start the frontend dev server (default port 5173):

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in two browser windows to play against yourself, or
share the URL and a room code with a friend.

### 3. Configure the server URL (optional)

The frontend connects to `http://localhost:3001` by default. To point it
somewhere else, create a `.env` file in `frontend/`:

```
VITE_SERVER_URL=http://your-server:3001
```

### 4. Production build

```bash
cd frontend
npm run build
cd ../server
npm start
```

The Express server automatically serves the built frontend from
`frontend/dist`, so the whole app runs on `http://localhost:3001`.

## Deploying

### Free options at a glance

Multiplayer needs a **persistent** server that supports WebSockets. These free
options work:

| Host | Free? | Card required | Caveats |
|------|-------|---------------|---------|
| **Render** (Web Service) | Yes | No | Free services spin down after ~15 min idle; first open after idle has a ~1 min cold start. An active game keeps the WebSocket alive, so real-time play works. **Recommended** — the included `render.yaml` already uses `plan: free`. |
| **Koyeb** | Yes | No | Free instances keep running (no spin-down). WebSockets supported. Slightly more setup than Render. |
| **Fly.io** | Free allowance (~3 small VMs) | Yes | No spin-down, reliable. Needs a credit card to sign up. |
| **Replit** | Yes | No | Projects sleep on inactivity and connections can be flaky; fine for testing, not ideal for real use. |
| Railway / Heroku | No | – | No real free tier anymore (trial credits only). |

### Single-instance requirement

The backend keeps rooms in memory, so it must run as a **single instance** on
whichever free host you pick (do not horizontally scale it without a shared
store such as Redis).

> **Important:** Vercel alone is **not** enough. Vercel hosts the static
> frontend perfectly, but its serverless functions **cannot** run Socket.IO or
> hold long-lived WebSocket connections, and they do not keep in-memory room
> state. So a Vercel-only deploy would load the page but stay stuck on
> "Connecting to server..." and **multiplayer would not work**.
>
> The multiplayer backend needs a **persistent** host that supports WebSockets:
> **Render** (Web Service), **Railway**, **Fly.io**, **Heroku**, or a VPS.
> Deploy the backend there, then point the Vercel frontend at it.

### 1. Backend (persistent WebSocket host) — Render free tier

This is the recommended free path — no credit card required.

1. Push this repo to GitHub.
2. On [Render](https://render.com), choose **New > Web Service**, connect the
   repo, and select the included blueprint: `render.yaml` (or set Root Directory
   to `server`, Build Command to `npm install`, Start Command to `npm start`,
   and Health Check Path to `/api/health`).
3. Under **Instance Type** pick the **Free** plan.
4. Render gives the backend a public URL, e.g.
   `https://tic-tac-toe-server.onrender.com`. Note it down.

Free-tier note: the service sleeps after ~15 minutes with no traffic. When a
player first opens the game after it slept, the first connection takes ~1
minute to cold-start; after that, moves sync in real time as long as the game
is open. If you prefer a host that never spins down, use **Koyeb** or
**Fly.io** instead.

Other hosts work the same way — the backend is a plain Node.js service that
listens on `process.env.PORT`.

### 2. Frontend on Vercel

1. On [Vercel](https://vercel.com), **Add New > Project**, import the same repo.
2. Set **Root Directory** to `frontend` (the included `vercel.json` already
   configures Vite for you).
3. Add the environment variable `VITE_SERVER_URL` with the backend URL from
   step 1, e.g. `VITE_SERVER_URL=https://tic-tac-toe-server.onrender.com`.
4. Deploy. The build bakes that URL into the app.

### 3. Verify

Open the deployed Vercel URL in two browser windows, create a room in one, and
join its code in the other. Moves should sync in real time.

Notes:

- Because the backend keeps rooms in memory, it must run as a **single
  instance** (do not horizontally scale it without adding a shared store such
  as Redis).
- `frontend/.env.example` documents the `VITE_SERVER_URL` variable.

## How to play

1. Open the app and enter your name, then click **Create New Room**, or enter a
   friend's room code and click **Join Room**.
2. The room creator plays as **X**; the joiner plays as **O**.
3. Take turns clicking cells to place your symbol.
4. Get three of your symbols in a row (horizontal, vertical, or diagonal) to win.
5. After a win or draw, both players are asked **Play again?**. Answer **Yes**
   to play another round; the new game starts when both players say **Yes**.
   Answering **No** ends the game: you return to the landing page and the
   opponent is redirected to the landing page too.

## Project structure

```
tic-tac-toe/
├── server/          # Express + Socket.IO backend
│   └── index.js     # Room management, game logic, validation
├── frontend/        # React + Vite frontend
│   └── src/
│       ├── App.jsx  # UI, socket handling, game screen
│       ├── App.css  # Game styles
│       └── index.css# Global theme
└── README.md
```
