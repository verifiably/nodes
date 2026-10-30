# Nodes test execution policy adoption

Status: revised after spec round 2; proposed for user review. Task: nodes-6fde14.
No implementation, workflow publication or policy-off activation is authorized by
this draft. Implementation planning follows user approval of the frozen design.

## Intent and authority

The originating human request in the ops-8bfa85 filing session asks to reduce
local contention and repeated broad verification while keeping focused tests
during implementation. The user subsequently approved shared wrapper ownership,
remote regression suites and policy-aware instructions. This project-specific
adoption task was filed by an agent; the choices below are the designer's calls,
not additional human decisions.

Shared authority is ops-8bfa85's approved design and implementation plan, read
through `tasks doc`. Its ops-68729d pilot is done with accepted hosted evidence
before and after activation. Consumer-first delivery and lore instructions are
recorded there as delivered. This task verifies the relevant delivery revisions
again at execution Setup rather than reproducing the shared machinery.

The nodes Standard governs kernel behavior. This change affects development
infrastructure only: no portable format, mutation, finding or language API changes,
no parity-tier feature, and no conformance-oracle changes.

## Current evidence (2026-10-30)

- `tools/tt` is already version 8; the task's version-7 observation is stale.
  It validates checkout-local policy, protects focused and hygiene targets, records
  null-outcome skips, and refuses hosted skips without explicit force.
- No `.tt.toml` exists. Automatic broad execution remains enabled.
- `just test` runs both complete package suites. `test-fast` uses pytest-testmon
  and Vitest's changed selection; the TypeScript command retains
  `--passWithNoTests`. No `test-one`, `test-full` or `setup` exists.
- `check` and both hook recipes embed ops-check, ops-docs, Python Ruff/Pyright,
  TypeScript tsc/Biome and tasks check into opaque shell commands. The pre-push
  script preserves SSH keepalive checks and clears Git-local environment variables.
  There is no remote/ref coverage declaration or shortened push route yet.
- CI runs Python 3.11/3.13 and Node 20/24, on standard Ubuntu hosted runners.
  It uses frozen uv/npm installs and pinned actions, runs only on main pushes,
  also runs on every PR, and is reusable by Release. No explicit force,
  latest-ref cancellation or manual CI dispatch is configured.
- Release calls CI before its artifact and publishing jobs. Tag releases and
  deliberate release dispatches are separate events whose verification remains.
- With the profile account, GitHub's repository API reports public visibility
  and admin access. Standard hosted compute for public repositories is free
  under current GitHub documentation. Private allowance and no-paid-overage
  settings are inapplicable while it stays public on standard hosted runners;
  visibility and runner class must be rechecked before activation. No billing
  setting is changed or paid compute authorized here.
- No private sibling checkout appears in package dependencies or CI setup.
  Both languages read the shared in-repository fixtures. Filesystem tests can
  skip for unsupported symlinks, case behavior, Windows or privileged users.
  These are potential omissions, not measured hosted skip counts.
- No open task tagged test-latency or halt was returned in the registered main
  checkout. Reinventory at activation, including each incident's host/target notes.
- The isolated tree was hydrated with `uv sync --frozen` in Python and `npm ci`
  in TypeScript, using existing lockfiles. npm reported ten dependency
  vulnerabilities (three moderate, five high, two critical); dependency upgrades
  are outside this infrastructure change. This is installer output, not a
  vulnerability assessment. The planned full-suite baseline waits for execution
  Setup; no test count or hosted equivalence is claimed by this design.

Successful local wrapper executions in this host's shared tt log, read through
ops tt-report's validated parser on 2026-10-30 (all available history, no fallback
harvest), give this descriptive cost baseline:

| Target | Median seconds | Successful executed runs |
| --- | ---: | ---: |
| test | 4.760 | 71 |
| check | 6.593 | 72 |
| hook-pre-commit | 7.293 | 232 |
| hook-pre-push | 12.906 | 26 |

Rows span 2026-09-05 through 2026-10-30; test/check series end on 2026-10-29.
The round-2 reviewer reported 230 commit-hook runs at 7.3 seconds; this fresh
snapshot has 232 at the same rounded median. These are successful invocation
wall times, mixing content, hosts' session load and nested work, not an
uncontended benchmark or a measured post-adoption saving. Roughly six seconds
per commit and thirteen per push is the reviewer's opportunity estimate;
always-run hygiene remains, so actual savings need post-adoption measurement.

