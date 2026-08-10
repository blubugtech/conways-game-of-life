import { runSimulation } from "./simulate.js";
import { renderSVG } from "./render-svg.js";
import { renderGIF } from "./render-gif.js";
import { ANIM_FRAME_COUNT, DARK_PALETTE, LIGHT_PALETTE } from "./constants.js";
import type { ContributionGrid } from "./fetch.js";
import fs from "node:fs/promises";
import path from "node:path";

// Build a realistic-looking synthetic 53-week contribution grid to test the
// full pipeline without needing live GitHub API access.
function buildSyntheticGrid(): ContributionGrid {
  const cols = 53;
  const rows = 7;
  let maxCount = 0;
  const weeks: ContributionGrid["weeks"] = [];

  for (let c = 0; c < cols; c++) {
    const week: ContributionGrid["weeks"][number] = [];
    for (let r = 0; r < rows; r++) {
      // simulate bursty coding activity: weekdays more active than weekends,
      // with some random "vacation" gaps and a couple of intense streaks
      let count = 0;
      const isWeekend = r === 0 || r === 6;
      const base = isWeekend ? 0.25 : 0.6;
      const inVacationGap = c > 20 && c < 24;
      const inIntenseStreak = c > 35 && c < 42;

      if (!inVacationGap && Math.random() < base) {
        count = Math.floor(Math.random() * (inIntenseStreak ? 15 : 6)) + 1;
      }
      if (count > maxCount) maxCount = count;
      week.push({ date: `2025-W${c}-${r}`, count });
    }
    weeks.push(week);
  }

  return { weeks, maxCount };
}

async function main() {
  const outDir = "dist";
  await fs.mkdir(outDir, { recursive: true });

  console.log("Building synthetic contribution grid...");
  const grid = buildSyntheticGrid();

  console.log("Running simulation...");
  const sim = runSimulation(grid, { seed: 7, maxTicks: 500, targetFrameCount: ANIM_FRAME_COUNT });

  console.log("Rendering SVG (dark + light)...");
  await fs.writeFile(path.join(outDir, "singularity-grid-dark.svg"), renderSVG(sim.rows, sim.cols, sim.inert, sim.frames, DARK_PALETTE));
  await fs.writeFile(path.join(outDir, "singularity-grid-light.svg"), renderSVG(sim.rows, sim.cols, sim.inert, sim.frames, LIGHT_PALETTE));

  console.log("Rendering GIF (dark)...");
  await renderGIF(sim.rows, sim.cols, sim.inert, sim.frames, DARK_PALETTE, path.join(outDir, "singularity-grid-dark.gif"));

  console.log("Rendering GIF (light)...");
  await renderGIF(sim.rows, sim.cols, sim.inert, sim.frames, LIGHT_PALETTE, path.join(outDir, "singularity-grid-light.gif"));

  console.log("Done ->", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
