---
id: nodes-24226f
title: "Document the nodes model: shapes, kinds, facets, consumers and the reference boundary"
status: doing
priority: 2
size: s
complexity: low
process: planned
owner: main
created: 2026-10-29T01:54:53Z
updated: 2026-10-29T01:55:02Z
started: 2026-10-29T01:55:02Z
depends: []
tags: [docs]
agent: claude-code/claude-fable-5-1
origin: user
---

Make the nodes model legible from the README, AGENTS.md and the package guides: the shape / kind / facet composition (the 2022–2023 "structure + domain building blocks" model, which is what the kernel implements), the consumer map that commit 629ecd0 dropped, that nodes runs without atoms, and what nodes deliberately does not do (external references and meaning, durability), each pointing at where it lives instead. Documentation only; no kernel change.

Context: brainstorm on 2026-10-28 in the nodes checkout; agreed direction is a separate `refs` project below the profiles for external references (vocabularies pinned to releases, external or self-issued), with nodes unchanged. That project and the vdocs overview update are filed separately once this spec is approved.

## Notes

- 2026-10-29T01:54:53Z (add): created
  provenance: {"harness_session":"claude-code:569c9b6a-e9ba-4bc4-9e07-f584fa31dbb1","harness_session_source":"CLAUDE_CODE_SESSION_ID","origin":"user"}
- 2026-10-29T01:55:02Z (main): started
  provenance: {"harness_session":"claude-code:569c9b6a-e9ba-4bc4-9e07-f584fa31dbb1","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
