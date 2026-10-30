---
id: nodes-6fde14
title: Adopt shared broad-test policy and remote verification
status: doing
priority: 2
size: m
complexity: mid
process: planned
owner: design/nodes-6fde14-test-policy
created: 2026-10-29T13:45:56Z
updated: 2026-10-30T14:36:18Z
started: 2026-10-30T13:43:25Z
depends: [ops-68729d]
tags: []
source: "tt-policy:nodes"
agent: codex
origin: agent
spec: docs/designs/2026-10-30-test-execution-policy-design.md
---

Adopt the approved shared test execution policy for this personal project after the ops pilot. Owner: the next nodes implementer; Keith approves external activation. State: pending preparation, not offloaded. Shared authority: ops-8bfa85 (read its approved spec and plan with tasks doc); pilot prerequisite ops-68729d.

Observed 2026-10-29: code checkout is its own Git top level; records kind in-tree; profile personal. Current policy file: absent (enabled). Wrapper: {"tools/tt": "# tt version 7"}. Commands: test-fast, test, check, hook-pre-commit, hook-pre-push, ci-python. Read [ref:front-door] for actual commands and setup. Workflows: .github/workflows/ci.yml, .github/workflows/release.yml.

Current command/ref declarations:
```
py_test_cmd := "(cd python && uv run --frozen pytest)"
ts_test_cmd := "(cd ts && npm test)"
fast_cmd := py_fast_cmd + " && " + ts_fast_cmd
test_cmd := py_test_cmd + " && " + ts_test_cmd
```

Prepare a reviewed project-specific design/plan and isolated worktree. Adopt the published wrapper only after ops and obs readers are live. Keep test-one/focused implementation checks and mandatory hygiene on; split broad lint/type/test work into explicit targets. Preserve current selectors and argument forwarding. Add the forced test-full route. Verify branch/ref coverage against workflow triggers and use explicit TT_FORCE=1 for the full remote suite, including nested recipes. One suite per push, latest-ref cancellation, no duplicate internal-PR run. Keep local policy enabled until an approved hosted invocation finishes with a nonzero test count and accepted coverage.

Inventory capability omissions and private sibling checkouts from actual workflow/setup; none are presumed equivalent to local verification.

Prepare the activation packet with current private-repository allowance and enforced no-paid-overage setting, setup, exact refs, executed tests, excluded modules and skipped-test/module counts. Publishing workflows, live global instruction/hook delivery and account changes require explicit approval. Existing work/external/shared Git roots are not independent opt-ins. Reuse host/profile proof only for identical setup paths. Detached records remain separate from code policy lookup.

After approved activation, commit .tt.toml with real broad target names, verify focused execution/recorded skip/forced failure/covered remote push, and retire each disabled timing obligation explicitly without claiming performance verification. Record the actual activation revision/time here. On hook-split integration and rollback write exactly: policy: enabled at <RFC3339-UTC> revision <full-sha>. This record's source tt-policy:nodes is the latency floor lookup key. Keep remaining diagnosis and unrelated obligations. Report status to ops-39bff6; never label pending work as offloaded. The first actual activation files the 30-day regret review under ops; no scheduler and no invented date.

## References

- front-door (input, required, kind=configuration): justfile

## Notes

- 2026-10-29T13:45:56Z (add): created
  provenance: {"harness_session":"codex:01a1874f-c2d8-7320-ae81-7114e37e343f","harness_session_source":"CODEX_THREAD_ID","origin":"agent"}
