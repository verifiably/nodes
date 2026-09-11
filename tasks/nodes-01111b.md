---
id: nodes-01111b
title: Reserved-path contract and no-follow containment
status: todo
priority: 1
size: s
created: 2026-09-11T12:33:36Z
updated: 2026-09-11T12:33:36Z
depends: []
parent: nodes-ce28b8
tags: [redesign]
spec: docs/designs/2026-09-11-nodes-2.0-remainder-design.md
---

Sub-task A of the 2.0 remainder. Nodes never touches non-*.md content under the root except its own reserved cache namespace; the reserved list is closed and versioned; no walk follows a symlink at any depth; every yielded path resolves within the root. Python's walk stops relying on rglob's incidental behaviour. Own brainstorm: root-relative vs any-depth reservation; traversal containment vs the executor's mutation guarantee.
