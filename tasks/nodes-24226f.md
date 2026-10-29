---
id: nodes-24226f
title: "Document the nodes model: shapes, kinds, facets, consumers and the reference boundary"
status: doing
priority: 2
size: s
complexity: low
process: planned
owner: docs/model-docs
created: 2026-10-29T01:54:53Z
updated: 2026-10-29T09:06:28Z
started: 2026-10-29T01:55:02Z
depends: []
tags: [docs]
agent: claude-code/claude-fable-5-1
origin: user
spec: docs/designs/2026-10-28-nodes-model-docs-design.md
plan: docs/plans/2026-10-28-nodes-model-docs-plan.md
---

Make the nodes model legible from the README, AGENTS.md and the package guides: the shape / kind / facet composition (the 2022–2023 "structure + domain building blocks" model, which is what the kernel implements), the consumer map that commit 629ecd0 dropped, that nodes runs without atoms, and what nodes deliberately does not do (external references and meaning, durability), each pointing at where it lives instead. Documentation only; no kernel change.

Context: brainstorm on 2026-10-28 in the nodes checkout; agreed direction is a separate `refs` project below the profiles for external references (vocabularies pinned to releases, external or self-issued), with nodes unchanged. That project and the vdocs overview update are filed separately once this spec is approved.

## Notes

- 2026-10-29T01:54:53Z (add): created
  provenance: {"harness_session":"claude-code:569c9b6a-e9ba-4bc4-9e07-f584fa31dbb1","harness_session_source":"CLAUDE_CODE_SESSION_ID","origin":"user"}
- 2026-10-29T01:55:02Z (main): started
  provenance: {"harness_session":"claude-code:569c9b6a-e9ba-4bc4-9e07-f584fa31dbb1","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-29T01:55:51Z (docs/model-docs): resumed
  provenance: {"harness_session":"claude-code:569c9b6a-e9ba-4bc4-9e07-f584fa31dbb1","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-29T01:58:48Z (docs/model-docs): spec drafted at 2f06a33 in .worktrees/model-docs (branch docs/model-docs); awaiting user review
- 2026-10-29T01:58:57Z (docs/model-docs): parked (waiting on user, review): user reviews the spec docs/designs/2026-10-28-nodes-model-docs-design.md at the frozen revision; on approval, invoke writing-plans in .worktrees/model-docs
  provenance: {"harness_session":"claude-code:569c9b6a-e9ba-4bc4-9e07-f584fa31dbb1","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-29T02:05:07Z (docs/model-docs): resumed
  provenance: {"harness_session":"claude-code:569c9b6a-e9ba-4bc4-9e07-f584fa31dbb1","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-29T02:05:15Z (docs/model-docs): review: spec round 1 — verdict: accept; findings: minor 2; reviewer: codex/gpt-6-astra
- 2026-10-29T02:05:47Z (docs/model-docs): spec accepted by user for planning; review wording applied at 6ff7d20 (boundary stays opaque to nodes; science consumer line qualified)
- 2026-10-29T02:08:40Z (docs/model-docs): plan drafted at 394c120; awaiting user plan review
- 2026-10-29T02:08:47Z (docs/model-docs): parked (waiting on user, review): user reviews the plan docs/plans/2026-10-28-nodes-model-docs-plan.md at 394c120 and picks native or subagent-driven execution; then execute in .worktrees/model-docs
  provenance: {"harness_session":"claude-code:569c9b6a-e9ba-4bc4-9e07-f584fa31dbb1","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-29T08:58:05Z (docs/model-docs): resumed
  provenance: {"harness_session":"claude-code:569c9b6a-e9ba-4bc4-9e07-f584fa31dbb1","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-29T08:58:12Z (docs/model-docs): review: plan round 1 — verdict: revise; findings: Important 2, Minor 1; reviewer: codex/gpt-6-astra
- 2026-10-29T08:59:58Z (docs/model-docs): plan revision 2 at 2c47c60: abstract cut to 387 chars with a parsed-length step; shape adoption worded optional and open (register_shape, KindSpec.shape: str | None) in T1, T2, T3; reproducibility step stages then git diff --exit-code. Execution: native, then a fresh whole-branch reviewer
- 2026-10-29T09:00:06Z (docs/model-docs): parked (waiting on user, review): user reviews plan revision 2c47c60 (docs/plans/2026-10-28-nodes-model-docs-plan.md); on accept, execute natively in .worktrees/model-docs via executing-plans, then dispatch a fresh whole-branch reviewer
  provenance: {"harness_session":"claude-code:569c9b6a-e9ba-4bc4-9e07-f584fa31dbb1","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-29T09:05:59Z (docs/model-docs): resumed
  provenance: {"harness_session":"claude-code:569c9b6a-e9ba-4bc4-9e07-f584fa31dbb1","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-29T09:06:06Z (docs/model-docs): review: plan round 2 — verdict: accept; findings: minor 2; reviewer: codex/gpt-6-astra
- 2026-10-29T09:06:21Z (docs/model-docs): plan approved by user at 2c47c60 (round 2 editorial corrections applied at 0db2a81, no new approval round); execution native in a fresh session, then a fresh whole-branch reviewer
- 2026-10-29T09:06:28Z (docs/model-docs): parked (waiting on agent, session): fresh session: in .worktrees/model-docs (branch docs/model-docs) run tasks start nodes-24226f, re-enter using-git-worktrees for the deferred baseline (just test), then execute docs/plans/2026-10-28-nodes-model-docs-plan.md natively via executing-plans (Task 1 first, children nodes-4740bb nodes-fbbf51 nodes-ec5b0d), then dispatch a fresh whole-branch reviewer; after landing, file the refs project on ops and the overview update on vdocs (spec §8)
  provenance: {"harness_session":"claude-code:569c9b6a-e9ba-4bc4-9e07-f584fa31dbb1","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
