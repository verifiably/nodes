---
id: nodes-ce28b8
title: Implement the remaining Nodes 2.0 redesign contract
status: done
priority: 1
size: xl
created: 2026-08-31T10:34:10Z
updated: 2026-09-12T10:23:08Z
completed: 2026-09-12T10:23:08Z
depends: []
tags: [migration, redesign, contract, parity]
spec: docs/designs/2026-09-11-nodes-2.0-remainder-design.md
---

Outcome: Nodes ships the reviewed remainder as one parity-safe 2.0 contract across the standard, Python, TypeScript, and shared fixtures. Acceptance evidence: implement reserved non-Markdown path and no-follow containment guarantees; collecting construction with parse-error and duplicate-uid findings; digest-ID path-collision, code-point ordering, and uid-opacity rules; withdraw dangling, descendants, and ancestors while retaining check findings; apply the write-plan seam and corpus-state identity amendments; add the namespaced-facet projection fixture; reconcile the remaining evidence-aware documentation paths; and pass every Python, TypeScript, and cross-language parity gate. Sources: docs/designs/2026-08-03-nodes-under-the-system-redesign-design.md sections 2.2-2.4, 3, 5, and 6; docs/designs/2026-08-17-nodes-write-plan-executor-seam-design.md section 7; and the Beliefs roadmap nodes-remainder row. Uncertainty: the reviewed design fixes the required behaviors and major-version ruling, but the implementation plan still must sequence the collecting build, removals, and one normative amendment without exposing a mixed-version surface.

## Notes

- 2026-09-11T12:33:36Z (nodes-2.0): Umbrella brainstorm done 2026-09-11: integration branch nodes-2.0, seven children D/A/C/B/F/E/G, preferred order D→A→C→B→F→E with G free
- 2026-09-12T10:23:08Z (main): Merged to main as b0c37b8 (--no-ff over nodes-2.0 at 2416dbd). Closeout gate on the integrated tree: gate 733 Python / 569 TS, tasks check clean, STANDARD free of (2.0) and Pending. Beliefs' roadmap row nodes-remainder is theirs to close against b0c37b8.
