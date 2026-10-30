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
updated: 2026-10-30T13:45:17Z
started: 2026-10-30T13:43:25Z
depends: [ops-68729d]
tags: []
source: "tt-policy:nodes"
agent: codex
origin: agent
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
