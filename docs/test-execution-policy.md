# Test execution policy

Type: development guide; document types 1. How nodes runs its checks: setup,
the focused, fast and full test routes, hygiene versus broad checks, Git hooks,
hosted CI and its evidence artifacts, and rollback. [`AGENTS.md`](../AGENTS.md)
summarizes the gates and the [`justfile`](../justfile) defines every recipe.

Development commands run from any directory through the root justfile. Their
execution decisions come from the invoking Git top level's `.tt.toml`, validated
by vendored `tools/tt`. The committed policy disables automatic broad work;
an absent file keeps broad verification enabled. Origin coverage is declared
for `refs/heads/*` and Release's `refs/tags/v*`.

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

## Without the maintainers' host tools

`just setup` calls the maintainers' `work-link` and `just check-hygiene` calls
`tasks`; neither is published with this repository, so both recipes fail without
them. Contributors prepare each package as CI does instead, with `uv`, Node.js,
npm and `just` on `PATH`:

```sh
(cd python && uv sync --frozen)
(cd ts && npm ci && npm run build)
just test-one python tests/test_paths.py
just test-one ts tests/paths.test.ts
TT_FORCE=1 just test
TT_FORCE=1 just check-code
```

## Hygiene, hooks and policy skips

`just check-hygiene` always runs ops-check, generated-document validation and
tasks check. `just check-code` runs Ruff, Pyright, tsc and Biome. `just check`
and `just gate` compose sequential children without enclosing timers.

Pre-commit times hygiene under its hook target, then requests check-code.
Pre-push preserves SSH keepalive and ref handling, clears Git-local environment
variables, times hygiene, then requests check-code and the suite. A push to
validated covered refs may use the existing fast selectors instead.
A policy-off uncovered push warns and retains hygiene; it does not restore a
local broad suite. Hook timers measure hygiene only; child timings describe
broad work separately.

With an approved `automatic_broad=false` policy, broad test and code-check requests
record explicit skipped decisions with null outcomes. Protected focused/setup/
hygiene commands still run. Skips are not passing suites or latency samples.
Missing or invalid policy never means disabled. Hosted broad calls without
explicit `TT_FORCE=1` fail instead of silently skipping. Under policy-off,
routine lint and type errors may surface only in the next completed CI run.

## Hosted verification

The CI workflow retains Python 3.11/3.13 and Node 20/24 on standard
Ubuntu runners. It covers every branch push, including names with slashes,
and fork PRs; same-repository PR events skip duplicate suite jobs. It supports
manual dispatch and reusable Release calls. A literal nodes-ci concurrency
namespace avoids Release's case-insensitive group collision. Superseded standalone
CI runs cancel; Release keeps its own serialization. Cancelled heads are unverified.

Each verification job has a 15-minute timeout and explicitly sets TT_FORCE=1,
including the jobs invoked by Release. Complete package suites and static checks
run through ci-python/ci-typescript. These recipes require an absolute
NODES_CI_EVIDENCE_DIR; they add reporting flags without selecting tests. Local
commands retain their original selections. The Python suite needs no Node install.

JUnit reports and module inventories live under RUNNER_TEMP outside tt's temporary
JUnit directory. Each matrix job uploads a unique coverage artifact retained for
30 days, including after a failing suite/static check. Explicit file checks fail
missing JUnit or inventory rather than accepting an inventory-only artifact.
The inventory contains the exact Git SHA, tracked test-root paths and discovery
configuration. Match module/case identities and summary counts against that
inventory; list excluded or unexplained absent modules, partially/wholly skipped
modules and reasons. A missing/unknown case blocks acceptance. Pytest includes
runtime skip reasons; Vitest may not, so annotate guards from the exact source
revision as source-derived reasons, never claim they were runtime messages.
Neither a workflow trigger nor a green job alone proves equivalent coverage.

The broad target list is test, test-fast, check-code, ci-python and ci-typescript.
Origin coverage includes all branches and Release's `v*` tags. Manual npm dry-runs
use --force to rehearse already-published versions; tag dry-runs and real
publication retain registry eligibility checks. Actual tag-trigger execution and
manual-path registry eligibility remain untested.

## Rollback

Set `automatic_broad = true` in `.tt.toml`, or remove the file, to restore local
broad runs and their hook cadence. Publishing a rollback is a separate, gated
action.