Designer decision: retain check-code as broad, consistent with the approved
shared contract, rather than keeping all static checks local only in nodes.
The local cost is modest. The accepted tradeoff proposed for user approval is
that routine Ruff, Pyright, tsc and Biome failures can remain undiscovered until
the next push and completed CI run; focused implementation checks and deliberate
`TT_FORCE=1 just check-code` remain available. CI queues, cancellation or failure
can delay that feedback further. No claim that these checks are individually
expensive or that nodes has measured large savings is made.

## Approaches

1. Adopt tt policy at existing command boundaries and retain both language
   matrices: selected by the designer. Split mandatory hygiene from broad work,
   add a real focused route, and improve existing CI rather than adding another
   workflow. This preserves current supported-version coverage.
2. Reduce CI to one Python and one Node version: rejected because it sacrifices
   established coverage solely to reduce job count. One workflow per push does
   not mean one job.
3. Keep all local gates and merely widen CI triggers: rejected because it leaves
   the originating contention problem unchanged. New selectors, sampling and
   dependencies are unnecessary; existing affected-test selectors remain usable.

## Command contract

Reuse the existing test selections and static-check commands and standard ops
hook/template patterns. CI reporting flags are an explicit exception to unchanged
command strings: add persistent JUnit output as specified below without changing
test selection. Every executed check goes through the existing vendored tt;
do not edit that copy.

| Route | Contract |
| --- | --- |
| `setup` | Protected, timed route: prepare managed links before frozen dependency installs, then reapply Dropbox marks after npm installs/builds in synced checkouts, as detailed below. Build TypeScript output if guide checks require it. No shared environment or host launcher changes. |
| `test-one <python\|ts> <runner args...>` | Protected focused route, requires a language and at least one selector argument; forwards remaining argv intact. Python uses the unselected pytest command from python/; TS uses the existing npm test/build command from ts/ with npm's argument separator. Unknown language fails early. No shell interpolation of user arguments. |
| `test-fast` | Existing pytest-testmon and Vitest changed commands, unchanged selection and argument semantics; classified broad. |
| `test` | Existing complete Python and TS suites; classified broad. |
| `test-full` | Untimed alias `TT_FORCE=1 just test`; only the inner suite is recorded. |
| `check-hygiene` | Always-run ops-check, ops-docs check and tasks check. |
| `check-code` | Existing complete Ruff, Pyright, tsc and Biome commands; classified broad. |
| `check` | Sequential hygiene then check-code, without an enclosing timer. |
| `gate` | Sequential check then test. |
| `hook-pre-commit` | Time mandatory hygiene once under the hook target, then invoke check-code as its own child. |
| `hook-pre-push` | Time mandatory hygiene once, then invoke check-code and test separately. |
| `hook-pre-push-fast` | Same hygiene/check-code children, then existing test-fast command; no new push selector. |
| `ci-python`, `ci-typescript` | Complete package suite plus existing static checks, each timed once under its CI target; add persistent CI JUnit reporting without test selection. Classified broad so a missing hosted force cannot silently succeed. |

Local setup follows ops's Dropbox handling, not merely the package installs.
Before uv sync, invoke the existing work-link tool's ensure route for
`python/.venv` from the repository root; in the synced main checkout it must
resolve to managed host-local storage. Outside the configured synced root,
work-link's explicit outside result leaves environments in-tree. Do not migrate
or replace an unrelated environment silently. In a synced checkout, run
`attr -s com.dropbox.ignored -V 1 node_modules` from ts/ immediately after
`npm ci`, and the corresponding mark on `dist` immediately after any build
that creates/replaces it. Missing tooling, failed link preparation or failed
attribute writes fail setup; do not swallow them. Repeated setup must preserve
the marks even when npm replaces directories. Mark only generated paths,
never their source parents. Builds outside setup that replace these directories
must retain/reapply the marks too. Hosted package setup remains the existing
frozen install path outside Dropbox and needs neither work-link nor attr.
The implementation plan must prove synced and outside-tree behavior with
isolated fixtures, including a failed attribute operation, without taking over
the host's main environment or changing its existing marks.

The guide must state that focused selectors resolve inside the selected package:
`just test-one python tests/test_paths.py` names a path relative to python/,
and `just test-one ts tests/paths.test.ts` names one relative to ts/.
Do not prefix the selector with the package directory again.

