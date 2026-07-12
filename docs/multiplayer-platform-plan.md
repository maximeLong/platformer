# Multiplayer Game-Creation Platform: Prompt-Driven Live Games

## What we're building

A platform where players create and edit multiplayer games by prompting, from inside the game. Type "add a lava pit near the flag" and a Claude agent edits the actual game code — client HTML and server game rules. Type "make a top-down racing game" on the directory page and a brand-new game is born. Every change persists in InstantDB with full version history, hot-reloads for every connected player within seconds, and can be rolled back. **No infrastructure is ever provisioned per game — creating a game writes database rows.** The existing platformer becomes game #1.

## The core idea: consoles and cartridges

Both client and server split into a fixed **console** (deployed normally, once, never edited by prompts) and mutable **cartridges** (the actual games, stored as code in InstantDB, loaded at runtime). Prompts only ever write new cartridges.

- **Client console — the bootloader + chrome.** `index.html` on Vercel becomes a fixed shell. With no game in the URL it shows the **directory**: a list of games (live from InstantDB) plus a "create a game" prompt box. With `?g=<slug>` it fetches that game's current HTML from the DB and injects it via `document.write()`. The console also owns all the editing **chrome** — prompt bar, edit-status toasts, version display, reload logic — rendered *around* whatever game is loaded, and exposes a tiny API to the cartridge:
  ```js
  window.__harness = {
    gameId, version,
    room,                          // pre-connected Colyseus room for this game
    onBeforeReload(fn),            // cartridge returns state to stash (position, etc.)
    onRestore(fn),                 // cartridge receives stashed state after reload
  }
  ```
  Because the chrome lives in the console, **the cartridge is pure game** — the agent can rewrite 100% of it, there are no fenced "do not remove" regions to police, and every game gets a consistent editing UI for free.
- **Server console.** `server/index.js` — Colyseus + Express, the per-game edit queues, agent runner, InstantDB admin client, publish/rollback, hot-swap. One room type, `filterBy(['gameId'])`: everyone joining with the same gameId lands in the same room; different games get different rooms **in the same process**. Each room, on creation, fetches its game's server cartridge from the DB and imports it — so one Node process simultaneously runs a platformer in one room and a racing game in another.
- **Server cartridge.** Per-game `serverJs` implementing `createGameLogic(ctx)` → `{ onCreate, onJoin, onLeave, onMessage, onTick, serialize, restore }`. Hot-swap: the running console imports the new module (`.runtime/<gameId>.v<N>.mjs`, unique names bust the ESM cache), calls old `serialize` → new `restore`, swaps the object. No restart, no disconnects.

## What happens when someone prompts (the loop)

1. Prompt goes to the server over the game's Colyseus room (`prompt {text}`).
2. It enters **that game's FIFO queue** — one edit at a time per game, no merges ever (git's *history* model without its *merge* model; queued prompts run against the head that already includes prior edits, so intents compose). Edits to *different* games run in parallel, under a global agent-concurrency cap. Everyone in the room sees the live queue toast.
3. Agent runs (Claude Agent SDK) in a temp workdir: the game's `index.html` + `gameLogic.js` + a generated `ARCHITECTURE.md` describing the harness contract.
4. **Validation gate:** JS parses (`node --check` on the module script and cartridge), cartridge trial-imports and exports the full interface, cartridge registers the harness hooks, size ≤ 500KB. Fail → error toast to the author, nothing publishes.
5. Pass → one atomic transact: immutable `versions` row N+1 + bump `games.currentVersion`.
6. Clients subscribed to their game's row see the bump → console stashes cartridge state (via `onBeforeReload`) in sessionStorage → `location.reload()` → bootloader fetches N+1 → `onRestore` puts the player back (respawn fallback if geometry changed). ~2s hiccup. Belt-and-braces: room also broadcasts `world_reload {version}`.
7. Server console swaps that game's room logic in the same beat.
8. **New game creation** is the same pipeline: create a `games` row, seed version 0 from the **genesis template** (minimal cartridge pair implementing just the harness contract + an empty scene), run the creation prompt as the first edit → version 1. No special machinery.
9. Bricked game? `/rollback [n]` in the prompt box repoints `currentVersion` (console-handled, no agent). Backups: `POST /admin/rollback` (admin token), `scripts/rollback.mjs` (direct DB, recovers even a crash-looping server).

## Technical appendix

### InstantDB schema
```
games:    { slug (unique, indexed), name, createdAt, currentVersion, createdBy }
versions: { gameId (indexed), version (indexed), html, serverJs, prompt, authorName, createdAt (indexed) }
players:  unchanged (leaderboard)
```
Perms: readable by all, writable by nobody (admin token bypasses). Versions immutable ⇒ rollback = repoint. Size contingency: Instant Storage `$files` if artifacts outgrow rows (platformer is 51KB today) — never Render disk (ephemeral).

