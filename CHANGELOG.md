# Changelog

All notable changes to DragonBallistics Pro are recorded here.

## 0.2.0 - 2026-11-05

### Added

- RK4 and semi-implicit Euler integrators with analytical validation and convergence tests.
- Typed projectile simulation, configurable power conversion, gravity and two wind models.
- Continuous collision detection for ground, terrain segments, circular targets and world bounds.
- Safe time, iteration and invalid-numeric-state termination with warnings and errors.
- Canvas trajectory, impact and apex rendering plus optional two-simulation comparison.
- Persisted per-workspace physics controls with backward-compatible defaults.

### Changed

- Workbench now reports real flight time, range, maximum height and termination state.
- Automated suite now covers the Phase 2 engine and visual controls.
- Curved-step collision detection now adaptively subdivides and refines physical contacts instead of
  relying on a single endpoint chord.
- IndexedDB hydration repairs workspaces individually and serializes rapid writes per workspace.
- CI now includes `pnpm format:check` through the required `pnpm check` gate.
- The transitive development dependency `minimatch` is pinned to patched version 11.0.1.

## 0.1.0 - 2026-11-05

### Added

- Phase 0 research, architecture, product, data, physics, testing, and roadmap documents.
- Strict TypeScript pnpm monorepo with React, Vite, Tailwind, Zustand, Zod, Dexie, Vitest,
  Playwright, ESLint, and GitHub Actions.
- Functional geometry workbench, four local workspaces, validated import/export, preferences, and
  local persistence.
- Foundational shared, physics, mobile, calibration, and image-validation packages.
