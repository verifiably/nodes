---
id: nodes-4edd5d
title: Rewrite t@t commit authorship in this repository
status: doing
priority: 2
size: s
complexity: low
process: direct
owner: main
created: 2026-10-16T16:32:51Z
updated: 2026-10-16T23:50:29Z
started: 2026-10-16T23:50:21Z
depends: [ops-e5b39c]
tags: []
source: git-identity-leak-2026-10-07
agent: claude-code/claude-opus-5-5
---

Rewrite this repository's t <t@t> commits (from the 2026-10-07 global-config leak; see ops-5749d9) to Keith Hughitt <keith.hughitt@gmail.com>, following the runbook ops-e5b39c. Inventory on titan 2026-10-16: 41 t@t commits on all refs, 30 unpushed on main, 1 worktree(s); remote: verifiably/nodes.

## Notes

- 2026-10-16T23:50:21Z (main): started
  provenance: {"harness_session":"claude-code:c6863573-34c2-470d-b394-259f7cc75503","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-16T23:50:29Z (main): Direct history maintenance under ops-e5b39c's pilot procedure (as mm-b15b67). Europa has no agent session. Inventory: 485 commits, 41 t@t (2026-10-08 on), all on main; origin/main reaches 11 of them (pushed). Tags core/v0.1.0, core/v0.1.1, v0.2.0 (lightweight) and refs/backup/main-before-trailer-strip, refs/original/refs/heads/main predate the window and stay unchanged; no stash, signatures, extra headers, repo-local user.*, or .git-blame-ignore-revs; one worktree (main) on both hosts. Remote verifiably/nodes main 0df76cf830f2b64f6bf19e42396d9e85d7c123f5 (lease). Steps: bundle --all; mirror; filter-repo --mailmap; byte-verify; citation check; guarded update-ref; attach map; just test-fast; push --force-with-lease.
