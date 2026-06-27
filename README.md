# Platformer

A browser-based 3D platformer with **WebGPU + TSL** render pipeline and **real-time multiplayer**.

- **Rendering** — WebGPU three.js runtime
- **Multiplayer** — real-time player presence via [Colyseus](https://colyseus.io/): Degrades gracefully to single-player.
- **Backend** — [InstantDB](https://instantdb.com) is configured for persistence (e.g. names and coin count).

## Project structure

```
index.html         # the entire game client (no build step; ES modules via CDN)
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

**2. Game client** — must be served over HTTP (not `file://`) for ES module imports:

```sh
python3 -m http.server 8765
```

Then open [http://localhost:8765](http://localhost:8765). The client connects to the local server.

> The game runs fine without the server running — multiplayer just stays off.

## Deployment

The client and server deploy separately (Colyseus needs a stateful host):


| Part                                   | Host       | Notes                                                             |
| -------------------------------------- | ---------- | ----------------------------------------------------------------- |
| Game client (`index.html` + `models/`) | **Vercel** | Static, no build step.                                            |
| Colyseus server (`server/`)            | **Render** | Root directory `server/`, build `npm install`, start `npm start`. |


### Render Server setup

1. create a **Node Web Service**, set **Root Directory** to `server`,
2. add the env vars `INSTANT_APP_ID` and `INSTANT_ADMIN_TOKEN` in the dashboard (for server based db writes).
3. After it deploys, copy the service's `wss://…onrender.com` URL into the `RENDER_WS_URL` constant in `index.html` so the production client connects to it.

### Environment / secrets

`.env` holds the InstantDB credentials.

1. Copy `.env.example` to `.env` to set up a fresh checkout.
2. **App ID** is a public client identifier (safe to embed in `index.html`).
3. **admin token** is a server-only secret (set it in Render's dashboard).