### Server cartridge interface
```js
export function createGameLogic(ctx /* {db, log, gameId, version} */) => ({
  onCreate(room), onJoin(room, client, opts), onLeave(room, client),
  onMessage(room, client, type, payload),   // all types the console doesn't reserve
  onTick(room, dt),                         // 20Hz
  serialize(room), restore(room, snapshot)  // hot-swap migration
})
```
Console reserves `move`/`profile`/`prompt`; registers `onMessage('*')` once and dispatches the rest. Colyseus Schema stays fixed (can't be redefined at runtime): presence `Player` map + one generic `data: 'string'` field driven via `room.setData(obj)`, plus `room.broadcast()` for events. This contract lives in the genesis template and the agent system prompt.

### Agent run
`@anthropic-ai/claude-agent-sdk`: `mkdtemp` → write cartridge files + `ARCHITECTURE.md` → `query({ prompt, options: { cwd, allowedTools: ['Read','Edit','Write','Grep','Glob'], permissionMode: 'bypassPermissions', maxTurns: 60, systemPrompt: { type:'preset', preset:'claude_code', append: server/prompts/system.md } } })` → read back → validate → publish. System-prompt invariants: keep the CDN import map; register the `__harness` hooks; export the full cartridge interface; no new Schema fields; only existing `models/*.glb` (relative paths); no build step; smallest change satisfying the prompt. Guards: prompt ≤ 500 chars, per-session cooldown (`EDIT_COOLDOWN_S`, default 60s), per-game queue depth ≤ 5, global agent concurrency 1–2. Each run records `baseVersion` (CAS) — enables future parallel-within-a-game via "rebase by re-prompting" if queue latency ever hurts.

### Why the bootloader (not serving HTML from Render)
`document.write()` re-parses the full document in order (import map before module script) and keeps the base URL on the Vercel/local origin, so relative `models/*.glb` paths and the canvas `getImageData` colormap work with zero CORS changes. Games load from InstantDB even while the Render free-tier server sleeps (single-player degradation preserved). Fallbacks: `GET /world?g=<slug>` JSON endpoint, then the static genesis copy in git.

### Files
| File | Role |
|---|---|
| `index.html` | fixed console: bootloader + directory + editing chrome + `__harness` API |
| `world/genesis.html`, `world/genesisLogic.js` | genesis template (minimal cartridge pair, the contract in code) |
| `world/platformer.html`, `world/platformerLogic.js` | seed for game #1: today's game refitted to `__harness` hooks (Colyseus connect via `__harness.room`, stash/restore registration; identity/leaderboard UI stays in-cartridge) |
| `server/index.js` | fixed console: Express + Colyseus (`filterBy(['gameId'])`), per-room cartridge load, hot-swap |
| `server/editQueue.js`, `agentRunner.js`, `validate.js`, `db.js`, `prompts/system.md` | console internals (queue is per-game) |
| `instant.schema.ts`, `instant.perms.ts`, `scripts/seed.mjs`, `scripts/rollback.mjs` | DB plumbing (seed creates the platformer game + v1) |
| `server/package.json` | + `express`, `@instantdb/admin`, `@anthropic-ai/claude-agent-sdk` |
| `.env.example` | + `ANTHROPIC_API_KEY` (optional `AGENT_MODEL`, `EDIT_COOLDOWN_S`) |

### Build order
1. **InstantDB plumbing** — schema/perms, `db.js`, seed round-trip.
2. **Bootloader spike (riskiest first)** — prove `document.write` boots WebGPU + models + Colyseus + Instant (Chrome + Safari). Fallback: serve from Render + CORS on `/models/*` + `crossOrigin='anonymous'`.
3. **Server console** — `filterBy(['gameId'])` rooms, per-room cartridge boot-from-DB, routes (`/world`, `/healthz`, `/admin/rollback`), prove hot-swap by hand-publishing a tweaked cartridge.
4. **Client console + platformer refit** — chrome/`__harness` in bootloader, refit today's game as the seed cartridge, prove reload+restore by hand-bumping `currentVersion` with two windows open.
5. **Agent pipeline** — per-game queues + runner + validation + system prompt, end to end on game #1.
6. **Genesis + directory** — game list page, create-game flow, genesis template, prove "make a pong game" from scratch.
7. **Safety & polish** — rollback surfaces, cooldowns, toasts, README/deploy, prod reseed.

### Verification (local, two browser windows)
1. Seed → `node --env-file=.env server/index.js` + `python3 -m http.server 8765`; both windows on `?g=platformer` see each other (presence regression).
2. Prompt "make all coins glow green" in A → both toast → both reload → A's position/coins restored via `__harness` hooks.
3. Server-rule prompt ("broadcast a welcome on join") → hot-swap without restart (`.runtime/platformer.v<N>.mjs`).
4. Failure path: validate.js vs broken JS / missing hooks → failed toast, pointer unchanged.
5. Per-game concurrency: A+B prompt the same game seconds apart → B queued #2, runs on A's output. Prompts to two *different* games run concurrently.
6. Directory: create "pong" from a prompt → new game appears in the list → playable in a second window at `?g=pong` while the platformer room keeps running untouched.
7. `/rollback` from prompt box and via curl revert both windows. Kill server → hard refresh still loads any game single-player from InstantDB.

### Risks
1. `document.write` full-document replacement — spiked first; fallback defined.
2. Agent bricks a game — validation gate + immutable history + three rollback surfaces; blast radius is one game, worst case one reload cycle.
3. Runaway cartridge (infinite loop in `onTick`) stalls the shared event loop for **all** games — acceptable at friends-scale (rollback + restart recovers); the platform-scale fix is per-room `worker_threads` (isolation upgrade inside this design, not a redesign), same milestone as sandboxing untrusted cartridges.
4. Fixed Colyseus schema limits — generic `data` field + broadcasts.
5. Cost/abuse — cooldowns, per-game queue caps, global agent concurrency cap, API key server-only.
