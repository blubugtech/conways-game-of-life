# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Game of Life birth logic**: Fixed an issue where 0-commit days were incorrectly marked as permanently inert, preventing any new cells from being born into empty spots during the Game of Life phase. 0-commit days now correctly act as playable space.

### Changed
- **Unified simulation color**: Active cells are now rendered as a single, uniform solid green throughout both the filling phase and Game of Life phase, eliminating visually distracting birth flashes or intensity changes. Dead cells correctly flash red.
- **Simulation pacing**: Cut the animation speed in half (increased frame duration to 180ms) for better visibility.
- **Simulation flow limits**: Added a 2-second hold after the random reveal finishes before starting Game of Life, and strictly capped the Game of Life phase to a maximum of 30 seconds.

## [1.0.5] - 2026-08-10

### Changed
- **Token Best Practices**: `github_token` now defaults to `${{ github.token }}` in `action.yml`, making it completely optional for end-users.
- **Authorization Standard**: Updated the GraphQL API request to use the `bearer ${token}` authorization header format rather than `token ${token}`, aligning with official GitHub App and GraphQL API standards.
## [1.0.4] - 2026-08-10

### Fixed
- **Contribution graph row misalignment**: `buildInertMask` was using the positional loop index `r` to read `week[r]`, ignoring the explicit `weekday` field on each day. Partial weeks (first/last of the year) returned `undefined` for missing slots, placing contributions on the wrong day-of-week row and corrupting the grid layout. Now iterates over actual days and uses `day.weekday` as the row index.
- **Short/stale fetch window**: The `contributionsCollection` GraphQL query was called without `from`/`to` arguments, so GitHub defaulted to the current calendar year only (Jan 1 → today). Mid-year runs silently dropped months of contributions. The query now always fetches the trailing 52 weeks to match what GitHub's profile UI displays.
- **`maxCount` collapsing to 0 for private-only contributors**: Added `totalContributions` to the GraphQL query as a fallback — when all public daily counts are 0 but the user has real activity, `maxCount` is set to 1 so cell weights remain meaningful and seeding still works.

### Added
- **Dynamic Timing & Intro**: Cells now organically spawn into existence over the first 2 seconds, followed by a dramatic 2-second pause before simulation begins.
- **Dynamic Simulation Length**: The simulation now runs indefinitely until a stable state or loop is detected, and pads the final loop for 5 seconds (50 frames).
- **Arcade Title**: Added a "SINGULARITY GRID" title at the top center of the generated SVG and GIF.
- **Death Flash Tuning**: Cells now turn red for exactly 500ms (5 frames) upon death before fading to the inert background color, making the death animation highly visible.

### Changed
- **Action Architecture**: Migrated from a bundled Node.js action (`ncc`) to a Composite Action. This forces `npm ci` to run on the target runner, ensuring `sharp` downloads the correct native binaries for the runner's specific OS and architecture.

## [1.0.0-beta] - 2026-08-10

### Added
- Initial release of the `singularity-grid` GitHub Action.
- Configurable generation of Game of Life style contribution graphs.
- Outputs crisp SVG and optimized GIF formats.
