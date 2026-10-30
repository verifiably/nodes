# Nodes test execution policy adoption

Status: proposed for user review. Task: nodes-6fde14.
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

Reuse the current command strings and standard ops hook/template patterns.
Every executed check goes through the existing vendored tt; do not edit that copy.

| Route | Contract |
| --- | --- |
| `setup` | Protected, timed route: frozen uv sync in Python and npm ci in TypeScript; build TypeScript output if required by guide checks. No shared environment or host launcher changes. |
| `test-one <python\|ts> <runner args...>` | Protected focused route, requires a language and at least one selector argument; forwards remaining argv intact. Python uses the unselected pytest command; TS uses the existing npm test/build command with npm's argument separator. Unknown language fails early. No shell interpolation of user arguments. |
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
| `ci-python`, `ci-typescript` | Existing package suite and static checks, each timed once under its CI target. Classified broad so a missing hosted force cannot silently succeed. |

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
whole-hook timings.

Adopt the standard pre-push coverage routing with `ci_remote = "origin"` and,
after workflow publication/accepted coverage, `ci_suite_refs = "refs/heads/*"`.
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

Use per-ref cancellation for ordinary CI. Concurrency groups must distinguish
standalone CI from reusable Release calls, including the caller context; do not
reuse Release's existing group, which could cause self-cancellation. Release tag
and dispatch behavior stays intact. Add finite job timeouts, with the exact
bound stated in the activation packet. Cancelled or absent runs are unverified.

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
   explicit force, CI refs, known omissions and hook timing discontinuity. This
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
   The shared first-activation regret review already exists; link to it rather
   than filing a second first-activation task or inventing a date.

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
[concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency), checked 2026-10-30.
