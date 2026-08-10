import type { ContributionGrid } from "./fetch.js";

export type CellStage = 0 | 1 | 2 | 3 | 4 | 5;
// 0 = empty/inert (no real contribution, permanently unavailable)
// 1 = flicker (just born)
// 2 = heavy glitch
// 3 = lock-in flash
// 4 = bright assimilated
// 5 = settled/dim assimilated

export interface FrameState {
  alive: Uint8Array; // flattened ROWS*COLS, 1 = alive this tick
  births: [number, number][];
  deaths: [number, number][];
  age: Uint16Array;
}

export interface SimConfig {
  seed?: number;
  maxTicks?: number;
  targetFrameCount: number; // exact frame count to hit the desired duration
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildInertMask(grid: ContributionGrid): {
  rows: number;
  cols: number;
  inert: Uint8Array; // 1 = permanently dead (no real contribution that day)
  weight: Float32Array; // 0..1 normalized contribution intensity, used for seeding + visuals
} {
  const cols = grid.weeks.length;
  const rows = 7;

  // Pre-fill everything as inert (dead). We only clear cells that have an
  // actual API entry, so partial first/last weeks and future dates stay dead.
  const inert = new Uint8Array(rows * cols).fill(1);
  const weight = new Float32Array(rows * cols);

  for (let c = 0; c < cols; c++) {
    const week = grid.weeks[c];
    for (const day of week) {
      // Use the explicit weekday field (0=Sun … 6=Sat) — NOT the positional
      // index — so partial weeks and any API ordering are handled correctly.
      const r = day.weekday;
      const idx = r * cols + c;
      if (day.count === 0) {
        // Day is present but has no contributions → stay inert
        inert[idx] = 1;
        weight[idx] = 0;
      } else {
        inert[idx] = 0;
        weight[idx] = grid.maxCount > 0 ? Math.min(1, day.count / grid.maxCount) : 0.5;
      }
    }
  }

  return { rows, cols, inert, weight };
}

function neighborCount(alive: Uint8Array, rows: number, cols: number, r: number, c: number): number {
  let n = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        n += alive[nr * cols + nc];
      }
    }
  }
  return n;
}

export function runSimulation(
  grid: ContributionGrid,
  config: SimConfig,
): {
  rows: number;
  cols: number;
  inert: Uint8Array;
  weight: Float32Array;
  frames: FrameState[];
} {
  const { rows, cols, inert, weight } = buildInertMask(grid);

  const total = rows * cols;

  // Only real GitHub contribution cells are allowed to become alive.
  const contributionIndices: number[] = [];

  for (let i = 0; i < total; i++) {
    if (!inert[i]) {
      contributionIndices.push(i);
    }
  }

  /*
   * IMPORTANT:
   *
   * Do NOT randomly remove contribution cells.
   * Do NOT run Game of Life on the source grid.
   *
   * The GitHub contribution grid is the source of truth.
   */

  const targetFrames = config.targetFrameCount;
  const frames: FrameState[] = [];

  // Deterministic ordering.
  //
  // We reveal cells from left -> right and top -> bottom.
  // You can change this later to create a more interesting animation.
  contributionIndices.sort((a, b) => {
    const ar = Math.floor(a / cols);
    const ac = a % cols;

    const br = Math.floor(b / cols);
    const bc = b % cols;

    if (ac !== bc) return ac - bc;
    return ar - br;
  });

  /*
   * Phase 1:
   * Gradually reveal the actual GitHub contribution cells.
   *
   * About 60% of the animation is used for the reveal.
   */
  const revealFrames = Math.max(
    1,
    Math.floor(targetFrames * 0.65),
  );

  for (let f = 0; f < revealFrames; f++) {
    const alive = new Uint8Array(total);
    const age = new Uint16Array(total);

    const births: [number, number][] = [];
    const deaths: [number, number][] = [];

    const progress =
      revealFrames === 1
        ? 1
        : (f + 1) / revealFrames;

    const visibleCount = Math.floor(
      progress * contributionIndices.length,
    );

    for (let i = 0; i < visibleCount; i++) {
      const idx = contributionIndices[i];

      alive[idx] = 1;
      age[idx] = Math.min(7, f + 1);

      const r = Math.floor(idx / cols);
      const c = idx % cols;

      births.push([r, c]);
    }

    frames.push({
      alive,
      births,
      deaths,
      age,
    });
  }

  /*
   * Phase 2:
   * Hold the EXACT GitHub contribution pattern.
   *
   * This is the important part:
   *
   * Every non-zero GitHub contribution cell is alive.
   * Every zero-contribution cell remains inert.
   */
  const finalAlive = new Uint8Array(total);
  const finalAge = new Uint16Array(total);

  for (const idx of contributionIndices) {
    finalAlive[idx] = 1;
    finalAge[idx] = 7;
  }

  const holdFrames = targetFrames - frames.length;

  for (let f = 0; f < holdFrames; f++) {
    frames.push({
      alive: new Uint8Array(finalAlive),
      births: [],
      deaths: [],
      age: new Uint16Array(finalAge),
    });
  }

  /*
   * Safety:
   * Guarantee EXACTLY targetFrameCount frames.
   */
  while (frames.length < targetFrames) {
    frames.push({
      alive: new Uint8Array(finalAlive),
      births: [],
      deaths: [],
      age: new Uint16Array(finalAge),
    });
  }

  if (frames.length > targetFrames) {
    frames.length = targetFrames;
  }

  return {
    rows,
    cols,
    inert,
    weight,
    frames,
  };
}


