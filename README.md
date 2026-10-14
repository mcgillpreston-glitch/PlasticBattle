# Plastic Front

An all-ARAM, toy-soldier MOBA that runs in the browser. Classic plastic army men fight down one diagonal lane, a sunken Normandy road between hedgerows, with a gritty WWII look. Play offline against bots, or online in real time against other people.

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
- **Smoothing.** Clients render 100 ms behind the newest snapshot and interpolate, so movement looks smooth.
- **Ping.** Your ping shows under the match clock.

### Deploy the game server

The GitHub Pages site is static, so online play needs the small Node server in `server/`, running somewhere. The server also serves the game page, so its own URL is a complete, playable site.

**Render (one click, free tier):**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/mcgillpreston-glitch/PlasticBattle)

1. Click the button, sign in with GitHub, and approve the blueprint (`render.yaml`).
2. Render builds and starts the service. Its URL looks like `https://plastic-front.onrender.com`.
3. Play online directly at that URL. The GitHub Pages site connects to `wss://plastic-front.onrender.com/ws` by default. If Render gave your service a different URL, change `PF_DEFAULT_SERVER` in `src/70-net.js`, or enter the address under **Server** on the online screen. It's remembered per browser and also carried in invite links.

**Capacity and cost:** a 5v5 match uses about 7% of one CPU core.

- **Render free** has 0.1 CPU, so it fits about one match at a time. It also sleeps after 15 minutes idle; the first visitor waits up to a minute while it wakes, and the client keeps retrying until then.
- **Render Starter** ($7/month, 0.5 CPU) fits roughly 7 matches and never sleeps.

**Anywhere else:** the `Dockerfile` runs on Fly.io, Railway or any VPS. Or run it directly with `npm install && node build.js && node server/server.js`. The server listens on `PORT` (default 8080). It serves the game at `/` and WebSocket at `/ws`, with `/health` and `/status` endpoints.

## The game

- **Mode:** ARAM only. Draw a random hero, with one reassignment. Offline you can pick any hero in test mode and play 1v1, 3v3 or 5v5 against bots.
- **Map:** The Sunken Road. Each side has two MG nests, a supply dump and an HQ, and they must fall in that order. The road has thickets that hide units, med crates that heal, and walls, a wrecked jeep, a cart and stumps for cover.
- **Reserves:** a minion wave every 25 s, a tank every third wave, and a jeep once the enemy supply dump is down.
- **Heroes:** 16, one for each classic army-men pose. Each has Q/W/E/R, plus D (Tag Round, then press again to close in) and F (Hit the Deck).
- **Field Orders:** augments at levels 3, 7, 11 and 15, in Squad, Platoon and Company tiers, issued at your CP or while reinforcing.
- **Overtime:** a rolling artillery barrage walks out from the centre after 18:00.

## Controls

| Input | Action |
|---|---|
| Click | Move or attack |
| A + click | Attack-move |
| Q W E R | Cast toward the cursor |
| D | Tag Round, then D again to close in |
| F | Hit the Deck (dive) |
| S | Halt |
| Tab (hold) | Scoreboard |
| O | Field Orders |
| Space / Y | Centre camera / toggle camera lock |
| Mouse wheel | Zoom |
| ` | Range-control panel. Online, only the display toggles show (ranges, collision, sound). |

On touch screens: tap to move, drag to pan, tap an ability button and then the ground to cast.

## Project layout

```
index.html                 built, standalone game (GitHub Pages and the server both serve it)
build.js                   concatenates src/ into index.html
src/00-shell.html          page markup and styles
src/10-data.js             shared: heroes, Field Orders, map geometry
src/11-art.js              browser: plastic soldier sculpts and sprites
src/12-audio.js            browser: synthesized sound
src/20-sim-core.js         shared: state, damage and stats, collision, pathfinding, abilities, events
src/30-sim-update.js       shared: update loop, attacks, bots and minions, Field Orders rules
src/40-render.js           browser: terrain, units, effects, minimap
src/50-present.js          browser: turns sim events into visuals and sound
src/60-hud-input.js        browser: HUD, scoreboard, Field Orders UI, input, game loop
src/70-net.js              browser: online client, lobby, snapshot interpolation
server/server.js           game server: rooms, lobby, matches, snapshots, commands
server/sim.js              loads the shared sim into an isolated context per match
tests/playtest-harness.js  obstacle course + bot-match stuck detector (offline)
tests/online-test.js       end-to-end online test with three live browser players
tests/visual-check.js      combat and scoreboard screenshots
render.yaml, Dockerfile    server deployment
```

The sim never touches the page. It emits events (shots, hits, callouts, feed lines), and the browser turns them into effects, whether the events came from the local sim or from the server.

Edit files in `src/`, then run `node build.js`. Pushing to `main` redeploys GitHub Pages, and redeploys the server if Render auto-deploy is on.

## Local development and tests

```
npm install
npm run dev            # build, then serve on http://localhost:8080 (online play works locally)
npx playwright install chromium
npm test               # offline: obstacle course for 3 unit sizes + bot matches with a stuck detector
npm run test:online    # online: create and join a room, start, move, cast, scoreboard, drop-in, leave, end, rematch
npm run visual         # screenshots of a live fight and the Tab scoreboard
```
