import type { ContributionGrid } from "./fetch.js";
import { ANIM_FRAME_MS } from "./constants.js";

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

  const rng = mulberry32(config.seed ?? 42);

  // Fisher-Yates shuffle for random reveal
  for (let i = contributionIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [contributionIndices[i], contributionIndices[j]] = [contributionIndices[j], contributionIndices[i]];
  }

  const frames: FrameState[] = [];

  // Phase 1: Reveal randomly within 2 seconds
  const targetRevealDurationMs = 2000;
  const revealFrames = Math.max(1, Math.floor(targetRevealDurationMs / ANIM_FRAME_MS));

  for (let f = 0; f < revealFrames; f++) {
    const alive = new Uint8Array(total);
    const age = new Uint16Array(total);
    const births: [number, number][] = [];
    const deaths: [number, number][] = [];

    const progress = revealFrames === 1 ? 1 : (f + 1) / revealFrames;
    const visibleCount = Math.floor(progress * contributionIndices.length);

    for (let i = 0; i < visibleCount; i++) {
      const idx = contributionIndices[i];
      alive[idx] = 1;
      age[idx] = Math.min(7, f + 1);
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      births.push([r, c]);
    }

    frames.push({ alive, births, deaths, age });
  }

  // Hold the final filled state for 2 seconds before Game of Life
  const holdWaitDurationMs = 2000;
  const holdWaitFrames = Math.floor(holdWaitDurationMs / ANIM_FRAME_MS);
  const filledAlive = frames[frames.length - 1].alive;
  const filledAge = frames[frames.length - 1].age;

  for (let w = 0; w < holdWaitFrames; w++) {
    frames.push({
      alive: new Uint8Array(filledAlive),
      births: [],
      deaths: [],
      age: new Uint16Array(filledAge),
    });
  }

  // Phase 2: Game of Life for max 30 seconds
  const maxGolDurationMs = 30000;
  const maxGolFrames = Math.floor(maxGolDurationMs / ANIM_FRAME_MS);
  
  let currentAlive = frames[frames.length - 1].alive.slice();
  let currentAge = frames[frames.length - 1].age.slice();

  for (let f = 0; f < maxGolFrames; f++) {
    const nextAlive = new Uint8Array(total);
    const nextAge = new Uint16Array(total);
    const births: [number, number][] = [];
    const deaths: [number, number][] = [];
    let anyAlive = false;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (inert[idx]) continue;

        const n = neighborCount(currentAlive, rows, cols, r, c);
        const isAlive = currentAlive[idx] === 1;

        if (isAlive) {
          if (n === 2 || n === 3) {
            nextAlive[idx] = 1;
            nextAge[idx] = Math.min(7, currentAge[idx] + 1);
            anyAlive = true;
          } else {
            deaths.push([r, c]);
          }
        } else {
          if (n === 3) {
            nextAlive[idx] = 1;
            nextAge[idx] = 1;
            births.push([r, c]);
            anyAlive = true;
          }
        }
      }
    }

    frames.push({ alive: nextAlive, births, deaths, age: nextAge });

    // Check if pattern stagnated (no change from previous frame)
    let patternChanged = false;
    for (let i = 0; i < total; i++) {
      if (nextAlive[i] !== currentAlive[i]) {
        patternChanged = true;
        break;
      }
    }

    currentAlive = nextAlive;
    currentAge = nextAge;

    if (!anyAlive || !patternChanged) {
      break;
    }
  }

  return {
    rows,
    cols,
    inert,
    weight,
    frames,
  };
}


