# Lightweight World Cup Manager Architecture

## Technology Stack

- Frontend: Vite, React, TypeScript. SPA flow keeps squad selection, lineup selection and simulation results responsive without page reloads.
- Simulation layer: pure TypeScript modules under `src/lib`. The match engine is deterministic in shape but uses controlled RNG for football variance, so it can later move to a Web Worker, Node API, or edge function.
- Backend path: start client-only for MVP. Move tournament persistence, user saves, leaderboards and anti-abuse checks into a small Fastify/NestJS API when accounts are added.
- Database path: PostgreSQL for canonical FC26 player snapshots, user saves and match history; Redis for short-lived simulation jobs if the tournament size grows.
- Monetization: AdSense placeholders are isolated in `AdSlot`, with banner, rail and interstitial variants. Real AdSense script loading should be feature-flagged and disabled in development.

## Dataset Pipeline

The expected source is `FC26_20250921.csv` in the project root. Vite imports it as a URL asset through `src/data/fc26Players.ts`, fetches it at runtime, parses the CSV in the browser, and sends rows through `normalizeFc26Players` in `src/lib/dataset.ts`.

Required fields:

- `long_name` or `short_name`
- `nationality_name`
- `club_name`
- `overall`
- `player_positions`
- Optional: `age`, `player_id`

The adapter maps detailed football positions such as `CB`, `CM`, `LW`, `ST` into the simplified simulation roles `GK`, `DEF`, `MID`, `FWD`.

## Match Engine

Each team enters a match with 11 players and one tactic. The engine now builds a richer team profile instead of rolling from average Overall alone.

Ratings:

- Base team strength is the average Overall of the lineup.
- Attack uses shooting, dribbling, pace and Overall, weighted toward forwards and midfielders.
- Defense uses defending, physic and Overall, weighted toward defenders and goalkeepers.
- Control uses passing and dribbling, weighted toward midfielders.
- Transition uses pace, physic and passing for counter-attacking threat.
- Goalkeeping uses FC26 goalkeeper attributes when available.

Tactics:

- Balanced: stable control and low-risk shape.
- Attacking: higher attack and tempo, lower defensive stability.
- Defensive: lower attack and tempo, stronger defensive stability.
- Counter attack: transition bonus, especially strong against attacking teams.

The engine also applies:

- A tactic-vs-tactic matrix, e.g. counter attack gains value against attacking teams and loses value against defensive blocks.
- A tactic-fit score based on squad shape and player attributes.
- An underdog brake so very weak teams can still spring a surprise, but repeated deep runs remain unlikely.
- Poisson goal sampling from calibrated expected goals.
- Penalty shootout resolution that favors power and goalkeeping without making it deterministic.

Every match also produces an OSM-style event timeline: kick-off, tactical analysis, fouls, big chances, "will it be a goal?" suspense moments, goals, half-time, full-time and penalties.

## Tactical Setup

The lineup screen uses a PES-style pitch board:

- Formations are coordinate-based definitions in `src/data/formations.ts`.
- Players can be dragged from the squad pool to pitch slots.
- Filled pitch slots can be dragged or clicked back to the bench.
- The bench is selected separately, up to 12 players.
- Mobile/non-drag fallback places clicked players into a compatible empty slot.

Tactics are defined in `src/data/tactics.ts`. Each tactic contains a base tactical plan with:

- Mentality
- Defensive line
- Press intensity
- Counter-press
- Build-up speed
- Passing directness
- Attacking width
- Tempo

The match engine derives attack, defense, control, transition, pressing and tempo multipliers from this plan, so detailed tactical changes affect simulation output.

## 2026 Tournament Format

The default tournament uses the real 48-team 2026 World Cup structure:

- 12 groups of four teams, from Group A to Group L.
- Each team plays the other three teams in its group once.
- The top two teams in every group qualify for the Round of 32.
- The eight best third-placed teams also qualify.
- Knockout rounds follow the official match-number bracket from M73 to M104, including the third-place match and final.
- Third-placed teams are assigned to Round of 32 slots through the full 495-row Annex C allocation table in `src/data/thirdPlaceAllocations.ts`.

Users can keep the official 2026 groups or switch to custom participant selection. Custom mode requires 48 teams and then generates 12 groups of four from the selected list.

## Folder Structure

```text
.github/
  workflows/
    deploy-pages.yml        GitHub Pages deployment workflow
Assets/
  world-cup.png             Entry screen and favicon image
Animations/
  index.html                Animation reference page
  script.js                 Animation reference trigger script
  style.css                 Animation reference styles
server/
  lobbyServer.mjs           Node.js WebSocket lobby server
scripts/
  dev.mjs                   Local client + server runner
  online-smoke.mjs          Multi-client online protocol smoke test
src/
  App.tsx                  Main SPA flow and screen composition
  components/
    AdSlot.tsx             AdSense placeholder component
    MatchEventAnimation.tsx Match event animation component
  data/
    fc26Players.ts         FC26 CSV loader
    worldCup2026.ts        Official 2026 groups and custom group helper
    formations.ts          Pitch slot definitions and auto-assignment helpers
    tactics.ts             Tactical presets and tactical plan defaults
    samplePlayers.ts       Small generated demo dataset
  lib/
    csv.ts                 Lightweight CSV parser
    dataset.ts             FC26 normalization and country/player selectors
    matchEngine.ts         Match simulation math
    setPieces.ts           Penalty/free-kick taker scoring helpers
    tournament.ts          Group and knockout orchestration
  styles.css               Responsive minimalist UI
  types.ts                 Shared domain types
docs/
  ARCHITECTURE.md          Stack, algorithm and project structure notes
  DEPLOYMENT.md            GitHub Pages + Render/Koyeb deployment guide
  ONLINE_TEST_SCENARIO.md  Manual and automated online test plan
  MATCH_ENGINE_REFERENCE.md Match engine design reference
FC26_20250921.csv          Player dataset imported as a Vite asset
render.yaml                Render web service blueprint
Procfile                   Node process declaration for Koyeb/buildpacks
```
