# Platformer

A browser-based 3D platformer with **WebGPU + TSL** render pipeline and **real-time multiplayer**.

- **Rendering** — WebGPU renderer
- **Multiplayer** — real-time player presence via [Colyseus](https://colyseus.io/): Degrades gracefully to single-player.
- **Backend** — [InstantDB](https://instantdb.com) is configured for persistence (e.g. a coin leaderboard).

## Project structure

```
index.html        # the entire game client (no build step; ES modules via CDN)
models/*.glb       # 3D assets
server/            # Colyseus multiplayer server (its own package.json)
```

## Running locally

You need two processes: the game client (a static file server) and the multiplayer server.

**1. Multiplayer server** — Colyseus on `ws://localhost:2567`:

```sh
cd server
npm install
npm start
```

**2. Game client** — must be served over HTTP (not `file://`) so ES module imports and
GLB fetches work:

```sh
python3 -m http.server 8765
```

Then open <http://localhost:8765>. The client auto-detects `localhost` and connects to the
local server. Open a second tab (or another machine on your network) to see another player.

> The game runs fine without the server running — multiplayer just stays off.

## Deployment

The client and server deploy separately (Colyseus needs a stateful host):

| Part | Host | Notes |
|---|---|---|
| Game client (`index.html` + `models/`) | **Vercel** | Static, no build step. |
| Colyseus server (`server/`) | **Render** | Root directory `server/`, build `npm install`, start `npm start`. |

Render setup: create a **Node Web Service**, set **Root Directory** to `server`, and add the
env vars `INSTANT_APP_ID` and `INSTANT_ADMIN_TOKEN` in the dashboard. After it deploys,
copy the service's `wss://…onrender.com` URL into the `RENDER_WS_URL` constant in
`index.html` so the production client connects to it.

## Environment / secrets

`.env` holds the InstantDB credentials.
**App ID** is a public client identifier (safe to embed in `index.html`).
**admin token** is a server-only secret (set it in Render's dashboard). 
Copy `.env.example` to `.env` to set up a fresh checkout.
