import type { FrameState } from "./simulate.js";
import { ANIM_FRAME_MS, HOLD_MS, CELL, GAP, PAD, TITLE_H, type Palette } from "./constants.js";

// For each non-inert cell, build a compact timeline of "stage at each frame"
// then collapse consecutive identical stages into keyframe percentages,
// so the SVG animation is small even though the simulation has 150 ticks.

type Stage = 0 | 1 | 2 | 3 | 4 | 5;

function buildCellTimelines(
  frames: FrameState[],
  rows: number,
  cols: number,
  inert: Uint8Array,
): Map<number, Stage[]> {
  const total = rows * cols;
  const timelines = new Map<number, Stage[]>();

  for (let idx = 0; idx < total; idx++) {
    if (inert[idx]) continue;
    const stages: Stage[] = [];
    let ageAtStage = 0;
    for (const f of frames) {
      const isBirth = f.births.some(([r, c]) => r * cols + c === idx);
      const isDeath = f.deaths.some(([r, c]) => r * cols + c === idx);
      const isAlive = f.alive[idx] === 1;

      let stage: Stage;
      if (isDeath) stage = 0; // render as fading to inert-black for a beat, handled via death color keyframe instead
      else if (isBirth) stage = 1;
      else if (isAlive) {
        const a = f.age[idx];
        stage = a > 6 ? 5 : 4;
      } else {
        stage = 0;
      }
      stages.push(stage);
    }
    timelines.set(idx, stages);
  }

  return timelines;
}

function stageColor(stage: Stage, isDeathFrame: boolean, isBirthFrame: boolean, p: Palette): string {
  if (isDeathFrame) return p.death;
  if (isBirthFrame) return p.birth;
  switch (stage) {
    case 0:
      return p.inert;
    case 4:
      return p.aliveBright;
    case 5:
      return p.aliveDim;
    default:
      return p.inert;
  }
}

function buildKeyframeAnimation(
  cellId: string,
  frames: FrameState[],
  idx: number,
  cols: number,
  p: Palette,
): string {
  // Build a <animate> for fill, using values + keyTimes sampled at each animated frame,
  // then hold the final color for the HOLD_MS tail.
  const values: string[] = [];
  const keyTimes: string[] = [];

  const n = frames.length;
  for (let i = 0; i < n; i++) {
    const f = frames[i];
    const isBirth = f.births.some(([r, c]) => r * cols + c === idx);
    const isDeath = f.deaths.some(([r, c]) => r * cols + c === idx);
    const isAlive = f.alive[idx] === 1;
    const age = f.age[idx];
    const stage: Stage = isAlive ? (age > 6 ? 5 : 4) : 0;

    const color = stageColor(stage, isDeath, isBirth, p);
    values.push(color);
    keyTimes.push((i / (n - 1)).toFixed(4));
  }

  // append a duplicate final value so the hold period keeps the last color
  values.push(values[values.length - 1]);
  keyTimes.push("1");

  const TOTAL_MS = n * ANIM_FRAME_MS + HOLD_MS;
  const animDur = (TOTAL_MS / 1000).toFixed(3);
  // scale keyTimes to account for hold: animated portion occupies (ANIM portion) of total
  const animPortion = (n * ANIM_FRAME_MS) / TOTAL_MS;
  const scaledKeyTimes = keyTimes.map((t, i) =>
    i === keyTimes.length - 1 ? "1" : (parseFloat(t) * animPortion).toFixed(4),
  );

  return `<animate xlink:href="#${cellId}" attributeName="fill" values="${values.join(";")}" keyTimes="${scaledKeyTimes.join(";")}" dur="${animDur}s" repeatCount="indefinite" calcMode="discrete" />`;
}

export function renderSVG(
  rows: number,
  cols: number,
  inert: Uint8Array,
  frames: FrameState[],
  palette: Palette,
): string {
  const width = cols * (CELL + GAP) - GAP + PAD * 2;
  const height = rows * (CELL + GAP) - GAP + PAD * 2 + TITLE_H;

  const rects: string[] = [];
  const animations: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const x = PAD + c * (CELL + GAP);
      const y = PAD + TITLE_H + r * (CELL + GAP);
      const cellId = `c${r}_${c}`;

      if (inert[idx]) {
        rects.push(
          `<rect id="${cellId}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${palette.inert}" />`,
        );
        continue;
      }

      rects.push(
        `<rect id="${cellId}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${palette.inert}" />`,
      );
      animations.push(buildKeyframeAnimation(cellId, frames, idx, cols, palette));
    }
  }

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<rect x="0" y="0" width="${width}" height="${height}" fill="${palette.bg}" />
<text x="${width / 2}" y="${PAD + 12}" text-anchor="middle" font-family="monospace, 'Courier New', Courier" font-size="16" fill="${palette.aliveBright}" font-weight="bold" letter-spacing="2">SINGULARITY GRID</text>
${rects.join("\n")}
${animations.join("\n")}
</svg>`;
}
