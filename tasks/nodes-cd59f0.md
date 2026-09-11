---
id: nodes-cd59f0
title: "Digest-id hazards: path-collision, refusal, collation, uid opacity"
status: doing
priority: 1
size: m
owner: nodes-2.0
created: 2026-09-11T12:33:36Z
updated: 2026-09-11T22:35:51Z
started: 2026-09-11T21:33:30Z
depends: []
parent: nodes-ce28b8
tags: [redesign]
spec: docs/designs/2026-09-11-nodes-digest-id-hazards-design.md
plan: docs/plans/2026-09-11-nodes-digest-id-hazards-plan.md
---

Sub-task C of the 2.0 remainder. Reviewed design defines mapped-path collision keys and derived uid buckets; construction/reconcile retain identity-only checks, while add and rename refuse new path collisions. Preserve exact-path replacement, refuse case-only rename, allow a free temporary-id workaround. Report warning path-collision per live claimant. Reject empty uids (including restored structural entries), preserve other supplied uid strings and UUID-hex defaults, and pin remaining TS code-point sorts. Collision-only logical oracle; uid presence oracle; non-BMP referrers in the existing rename fixture. B owns disk placement enforcement on cold rebuild and changed-file reconcile. Four implementation children; one code/fixtures/STANDARD commit.

## Notes

- 2026-09-11T21:13:50Z (nodes-2.0): A landed the code-point walk sort in TypeScript (compareCodepoints); C's collation item now covers only the STANDARD wording and Python/TS parity of any remaining sorts
- 2026-09-11T21:34:07Z (nodes-2.0): Draft C design: indexed path-collision detection; construction identity checks separated from mutation refusal; preserve exact-path rename, refuse case-only rename; warning findings proposed; portable logical oracle; opaque uid and remaining ordering fixes.
- 2026-09-11T21:35:16Z (nodes-2.0): parked (waiting on user, review): Review draft digest-id hazard design (3ad1c9f), especially warning severity and exact-path versus case-only rename policy; then write implementation plan
- 2026-09-11T21:55:35Z (nodes-2.0): Correction to the preceding parked note: the reviewed draft commit is 103e31d, not 3ad1c9f (notes are append-only). Review accepted: reject empty uids including restored entries, remove snapshot module re-export, isolate uid ordering in rename fixtures, and document placement fallback plus temporary-id rename.
- 2026-09-11T22:10:46Z (nodes-2.0): Review corrections incorporated and four-step implementation plan attached. Added old-empty-uid snapshot bypass coverage; clarified that B must check cold rebuild and changed-file reconciliation. No implementation changes in this documentation commit.
- 2026-09-11T22:10:46Z (nodes-2.0): parked (waiting on user, review): Review the digest-id hazards implementation plan; then execute its four children in order with one combined code/fixtures/STANDARD commit
- 2026-09-11T22:35:51Z (nodes-2.0): Plan review incorporated: seam pending amendment included in C scope, uid JSON spellings made visible, both refusal runners compare derived collision rows, and baseline pinned to ef5a487. Reviewed plan is ready to execute.
- 2026-09-11T22:35:51Z (nodes-2.0): parked (waiting on agent): Execute the reviewed digest-id hazards plan, starting nodes-7b859d; retain the four children in one code/fixtures/STANDARD implementation commit
