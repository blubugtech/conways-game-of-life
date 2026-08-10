import * as core from "@actions/core";
import { fetchContributionGrid } from "./fetch.js";
import { runSimulation } from "./simulate.js";
import { renderSVG } from "./render-svg.js";
import { renderGIF } from "./render-gif.js";
import { ANIM_FRAME_COUNT, DARK_PALETTE, LIGHT_PALETTE } from "./constants.js";
import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  // In a GitHub Action, inputs are read via core.getInput
  // Fallbacks are just for local testing if running via tsx directly
  const userName = core.getInput("github_user_name") || process.env.GITHUB_USER_NAME || process.argv[2];
  const token = core.getInput("github_token") || process.env.GITHUB_TOKEN;
  const outDir = core.getInput("out_dir") || process.env.OUT_DIR || "dist";

  if (!userName) {
    throw new Error("Provide github_user_name input or GITHUB_USER_NAME env var.");
  }
  if (!token) {
    throw new Error("Provide github_token input or GITHUB_TOKEN env var.");
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
  core.setFailed(err instanceof Error ? err.message : String(err));
});
