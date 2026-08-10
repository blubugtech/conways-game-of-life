# singularity-grid

**singularity-grid** turns your GitHub contribution graph into a 15-second animated takeover, styled as an AI/machine intelligence spreading across your commit history. Days you didn't code stay permanently dark — inert territory the simulation can't touch — while days you did commit become living cells in a tuned variant of Conway's Game of Life: a cellular automaton where each cell's fate depends on its neighbors, so instead of one snake eating the grid in a straight line (like the original `Platane/snk` project this was inspired by), colonies of "infected" cells organically spawn, spread, pulse, stabilize, and sometimes die back before flaring up again elsewhere — giving it a genuinely alive, unpredictable texture rather than a scripted crawl. It renders in both dark and light palettes, as both SVG (crisp, native-animated, ideal for embedding) and GIF (universally viewable), and ships as a GitHub Action that can run on a schedule, pull your real contribution data via GitHub's API, and automatically regenerate the animation for your profile README — exactly like the snake-game project it riffs on, just reskinned as a hostile AI colonizing your commit calendar instead.

## How it works

1. `src/fetch.ts` — pulls your real contribution calendar via GitHub's GraphQL API
   (`contributionsCollection.contributionCalendar`), giving a 7-row x ~53-column grid of
   daily contribution counts.
2. `src/simulate.ts` — runs a relaxed Conway's Game of Life variant on that grid:
   - Cells with **zero** contributions are permanently inert (never come alive) — they're
     the dark backdrop / negative space.
   - Cells with contributions can become alive. Higher-activity days seed more readily
     and catch more easily from neighbors.
   - Survival/birth rules are relaxed slightly from classic B3/S23 so that the naturally
     sparse, holey shape of a real contribution graph can still sustain a living,
     churning population instead of dying out immediately.
   - When the population crashes or goes stagnant (a boring stand-off), a small burst of
     new "exploit" cells is injected elsewhere (still only on real-contribution days) to
     keep the animation alive for the full 15 seconds.
   - Every cell has a visible lifecycle: birth flash -> bright active -> settled dim ->
     death flash (if it dies).
3. `src/render-svg.ts` / `src/render-gif.ts` — render the simulated frames as SVG
   (native per-cell `<animate>`, no rasterization) or GIF (rasterized via `sharp`,
   encoded via `gifenc`).

## Usage

### Locally

```bash
npm install
GITHUB_USER_NAME=yourusername GITHUB_TOKEN=ghp_xxx npm run build
```

Outputs land in `dist/`:
- `singularity-grid-dark.svg`, `singularity-grid-light.svg`
- `singularity-grid-dark.gif`, `singularity-grid-light.gif`

`GITHUB_TOKEN` needs **no scopes at all** — contribution data is public. Generate one at
https://github.com/settings/tokens (classic token, no checkboxes needed) or a
fine-grained token with no permissions.

### As a GitHub Action (automated, like Platane/snk)

The included `.github/workflows/generate.yml` runs daily, regenerates the animation for
`github.repository_owner`, and pushes the output files to an `output` branch — same
pattern as the original `snk` project. Enable it by pushing this repo to GitHub; it uses
the automatically-provided `secrets.GITHUB_TOKEN`, no setup needed.

Once generated, embed in your profile README with dark-mode support:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/<you>/<repo>/output/singularity-grid-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/<you>/<repo>/output/singularity-grid-light.svg" />
  <img alt="singularity-grid" src="https://raw.githubusercontent.com/<you>/<repo>/output/singularity-grid-light.svg" />
</picture>
```

## Tuning

All timing/color config lives in `src/constants.ts`:
- `ANIM_FRAME_COUNT`, `ANIM_FRAME_MS`, `HOLD_MS` control total duration (currently locked to 15s)
- `DARK_PALETTE` / `LIGHT_PALETTE` control colors
- `CELL`, `GAP`, `PAD` control grid sizing

Simulation behavior (seed density, survival/birth thresholds, reinjection aggressiveness)
lives in `src/simulate.ts` — see inline comments.

## Testing without a token

`src/test-local.ts` generates a synthetic-but-realistic contribution grid (weekday bias,
a vacation gap, an intense streak) so you can iterate on the simulation and renderers
without hitting the GitHub API:

```bash
npx tsx src/test-local.ts
```
