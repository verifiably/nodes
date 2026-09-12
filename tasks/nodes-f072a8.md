---
id: nodes-f072a8
title: "Task 4: Plan validation and the executor's whole-plan preflight"
status: done
priority: 1
size: s
owner: nodes-2.0
created: 2026-09-11T15:06:48Z
updated: 2026-09-11T20:52:02Z
started: 2026-09-11T20:46:37Z
completed: 2026-09-11T20:52:02Z
depends: [nodes-989525]
parent: nodes-01111b
tags: [redesign]
plan: docs/plans/2026-09-11-nodes-reserved-paths-and-containment-plan.md
step: "Task 4: Plan validation and the executor's whole-plan preflight"
---

## Notes

- 2026-09-11T20:52:02Z (nodes-2.0): validate_plan applies the portable .md path rule in both languages (manifest validator aligned); DefaultExecutor preflights the whole plan with assert_contained and refuses ExecutionError(index=i, applied=0) before any effect
