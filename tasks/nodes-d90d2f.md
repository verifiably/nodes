---
id: nodes-d90d2f
title: Add a just setup recipe that hydrates a fresh worktree (npm ci in ts/)
status: idea
priority: 2
reviewed: true
reviewed_at: 2026-10-17T20:32:19Z
created: 2026-10-15T12:01:44Z
updated: 2026-10-17T20:32:19Z
depends: []
tags: []
agent: claude-code/claude-opus-5-5
---

A new worktree has no ts/node_modules, so its pre-commit hook fails in tsc (missing node types) until someone runs npm ci by hand; the global worktree rule runs just setup when defined, and nodes defines none. CI's own step is npm ci (.github/workflows/ci.yml).

## Notes

- 2026-10-17T20:32:19Z (main): scope: drop; duplicate of nodes-9f6f50 (todo, source ops-9c7dab), which already asks for setup_cmd with npm ci in ts/ and a throwaway-worktree check; the tsc failure this idea observed is folded into that task's body; proposal: drop as covered by nodes-9f6f50
