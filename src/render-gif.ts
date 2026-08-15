import sharp from "sharp";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc as unknown as {
  GIFEncoder: typeof import("gifenc").GIFEncoder;
  quantize: typeof import("gifenc").quantize;
  applyPalette: typeof import("gifenc").applyPalette;
};
import type { FrameState } from "./simulate.js";
import { ANIM_FRAME_MS, HOLD_MS, CELL, GAP, PAD, TITLE_H, type Palette } from "./constants.js";

function cellXY(r: number, c: number): [number, number] {
  return [PAD + c * (CELL + GAP), PAD + TITLE_H + r * (CELL + GAP)];
}

function frameSVG(
  rows: number,
  cols: number,
  inert: Uint8Array,
  frame: FrameState,
  palette: Palette,
  width: number,
  height: number,
  population: number,
  cumulativeDeaths: number,
): string {
  const births = new Set(frame.births.map(([r, c]) => r * cols + c));
  const deaths = new Set(frame.deaths.map(([r, c]) => r * cols + c));

  const rects: string[] = [];
  const glows: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const [x, y] = cellXY(r, c);

      if (inert[idx]) {
        rects.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${palette.inert}" />`);
        continue;
      }

      let fill = palette.inert;
      let glow: string | null = null;

      if (deaths.has(idx)) {
        fill = palette.death;
        glow = palette.glowDeath;
      } else if (births.has(idx)) {
        fill = palette.birth;
        glow = palette.glowBirth;
      } else if (frame.alive[idx] === 1) {
        const age = frame.age[idx];
        fill = age > 6 ? palette.aliveDim : palette.aliveBright;
        if (age <= 6) glow = palette.glowAlive;
      }

      rects.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}" />`);
      if (glow) {
        glows.push(
          `<rect x="${x - 1.5}" y="${y - 1.5}" width="${CELL + 3}" height="${CELL + 3}" rx="3" fill="${glow}" opacity="0.55" filter="url(#blur)" />`,
        );
      }
    }
  }

  const textY = height - PAD + 5;
  const textStr = `POPULATION: ${population.toString().padStart(4, '0')} | ERADICATED: ${cumulativeDeaths.toString().padStart(4, '0')}`;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<defs><filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>
<rect x="0" y="0" width="${width}" height="${height}" fill="${palette.bg}" />
<text x="${width / 2}" y="${PAD + 12}" text-anchor="middle" font-family="monospace, 'Courier New', Courier" font-size="16" fill="${palette.aliveBright}" font-weight="bold" letter-spacing="2">CONWAY'S GAME OF LIFE</text>
${glows.join("\n")}
${rects.join("\n")}
<text x="${PAD}" y="${textY}" font-family="monospace, 'Courier New', Courier" font-size="11" fill="${palette.aliveBright}" font-weight="bold" letter-spacing="1">${textStr}</text>
</svg>`;
}

export async function renderGIF(
  rows: number,
  cols: number,
  inert: Uint8Array,
  frames: FrameState[],
  palette: Palette,
  outPath: string,
  scale = 2,
): Promise<void> {
  const width = cols * (CELL + GAP) - GAP + PAD * 2;
  const height = rows * (CELL + GAP) - GAP + PAD * 2 + TITLE_H + 20; // Extra 20px for text
  const outW = width * scale;
  const outH = height * scale;

  const gif = GIFEncoder();

  let cumulativeDeaths = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const population = f.alive.reduce((a, b) => a + b, 0);
    cumulativeDeaths += f.deaths.length;

    const svg = frameSVG(rows, cols, inert, f, palette, width, height, population, cumulativeDeaths);
    const { data, info } = await sharp(Buffer.from(svg))
      .resize(outW, outH)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgba = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
    const palette256 = quantize(rgba, 256);
    const index = applyPalette(rgba, palette256);

    const isLast = i === frames.length - 1;
    const delay = isLast ? ANIM_FRAME_MS + HOLD_MS : ANIM_FRAME_MS;

    gif.writeFrame(index, info.width, info.height, {
      palette: palette256,
      delay,
      dispose: -1,
    });
  }

  gif.finish();
  const bytes = gif.bytesView();

  const fs = await import("node:fs/promises");
  await fs.writeFile(outPath, Buffer.from(bytes));
}
