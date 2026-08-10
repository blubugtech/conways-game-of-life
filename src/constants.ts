export const ANIM_FRAME_COUNT = 150; // animated frames
export const ANIM_FRAME_MS = 90; // ms per animated frame
export const HOLD_MS = 1500; // hold on final frame
export const TOTAL_MS = ANIM_FRAME_COUNT * ANIM_FRAME_MS + HOLD_MS; // = 15000ms exactly

export const CELL = 11;
export const GAP = 3;
export const PAD = 14;

export interface Palette {
  bg: string;
  inert: string;
  scanline: string;
  aliveBright: string;
  aliveDim: string;
  birth: string;
  death: string;
  glowAlive: string;
  glowBirth: string;
  glowDeath: string;
}

export const DARK_PALETTE: Palette = {
  bg: "#050805",
  inert: "#0c100c",
  scanline: "#070b07",
  aliveBright: "#37d269",
  aliveDim: "#18502e",
  birth: "#d7ffc8",
  death: "#dc463c",
  glowAlive: "#3cd26e",
  glowBirth: "#dcffd2",
  glowDeath: "#d2463c",
};

export const LIGHT_PALETTE: Palette = {
  bg: "#f6f8f6",
  inert: "#e8ede8",
  scanline: "#eef2ee",
  aliveBright: "#1a8a44",
  aliveDim: "#a8d9b8",
  birth: "#0d5c26",
  death: "#c23b30",
  glowAlive: "#1a8a44",
  glowBirth: "#0d5c26",
  glowDeath: "#c23b30",
};
