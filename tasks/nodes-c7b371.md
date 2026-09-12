---
id: nodes-c7b371
title: Collecting construction
status: doing
priority: 1
size: l
owner: nodes-2.0
created: 2026-09-11T12:33:36Z
updated: 2026-09-12T01:50:12Z
started: 2026-09-11T23:32:59Z
depends: [nodes-01111b, nodes-cd59f0]
parent: nodes-ce28b8
tags: [redesign]
spec: docs/designs/2026-09-11-nodes-collecting-construction-design.md
---

Sub-task B of the 2.0 remainder. Constructor flag mode=collecting, strict default; parse-error and uid-collision findings, all duplicate-uid claimants excluded; misplaced members (C's well-placed rule) refused under strict and excluded under collecting with a path-anchored path-mismatch finding; well-placed path-collision claimants stay ordinary members under both modes; check() the single reporting surface; mutation allowed but excluded paths are occupied, never overwrite targets; registry-backed check iterates accepted members only; filesystem failures stay exceptions, distinct from content findings (A made the walks raise); snapshot load/flush/reopen behaviour settled; damaged-corpus fixture and oracle pin parse-error, uid-collision, path-mismatch, and path-collision together. Own brainstorm reads beliefs' audit and manifest designs first.

## Notes

- 2026-09-11T23:34:23Z (nodes-2.0): Draft B design: mode flag on Corpus; parse floor = kernel ValidationError in both kernels (Python wraps, TS decodes fatally); four path-anchored construction findings, all claimants excluded; PlacementError for strict misplaced; excluded paths occupied exactly; one admission algorithm with eviction for reconcile; all()/check() over the manifest; damaged-corpus fixture without path-collision
- 2026-09-11T23:34:31Z (nodes-2.0): parked (waiting on user, review): Review draft collecting-construction design; then write implementation plan
- 2026-09-11T23:45:41Z (nodes-2.0): Review round 1 incorporated: snapshot schema versions bump so pre-B snapshots rebuild cold; uid/id collisions grouped simultaneously with one id-collision per (path, contested id); frontmatter shapes specified (null/scalar/BOM refused) with a shared malformed-input oracle; all()/check() iterate manifest paths in code-point order; finding code discriminates path vs id refs
- 2026-09-11T23:58:55Z (nodes-2.0): Review round 2: excluded uid/id-collision claimants reserve their identity claims against mutation (parse-failed and misplaced reserve nothing); no type coercion at the Markdown boundary, dates the one conversion; wording fixes (per-stage grouping, A+C cached case, malformed oracle in §11.2)
- 2026-09-12T00:53:36Z (nodes-2.0): Review round 3: reservations respect admission stages — uid-stage claimants reserve uids only, id-stage claimants reserve uids and ids, separate namespaces; fixture twin-a lists topic:good as deprecated to pin the accepted member's replacement
