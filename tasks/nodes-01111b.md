---
id: nodes-01111b
title: Reserved-path contract and no-follow containment
status: todo
priority: 1
size: s
created: 2026-09-11T12:33:36Z
updated: 2026-09-11T15:06:48Z
depends: []
parent: nodes-ce28b8
tags: [redesign]
spec: docs/designs/2026-09-11-nodes-reserved-paths-and-containment-design.md
plan: docs/plans/2026-09-11-nodes-reserved-paths-and-containment-plan.md
---

Sub-task A of the 2.0 remainder; design: docs/designs/2026-09-11-nodes-reserved-paths-and-containment-design.md. Two guarantees in STANDARD §4.1: non-Markdown content untouched outside the root-relative reserved namespace (.nodes-index/, closed and versioned), and no symlink component below the root on any yielded, read, written, or deleted path (root itself may be a symlink). Both walks become explicit scandir/readdir recursions that propagate filesystem failures. validate_plan refuses non-canonical segments. One assert_contained helper (ContainmentError) serves DefaultExecutor's whole-plan preflight (ExecutionError(index=i, applied=0) before any effect) and Store's read/write/delete. Shared JSON-described fixture containment.oracle.json materialized per language. Seam §3 amendment with Science sign-off pending, recorded in §8 with the process exception.
