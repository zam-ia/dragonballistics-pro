# DragonBallistics Pro engineering rules

## Product boundary

- This is an independent, local laboratory. It must not connect to a commercial game client.
- Never add process or memory reading, continuous screen capture, live target detection, input
  injection, game control, interception, or anti-cheat evasion.
- Saved-image analysis is allowed only as an explicit, offline user action with a visible correction
  step and confidence reporting.

## Evidence and provenance

- Do not present guessed constants as game data.
- Every mobile parameter set must carry a source, version, calibration state, and confidence.
- Demo, provisional, calibrated, and verified data must remain distinguishable in code and UI.
- External repositories are research references, not runtime dependencies. Preserve license notices if
  any permitted code is ever incorporated.

## Architecture

- Keep UI, physics, persistence, calibration, vision, and mobile profiles in separate packages.
- Physics functions should be pure and deterministic. Screen pixels never enter the physics model.
- Validate every imported file and persisted record with Zod at the boundary.
- Avoid circular dependencies. Packages may depend on `shared`; the web app composes packages.
- Do not use `eval`, remote databases, hidden telemetry, or secrets.

## Quality gate

Before marking work complete, run:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Update the roadmap and relevant architecture decision whenever behavior or package boundaries change.
