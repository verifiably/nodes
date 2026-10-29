---
id: nodes-bcb041
title: Resolve existing tilde-layout findings before checker rollout
status: doing
priority: 2
size: m
complexity: mid
process: direct
owner: fix/nodes-bcb041
created: 2026-10-22T19:07:30Z
updated: 2026-10-29T20:35:13Z
started: 2026-10-29T20:26:28Z
depends: []
tags: []
source: ops-295f8d
agent: codex
---

Why: the final candidate from ops-295f8d reports existing home-relative machine-layout paths that the current checker misses. Resolve these before the stricter vendored copy arrives, so unrelated commits are not blocked. These are scanner findings to classify, not an instruction to discard historical documents.

Done: inspect each listed file in context. Replace accidental checkout/storage paths in shared docs, examples or fixtures with repository-relative paths, project-role references or portable URLs as appropriate. For intentional host configuration, use only the narrow existing layout_allowed mechanism where this repository is host configuration by design; do not exempt ordinary docs wholesale. Preserve historical evidence, attachments and every spec/plan review ledger; follow the task attachment CLI and retention rules instead of editing attached artifacts by hand. If a runtime-path correction needs an unsettled public contract, change that piece to planned before implementation. Run the project-declared checks and the reviewed candidate checker by explicit path, then record every listed file disposition and the clean verdict on this task. Do not repoint shared launchers, vendor the checker, publish, push or activate global guidance in this task.

Where: the current project guide/profile, listed tracked files, existing layout_allowed, and ops-295f8d for candidate branch/path and canonical report. The full sweep reached 36 registered repositories with no unavailable roots; counts here are capped scanner records, not an estimate of all occurrences. No source snippets are copied.

Reported files:
- docs/designs/2026-06-21-nodes-substrate-design.md: first reported line 11; 4 reported finding(s)
- docs/designs/2026-06-21-nodes-ts-kernel-design.md: first reported line 63; 1 reported finding(s)
- docs/designs/2026-07-02-nodes-ts-corpus-fingerprints-design.md: first reported line 13; 2 reported finding(s)
- docs/designs/2026-07-10-nodes-standard-and-check-design.md: first reported line 14; 1 reported finding(s)
- docs/designs/2026-07-11-nodes-membership-traversal-and-check-design.md: first reported line 15; 1 reported finding(s)
- docs/designs/2026-07-13-nodes-python-package-layout-design.md: first reported line 5; 3 reported finding(s)
- docs/designs/2026-07-16-nodes-first-publish-design.md: first reported line 5; 3 reported finding(s)
- docs/designs/2026-07-18-nodes-first-publish-recovery-design.md: first reported line 5; 8 reported finding(s)
- docs/designs/2026-08-03-nodes-under-the-system-redesign-design.md: first reported line 184; 5 reported finding(s)
- docs/designs/2026-08-17-nodes-write-plan-executor-seam-design.md: first reported line 0; 11 reported finding(s)
- docs/designs/2026-09-11-nodes-reserved-paths-and-containment-design.md: first reported line 40; 1 reported finding(s)
- docs/plans/2026-06-21-nodes-knowledge-vocab-plan.md: first reported line 17; 2 reported finding(s)
- docs/plans/2026-06-21-nodes-python-kernel-plan.md: first reported line 0; 11 reported finding(s)
- docs/plans/2026-06-21-nodes-structural-index-plan.md: first reported line 17; 2 reported finding(s)
- docs/plans/2026-06-21-nodes-ts-kernel-plan.md: first reported line 0; 11 reported finding(s)
- docs/plans/2026-06-22-nodes-fulltext-search-plan.md: first reported line 36; 6 reported finding(s)
- docs/plans/2026-06-22-nodes-similarity-index-plan.md: first reported line 38; 1 reported finding(s)
- docs/plans/2026-06-22-nodes-ts-fulltext-search-plan.md: first reported line 39; 2 reported finding(s)
- docs/plans/2026-06-22-nodes-ts-knowledge-vocab-plan.md: first reported line 0; 11 reported finding(s)
- docs/plans/2026-06-22-nodes-ts-similarity-index-plan.md: first reported line 49; 2 reported finding(s)
- docs/plans/2026-06-22-nodes-ts-structural-index-plan.md: first reported line 0; 11 reported finding(s)
- docs/plans/2026-06-23-nodes-index-persistence-plan.md: first reported line 9; 2 reported finding(s)
- docs/plans/2026-06-23-nodes-structural-shapes-redesign-plan.md: first reported line 9; 10 reported finding(s)
- docs/plans/2026-06-23-nodes-ts-index-persistence-plan.md: first reported line 33; 1 reported finding(s)
- docs/plans/2026-06-24-nodes-ts-structural-shapes-redesign-plan.md: first reported line 0; 11 reported finding(s)
- docs/plans/2026-07-02-nodes-ts-corpus-fingerprints-plan.md: first reported line 29; 4 reported finding(s)
- docs/plans/2026-07-10-nodes-standard-and-check-plan.md: first reported line 24; 4 reported finding(s)
- docs/plans/2026-07-11-nodes-membership-traversal-and-check-plan.md: first reported line 0; 11 reported finding(s)
- docs/plans/2026-07-11-package-identity-implementation-plan.md: first reported line 311; 8 reported finding(s)
- docs/plans/2026-07-12-nodes-base-vocabulary-retirement-plan.md: first reported line 0; 11 reported finding(s)
- docs/plans/2026-07-13-nodes-python-package-layout-plan.md: first reported line 25; 3 reported finding(s)
- docs/plans/2026-07-16-nodes-first-publish-plan.md: first reported line 6; 3 reported finding(s)
- docs/plans/2026-07-18-nodes-first-publish-recovery-plan.md: first reported line 0; 11 reported finding(s)
- docs/plans/2026-08-30-nodes-tasks-migration.md: first reported line 82; 2 reported finding(s)
- docs/superpowers/plans/2026-08-17-nodes-detailed-review.md: first reported line 18; 9 reported finding(s)
- docs/superpowers/specs/2026-08-17-nodes-detailed-review-design.md: first reported line 238; 1 reported finding(s)

