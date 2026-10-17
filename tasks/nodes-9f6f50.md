---
id: nodes-9f6f50
title: Fill in setup_cmd for the ts tree so a fresh worktree runs the suite
status: todo
priority: 2
size: xs
complexity: low
process: direct
created: 2026-09-11T21:13:32Z
updated: 2026-10-17T20:32:45Z
depends: []
tags: [testing]
source: ops-9c7dab
---

Why: a fresh worktree has no ts/node_modules, so its pre-commit hook fails in tsc (missing node types) until someone runs npm ci by hand (observed again 2026-10-15, nodes-d90d2f). The global worktree rule runs `just setup` right after `git worktree add` when the justfile defines it, and nodes defines none. Piece of ops-9c7dab, same shape as beliefs (beliefs-ba648a, done).

Established 2026-10-17 (ops templates/justfile, beliefs justfile, this checkout):
- The ops template's setup_cmd now starts with `just work-link <generated dirs>` (its `work-link` recipe calls `work-link --ensure` when the command exists, exit 0 otherwise) and then installs; in a Dropbox checkout an install that creates node_modules ends with `attr -s com.dropbox.ignored -V 1 node_modules`, and an attribute failure must fail setup.
- beliefs' setup_cmd is `(cd ts && npm ci && attr -s com.dropbox.ignored -V 1 node_modules)`; its ts_fast_cmd uses `npx --no-install` so an unhydrated tree fails instead of fetching vitest mid-run. nodes' ts_fast_cmd still uses bare `npx`.
- This main checkout already has .worktrees, .venv and python/.venv as work-link symlinks and the Dropbox ignore attribute on ts/node_modules and python/.venv. The Python side self-heals through `uv run --frozen`, but CI runs `uv sync --frozen` explicitly.
- nodes' justfile has neither a `work-link` nor a `setup` recipe.

Done when: the justfile carries the template's `work-link` and `setup` recipes and a setup_cmd of roughly `just work-link .worktrees python/.venv && (cd python && uv sync --frozen) && (cd ts && npm ci && attr -s com.dropbox.ignored -V 1 node_modules)`, with a comment saying the suite reads only tracked fixtures (no gitignored inputs); ts_fast_cmd uses `npx --no-install`; and a throwaway worktree created with `git worktree add` passes `just setup && just check` there (record the run in a note).

Where: justfile; ops templates/justfile (setup_cmd comment, work-link and setup recipes); beliefs justfile (setup_cmd, ts_fast_cmd); .github/workflows/ci.yml (CI's own install steps, unchanged).

## Notes

- 2026-09-12T16:43:24Z (main): complexity low: mirrors beliefs' setup_cmd, one config line plus the ops template recipe, check is the throwaway-worktree run the body names
- 2026-10-17T20:32:28Z (main): scope: rescoped; premises hold against ops templates/justfile and beliefs justfile as of 2026-10-17: setup_cmd plus the setup recipe still the shape; established that the template now leads with work-link and marks node_modules Dropbox-ignored, that beliefs uses npx --no-install, and this checkout's existing links; absorbed nodes-d90d2f (duplicate, drop proposed); process direct