A caller can deliberately select all tests through runner arguments; documentation
must forbid using test-one as a policy bypass. The interface requires a selector
but need not invent a parser for each runner's selection language. Focused TS runs
still build the package because existing tests consume its output.

After accepted hosted verification and approval, commit:

```toml
automatic_broad = false
broad_targets = ["test", "test-fast", "check-code", "ci-python", "ci-typescript"]
```

Composing aliases and protected hook/focused/setup/hygiene targets stay outside
that list. Missing policy means enabled; malformed policy is an error, including
under force. Skips are decisions, never passing suites or performance samples.
Hook timing becomes hygiene-only and cannot be compared directly with historical
whole-hook timings. The old timed check series (72 successful samples above)
also ends: check becomes an untimed alias, and check-hygiene/check-code begin
new series. Do not splice or sum their medians into a continuation of check.

Adopt the standard pre-push coverage routing with `ci_remote = "origin"` and,
after workflow publication/accepted coverage, `ci_suite_refs = "refs/heads/* refs/tags/v*"`.
The tag declaration reflects Release's v* push trigger and reusable CI gate;
do not add standalone CI tag triggers that duplicate the Release gate. Declare
both patterns only when their current workflows are published and validated.
Before then declare no coverage. Preserve input validation, deletion handling,
byte-preserving ref forwarding, SSH keepalive and inherited Git-variable clearing.
An uncovered push under policy-off warns and retains hygiene without restoring
local suites. The hook consults tt's policy reader, never a second TOML parser.

## Hosted verification

Extend the existing workflow to branch pushes matching `**`, with no path
selection, manual dispatch and reusable workflow_call. Keep PR verification only
for fork PRs (job condition comparing head and base repository); same-repository
PR events launch no duplicate suite jobs. Preserve both version matrices and
existing pinned setup actions and frozen dependency installs. Set `TT_FORCE: "1"`
explicitly at verification-job scope so nested wrapper processes inherit it.

Use per-ref cancellation for ordinary CI. Give the called CI workflow a distinct
literal namespace, for example
`nodes-ci-${{ github.workflow }}-${{ github.ref }}`. In reusable CI the github
context belongs to the caller, so the generic workflow/ref expression alone
would become Release-refs/tags/v..., colliding with Release's existing
release-refs/tags/v... group because GitHub group names are case-insensitive.
The literal nodes-ci prefix prevents that collision; standalone CI and called
Release groups also differ by workflow context. Test the evaluated keys for
both paths, not just YAML spelling. Release's existing serialization and its
tag/dispatch behavior stay intact; do not enable latest-ref cancellation for
Release publishing by this change. Add finite job timeouts, with the exact
bound stated in the activation packet. Cancelled or absent runs are unverified.

### Durable coverage evidence

Choose persistent JUnit artifacts rather than relying on tt's temporary JUnit
directory or runner-local log. Verification jobs create an evidence directory
under RUNNER_TEMP in a shell step (not job-level runner-context interpolation).
Each CI recipe writes to that directory outside TT_JUNIT_DIR: pytest adds
`--junitxml` to its complete-suite command, and npm test adds Vitest's default
and junit reporters with an explicit junit output path. The default reporter
keeps summary counts in the job log. Require an evidence path for these CI
routes; the workflow supplies it before invoking them. Local test/test-fast
commands retain their existing flags and selection. Do not alter tt's cleanup.

After verification, an always-run, pinned upload-artifact step uploads the JUnit
file and module inventory with a unique package/version artifact name and finite
retention covering activation review (30 days). Missing expected evidence is an
error, not an empty passing artifact. A failed test/static check must retain its
failure status even when artifact upload succeeds. Cancelled or setup-failed
jobs may lack evidence and cannot satisfy activation.

The module inventory identifies eligible tracked test modules at the exact
revision under each runner's discovery configuration; compare it with module
identities in JUnit and the job's collection/error summary. Count partially
skipped modules separately from wholly skipped modules; list excluded modules
and every unexplained absent module, rather than treating them as executed.
Pytest JUnit carries skip reasons. Vitest may emit a skipped identity without a
reason: map each such case back to the exact revision's skip guard and record
the condition as a source-derived reason, explicitly distinct from a reported
runtime reason. An unmapped case remains unknown and blocks coverage acceptance.
A static inventory alone is not proof that a guard fired. Validate the evidence
path with one executed and one skipped case in each runner before the full hosted
verification; include wholly skipped module and missing-artifact cases in the
focused evidence checks. Retain the downloaded artifacts on the task through
activation/closeout under the normal attachment/retained-item rules.

