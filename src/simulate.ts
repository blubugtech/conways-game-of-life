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
  const inert = new Uint8Array(rows * cols);
  const weight = new Float32Array(rows * cols);

  for (let c = 0; c < cols; c++) {
    const week = grid.weeks[c];
    for (let r = 0; r < rows; r++) {
      const day = week[r];
      const idx = r * cols + c;
      if (!day || day.count === 0) {
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
): { rows: number; cols: number; inert: Uint8Array; weight: Float32Array; frames: FrameState[] } {
  const { rows, cols, inert, weight } = buildInertMask(grid);
  const rand = mulberry32(config.seed ?? 42);
  const total = rows * cols;

  let alive = new Uint8Array(total);
  let age = new Uint16Array(total);

  // seed: live cells only on days that actually have contributions,
  // weighted so higher-activity days are more likely to be patient zero
  for (let i = 0; i < total; i++) {
    if (inert[i]) continue;
    const p = 0.22 + weight[i] * 0.25; // busier days seed more readily
    if (rand() < p) alive[i] = 1;
  }

  const frames: FrameState[] = [];
  const maxTicks = config.maxTicks ?? config.targetFrameCount;
  const history: Uint8Array[] = [];

  for (let tick = 0; tick < maxTicks; tick++) {
    const next = new Uint8Array(total);
    const nextAge = new Uint16Array(total);
    const births: [number, number][] = [];
    const deaths: [number, number][] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (inert[idx]) continue; // never comes alive - permanent background

        const n = neighborCount(alive, rows, cols, r, c);
        const isAlive = alive[idx] === 1;

        if (isAlive) {
          // relaxed survival: 2-4 neighbors (instead of strict 2-3) so sparse,
          // fragmented contribution grids can still sustain live colonies
          if (n >= 2 && n <= 4) {
            next[idx] = 1;
            nextAge[idx] = age[idx] + 1;
          } else {
            deaths.push([r, c]);
          }
        } else {
          // relaxed birth: 3 neighbors as classic Life, but also allow 2
          // neighbors to spark to life with a probability boosted by the
          // cell's own contribution weight (busier days "catch" more easily)
          if (n === 3 || (n === 2 && rand() < 0.15 + weight[idx] * 0.25)) {
            next[idx] = 1;
            nextAge[idx] = 1;
            births.push([r, c]);
          }
        }
      }
    }

    frames.push({ alive: next, births, deaths, age: nextAge });
    alive = next;
    age = nextAge;

    // Loop detection: check if current state matches any of the last 8 states
    let isLoop = false;
    for (let h = history.length - 1; h >= Math.max(0, history.length - 8); h--) {
      let match = true;
      for (let i = 0; i < total; i++) {
        if (history[h][i] !== next[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        isLoop = true;
        break;
      }
    }
    
    if (isLoop) {
      break;
    }
    history.push(next);
  }

  return { rows, cols, inert, weight, frames };
}


