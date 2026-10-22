---
id: nodes-bcb041
title: Resolve existing tilde-layout findings before checker rollout
status: todo
priority: 2
size: m
complexity: mid
process: direct
created: 2026-10-22T19:07:30Z
updated: 2026-10-22T19:07:30Z
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
