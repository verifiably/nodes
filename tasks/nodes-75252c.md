---
id: nodes-75252c
title: Validate approved hosted paths and activate policy
status: doing
priority: 2
size: m
complexity: mid
process: direct
owner: design/nodes-6fde14-test-policy
created: 2026-10-30T14:38:16Z
updated: 2026-10-30T16:30:04Z
started: 2026-10-30T15:35:59Z
depends: [nodes-3ce05a]
parent: nodes-6fde14
tags: []
source: "nodes-6fde14:plan-task-3"
agent: codex
origin: agent
spec: docs/designs/2026-10-30-test-execution-policy-design.md
plan: docs/plans/2026-10-30-test-execution-policy.md
step: "Task 3: Validate approved hosted paths and activate policy"
---

Initial authorized runtime1dfcc54 push and branch CI succeeded; manual Release41084963994 failed only npm dry-run for already-published0.2.0; both publish jobs skipped. Policy remains absent/enabled and main unmerged. Corrected runtime8695d91ab87150c4dc9ac083c477d5542a97dddb and packet52cf368967699b709c22db0a45e0b68464518cda are frozen for fresh scoped review. Then obtain renewed approval of one corrected branch push, one conditional manual Release dispatch, and conditional reviewed policy-off main push. No retries, tags, package publication, paid compute or account changes. Parent nodes-6fde14 owns retained worktree and hashed evidence.

## Notes

- 2026-10-30T14:38:16Z (add): created
  provenance: {"harness_session":"codex:01a18d0c-6692-7e81-aa23-4ca449feaad8","harness_session_source":"CODEX_THREAD_ID","origin":"agent"}
