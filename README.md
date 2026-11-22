# Rooftop Runner

A top-down stealth game built for the make.fun best-stealth-game bounty.

Mira the rooftop runner delivers 3 letters to marked chimneys across a row of
night roofs, then slips out down the green stairs — unseen. Two watchmen patrol
below and above: Watchman Odo sweeps the street with his lantern, Watchman Fen
walks the far roof. Chimneys and water tanks block sight, skylights expose you,
pigeons raise the alarm if you run past them, and a laundry line zips you
across the gaps between roofs. Pebbles distract a guard; crouching keeps you
in shadow.

Play: open `game/index.html` in a desktop browser. WASD / arrows to move,
Shift to run, C to crouch, click a laundry line to zip across, click the
ground to throw a pebble.

## Layout

- `game/` — the playable game (static files, no network)
  - `index.html`, `style.css`
  - `src/main.js` — loop, rendering, input, screenshot presets
  - `src/level.js` — roofs, cover, lines, letters, exit
  - `src/player.js` — Mira: move, zip, pebbles, objectives
  - `src/guard.js` — Odo and Fen: patrol, suspicion, alarm, chase
  - `src/vision.js` — vision cones and line of sight
  - `src/audio.js` — WebAudio footsteps and alarm sting
  - `src/hud.js` — info panel, alarm bar, minimap
- `screenshots/` — 4 renders of the game itself
- `main.ts` — copies `game/` and `screenshots/` to the output directory and
  writes `dossier.json` with the kit's `buildDossier`
- `vendor/makefun-game.ts` — the kit's library, unchanged

## License

MIT — see LICENSE.
