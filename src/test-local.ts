import { runSimulation } from "./simulate.js";
import { renderSVG } from "./render-svg.js";
import { renderGIF } from "./render-gif.js";
import { DARK_PALETTE, LIGHT_PALETTE } from "./constants.js";
import type { ContributionGrid } from "./fetch.js";
import fs from "node:fs/promises";
import path from "node:path";

interface GridOptions {
  baseWeekdayProb: number;
  baseWeekendProb: number;
  vacationGaps: [number, number][]; // [startCol, endCol]
  intenseStreaks: [number, number][]; // [startCol, endCol]
}

const DEFAULT_OPTIONS: GridOptions = {
  baseWeekdayProb: 0.6,
  baseWeekendProb: 0.25,
  vacationGaps: [[21, 23]],
  intenseStreaks: [[36, 41]],
};

// Build a realistic-looking synthetic 53-week contribution grid to test the
// full pipeline without needing live GitHub API access.
function buildSyntheticGrid(options: GridOptions = DEFAULT_OPTIONS): ContributionGrid {
  const cols = 53;
  const rows = 7;
  let maxCount = 0;
  const weeks: ContributionGrid["weeks"] = [];

  for (let c = 0; c < cols; c++) {
    const week: ContributionGrid["weeks"][number] = [];
    for (let r = 0; r < rows; r++) {
      // simulate partial first and last weeks
      if (c === 0 && r < 3) continue;
      if (c === cols - 1 && r > 2) continue;

      let count = 0;
      const isWeekend = r === 0 || r === 6;
      const base = isWeekend ? options.baseWeekendProb : options.baseWeekdayProb;

      const inVacationGap = options.vacationGaps.some(([start, end]) => c >= start && c <= end);
      const inIntenseStreak = options.intenseStreaks.some(([start, end]) => c >= start && c <= end);

      if (!inVacationGap && Math.random() < base) {
        count = Math.floor(Math.random() * (inIntenseStreak ? 15 : 6)) + 1;
      }
      if (count > maxCount) maxCount = count;
      week.push({ date: `2025-W${c}-${r}`, count, weekday: r });
    }
    weeks.push(week);
  }

  return { weeks, maxCount };
}

async function runScenario(name: string, grid: ContributionGrid, outDir: string) {
  console.log(`\n--- Running Scenario: ${name} ---`);
  console.log(`Running simulation...`);
  const sim = runSimulation(grid, { seed: 7 });

  console.log(`Rendering outputs to ${outDir}...`);
  await fs.writeFile(path.join(outDir, `${name}-dark.svg`), renderSVG(sim.rows, sim.cols, sim.inert, sim.frames, DARK_PALETTE));
  await fs.writeFile(path.join(outDir, `${name}-light.svg`), renderSVG(sim.rows, sim.cols, sim.inert, sim.frames, LIGHT_PALETTE));
  
  await renderGIF(sim.rows, sim.cols, sim.inert, sim.frames, DARK_PALETTE, path.join(outDir, `${name}-dark.gif`));
  await renderGIF(sim.rows, sim.cols, sim.inert, sim.frames, LIGHT_PALETTE, path.join(outDir, `${name}-light.gif`));
}

async function main() {
  const outDir = "dist/output";
  await fs.mkdir(outDir, { recursive: true });

  console.log("Building synthetic contribution grids...");

  // 1. Default bursty scenario (original behavior)
  const defaultGrid = buildSyntheticGrid();
  await runScenario("conways-game-of-life", defaultGrid, outDir);

  console.log("\nDone ->", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