- 2026-10-30T13:43:25Z (main): started
  provenance: {"harness_session":"codex:01a18d0c-6692-7e81-aa23-4ca449feaad8","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-30T13:44:19Z (design/nodes-6fde14-test-policy): resumed
  provenance: {"harness_session":"codex:01a18d0c-6692-7e81-aa23-4ca449feaad8","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-30T13:45:17Z (design/nodes-6fde14-test-policy): Planned path in .worktrees/nodes-6fde14 on design/nodes-6fde14-test-policy; locked worktree hydrated with uv sync --frozen in python and npm ci in ts. No just setup exists. Full-suite baseline deferred until implementation Setup per planned-work rule. tt is already version 8 (task inventory version 7 is stale). npm ci reports 10 existing dependency vulnerabilities; no dependency edits made.
- 2026-10-30T13:47:41Z (design/nodes-6fde14-test-policy): Origin recovered using session-logs from codex:01a1874f-c2d8-7320-ae81-7114e37e343f: human turn at line 15 asks to reduce broad local testing while preserving focused implementation tests; turn at line 108 carries shared wrapper/CI/lore suggestions; line 538 explicitly approves the shared plan for inline execution. This adoption task is agent-derived. Project calls: retain both matrices, introduce language-qualified test-one, split hygiene, expand branch CI before policy-off. GitHub API with khughitt reports public visibility/admin rights; private allowance controls are inapplicable while public on standard runners. No public workflow or host changes authorized by design preparation.
- 2026-10-30T13:48:57Z (design/nodes-6fde14-test-policy): review: spec round 1 — verdict: accept; findings: none; reviewer: codex/gpt-6.1-sol
- 2026-10-30T13:49:06Z (design/nodes-6fde14-test-policy): attached: builder-check-report.md (869 bytes): Full read-only builder check by codex/gpt-6.1-sol of frozen design 13a879b; accepted with no findings.
- 2026-10-30T13:49:34Z (design/nodes-6fde14-test-policy): Frozen design 13a879b3a53d3429f1de335af898f0815a2ddcf9 accepted by builder with no findings, rulings or deferred minors. Full review is attached and tasks show lists it; SHA-256 202c320cfb5ff86272ab5842dace2240b6d20e49695e8e17c83e9476095ae3d4 matched workspace copy, which was removed. No scratch/evidence copy or host pointer remains. Design commit hook passed ops-check, ops-docs check, Ruff, Pyright, tsc, Biome and tasks check; git diff --check passed. No tests run: design-only phase, full baseline deferred to execution Setup. Policy absent/enabled; no implementation, merge, push or hosted activation.
- 2026-10-30T13:49:42Z (design/nodes-6fde14-test-policy): retained: {"host":"titan","kind":"worktree","path":".worktrees/nodes-6fde14","state":"kept","verification":"verified","purpose":"Frozen design and attached accepted builder check await user review; branch design/nodes-6fde14-test-policy is unmerged","next_owner":"task:nodes-6fde14","cleanup_trigger":"After user design and plan review, implementation and authorized integration, inspect ignored items and host pointers and harvest timings before considering removal"}
- 2026-10-30T13:49:50Z (design/nodes-6fde14-test-policy): parked (waiting on user, review): User reviews frozen 13a879b3a53d3429f1de335af898f0815a2ddcf9:docs/designs/2026-10-30-test-execution-policy-design.md in .worktrees/nodes-6fde14; after approval the agent resumes this worktree and writes the implementation plan for user review. No runtime or workflow activation yet.
  provenance: {"harness_session":"codex:01a18d0c-6692-7e81-aa23-4ca449feaad8","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-30T14:06:42Z (design/nodes-6fde14-test-policy): resumed
  provenance: {"harness_session":"codex:01a18d0c-6692-7e81-aa23-4ca449feaad8","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-30T14:06:50Z (design/nodes-6fde14-test-policy): review: spec round 2 — verdict: revise; findings: Important 3, Minor 4; reviewer: claude/claude-opus-5-5
- 2026-10-30T14:10:41Z (design/nodes-6fde14-test-policy): attached: spec-round-2-report.md (5411 bytes): Full spec round 2 review supplied by the user; reviewer claude/claude-opus-5-5, frozen 13a879b, revise with three Important and four Minor findings.
- 2026-10-30T14:10:48Z (design/nodes-6fde14-test-policy): attached: review-ledger.md (3810 bytes): Controller rulings for all seven spec round 2 findings; corrected frozen design cc5df73, none deferred.
- 2026-10-30T14:11:26Z (design/nodes-6fde14-test-policy): review: spec round 3 — verdict: accept; findings: none; reviewer: codex/gpt-6.1-sol
- 2026-10-30T14:11:33Z (design/nodes-6fde14-test-policy): attached: spec-round-3-report.md (1617 bytes): Full fresh builder review by codex/gpt-6.1-sol of frozen cc5df73; all seven round 2 findings addressed, accepted with none deferred.
- 2026-10-30T14:12:10Z (design/nodes-6fde14-test-policy): Spec round 2 review recorded before revision; all I1-I3 and M4-M7 accepted and corrected in new frozen cc5df734f321d9755496e344866776f6c289f11b, SHA-256 47d628ca42caf15f699fe59ac3eaf4b7ff5f43dbc8a6411f74c58f82f13a30ea. Round 3 fresh builder acceptance supersedes the review-ledger pending-review status; no findings or deferred minors remain. Full round 2, seven-ruling ledger and round 3 reports are attached, tasks show lists each, and byte equality/SHA-256 verified before workspace duplicates were removed. No scratch/evidence copy remains. Design commit hook passed hygiene, Ruff/Pyright/tsc/Biome and tasks checks; git diff --check passed. No tests run for this design-only revision; setup behavior and hosted evidence remain unimplemented/unverified. Policy absent/enabled; no push, merge, host-pointer or external change.
- 2026-10-30T14:12:18Z (design/nodes-6fde14-test-policy): retained: {"host":"titan","kind":"worktree","path":".worktrees/nodes-6fde14","state":"kept","verification":"verified","purpose":"Revised frozen design cc5df73 and attached round 2 review, seven rulings and accepted round 3 builder check await user design review; branch design/nodes-6fde14-test-policy remains unmerged","next_owner":"task:nodes-6fde14","cleanup_trigger":"After user design and plan approvals, implementation and authorized integration, inspect ignored files and host pointers and harvest timings before considering removal"}
- 2026-10-30T14:12:26Z (design/nodes-6fde14-test-policy): parked (waiting on user, review): User reviews frozen cc5df734f321d9755496e344866776f6c289f11b:docs/designs/2026-10-30-test-execution-policy-design.md (SHA-256 47d628ca42caf15f699fe59ac3eaf4b7ff5f43dbc8a6411f74c58f82f13a30ea) in .worktrees/nodes-6fde14. After approval the agent resumes here and writes the implementation plan for review. All seven spec round 2 findings are addressed; round 3 builder accepts. No implementation or activation yet.
  provenance: {"harness_session":"codex:01a18d0c-6692-7e81-aa23-4ca449feaad8","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-30T14:28:53Z (design/nodes-6fde14-test-policy): resumed
  provenance: {"harness_session":"codex:01a18d0c-6692-7e81-aa23-4ca449feaad8","harness_session_source":"CODEX_THREAD_ID"}
- 2026-10-30T14:29:01Z (design/nodes-6fde14-test-policy): review: spec round 4 — verdict: accept; findings: Minor 2; reviewer: claude/claude-opus-5-5
- 2026-10-30T14:29:08Z (design/nodes-6fde14-test-policy): User explicitly accepted frozen cc5df73 for planning. Design remains frozen and unchanged. Round 4 minors are assigned to the implementation plan: derive attribute marking from the successful work-link --ensure outside result, and validate Release-called CI with an explicitly approved workflow_dispatch on a branch, never by pushing a release tag. Planning only; implementation and external activation remain separately gated.
- 2026-10-30T14:35:49Z (design/nodes-6fde14-test-policy): attached: spec-round-4-report.md (3012 bytes): Full spec round 4 review supplied by the user; claude/claude-opus-5-5 accepts cc5df73 with two Minor plan clarifications; explicit user approval for planning follows.
- 2026-10-30T14:36:18Z (design/nodes-6fde14-test-policy): Created persistent scratch on titan at $WORK_ROOT/nodes/nodes-6fde14 for exact round 4 review bytes rejected by layout check; current owner task:nodes-6fde14, contents mutable until checkpoint. Raw file spec-round-4-report-raw.md preserves the verbatim user-supplied review; portable attachment will replace /mnt/ssd3/work with <work-storage>. Plan ace792b is unchanged.
