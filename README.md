# makefun-gta6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/mikaelkarlmax/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/mikaelkarlmax/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Palm Bay Heat** — an original open-world crime game that runs in the browser from static files, built for make.fun's *Make GTA 6* bounty. No engine, no assets, no network: every street, car, palm and siren is drawn or synthesised by the code in `game/src/`.

Welcome to **Palm Bay**, a sun-soaked city of seven districts — The Hills, Old Town, Portside, the Marina District, Downtown Serena, the East Yards and Playa Serena on the bay. You are **Rio**, a driver with a debt to the Cangrejo crew. Seven story jobs for the city's fixers — Marisol, Paz and Tito — stand between Rio and a clean name.

## What's in the game

- **A living city** — a seeded grid of named buildings and districts, flowing traffic that keeps right and brakes for trouble, parked cars along the kerbs, pedestrians who stroll, flee gunfire and dive from fast cars, and a full day cycle from dawn gold to lamp-lit night.
- **On foot and by car** — walk or sprint the sidewalks, take any parked or rolling car (the law notices), and drive with weight, drag and a handbrake. Cars bend, smoke and die.
- **Wanted heat, 1–5 stars** — crimes add heat when witnessed; hiding cools it. The Comisaría answers with patrol cars in star-scaled numbers, officers who bail out and chase on foot, gunfire at two stars, and roadblocks at four. Get cornered and slow, and the **bust meter** fills.
- **Seven story missions** — a quiet package run, a pier pickup against the clock, a red coupé to steal, a stolen van to disable, a hideout to cool off in, the six-light Serena Sprint, and the Cangrejo Score: crew pickups, a twelve-second hold in the Hotel Mirador yard at high heat, and a vanishing act.
- **Combat** — a punch for whoever is close, hitscan gunfire with tracers for whoever the crosshair holds, on foot or through a car window.
- **A full HUD** — minimap with the law, the job and the next fixer on it; wanted stars; money, health and car condition; the clock and the street you are on; mission objectives with distance, timers and an edge arrow.
- **Shops and survival** — patch up at the Hospital del Litoral or Bar El Ancla, repair at Taller Paz or Depósito Mar. Busted means a fine and a walk from the Comisaría; wasted means a hospital bill.
- **Sound, synthesised** — engine note, two-tone sirens that swell as patrols close in, horns, shots, cash and a mission-complete jingle. `M` mutes.
- **Saving** — the run saves itself after every job: money, story progress, place and clock, ready to continue from the title screen.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| E | Enter / exit a car, talk to a fixer, use a shop, advance dialog |
| Mouse (hold) / F | Shoot toward the pointer |
| Shift | Sprint on foot |
| Space | Handbrake (and confirm in menus) |
| P / Esc | Pause |
| M | Mute |
| Enter | Start, confirm, respawn |

## Run it

```sh
node serve.ts          # serves game/ at http://localhost:8080
```

or hand the entry in the way the grader does:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # copies game/ + screenshots/ to out/ and writes out/dossier.json
```

## Source map

`game/src/` is split one job per file: `city.js` builds Palm Bay, `vehicles.js` drives it, `peds.js` walks it, `police.js` hunts through it, `missions.js` tells Rio's story, `combat.js` handles the loud parts, `hud.js` and `render.js` paint it, `audio.js` synthesises every sound, `world.js` holds the run's state and its save, `shots.js` stages the screenshots, and `main.js` runs the loop.

---

<sub>Entered on [make.fun](https://make.fun/?ref=q8z3gt64&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
