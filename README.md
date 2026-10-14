# Plastic Front

An all-ARAM, toy-soldier MOBA playtest that runs in the browser. Classic plastic army men fight down one diagonal lane, a sunken Normandy road between hedgerows, with a gritty WWII look.

**Play:** https://mcgillpreston-glitch.github.io/PlasticBattle/

No install needed. It's a single HTML page; open `index.html` locally to play offline. Fonts load from Google Fonts when online.

## The game

- **Mode:** ARAM only. Draw a random hero at Roll Call, with one reassignment (reroll), or pick any hero in test mode. Play 1v1, 3v3 or 5v5 against bots.
- **Map:** The Sunken Road. Each side has two MG nests, a supply dump and an HQ (Green's log command post, Tan's concrete pillbox), and they must fall in that order. The road has thickets that hide units, med crates that heal, and walls, a wrecked jeep, a cart and stumps for cover.
- **Reserves:** a minion wave every 25 s, a tank every third wave, and a jeep once the enemy supply dump is down.
- **Heroes:** 16, one for each classic army-men pose: Point Man, Kneeler, Prone Sniper, Bazooka, Grenadier, Radioman, Flamethrower, Minesweeper, Mortar Man, Officer, Machine Gunner, Charger, Paratrooper, Scout, Shotgunner, Commando. Each has Q/W/E/R, plus D (Tag Round, then press again to close in) and F (Hit the Deck).
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
| ` | Range-control test panel |

On touch screens: tap to move, drag to pan, tap an ability button and then the ground to cast.

The **Range control** panel (top left) has test toggles: weapon ranges, collision and routes overlay, god mode, no cooldowns, passive enemies, sound, pause, game speed, spawn wave, +1 level, and more.

## Project layout

```
index.html                       built, standalone game (served by GitHub Pages)
build.js                         concatenates src/ into index.html
src/00-shell.html                page markup and styles
src/01-assets-heroes-map.js      soldier sculpts, hero kits, Field Orders, map, audio
src/02-core-combat-pathing.js    state, damage and stats, collision, pathfinding, abilities
src/03-simulation-ai.js          update loop, attacks, bots and minions, Field Orders logic
src/04-render.js                 terrain, units, effects, post-processing, minimap
src/05-hud-input.js              HUD, scoreboard, input, Roll Call, game loop
tests/playtest-harness.js        obstacle course + bot-match stuck detector
tests/visual-check.js            combat and scoreboard screenshots
```

Edit files in `src/`, then run `node build.js`. Pushing to `main` rebuilds and redeploys the site automatically.

## Testing

```
npm install
npx playwright install chromium
npm test        # obstacle course for 3 unit sizes + bot matches with a stuck detector
npm run visual  # screenshots of a live fight and the Tab scoreboard
```

The harness writes a JSON report and a map image of stick points to `tests/out-*`.
