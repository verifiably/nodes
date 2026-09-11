---
id: nodes-904ecf
title: "Task 2: Root-aware cache helpers"
status: done
priority: 1
size: s
owner: nodes-2.0
created: 2026-09-11T15:06:48Z
updated: 2026-09-11T20:31:27Z
started: 2026-09-11T20:26:51Z
completed: 2026-09-11T20:31:27Z
depends: [nodes-e48507]
parent: nodes-01111b
tags: [redesign]
plan: docs/plans/2026-09-11-nodes-reserved-paths-and-containment-plan.md
step: "Task 2: Root-aware cache helpers"
---

## Notes

- 2026-09-11T20:31:27Z (nodes-2.0): read_json/write_json_atomic take root plus a cache path strictly beneath .nodes-index, reject null documents, check final path on read and .tmp sibling on write; snapshot and VectorCache use them; TypeScript loadSnapshot rethrows ContainmentError
