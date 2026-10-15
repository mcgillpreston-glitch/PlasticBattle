# Plastic Front

An all-ARAM, toy-soldier MOBA that runs in the browser. Modern-kit plastic army men fight across a backyard sandbox: one diagonal lane between wooden planks, with sandcastle turrets, toy buckets, a dump truck and the lawn beyond. Combat feedback is modern-shooter style (hitmarkers, damage numbers, damage direction, kill confirms), and the HUD is riveted metal with LED readouts and a radar minimap, in the manner of a classic 90s RTS. Play offline against bots, or online in real time against other people.

**Play:** https://mcgillpreston-glitch.github.io/PlasticBattle/

## Online PvP

Open **Online PvP** on the Roll Call screen, choose a callsign, then:

- **Quick match** joins any open room, or drops you into a running match by taking over a bot.
- **Create room** gives you a 4-letter code. Use **Copy invite link** to send it to friends.
- **Join room** takes a code.

In the lobby everyone draws a random hero (ARAM) and gets one **reassignment** (reroll). Players can switch teams, and the host picks 1v1, 3v3 or 5v5 and starts the match. Bots fill every empty slot. If someone leaves mid-match, a bot takes over their hero; anyone joining a running match takes over a bot. When the match ends, the room returns to the lobby for a rematch.

### How it works

The **server runs the real match**: movement, combat, bots, Field Orders and the win condition. Browsers only send commands (move, attack, cast, pick an order) and draw what the server sends.

- **Shared code.** The server loads the exact same simulation files the browser uses offline (`src/10`, `20`, `30`), so the rules can't drift apart.
- **Snapshots.** The server ticks the sim at 40 Hz and sends each team a snapshot 20 times a second, about 20–25 KB/s per player.
- **Fog of war.** Each team only receives units it can actually see, so an enemy hiding in a thicket is never sent to the other side's browser.
- **Smoothing.** Clients render 60 ms behind the newest snapshot on a steady connection (more when arrival jitter is measured, up to 160 ms) and interpolate, so movement looks smooth.
- **Ping.** Your ping shows in the top strip.

### Deploy the game server

The GitHub Pages site is static, so online play needs a game server. There are two ways to run one; both serve the game page too, so their own URL is a complete, playable site.

**Cloudflare Workers (recommended: lowest latency, no sleeping).** Each room is a [Durable Object](https://developers.cloudflare.com/durable-objects/) that is created in the Cloudflare datacenter nearest the player who opens the room, and the page and art are served from the edge. Idle lobbies hibernate for free; a running match keeps its object awake. A 5v5 hour costs a fraction of a cent and casual use fits the free plan.

```
npm install -g wrangler        # once
npx wrangler login             # once, opens the browser
npm run deploy:cf              # builds, then deploys worker/ with dist/ as static assets
```

The deploy prints the URL, like `https://plastic-front.<your-subdomain>.workers.dev`. Play there directly, or point the GitHub Pages site at it by setting `PF_DEFAULT_SERVER` in `src/70-net.js` to `wss://plastic-front.<your-subdomain>.workers.dev/ws` (or enter that address under **Server** on the online screen; invite links carry it). `npm run dev:cf` runs the same thing locally with `wrangler dev`.

How it maps: `worker/index.js` is the Worker plus two Durable Object classes: `RoomDO` (one per 4-letter code; lobby, the authoritative match at 40 Hz, per-team snapshots at 20 Hz) and `LobbyDO` (a single directory used for quick match and `/status`). The room logic itself is `server/room.js`, shared with the Node server, and the simulation is the same `src/10`, `20`, `30` the browser runs, built into `worker/sim.gen.js`.

**Render (one click, free tier):**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/mcgillpreston-glitch/PlasticBattle)

1. Click the button, sign in with GitHub, and approve the blueprint (`render.yaml`).
2. Render builds and starts the Node server (`server/server.js`). Its URL looks like `https://plastic-front.onrender.com`.
3. Play online directly at that URL, or set it as the server as above.

**Capacity and cost:** a 5v5 match uses about 9% of one CPU core on Node.

- **Render free** has 0.1 CPU, so it fits about one match at a time. It also sleeps after 15 minutes idle; the first visitor waits up to a minute while it wakes, and the client keeps retrying until then.
- **Render Starter** ($7/month, 0.5 CPU) fits roughly 5 matches and never sleeps.

**Anywhere else:** the `Dockerfile` runs on Fly.io, Railway or any VPS. Or run it directly with `npm install && node build.js && node server/server.js`. The server listens on `PORT` (default 8080). It serves the game at `/`, the room API at `/api/room`, `/api/quick` and `/api/room/CODE`, one WebSocket per room at `/ws/CODE`, and `/health` and `/status`.

## The game

