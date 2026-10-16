---
id: nodes-4edd5d
title: Rewrite t@t commit authorship in this repository
status: done
priority: 2
size: s
complexity: low
process: direct
owner: main
created: 2026-10-16T16:32:51Z
updated: 2026-10-16T23:52:33Z
started: 2026-10-16T23:50:21Z
completed: 2026-10-16T23:52:33Z
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
- 2026-10-16T23:51:07Z (main): attached: 2026-10-16-identity-commit-map.txt (3690 bytes): Authorship rewrite map: 45 changed commit IDs (old new); resolves historical SHA references in task notes and docs without editing them
- 2026-10-16T23:52:33Z (main): done
  provenance: {"harness_session":"claude-code:c6863573-34c2-470d-b394-259f7cc75503","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-16T23:52:33Z (main): Rewrote 41 t@t commits to Keith Hughitt (82 identity lines, 45 hashes changed) in one filter-repo pass in a mirror outside Dropbox; verified all 487 commits byte-for-byte (only mapped parents and identities differ; no message SHAs; every tree preserved). Tags core/v0.1.0, core/v0.1.1, v0.2.0 and the refs/backup and refs/original refs predate the window and are unchanged. Swapped main in one guarded update-ref transaction; working tree untouched. Only rewritten SHA cited in tracked files is this task's own lease note; map attached (tasks/files/nodes-4edd5d/2026-10-16-identity-commit-map.txt). just test-fast selects no tests on an unchanged tree, so ran just test: green. Pushed main with lease 0df76cf -> 11e5b42 (verifiably/nodes, unprotected); a fresh remote mirror, Titan and Europa show 0 t@t, Europa refs synced and fsck clean. Forced only past ops-e5b39c, whose pilot procedure was followed. Bundle, index backup, mirror, ref transaction and verification kept on Titan at WORK_ROOT/nodes/identity-rewrite-20261016T235036Z.
  provenance: {"harness_session":"claude-code:c6863573-34c2-470d-b394-259f7cc75503","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
