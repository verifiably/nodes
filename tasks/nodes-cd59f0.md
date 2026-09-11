---
id: nodes-cd59f0
title: "Digest-id hazards: path-collision, refusal, collation, uid opacity"
status: doing
priority: 1
size: m
owner: nodes-2.0
created: 2026-09-11T12:33:36Z
updated: 2026-09-11T21:35:16Z
started: 2026-09-11T21:33:30Z
depends: []
parent: nodes-ce28b8
tags: [redesign]
spec: docs/designs/2026-09-11-nodes-digest-id-hazards-design.md
---

Sub-task C of the 2.0 remainder. Defines well-placed (physical path == path_for(id)) and collision (mapped paths equal under NFC+casefold, or exactly via ':'→'__'). One helper serves assert_addable (add, reconcile), rename (which today checks only resolve_uid), and check; its signature is C's to choose but must carry the candidate uid so same-(uid,id) replacement stays permitted, and must rule the same-path (case-only) rename: refuse, or an in-place plan. Refusal on add/rename; path-collision finding in check; strict construction accepts a collided corpus with well-placed claimants. Walk order pins code-point collation; uid minting becomes opacity. Fixture: in-test casefold pair on case-sensitive volumes, or committed misplaced claimants — C's brainstorm decides.

## Notes

- 2026-09-11T21:13:50Z (nodes-2.0): A landed the code-point walk sort in TypeScript (compareCodepoints); C's collation item now covers only the STANDARD wording and Python/TS parity of any remaining sorts
- 2026-09-11T21:34:07Z (nodes-2.0): Draft C design: indexed path-collision detection; construction identity checks separated from mutation refusal; preserve exact-path rename, refuse case-only rename; warning findings proposed; portable logical oracle; opaque uid and remaining ordering fixes.
- 2026-09-11T21:35:16Z (nodes-2.0): parked (waiting on user, review): Review draft digest-id hazard design (3ad1c9f), especially warning severity and exact-path versus case-only rename policy; then write implementation plan
