// Colyseus multiplayer server for the platformer.
//
// Stage 1: real-time player presence. Each connected client owns one Player in
// the room state (position, facing, animation, name, color). Clients push their
// own transform via "move" messages; Colyseus syncs the whole player map back to
// everyone automatically. Shared world state (coins, platforms) comes later.
//
// Plain ESM + the non-decorator schema API on purpose: no TypeScript / Babel, so
// Render can run it with a bare `npm install && npm start` — no build step.

import { Server, Room } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Schema, MapSchema, defineTypes } from '@colyseus/schema';

// ---------- schema (synced state) ----------
class Player extends Schema {}
defineTypes(Player, {
  x: 'number',
  y: 'number',
  z: 'number',
  rot: 'number',     // facing, radians around Y
  anim: 'string',    // 'idle' | 'walk' | 'jump'
  name: 'string',
  color: 'uint32',   // hex tint, e.g. 0x8a5cff
});

class GameState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
  }
}
defineTypes(GameState, {
  players: { map: Player },
});

// ---------- room ----------
class GameRoom extends Room {
  onCreate() {
    this.setState(new GameState());

    // A client reporting its own transform. We trust the client for its own
    // avatar in this presence stage (authoritative world state comes later).
    this.onMessage('move', (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !data) return;
      if (typeof data.x === 'number') p.x = data.x;
      if (typeof data.y === 'number') p.y = data.y;
      if (typeof data.z === 'number') p.z = data.z;
      if (typeof data.rot === 'number') p.rot = data.rot;
      if (typeof data.anim === 'string') p.anim = data.anim;
    });

    // Live name/color changes from the identity picker.
    this.onMessage('profile', (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !data) return;
      if (typeof data.name === 'string') p.name = data.name.slice(0, 24);
      if (typeof data.color === 'number') p.color = data.color >>> 0;
    });
  }

  onJoin(client, options = {}) {
    const p = new Player();
    p.x = 0; p.y = 1.5; p.z = 0; p.rot = 0; p.anim = 'idle';
    p.name = (options.name || 'Player').slice(0, 24);
    p.color = (options.color >>> 0) || 0xffffff;
    this.state.players.set(client.sessionId, p);
    console.log(`+ ${client.sessionId} joined (${this.state.players.size} in room)`);
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    console.log(`- ${client.sessionId} left (${this.state.players.size} in room)`);
  }
}

// ---------- bootstrap ----------
// Bind to the port Render provides (falls back to 2567 locally) on 0.0.0.0.
const PORT = Number(process.env.PORT) || 2567;

const gameServer = new Server({
  transport: new WebSocketTransport(),
});
gameServer.define('game', GameRoom);
gameServer.listen(PORT, '0.0.0.0');
console.log(`Colyseus listening on 0.0.0.0:${PORT}`);