- 2026-10-30T14:38:24Z (design/nodes-6fde14-test-policy): Await user review of complete frozen plan ace792b before implementation.
  provenance: {"harness_session":"codex:01a18d0c-6692-7e81-aa23-4ca449feaad8","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-30T15:35:59Z (design/nodes-6fde14-test-policy): started
  provenance: {"harness_session":"codex:01a18d0c-6692-7e81-aa23-4ca449feaad8","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-30T15:41:26Z (design/nodes-6fde14-test-policy): Concrete packet is a540c756a90bf0a14e16ddf74849f60d8a71cc9d:docs/notes/2026-10-30-test-policy-activation.md. Whole-branch review plus fresh scoped correction accepted; full reports attached to nodes-3ce05a and full execution ledger attached to parent nodes-6fde14. Runtime snapshot1dfcc543bed337281662b4d4b7c6acb4416d0391 is immutable; later branch commits are docs/records only. Focused final81Python/1TS, hygiene/static and actionlint0 passed; latest fastPython0selected/TS1pass, no full-current-suite or hosted coverage claim. Parent owns current hashed execution/raw review evidence and shared worktree. No remote work, policy file, main merge, global account change, service or host-pointer change.
- 2026-10-30T15:41:34Z (design/nodes-6fde14-test-policy): parked (waiting on user, approval): User approves the three bounded external actions in packet a540c75: initial push of runtime1dfcc543bed337281662b4d4b7c6acb4416d0391 to origin design/nodes-6fde14-test-policy; after accepted branch coverage one manual Release dispatch at that exact remote SHA; only after both paths pass one reviewed policy-off origin/main integration push. Then the agent resumes this worktree, rechecks auth/visibility/remote SHA, executes approved actions and inspects every matrix job/artifact. No retries or real tags included.
  provenance: {"harness_session":"codex:01a18d0c-6692-7e81-aa23-4ca449feaad8","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-30T15:48:29Z (design/nodes-6fde14-test-policy): resumed
  provenance: {"harness_session":"codex:01a18d0c-6692-7e81-aa23-4ca449feaad8","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-30T15:48:37Z (design/nodes-6fde14-test-policy): User explicitly approved all three actions in packet a540c75: one initial push of runtime1dfcc543bed337281662b4d4b7c6acb4416d0391 to origin design/nodes-6fde14-test-policy, one manual Release dispatch only after accepted branch coverage, and one reviewed policy-off main push only after both verification paths pass. No retries, real tags, package publication, paid compute or account/billing changes authorized.
- 2026-10-30T15:53:47Z (design/nodes-6fde14-test-policy): Approved initial branch push completed at runtime1dfcc543bed337281662b4d4b7c6acb4416d0391. Hosted CI https://github.com/verifiably/nodes/actions/runs/41084263091 accepted after artifact reconciliation: Python3.11/3.13 each811 passed in52 modules; Node20/24 each593 passed in51 modules; zero skips, failures, wholly/partially skipped or excluded/absent modules. Local pre-push811Python/593TS passed. One approved push consumed; proceed with the already-approved conditional Release dispatch at this exact remote SHA.
- 2026-10-30T16:06:47Z (design/nodes-6fde14-test-policy): Manual Release run41084963994 at approved runtime1dfcc543bed337281662b4d4b7c6acb4416d0391 failed only npm publish dry-run: version0.2.0 already published. Called CI matrix and build passed; artifact/smoke/PyPI dry-run steps passed; both publish jobs skipped. No retry, merge, .tt.toml or activation. Upstream investigation before local reproduction: searched npm/cli open/closed issues and PRs (4927,7993,8286,9188,1559), default latest and maintained release/v11 sources, v11.19.1 hosted source and latest changelog. Duplicate-version rejection is intentional and independent of dryRun; force bypasses registry eligibility while dryRun separately prevents upload. No upstream defect patch needed. Prepare manual-only dry-run correction and fresh reviewed packet, then seek further external authorization.
- 2026-10-30T16:11:14Z (design/nodes-6fde14-test-policy): attached: branch-coverage.json (1179 bytes): Accepted four-job coverage for initial standalone CI41084263091 at runtime1dfcc54
- 2026-10-30T16:11:22Z (design/nodes-6fde14-test-policy): attached: release-coverage.json (1179 bytes): Accepted called-CI coverage within failed manual Release41084963994; not an overall Release pass
- 2026-10-30T16:11:32Z (design/nodes-6fde14-test-policy): attached: hosted-validation-report.md (2570 bytes): Initial hosted outcomes, duplicate-version failure, local correction and remaining authorization gate
- 2026-10-30T16:13:12Z (design/nodes-6fde14-test-policy): review: impl round 1 — verdict: accept; findings: none; reviewer: codex/gpt-6-astra
- 2026-10-30T16:13:20Z (design/nodes-6fde14-test-policy): attached: release-rehearsal-review-report.md (3722 bytes): Full fresh read-only scoped review by codex/gpt-6-astra of runtime8695d91 and packet52cf368; accept, zero findings
- 2026-10-30T16:15:27Z (design/nodes-6fde14-test-policy): Parent nodes-6fde14 owns the retained worktree,87-entry task storage and84-entry execution evidence, with fresh manifest hashes and both raw supplied-review hashes recorded there. Scoped correction accepted at runtime8695d91/packet52cf368; full report and both original hosted coverage summaries are attached here. Latest remote head remains1dfcc54; no additional push/dispatch, policy file or main merge. No persistent session processes.
- 2026-10-30T16:15:34Z (design/nodes-6fde14-test-policy): parked (waiting on user, approval): User approves revised packet52cf368: one push of runtime8695d91ab87150c4dc9ac083c477d5542a97dddb to origin design/nodes-6fde14-test-policy, then one conditional manual Release dispatch, then conditional reviewed policy-off main push; agent resumes, rechecks auth/public/exact remote SHA and executes only those bounded actions. Original no-retry approval is consumed; no tags or publication.
  provenance: {"harness_session":"codex:01a18d0c-6692-7e81-aa23-4ca449feaad8","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-30T16:23:04Z (design/nodes-6fde14-test-policy): resumed
  provenance: {"harness_session":"codex:01a18d0c-6692-7e81-aa23-4ca449feaad8","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-30T16:23:12Z (design/nodes-6fde14-test-policy): User approved revised packet52cf368 this turn: one push of corrected runtime8695d91ab87150c4dc9ac083c477d5542a97dddb to origin design/nodes-6fde14-test-policy; after accepted standalone coverage one manual Release dispatch at that same remote SHA; only after both paths pass and activation diff review one main integration push. No retries, real tags, package publication, paid compute or account changes. Verified both retained manifests and all member hashes, public visibility/admin access and named gh account before execution.
- 2026-10-30T16:27:30Z (design/nodes-6fde14-test-policy): Corrected branch push at8695d91 succeeded. CI41089556252 accepted after exact SHA, complete module/config inventory and every JUnit identity reconciled: Python3.11/3.13 each813 passed/52modules; Node20/24 each593 passed/51modules; zero skipped, failed, partly/wholly skipped or absent/excluded modules. Approved manual Release41089968448 dispatched once after auth/public/published-workflow/remote-SHA checks; recorded event workflow_dispatch and branch/SHA correct. Submission alone is not success; main remains unmerged and policy enabled.
- 2026-10-30T16:30:04Z (design/nodes-6fde14-test-policy): Corrected standalone CI41089556252 and manual Release41089968448 both accepted at8695d91 after complete exact-SHA/module/config/JUnit reconciliation: Python813/52modules per job, TS593/51modules per job, zero skips or omissions. Build/verify-artifacts passed and publish-npm/publish-pypi skipped. Conditional activation approval is now effective; proceed with local enabled integration/floor, branch-local activation and fresh review before the one main push. No actual tag execution or package publication.
