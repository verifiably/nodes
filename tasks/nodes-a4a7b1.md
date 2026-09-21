---
id: nodes-a4a7b1
title: Scrub machine layout from tracked files and commit ops-check 5
status: done
priority: 2
size: s
complexity: low
process: direct
owner: main
created: 2026-09-21T13:06:07Z
updated: 2026-09-21T21:05:41Z
started: 2026-09-21T21:05:04Z
completed: 2026-09-21T21:05:41Z
depends: []
tags: []
source: ops-0c42b9
model: "claude-opus-5[1m]"
agent: "claude-code/claude-opus-5[1m]"
---

ops-check 5 (ops ops-0c42b9) fails on this machine's layout in any tracked file: the home directory, the hostname, WORK_ROOT, a registered checkout or its parent, the banned tracker host. tools/ops-check is already updated in the working tree but uncommitted, because the pre-commit hook refuses every commit here until these findings are gone. Per file: rewrite the path or hostname neutrally; drop the file when it is captured scratch that does not belong in the repository; or, for evidence that must stay verbatim, list its path prefix under layout_allowed in a root .ops-check.toml. Commit tools/ops-check in the same change.

Findings (11 lines in 6 files):
- docs/plans/2026-06-21-nodes-ts-kernel-plan.md: the home directory
- docs/plans/2026-06-22-nodes-ts-knowledge-vocab-plan.md: the home directory, the parent of a registered checkout
- docs/plans/2026-06-22-nodes-ts-structural-index-plan.md: the home directory, the parent of a registered checkout
- docs/plans/2026-07-10-nodes-standard-and-check-plan.md: the home directory, the parent of a registered checkout
- docs/plans/2026-07-11-nodes-membership-traversal-and-check-plan.md: the home directory, the parent of a registered checkout
- docs/superpowers/plans/2026-08-17-nodes-detailed-review.md: the home directory, the parent of a registered checkout

## Notes

- 2026-09-21T21:05:04Z (main): started
  provenance: {"harness_session":"claude-code:6819244b-2358-447b-8b92-1c2457c77557","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-21T21:05:41Z (main): done
  provenance: {"harness_session":"claude-code:6819244b-2358-447b-8b92-1c2457c77557","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-09-21T21:05:41Z (main): ops-check 5 committed; six plan-doc convention lines that spelled out the home and sync-root paths rewritten neutrally, no allowlist needed
  provenance: {"harness_session":"claude-code:6819244b-2358-447b-8b92-1c2457c77557","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
