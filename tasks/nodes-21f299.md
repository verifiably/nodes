---
id: nodes-21f299
title: Triage dependency audit findings reported during setup
status: todo
priority: 2
size: s
complexity: mid
process: direct
created: 2026-10-30T17:04:23Z
updated: 2026-10-30T17:04:23Z
depends: []
tags: [hygiene]
source: "nodes-6fde14:dependency-triage"
agent: codex
origin: agent
---

Setup during nodes-6fde14 reported 10 inherited npm dependency advisories on 2026-10-30: 3 moderate, 5 high and 2 critical. Those are historical install counts, not a current audit or a reachability finding; adoption changed no dependency versions and intentionally left triage out of scope. Obtain a fresh read-only audit against ts/package-lock.json, identify affected locked packages and distinguish shipped runtime exposure from build/test-only exposure. Before reproducing or patching a third-party defect, check official advisories, maintainer releases/changelog, open and closed issues/PRs, and default/maintained development branches for an existing report or fix. Record a justified disposition for each advisory and create bounded remediation tasks only where needed; no wholesale or forced audit upgrade is authorized by this triage. Done when current findings, exposure, upstream status and dispositions are recorded. Any fixes use the task worktree and the declared focused/hygiene routes under current policy.

## References

- evidence (input, required, kind=note): docs/notes/2026-10-30-test-policy-activation.md — recorded setup audit counts and scope limits

## Notes

- 2026-10-30T17:04:23Z (add): created
  provenance: {"harness_session":"codex:01a18d0c-6692-7e81-aa23-4ca449feaad8","harness_session_source":"CODEX_THREAD_ID","origin":"agent"}
