---
id: nodes-cd59f0
title: "Digest-id hazards: path-collision, refusal, collation, uid opacity"
status: todo
priority: 1
size: m
created: 2026-09-11T12:33:36Z
updated: 2026-09-11T21:13:50Z
depends: []
parent: nodes-ce28b8
tags: [redesign]
spec: docs/designs/2026-09-11-nodes-2.0-remainder-design.md
---

Sub-task C of the 2.0 remainder. Defines well-placed (physical path == path_for(id)) and collision (mapped paths equal under NFC+casefold, or exactly via ':'→'__'). One helper serves assert_addable (add, reconcile), rename (which today checks only resolve_uid), and check; its signature is C's to choose but must carry the candidate uid so same-(uid,id) replacement stays permitted, and must rule the same-path (case-only) rename: refuse, or an in-place plan. Refusal on add/rename; path-collision finding in check; strict construction accepts a collided corpus with well-placed claimants. Walk order pins code-point collation; uid minting becomes opacity. Fixture: in-test casefold pair on case-sensitive volumes, or committed misplaced claimants — C's brainstorm decides.

## Notes

- 2026-09-11T21:13:50Z (nodes-2.0): A landed the code-point walk sort in TypeScript (compareCodepoints); C's collation item now covers only the STANDARD wording and Python/TS parity of any remaining sorts
