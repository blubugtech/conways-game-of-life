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
): { rows: number; cols: number; inert: Uint8Array; weight: Float32Array; frames: FrameState[] } {
  const { rows, cols, inert, weight } = buildInertMask(grid);
  const rand = mulberry32(config.seed ?? 42);
  const total = rows * cols;

  // First, figure out which cells should eventually be alive at tick 0
  const initialAliveIndices: number[] = [];
  for (let i = 0; i < total; i++) {
    if (inert[i]) continue;
    const p = 0.22 + weight[i] * 0.25;
    if (rand() < p) {
      initialAliveIndices.push(i);
    }
  }

  const frames: FrameState[] = [];
  
  // 1. INTRO ANIMATION (20 frames)
  // We gradually spawn the initialAlive cells in random batches
  const introFrames = 20;
  // Shuffle the initial alive indices for organic spawning
  for (let i = initialAliveIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [initialAliveIndices[i], initialAliveIndices[j]] = [initialAliveIndices[j], initialAliveIndices[i]];
  }
  
  let currentIntroAlive = new Uint8Array(total);
  let currentIntroAge = new Uint16Array(total);
  
  for (let f = 0; f < introFrames; f++) {
    const nextIntroAlive = new Uint8Array(currentIntroAlive);
    const nextIntroAge = new Uint16Array(currentIntroAge);
    const births: [number, number][] = [];
    
    // Calculate how many cells should be spawned by this frame
    const targetSpawned = Math.floor(((f + 1) / introFrames) * initialAliveIndices.length);
    let currentSpawned = 0;
    
    // Turn on the required number of cells from our shuffled list
    for (let i = 0; i < targetSpawned; i++) {
      const idx = initialAliveIndices[i];
      if (nextIntroAlive[idx] === 0) {
        nextIntroAlive[idx] = 1;
        nextIntroAge[idx] = 1;
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        births.push([r, c]);
      }
    }
    
    frames.push({ alive: nextIntroAlive, births, deaths: [], age: nextIntroAge });
    currentIntroAlive = nextIntroAlive;
    currentIntroAge = nextIntroAge;
  }
  
  // Setup the starting state for the actual simulation
  let alive = currentIntroAlive;
  let age = currentIntroAge;

  // Add a 2-second pause (20 frames) before the game begins
  for (let f = 0; f < 20; f++) {
    frames.push({ alive: new Uint8Array(alive), births: [], deaths: [], age: new Uint16Array(age) });
  }

  const maxTicks = config.maxTicks ?? 1000; // Emergency ceiling of 1000 frames
  const history: Uint8Array[] = [];
  let paddingTicksLeft = -1; // -1 means we haven't detected a loop yet

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

    // Loop detection & Padding
    if (paddingTicksLeft > 0) {
      paddingTicksLeft--;
      if (paddingTicksLeft === 0) {
        break; // End after playing the loop for 5 seconds
      }
    } else if (paddingTicksLeft === -1) {
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
        // Hold the stable loop for exactly 50 ticks (5 seconds at 10fps) before ending the GIF
        paddingTicksLeft = 50; 
      } else {
        history.push(next);
      }
    }
  }

  return { rows, cols, inert, weight, frames };
}


