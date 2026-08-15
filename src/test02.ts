import { runSimulation } from "./simulate.js";
import { renderSVG } from "./render-svg.js";
import { LIGHT_PALETTE } from "./constants.js";
import type { ContributionGrid } from "./fetch.js";
import fs from "node:fs/promises";
import path from "node:path";

interface GridOptions {
  fillProb: number;
}

function buildSyntheticGrid(options: GridOptions): ContributionGrid {
  const cols = 53;
  const rows = 7;
  let maxCount = 0;
  const weeks: ContributionGrid["weeks"] = [];

  for (let c = 0; c < cols; c++) {
    const week: ContributionGrid["weeks"][number] = [];
    for (let r = 0; r < rows; r++) {
      if (c === 0 && r < 3) continue;
      if (c === cols - 1 && r > 2) continue;

      let count = 0;
      if (Math.random() < options.fillProb) {
        count = Math.floor(Math.random() * 10) + 1;
      }
      if (count > maxCount) maxCount = count;
      week.push({ date: `2025-W${c}-${r}`, count, weekday: r });
    }
    weeks.push(week);
  }

  return { weeks, maxCount };
}

async function runScenario(name: string, grid: ContributionGrid, outDir: string) {
  const sim = runSimulation(grid, { seed: 7 });
  await fs.writeFile(path.join(outDir, `${name}-light.svg`), renderSVG(sim.rows, sim.cols, sim.inert, sim.frames, LIGHT_PALETTE));
}

async function main() {
  const outDir = "dist/test02";
  await fs.mkdir(outDir, { recursive: true });

  console.log(`Building 50 synthetic grids and rendering light SVGs to ${outDir}...`);

  for (let i = 0; i < 50; i++) {
    // Fill probability from 20% to 80%
    const fillProb = 0.2 + (i / 49) * 0.6;
    const grid = buildSyntheticGrid({ fillProb });
    
    // Format index to be zero-padded
    const idx = i.toString().padStart(2, "0");
    const name = `test-${idx}`;
    
    await runScenario(name, grid, outDir);
    
    if ((i + 1) % 10 === 0) {
      console.log(`Completed ${i + 1} / 50...`);
    }
  }

  console.log("\nDone ->", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
