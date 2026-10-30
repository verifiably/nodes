I reviewed the frozen revision 13a879b of `.worktrees/nodes-6fde14/docs/designs/2026-10-30-test-execution-policy-design.md` (sha256 `fa4237da…b10d`). My verdict is **revise**: three Important findings and four Minor ones. Nothing is wrong with the overall approach, which matches the approved shared ops design. Task nodes-6fde14 stays parked waiting on your review. The design agent should fix the findings in a new frozen revision before planning starts. I only read things: no files, task notes or GitHub settings changed. That includes read-only calls to the GitHub API for branch protection and rulesets.

**Important**

1. **The `setup` route leaves out the Dropbox handling.** The spec's setup is just `uv sync --frozen` plus `npm ci`. The ops template's `setup_cmd` starts with `work-link` and then re-marks `node_modules` with `attr -s com.dropbox.ignored`, because a package manager can replace that directory and lose the mark. In the main checkout, `ts/node_modules` and `ts/dist` carry that attribute today, set by hand. `python/.venv` is linked off the synced tree. If the new `just setup` runs there, `npm ci` recreates `node_modules` without the attribute, and Dropbox starts syncing it. The spec should take the template's pattern, and a failure to set the attribute should fail setup.

2. **Nothing can produce the skip evidence the spec requires.** It wants, per matrix job, skipped-module counts and excluded modules with reasons.
   - pytest runs with `addopts = "-q"`, with no `-rs` and no junit output, so the hosted log shows counts but no skip reasons.
   - `tt`'s junit directory is temporary and deleted after the run, and its run log stays on the runner.
   - The spec has to choose one route: `-rs` on the CI commands (which conflicts with its "reuse the current command strings" rule), uploading junit as an artifact, or counts from the summary lines plus a static list of the 37 skip guards. As written, the activation packet can't be assembled.

3. **The design records no cost baseline for nodes.** This host's run log (successful runs) shows:

   | Target | Median | Runs |
   | --- | --- | --- |
   | `test` | 4.8 s | 71 |
   | `check` | 6.6 s | 72 |
   | `hook-pre-commit` | 7.3 s | 230 |
   | `hook-pre-push` | 12.9 s | 26 |

   - So switching policy off saves roughly 6 s per commit and 13 s per push.
   - The cost is that Ruff, Pyright, tsc and Biome errors only show up after a push.
   - The shared design's stated aim is moving "expensive static checks"; it also names `check-code` as broad and aims for policy-off in every authorized project.
   - I recommend keeping `check-code` broad, consistent with that approved contract. The alternative I rejected is keeping it local in nodes only.
   - Either way, the numbers belong in "Current evidence" so your approval is informed. Whether nodes keeps lint and typecheck local is your call.

**Minor**

4. **A concurrency group could collide with Release's.** When Release calls CI, the `github` context in CI belongs to the caller. So a group like `${{ github.workflow }}-${{ github.ref }}` becomes `Release-refs/tags/v…`. As I recall GitHub's docs, group names are case-insensitive, which would make that the same group as Release's `release-${{ github.ref }}`. I haven't re-checked that against the docs. The spec already warns against reusing Release's group; naming this specific trap would help the builder.

5. **The coverage declaration doesn't match the real triggers.** `ci_suite_refs = "refs/heads/*"` leaves out `refs/tags/v*`, which Release does gate through CI. Under policy-off, a tag push would print the "remote coverage not declared" warning when coverage actually exists. The shared design asks for the declaration to be checked against actual triggers.

6. **Two documentation gaps.**
   - `check` becomes an untimed alias, which ends its 72-sample timing series; the spec mentions only the hook timing change.
   - `test-one python` arguments are resolved from inside `python/`, because the command does `cd python` first. The guide should say so.

7. **Name the regret review task.** The spec says the shared regret review "already exists". It is ops-56aab7, deferred to 2026-11-28; the spec should give the id.

**Claims I checked and found accurate:** `tools/tt` is version 8 and refuses a hosted skip without `TT_FORCE=1`. `.tt.toml` is absent. The justfile and hook descriptions match the code, and the planned hook split matches the ops template. `ci_remote` and `ci_suite_refs` are justfile variables in the ops pattern, which fits `tt`'s two-key policy file. The CI triggers, matrices and Release's call to CI are as described. ops-68729d is done. The repository has no branch protection and no rulesets, so skipped same-repository PR jobs affect no required checks. An earlier spec round 1 (codex/gpt-6.1-sol) accepted the design with no findings; I disagree on the points above.

For the task record, the note for this round is: `review: spec round 2 — verdict: revise; findings: Important 3, Minor 4; reviewer: claude/claude-opus-5-5`. As the reviewer I didn't write it; the agent that resumes nodes-6fde14 should add it before revising.

Nothing was pushed, and no processes were left running. The worktree `.worktrees/nodes-6fde14` and its branch `design/nodes-6fde14-test-policy` are unchanged and unmerged; integration happens after design approval, planning and implementation.
