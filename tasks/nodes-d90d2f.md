---
id: nodes-d90d2f
title: Add a just setup recipe that hydrates a fresh worktree (npm ci in ts/)
status: dropped
priority: 2
created: 2026-10-15T12:01:44Z
updated: 2026-10-17T20:35:31Z
closed: 2026-10-17T20:35:31Z
depends: []
tags: []
agent: claude-code/claude-opus-5-5
---

A new worktree has no ts/node_modules, so its pre-commit hook fails in tsc (missing node types) until someone runs npm ci by hand; the global worktree rule runs just setup when defined, and nodes defines none. CI's own step is npm ci (.github/workflows/ci.yml).

## Notes

- 2026-10-17T20:32:19Z (main): scope: drop; duplicate of nodes-9f6f50 (todo, source ops-9c7dab), which already asks for setup_cmd with npm ci in ts/ and a throwaway-worktree check; the tsc failure this idea observed is folded into that task's body; proposal: drop as covered by nodes-9f6f50
- 2026-10-17T20:35:31Z (main): dropped
  provenance: {"harness_session":"claude-code:6a32c545-6b7e-41f8-b075-62c745925b92","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-17T20:35:31Z (main): duplicate of nodes-9f6f50 (setup_cmd with npm ci in ts/); its observation is folded into that task's body; drop approved by the user 2026-10-17
  provenance: {"harness_session":"claude-code:6a32c545-6b7e-41f8-b075-62c745925b92","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
