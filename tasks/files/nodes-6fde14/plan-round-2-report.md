The plan at ace792b needs one more small revision before you approve it. The problem is that a test it plans would fail in CI. Otherwise it follows the design closely, and both round-4 minors are settled correctly. Task nodes-6fde14 is parked for plan review. The planning agent should fix the finding below in a new frozen revision. I'd let the three Minor points ride into execution, or fold them into the same revision, which is cheap.

I reviewed `docs/plans/2026-10-30-test-execution-policy.md` at ace792b (sha256 `5ed03d99…1262`). The design file is unchanged since cc5df73.

**Important**

1. **The Vitest reporter test would fail in CI.** Task 2 puts the Vitest reporter pilot in `python/tests/test_ci_evidence.py`, using "the installed Vitest". But the Python CI jobs only run `uv sync --frozen` in `python/`, so `ts/node_modules` doesn't exist there. No Python test depends on npm or Vitest today.
   - In both Python matrix jobs, that test fails, or becomes a skip that the plan's own evidence rules then flag as an unexplained omission.
   - It would also tie the Python suite locally to a TypeScript install.
   - Fix: keep the pytest pilot in Python and move the Vitest pilot into the TypeScript suite under `ts/tests/`, run by `test-one ts`. If it really must stay in Python, the plan has to say how the Python job gets the Node dependencies.

**Minor**

2. **The pre-push test needs an `ssh` stub.** Task 1's routing test asserts that "keepalive refusal remains", and the hook calls `ssh -G`. OpenSSH reads `<account-ssh-config>` from the account's home directory, not from `$HOME`. So a fixture `HOME` doesn't isolate it: the result would depend on the developer's real SSH config, and on a hosted runner the interval reads 0. A stub `ssh` on the fixture `PATH` makes the result deterministic.

3. **Say which path `tools/setup` compares against.** It picks the `work-link` row whose path is "the repository-root `python/.venv`". `work-link` builds that path from `git rev-parse --show-toplevel`, which is the physical path. A path built from `$PWD` through the `<synced-alias>` symlink wouldn't match, and setup would fail on "no matching row". The plan should say to use git's top level. Otherwise its status list matches the tool exactly: `outside`, `external`, `ok`, `created`, `relinked`, `materialized`, `rewritten`, and `needs-migration`. That last one exits 0, and the plan correctly fails on it. It also correctly ignores the anchor's own `created` row.

4. **Task 3 doesn't say where the `.tt.toml` commit is made.** The order is: merge the enabled hook split locally, record the floor note, then "add the coverage declarations and `.tt.toml`". It doesn't say whether that commit goes on the task branch or straight onto main. The worktree rule and "final review covers the small activation diff before integration" both point to the branch: make it there, review it, then merge. One sentence would settle it.

**Checked and sound:**
- **Manual Release run:** the publish jobs need a tag push, so a manually triggered run on the branch skips them. GitHub only allows that trigger for a workflow published on main, and Release's is. The plan rechecks this and pins the reviewed SHA.
- **Concurrency groups:** the evaluated group names and the case-folding check are right. Cancelling superseded runs only for standalone CI (`github.workflow == 'CI'`) leaves Release's serialization alone.
- **Hosted environment:** `TT_FORCE` set at job scope reaches the Release-called CI jobs too. PyYAML, which the workflow tests use, is a runtime dependency, so no new dependency is added.
- **Order and test hygiene:** the RED-first bootstrap through `test-fast`, the key-by-key test environments and the approval gates in Task 3 follow the project and global rules.

For the task record, the note is: `review: plan round 2 — verdict: revise; findings: Important 1, Minor 3; reviewer: claude/claude-opus-5-5`. The agent that resumes nodes-6fde14 should add it; as the reviewer, I didn't.
