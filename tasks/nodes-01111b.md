---
id: nodes-01111b
title: Reserved-path contract and no-follow containment
status: todo
priority: 1
size: s
created: 2026-09-11T12:33:36Z
updated: 2026-09-11T12:38:40Z
depends: []
parent: nodes-ce28b8
tags: [redesign]
spec: docs/designs/2026-09-11-nodes-2.0-remainder-design.md
---

Sub-task A of the 2.0 remainder. Nodes never touches non-*.md content under the root except its own reserved cache namespace; the reserved list is closed and versioned; no walk follows a symlink at any depth; every yielded path resolves within the root; Python's walk stops relying on rglob's incidental behaviour. The walk alone does not contain mutation: PlanRefusedError is lexical and DefaultExecutor writes through symlinks, so A also adds a pre-effect lstat check to DefaultExecutor (no symlink component or target under the root; ExecutionError before any effect) — a seam §8 amendment on an exercised part, needing Science sign-off. Own brainstorm: root-relative vs any-depth reservation; the amendment entry.
