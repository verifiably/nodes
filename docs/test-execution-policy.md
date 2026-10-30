# Test execution policy

Type: reference

Development commands run from any directory through the root justfile. Their
execution decisions come from the invoking Git top level's `.tt.toml`, validated
by vendored `tools/tt`. An absent file keeps broad verification enabled. There
is currently no policy-off activation or declared remote push coverage.

## Setup and focused work

Run `just setup` after creating a worktree or changing dependencies. It prepares
`python/.venv` with work-link, installs both frozen lockfiles and builds TypeScript.
The work-link result alone controls Dropbox handling: `outside` and `external`
leave environments in place; managed links require marks on generated npm output.
Installs can replace `node_modules`, so setup reapplies its mark immediately after
installation and marks `dist` after building. A link or attribute error fails setup.
The TypeScript build preserves its output directory; do not introduce deletion
without restoring the mark. CI installs each package separately outside Dropbox.

Use `just test-one python tests/test_paths.py` or
`just test-one ts tests/paths.test.ts`. Selectors resolve inside `python/` and
`ts/` respectively. Quote names and expressions normally: argv is forwarded
without interpolation. A language and at least one selector are required.
Do not use this protected route to run a whole suite as a policy bypass.

`just test-fast` retains pytest-testmon selection and Vitest's changed selection;
an empty affected selection is not a successful full-suite verification.
`just test` requests both complete suites. `just test-full` explicitly runs them
with `TT_FORCE=1`; only the inner suite produces a timing record. Use
`TT_FORCE=1 just check-code` for deliberate broad static verification.

## Hygiene, hooks and timing

`just check-hygiene` always runs ops-check, generated-document validation and
tasks check. `just check-code` runs Ruff, Pyright, tsc and Biome. `just check`
and `just gate` compose sequential children without enclosing timers.

Pre-commit times hygiene under its hook target, then requests check-code.
Pre-push preserves SSH keepalive and ref handling, clears Git-local environment
variables, times hygiene, then requests check-code and the suite. A push to
validated covered refs may use the existing fast selectors instead. Until
coverage is accepted, `ci_suite_refs` is empty. A policy-off uncovered push warns
and retains hygiene; it does not restore a local broad suite.

With an approved `automatic_broad=false` policy, broad test and code-check requests
record explicit skipped decisions with null outcomes. Protected focused/setup/
hygiene commands still run. Skips are not passing suites or latency samples.
Missing or invalid policy never means disabled. Hosted broad calls without
explicit `TT_FORCE=1` fail instead of silently skipping.

The old whole-hook timing series ends at hook-split integration. Hook timers now
measure hygiene only; child timings describe broad work separately. The old
`check` series also ends, replaced by check-hygiene and check-code. Do not splice
those series or add their medians as though they measured the old invocation.
Historical local medians were about 4.8 seconds for test, 6.6 for check, 7.3 for
commit hooks and 12.9 for push hooks. Expected savings are modest and unmeasured;
routine lint/type errors under policy-off may wait until a completed pushed CI
run, with further delay during queues, cancellation or outages.

## Activation and rollback

Policy-off activation requires a reviewed packet and explicit external approval,
then accepted hosted coverage at the reviewed SHA before committing `.tt.toml`.
The packet names setup, actual test/skip/module counts, unsupported capabilities,
public/private status, applicable billing controls, refs, run limits and rollback.
Neither a workflow trigger nor a green job alone proves equivalent coverage.

The intended broad target list is test, test-fast, check-code, ci-python and
ci-typescript. The intended origin coverage is all branches and Release's `v*`
tags, declared only after branch CI and an approved manual Release-on-branch
run validate the shared callable path. Publish jobs must skip in that dispatch;
no real release tag is used for this adoption check. Actual tag-trigger execution
remains untested. Runtime results belong in the activation packet, not assumptions.

Rollback enables automatic broad work, restores its local cadence and records
`policy: enabled at <RFC3339-UTC> revision <full-sha>` on nodes-6fde14 at the actual
landed time/revision. Publishing rollback is another gated external action.
Disabled timing obligations are explicitly policy-retired, never called
performance-verified; unrelated halts and remaining diagnosis stay intact.
The shared regret review is ops-56aab7, due 2026-11-28.
