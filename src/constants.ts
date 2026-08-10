export const ANIM_FRAME_MS = 180; // ms per animated frame
export const HOLD_MS = 1500; // hold on final frame
export const CELL = 11;
export const GAP = 3;
export const PAD = 14;
export const TITLE_H = 30;

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
  bg: "#0d1117", // standard github dark mode background
  inert: "#161b22", // standard github empty cell
  scanline: "#0d1117",
  aliveBright: "#39d353", // vibrant github green
  aliveDim: "#39d353", // same as bright for solid color
  birth: "#39d353", // same as alive
  death: "#161b22", // same as inert
  glowAlive: "#39d353",
  glowBirth: "#39d353",
  glowDeath: "#161b22",
};

export const LIGHT_PALETTE: Palette = {
  bg: "#f6f8f6",
  inert: "#e8ede8",
  scanline: "#eef2ee",
  aliveBright: "#1a8a44",
  aliveDim: "#1a8a44", // same as bright for solid color
  birth: "#1a8a44", // same as alive
  death: "#e8ede8", // same as inert
  glowAlive: "#1a8a44",
  glowBirth: "#1a8a44",
  glowDeath: "#e8ede8",
};