Verification retains every test module. Record executed/passed/failed/skipped
counts per matrix job, skipped module count and any excluded modules, with reasons.
Do not infer zero skips from a green workflow. No generic hosted VM proves
unsupported filesystem capabilities, and passing one language/version cannot
stand in for another matrix entry. Hosted runs need nonzero executed test counts
in every required package job plus accepted omission coverage before activation.

## Verification and activation sequence

1. After design approval, write and freeze the project implementation plan for
   user review. Keep policy enabled throughout preparation and the first hosted run.
2. Execution Setup refreshes shared delivery state and runs `just test` as the
   full baseline from the hydrated tree, recording test counts and failures.
3. Implement focused-route, hook and workflow contracts with focused RED to
   GREEN checks through the declared front door. Bootstrap the minimal focused
   recipe before using it to test its forwarding. Preserve existing workflow
   action-pin and release tests in `python/tests/test_release_scripts.py`.
   Use allowlisted subprocess environments with temporary HOME and isolated Git
   configuration, asserting fixture top level and git-dir before fixture writes.
4. Prove mandatory hygiene survives policy-off, focused argv reaches both runners,
   unknown language/missing selector fail, skip children never spawn and log null
   outcomes, forced failure propagates, and direct/nested hosted missing-force
   calls refuse. Use isolated fixture policy files, never disable the real checkout
   to test adoption. Existing shared tests supply policy internals; these project
   tests cover the composed commands, hooks and workflow.
5. Update AGENTS and development guidance with command forms, setup, policy scope,
   explicit force, package-relative focused paths, CI refs, known omissions and
   hook/check timing discontinuities. This
   remains infrastructure scope; do not change the Standard or package APIs.
6. Present reviewed implementation plus an activation packet: exact commit/ref,
   workflow diff, setup and delivery revisions, runner/time limits, public/private
   status, applicable billing evidence, test/skip/module inventory and rollback.
   Obtain explicit approval before any push, workflow activation or account write.
   Existing ops pilot spending approval does not transfer to this project.
7. Publish only the approved enabled-policy revision and inspect completed hosted
   results. On accepted coverage and explicit conditional activation approval,
   commit and integrate policy-off, then perform an approved covered activation
   push and inspect its forced execution too. Failed hosted setup leaves policy on.
8. Record activation revision/time and the exact enabled-floor note when the hook
   split integrates: `policy: enabled at <RFC3339-UTC> revision <full-sha>`.
   Reconcile every outstanding latency host/target against the landed policy:
   disabled obligations are policy-retired, never performance-verified. Keep
   unrelated halts and remaining diagnosis. Report concrete status to ops-39bff6.
   The shared first-activation regret review is ops-56aab7, deferred to
   2026-11-28; link to it rather than filing a duplicate or inventing a date.

Rollback sets automatic_broad=true, restores documented local cadence, records
the same enabled-floor note with the rollback's actual landed timestamp/SHA,
and reports remote state. Publishing rollback remains externally gated.

## Builder freedom and limits

The builder chooses small just/shell implementation details, exact focused
fixture placement, job timeouts and evidence attachment names within these
contracts. No new dependency, standalone workflow or general selector engine is
needed. Worktree setup may become the explicit setup recipe; no shared launcher
is repointed. Product behavior, fixture oracles, dependency remediation and release
publishing behavior are outside scope. No unresolved taste or intent question is
known; these bounded design calls remain subject to user review.

Sources: current justfile, hooks, workflows, package manifests and test skip guards;
ops-8bfa85 approved artifacts and ops-68729d completion evidence; originating
session codex:01a1874f-c2d8-7320-ae81-7114e37e343f human turns;
[GitHub billing](https://docs.github.com/en/actions/concepts/billing-and-usage) and
[concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency),
[Vitest 2 reporters](https://v2.vitest.dev/guide/reporters) and
[pytest JUnit implementation](https://github.com/pytest-dev/pytest/blob/main/src/_pytest/junitxml.py),
checked 2026-10-30. Round-2 review concerns frozen 13a879b only; its full text and
the controller's seven rulings are attached to nodes-6fde14. This revised design
is a new review revision, not an amendment of the prior frozen commit.