- **Mode:** ARAM only. Draw a random hero, with one reassignment. Offline you can pick any hero in test mode and play 1v1, 3v3 or 5v5 against bots.
- **Map:** The Sandbox, a painted 4K backyard sandbox (`assets/map.webp`, one world unit per pixel). Green holds the sand fort bottom-left, Tan the fort top-right, and **three lanes** run between them: top (around the left and along the back board), mid (straight through the centre bridge) and bottom (along the front and up the right side). Each lane has an outer and an inner sand turret per team; a lane's inner turret can only be hit once its outer turret is down, and a fort opens up once any of its three inner turrets has fallen. The hills, trenches, sandbag walls and barrels in the painting are not walkable; the rutted sand bands are, and weeds hide units.
- **Reserves:** every 25 s each lane gets two riflemen and two bayonet chargers; every third wave one lane gets a toy tank and the other two get mortar crews; a jeep joins a lane once the enemy's inner turret there is down.
- **Heroes:** 16, one for each classic army-men pose, drawn from illustrated figures (`assets/heroes/` for Green, `assets/heroes/tan/` for Tan; a missing tan file falls back to a recolour of the green one). Each has Q/W/E/R, plus D (Tag Round, then press again to close in) and F (Hit the Deck).
- **Going down:** when your soldier is eliminated the screen switches to a thermal feed (cold blue sandbox, white-hot soldiers, shots and blasts) and a KIA recap shows who hit you in the last 12 seconds, with what, for how much, who landed the killing blow, and the reinforcement countdown. The camera holds on the spot where you fell, you can drag to look around, and it swings back to base just before you respawn. Field Orders can still be issued while reinforcing, and so can a **reassignment**: press C (or the button on the KIA plate) to open the figure select again and come back as a different soldier. Level, XP, Field Orders and your record carry over, the new kit starts with fresh cooldowns, and figures already in your squad are unavailable. Online, the server applies the change and everyone sees the new figure.
- **Field Orders:** augments at levels 3, 7, 11 and 15, in Squad, Platoon and Company tiers, issued at your CP or while reinforcing.
- **Overtime:** the lawn sprinkler comes on after 18:00 and sweeps every lane out from the centre; anything caught in the water takes damage.

## Controls

| Input | Action |
|---|---|
| Click | Move or attack |
| A + click | Attack-move |
| Q W E R | Cast toward the cursor |
| D | Tag Round, then D again to close in |
| F | Hit the Deck (dive) |
| S | Halt |
| Tab (hold) | Intel report (scoreboard) |
| O | Field Orders |
| C | Change figure (while reinforcing) |
| Space / Y | Centre camera / toggle camera lock |
| Mouse wheel | Zoom |
| ` | Range-control panel. Online, only the display toggles show (ranges, collision, sound). |

On touch screens: tap to move, drag to pan, tap an ability button and then the ground to cast.

## Project layout

```
index.html                 built game page (GitHub Pages and the server both serve it, with assets/ beside it)
assets/                    map.webp, heroes/*.png and heroes/tan/*.png, minions/*.png and minions/tan/*.png
art-src/                   the original illustrations and the map sections
build.js                   concatenates src/ into index.html
src/00-shell.html          page markup and styles
src/10-data.js             shared: heroes, Field Orders, the three-lane map (lane polylines, walkable field, turret spots)
src/11-art.js              browser: illustrated soldiers and vehicles (tan recolour), sprite cache, sculpt fallback
src/12-audio.js            browser: synthesized sound
src/20-sim-core.js         shared: state, damage and stats, collision, pathfinding, abilities, events
src/30-sim-update.js       shared: update loop, attacks, bots and minions, Field Orders rules
src/40-render.js           browser: the painted map, units, effects, thermal feed, minimap
src/50-present.js          browser: turns sim events into visuals, sound and EVA-style alerts
src/60-hud-input.js        browser: HUD, scoreboard, Field Orders UI, input, game loop
src/70-net.js              browser: online client, lobby, snapshot interpolation
server/room.js             one room: lobby, hero draws, the match, snapshots, commands (shared by both hosts)
server/server.js           Node host: static files, room API, one WebSocket per room
server/sim.js              loads the shared sim into an isolated context per match (Node)
worker/index.js            Cloudflare host: the Worker, RoomDO (one per room) and LobbyDO (directory)
wrangler.toml              Cloudflare deploy config (static assets from dist/, Durable Object bindings)
tests/playtest-harness.js  obstacle course + bot-match stuck detector (offline)
tests/online-test.js       end-to-end online test with three live browser players (Node host)
tests/worker-test.js       the Worker and Durable Objects driven in Node through runtime shims, including a hibernation wake-up
tests/visual-check.js      combat and scoreboard screenshots
tests/death-check.js       death recap, countdown and thermal feed (offline)
render.yaml, Dockerfile    server deployment
```

The sim never touches the page. It emits events (shots, hits, callouts, feed lines, the death recap), and the browser turns them into effects, whether the events came from the local sim or from the server.

Edit files in `src/`, then run `node build.js`. Pushing to `main` redeploys GitHub Pages, and redeploys the server if Render auto-deploy is on.

## Local development and tests

```
npm install
npm run dev            # build, then serve on http://localhost:8080 (online play works locally)
npx playwright install chromium
npm test               # offline: obstacle course for 3 unit sizes + bot matches with a stuck detector
npm run test:online    # online: create and join a room, start, move, cast, scoreboard, death recap, drop-in, leave, end, rematch
npm run test:worker    # the Cloudflare Worker and Durable Objects, same scenario, in Node
npm run visual         # screenshots of a live fight and the Tab scoreboard
npm run test:death     # the player dies to real damage: recap rows, countdown, thermal view, respawn restores the normal view
```
