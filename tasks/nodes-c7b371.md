---
id: nodes-c7b371
title: Collecting construction
status: todo
priority: 1
size: l
created: 2026-09-11T12:33:36Z
updated: 2026-09-11T14:36:16Z
depends: [nodes-01111b, nodes-cd59f0]
parent: nodes-ce28b8
tags: [redesign]
spec: docs/designs/2026-09-11-nodes-2.0-remainder-design.md
---

Sub-task B of the 2.0 remainder. Constructor flag mode=collecting, strict default; parse-error and uid-collision findings, all duplicate-uid claimants excluded; misplaced members (C's well-placed rule) refused under strict and excluded under collecting with a path-anchored path-mismatch finding; well-placed path-collision claimants stay ordinary members under both modes; check() the single reporting surface; mutation allowed but excluded paths are occupied, never overwrite targets; registry-backed check iterates accepted members only; filesystem failures stay exceptions, distinct from content findings (A made the walks raise); snapshot load/flush/reopen behaviour settled; damaged-corpus fixture and oracle pin parse-error, uid-collision, path-mismatch, and path-collision together. Own brainstorm reads beliefs' audit and manifest designs first.