## Notes

- 2026-10-29T20:26:28Z (main): started
  provenance: {"harness_session":"claude-code:0abf3f61-62e6-4a09-a944-9063cc887bf3","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-29T20:27:17Z (fix/nodes-bcb041): resumed
  provenance: {"harness_session":"claude-code:0abf3f61-62e6-4a09-a944-9063cc887bf3","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-29T20:34:54Z (fix/nodes-bcb041): dispositions: all 190 candidate findings (334 lines incl. lines past the per-file cap) reworded, none allowed; no .ops-check.toml created. Patterns: `cd ~/d/nodes[/sub]` -> `cd <nodes>[/sub]` (multi-cd blocks keep their anchor); backticked `~/d/nodes/<path>` -> repo-relative `<path>`; bare checkout in prose -> `nodes` / the nodes checkout / the repository root; other checkouts -> project-qualified paths (atoms `python/...`, science `docs/...`, beliefs `python/pyproject.toml`) or placeholders `<mindful>/v6`, `<science>`, `<beliefs>`; historical path-convention rules `~/d/` and `~/d/nodes/...` -> `~/…/` and `~/…/nodes/...`; tree-diagram roots `~/d/nodes/` -> `nodes/`. Files: docs/designs/2026-06-21-nodes-substrate-design.md:11,12,283 — reworded; 2026-06-21-nodes-ts-kernel-design.md:63 — reworded; 2026-07-02-nodes-ts-corpus-fingerprints-design.md:13 — reworded; 2026-07-10-nodes-standard-and-check-design.md:14 — reworded; 2026-07-11-nodes-membership-traversal-and-check-design.md:15 — reworded; 2026-07-13-nodes-python-package-layout-design.md:5,9,17 — reworded; 2026-07-16-nodes-first-publish-design.md:5,7,60 — reworded; 2026-07-18-nodes-first-publish-recovery-design.md:5,40-43,54,55,104 — reworded; 2026-08-03-nodes-under-the-system-redesign-design.md:184,185,249,254,256 — reworded; 2026-08-17-nodes-write-plan-executor-seam-design.md (13 lines, 24-258) — reworded; 2026-09-11-nodes-reserved-paths-and-containment-design.md:40 — reworded; docs/plans/2026-06-21-nodes-knowledge-vocab-plan.md (2) — reworded; 2026-06-21-nodes-python-kernel-plan.md (14) — reworded; 2026-06-21-nodes-structural-index-plan.md (2) — reworded; 2026-06-21-nodes-ts-kernel-plan.md (38) — reworded; 2026-06-22-nodes-fulltext-search-plan.md (6) — reworded; 2026-06-22-nodes-similarity-index-plan.md:38 — reworded; 2026-06-22-nodes-ts-fulltext-search-plan.md (2) — reworded; 2026-06-22-nodes-ts-knowledge-vocab-plan.md (18) — reworded; 2026-06-22-nodes-ts-similarity-index-plan.md (2) — reworded; 2026-06-22-nodes-ts-structural-index-plan.md (28) — reworded; 2026-06-23-nodes-index-persistence-plan.md (2) — reworded; 2026-06-23-nodes-structural-shapes-redesign-plan.md (10) — reworded; 2026-06-23-nodes-ts-index-persistence-plan.md:33 — reworded; 2026-06-24-nodes-ts-structural-shapes-redesign-plan.md (22) — reworded; 2026-07-02-nodes-ts-corpus-fingerprints-plan.md (4) — reworded; 2026-07-10-nodes-standard-and-check-plan.md:24,592,593,634 — reworded; 2026-07-11-nodes-membership-traversal-and-check-plan.md (11) — reworded; 2026-07-11-package-identity-implementation-plan.md:311,312,333,341,344,351,380 — reworded; 2026-07-12-nodes-base-vocabulary-retirement-plan.md (39) — reworded; 2026-07-13-nodes-python-package-layout-plan.md (3) — reworded; 2026-07-16-nodes-first-publish-plan.md (3) — reworded; 2026-07-18-nodes-first-publish-recovery-plan.md (64) — reworded; 2026-08-30-nodes-tasks-migration.md:82 — reworded; docs/superpowers/plans/2026-08-17-nodes-detailed-review.md:18,121,161,183,238,247,248,293,318 — reworded; docs/superpowers/specs/2026-08-17-nodes-detailed-review-design.md:238 — reworded.
- 2026-10-29T20:35:13Z (fix/nodes-bcb041): verification: candidate rc=0 at d1cd97d (ops-295f8d bin/ops-check v15, run by explicit path from the worktree); just check rc=0 (vendored ops-check, ops-docs check, ruff, pyright, biome, tsc, tasks check); git diff --check clean; word-level diff review: every change is path text only; all <placeholder> uses sit inside code spans or fences. Docs-only change, so no focused tests; baseline just test at worktree creation: 755 pytest + 592 vitest passed (no .tt.toml, policy absent).
