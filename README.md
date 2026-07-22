# Jank Pool

A browser-based, two-player 8-ball pool game backed by a custom rigid-body
physics engine written in C. The simulation runs entirely on the server: every
shot is computed step-by-step, rendered to a sequence of SVG frames, and
animated in the browser. Game state is persisted to SQLite so each shot is
reconstructed from the database.

## Architecture

The project is built in layers, from a low-level C physics core up to a web
front end:

| Layer | Files | Responsibility |
|-------|-------|----------------|
| **Physics core (C)** | `phylib.c`, `phylib.h` | Rigid-body simulation: ball rolling, drag, rail bounces, and ball-to-ball collisions, integrated in small time steps. |
| **Python bindings** | `phylib.i` → `phylib.py`, `_phylib.so` | SWIG wraps the C library so it can be driven from Python. |
| **Game & rendering layer** | `Physics.py` | Object-oriented wrappers (`Ball`, `Table`, `Hole`, `Cushion`), SVG rendering of each frame, the SQLite `Database` layer, and the `Game` rules engine. |
| **HTTP server** | `server.py` | A `http.server`-based server that serves the front end, accepts shots, runs the simulation, and returns the animation frames. |
| **Front end** | `game_setup.html`, `pool_table.html`, `poolActions.js`, `*.css` | Setup screen, table view, aiming guide, and shot playback. |

### How a shot works

1. The player aims and clicks; `poolActions.js` POSTs the cue-ball velocity
   (`velX`, `velY`) and game ID to `/shoot`.
2. `server.py` loads the current table from SQLite and calls
   `Game.shoot()`, which steps the C physics engine forward, saving each
   intermediate table state.
3. Every saved state is rendered to an SVG string; the frames are joined with a
   `<!---->` delimiter and returned to the browser.
4. `poolActions.js` splits the frames and plays them back with
   `requestAnimationFrame` for smooth animation, then wires up the final frame
   for the next shot.

### Physics highlights

The C engine (see constants in `phylib.h`) models more than a simple straight
line:

- Combined **rolling resistance** — a constant term plus a speed-proportional
  term — for realistic deceleration.
- **Cushion restitution** with separate normal and tangential damping so rail
  bounces lose energy realistically.
- **Ball-to-ball restitution** for elastic collisions.
- Balls are only pocketed once fully over a hole.

## Gameplay

- Enter two **distinct** player names and a game name on the setup screen.
  Blank fields fall back to defaults; identical names are rejected.
- The starting player is chosen at random.
- Players are **not** assigned a suit (stripes/solids) at the start. The first
  time a player pots a ball they are assigned to whichever team has fewer balls
  remaining; on a tie they are assigned stripes.
- **Winning:** pot all of your balls and then the 8-ball, or win automatically
  if your opponent sinks the 8-ball before clearing their own.
- **Fouls:** scratching (potting the cue ball) or a **complete miss** — a shot
  where the cue ball contacts no object ball at all — passes the turn and hands
  the incoming player *ball-in-hand*: they place the cue ball anywhere open on
  the felt before shooting.
- The aiming guide shows the projected trajectory, cushion bounces, a ghost ball
  at the contact point, and the object ball's deflection line.
- A back button in the top-right HUD starts a new game.

### Edge cases

- A player does **not** win if they sink their last ball and the 8-ball on the
  same shot.
- A player **loses** if they pot the cue ball (scratch) on the same shot as the
  8-ball, even if they had already cleared their own side.

## Persistence

Game state lives in a SQLite database (`phylib.db`) with tables for balls,
table snapshots, shots, games, and players. Each shot is stored as a chain of
table states, so any shot can be replayed or reconstructed from the database.

## Requirements

- **SWIG** — generates the Python bindings from `phylib.i`
- **Clang** — compiles the C physics library
- **Python 3** with development headers (`python3-config`)

## Build & Run

```sh
# 1. Compile the C library and build the Python bindings
make

# 2. Make the shared library loadable
export LD_LIBRARY_PATH=`pwd`

# 3. Start the server on a port of your choice
python3 server.py 58467
```

Then open the link printed in the terminal
(`http://localhost:58467/game_setup.html`), or ctrl + left-click it.

Run `make clean` to remove generated objects, shared libraries, the database,
and SVG/build artifacts.

## Project layout

```
phylib.c / phylib.h   C rigid-body physics engine
phylib.i              SWIG interface definition
Physics.py            Python game logic, SVG rendering, SQLite layer
server.py             HTTP server and request routing
game_setup.html       Player/game setup screen
pool_table.html       Table view and HUD
poolActions.js        Aiming guide and shot animation
*.css                 Styling for setup and table screens
makefile              Build rules (SWIG + Clang)
```

---

*Originally created by Alex Daniel.*
