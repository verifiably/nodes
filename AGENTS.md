# Agent guide — nodes

## Authority order

1. `docs/STANDARD.md` — the versioned normative contract. When anything disagrees with
   it, it wins (or it has a bug: fix it in the same change).
2. The code and its tests.
3. `docs/designs/` and `docs/plans/` — dated historical records. Rationale only; do not
   execute old plans or treat their code snippets as current.

## Layering (enforced, not conventional)

- `nodes.core` (the kernel) imports nothing above it and names zero knowledge kinds.
- Domain kinds live in downstream repos, registered onto the kernel's `Registry`.

## Parity tiers (before adding any feature)

Decide the tier first — see `docs/STANDARD.md` §1:

- **Tier 1** (format, identity, mutation semantics): implement in both languages, update
  `docs/STANDARD.md` and the `fixtures/` oracles in the same change.
- **Tier 2** (derived-index behavior, finding codes): same, pinned by oracles.
- **Tier 3** (per-language convenience): one language is fine; no standard change.

## Gates (run before every commit)

- `just gate` — the whole thing: `just check` (ruff, pyright, biome, tsc, `tasks check`)
  then `just test` (pytest and vitest, both packages). Run it from anywhere in the tree.
- Every recipe records its run through `tools/tt`, the timing wrapper vendored from the
  ops repository, so do not call `pytest`, `npm test`, `ruff`, `pyright`, `tsc`, or
  `biome` directly. `tools/tt` is a copy of ops `bin/tt`; that copy is the source of
  truth.
- The git hooks in `.githooks/` run `just hook-pre-commit` (the `check` command) and
  `just hook-pre-push` (the whole gate). A fresh clone installs them with
  `git config core.hooksPath .githooks`.
- Before removing a worktree, run `tt-report` in the ops repository so this checkout's
  fallback test-timing log is harvested.

## Conventions

- Fail early; no silent fallbacks. Wrap Pydantic/Zod errors into the kernel error
  hierarchy — they never escape public APIs.
- Composition over inheritance: kinds are name + facets + invariants, never subclasses.
- Filepaths in docs use `~/d/nodes/...`.
- No AI-attribution trailers in commit messages.

## Tasks workflow

- Run `tasks prime` at the start of a work session and `tasks ready` before choosing work.
- Run `tasks start ID` before implementation, add concise notes as evidence changes, and close the task with a one-line result in the same commit as the work.
- Never edit `tasks/*.md` directly; use the `tasks` CLI for every task mutation.
- Before completion, run `tasks check`. Require zero errors and report every warning. Registration-only `unreachable_dep` and `cycle_unverifiable` warnings are environmental on machines without all referenced projects; resolve every other warning.
