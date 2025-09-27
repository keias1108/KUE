# Persistent Context

## Project Snapshot (2025-02-14)
- **App focus**: Personal Universe Engine — Gray–Scott GPU lab with Codex bookmarking and automated seed exploration.
- **Guiding vision**: See `VISION.md` for philosophical/UX principles; keep patterns emergent, balanced, bottom-up.

## Recent System Capabilities
- **Automated Seed Scan** (`Scan 6 Seeds`)
  - Low-res GPU evaluation with vitality metrics (mean/std, activity, entropy).
  - Results classified as `balanced / dormant / chaotic` with composite score and sorted list.
  - Replay scrolls to sticky canvas; Adopt pushes entry (with metrics) into Codex.
- **Codex**
  - Saves current params + metrics + resolution; exposes imperative handle for programmatic insertion.
- **Metrics API**
  - `collectMetrics()` on canvas returns vitality snapshot.
  - `evaluateParameterSets()` runs headless simulations for scans.

## UX Layout Notes
- Canvas column is sticky on large screens so simulation stays visible.
- Automated Seeds live in right column with internal scroll; keep candidate count manageable or trim periodically.

## Testing
- `npm run build`
- `npx playwright test tests/playwright/console.spec.ts`
- `npx playwright test tests/playwright/auto-scan-screenshot.spec.ts` (captures overview & replay screenshots under `test-results/auto-scan-screenshot-auto--93837-s-and-replay-reveals-canvas/`).

## Pending Ideas / Wishlist
- Enhance auto-scan panel with collapsing/filters to surface top “balanced” seeds by default.
- Add mini previews or timeline sparklines for each seed/Codex entry.
- Collect user feedback tags (`균형/혼돈/사멸`) to bias future exploration.

