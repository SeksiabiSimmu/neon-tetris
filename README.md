# Neon Tetris

A desktop and browser Tetris game with six modes, reactive 3D worlds, synthesized audio, progression, and unlockable visual customization. The 3D presentation has a Canvas fallback when WebGL is unavailable.

![Neon Tetris icon](assets/icon.png)

## Play on Windows

Download `NeonTetris-1.0.0-win-x64.exe` from the [latest GitHub release](https://github.com/SeksiabiSimmu/neon-tetris/releases/latest) and run it. This is a portable Windows x64 application; it does not need an installer. Progress and settings are saved for the current Windows user. An unsigned build may show a Windows reputation prompt.

## Run from source

Install Node.js 22.12 or newer and pnpm, then run:

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. To create a production browser build, run `pnpm build`. To run that build in Electron, run `pnpm desktop`. On Windows, `pnpm build:win` creates the portable executable in `release/`.

## Controls

| Action | Default keys |
| --- | --- |
| Move | Left / Right |
| Soft drop | Down |
| Hard drop | Space |
| Rotate clockwise | Up / X |
| Rotate counterclockwise | Z / Ctrl |
| Hold | C / Shift |
| Pause or return from a menu | Esc |
| Restart | R |

Keys can be rebound in Settings. The game also offers colorblind-friendly colors, reduced motion, and adjustable glow, screen shake, and particle intensity. Settings has a separate progression reset; mode records and key bindings remain saved.

## Modes

- **Endless** climbs from the surface toward space as levels increase.
- **Sprint** races to a chosen line target.
- **Marathon** caps the gravity speed at a chosen level.
- **Time Attack** scores against a countdown.
- **Zen** clears the board on top-out so play can continue.
- **Challenge** offers fixed objectives.

## Quality checks

`pnpm test` runs gameplay, progression, settings, rendering, and entry-point checks. `pnpm build` verifies the browser bundle.
