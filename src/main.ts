import { fetchContributionGrid } from "./fetch.js";
import { runSimulation } from "./simulate.js";
import { renderSVG } from "./render-svg.js";
import { renderGIF } from "./render-gif.js";
import { ANIM_FRAME_COUNT, DARK_PALETTE, LIGHT_PALETTE } from "./constants.js";
import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  const userName = process.env.GITHUB_USER_NAME || process.argv[2];
  const token = process.env.GITHUB_TOKEN;
  const outDir = process.env.OUT_DIR || "dist";

  if (!userName) {
    throw new Error("Provide a GitHub username: GITHUB_USER_NAME env var or first CLI arg.");
  }
  if (!token) {
    throw new Error("Provide GITHUB_TOKEN env var (a token with no scopes works, contributions are public).");
  }

  console.log(`Fetching contribution graph for ${userName}...`);
  const grid = await fetchContributionGrid(userName, token);

  console.log("Running Game of Life AI-virus simulation...");
  const sim = runSimulation(grid, {
    seed: 42,
    maxTicks: 500,
    targetFrameCount: ANIM_FRAME_COUNT,
  });

  await fs.mkdir(outDir, { recursive: true });

  console.log("Rendering SVG (dark)...");
  const svgDark = renderSVG(sim.rows, sim.cols, sim.inert, sim.frames, DARK_PALETTE);
  console.log("Writing singularity-grid-dark.svg...");
  await fs.writeFile(path.join(outDir, "singularity-grid-dark.svg"), svgDark);

  console.log("Rendering SVG (light)...");
  const svgLight = renderSVG(sim.rows, sim.cols, sim.inert, sim.frames, LIGHT_PALETTE);
  console.log("Writing singularity-grid-light.svg...");
  await fs.writeFile(path.join(outDir, "singularity-grid-light.svg"), svgLight);

  console.log("Writing singularity-grid-dark.gif...");
  await renderGIF(sim.rows, sim.cols, sim.inert, sim.frames, DARK_PALETTE, path.join(outDir, "singularity-grid-dark.gif"));

  console.log("Writing singularity-grid-light.gif...");
  await renderGIF(sim.rows, sim.cols, sim.inert, sim.frames, LIGHT_PALETTE, path.join(outDir, "singularity-grid-light.gif"));

  console.log(`Done. Output written to ${outDir}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
