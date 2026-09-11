---
id: nodes-cd59f0
title: "Digest-id hazards: path-collision, refusal, collation, uid opacity"
status: todo
priority: 1
size: m
created: 2026-09-11T12:33:36Z
updated: 2026-09-11T12:33:36Z
depends: []
parent: nodes-ce28b8
tags: [redesign]
spec: docs/designs/2026-09-11-nodes-2.0-remainder-design.md
---

Sub-task C of the 2.0 remainder. A pure collision predicate over (candidate id, existing member paths) shared by assert_addable (add, rename, reconcile) and check; assert_addable refuses NFC+casefold and ':'→'__' mapped-path collisions; check gains path-collision; walk order pins code-point collation; uid minting becomes an opacity statement. Fixtures commit distinct filenames whose logical ids collide. Own brainstorm pins the C/B interface.
