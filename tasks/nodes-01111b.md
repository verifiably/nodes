---
id: nodes-01111b
title: Reserved-path contract and no-follow containment
status: done
priority: 1
size: s
created: 2026-09-11T12:33:36Z
updated: 2026-09-11T21:22:35Z
completed: 2026-09-11T21:14:20Z
depends: []
parent: nodes-ce28b8
tags: [redesign]
spec: docs/designs/2026-09-11-nodes-reserved-paths-and-containment-design.md
plan: docs/plans/2026-09-11-nodes-reserved-paths-and-containment-plan.md
---

Sub-task A of the 2.0 remainder; design: docs/designs/2026-09-11-nodes-reserved-paths-and-containment-design.md. Two guarantees in STANDARD §4.1: non-Markdown content untouched outside the root-relative reserved namespace (.nodes-index/, closed and versioned), and no symlink component below the root on any yielded, read, written, or deleted path (root itself may be a symlink). Both walks become explicit scandir/readdir recursions that propagate filesystem failures. validate_plan refuses non-canonical segments. One assert_contained helper (ContainmentError) serves DefaultExecutor's whole-plan preflight (ExecutionError(index=i, applied=0) before any effect) and Store's read/write/delete. Shared JSON-described fixture containment.oracle.json materialized per language. Seam §3 amendment with Science sign-off pending, recorded in §8 with the process exception.

## Notes

- 2026-09-11T21:14:20Z (nodes-2.0): Reserved-path contract, containment (walk, executor preflight, Store, caches), portable path rule, containment.oracle.json with both harnesses; STANDARD §§4.1, 6, 7, 10, 11.2 marked (2.0); seam §3 amended with Science sign-off pending and the process exception recorded in §8
- 2026-09-11T21:22:35Z (nodes-2.0): Final review fixes: shared oracle case 37 pins op1 NUL inspection failure as ExecutionError(index=1, applied=0) with op0 absent in both harnesses; Python lstat ValueError now maps to ContainmentError without changing lexical validation; snapshot symlink test uses the shared capability marker.
