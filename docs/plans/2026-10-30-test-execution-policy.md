# Nodes Test Execution Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Inline execution is the designer's recommendation because the steps share command and coverage interfaces. Use a fresh final reviewer. Steps use checkbox syntax; user review of this frozen plan precedes implementation.

**Goal:** Keep focused local checks and mandatory hygiene while moving routine broad suites and static checks to verified hosted CI.

**Architecture:** Retain vendored tt v8 as policy owner. Split the existing just/hook commands, add safe local setup and language-qualified focused testing, and extend the existing CI matrices with durable evidence. Publish and activate only after separately approved hosted verification; missing policy remains enabled throughout preparation.

**Tech Stack:** just, POSIX shell, existing Python/pytest/PyYAML and TypeScript/Vitest 2 tooling, GitHub Actions. No new package dependency.

**Spec:** docs/designs/2026-10-30-test-execution-policy-design.md, frozen nodes commit cc5df734f321d9755496e344866776f6c289f11b, SHA-256 47d628ca42caf15f699fe59ac3eaf4b7ff5f43dbc8a6411f74c58f82f13a30ea. The user accepted it for planning after spec round 4 (claude/claude-opus-5-5, accept with two Minor findings). Leave that frozen design unchanged; the two clarifications are settled below.

## Global Constraints

- This plan needs user review before implementation. Approval of the plan does not authorize a push, workflow dispatch, account change, real release tag or paid compute. Prepare a concrete activation packet before requesting external approval.
- Reuse .worktrees/nodes-6fde14 on design/nodes-6fde14-test-policy. Worktree hydration already used uv sync --frozen and npm ci. Execution Setup refreshes dependencies if needed and runs just test before the first code edit; record command, test count and observed failures. This is the deferred policy-enabled full baseline.
- Refresh ops/obs reader delivery and lore instruction evidence from ops-8bfa85 and ops-68729d before execution. tools/tt is already v8; never edit a vendored copy here.
- .tt.toml stays absent/enabled until accepted hosted coverage and explicit conditional activation approval. Broad targets at activation are exactly test, test-fast, check-code, ci-python, ci-typescript. Protected setup, test-one, test-full, check-hygiene and hook-* routes are never broad.
- Keep full Python 3.11/3.13 and Node 20/24 matrices, complete suites, existing action pins, frozen installs, shared conformance fixtures and language APIs. No parity-tier feature or Standard change is involved.
- Keep testmon and Vitest changed selectors exactly as today. test-one forwards argv intact and requires a language plus a selector; package-relative paths are documented. Do not run a whole suite under test-one to evade policy.
- All checks/tests use just recipes and tt, never a runner directly. While policy remains enabled, use focused checks followed by just test-fast before code commits; full-suite and hook obligations follow the project rules. Once policy-off is valid, use focused evidence and hygiene, not a broad rerun solely for a commit or review gate. Skips are never green suites or timing samples.
- Test subprocess environments are built key by key: fixture-owned HOME, fixture PATH, isolated GIT_CONFIG_GLOBAL, GIT_CONFIG_NOSYSTEM=1, fake identities and only explicitly read variables. Never inherit/copy the process environment. Clear inherited GIT_* before fixture creation and assert both fixture top level and an internal git-dir before its first write.
- No host launcher, symlink or service is repointed. Synced-checkout setup behavior is tested in isolated fixtures; do not exercise dependency replacement in the user's main environment.
- Preserve SSH keepalive, byte-preserving push refs, validation/deletion handling and inherited Git-variable clearing. Uncovered policy-off pushes warn and retain hygiene without restoring local suites.
- Routine Ruff/Pyright/tsc/Biome are deliberately broad. Historical gates cost seconds, not minutes; the approved tradeoff is modest local savings against routine errors discovered after the next push and completed CI. Retain the design's baseline and timing-series caveats.
- Reviewer requests name frozen commit/path, reviewers stay read-only, and the controller saves their full returned text and rulings. Final whole-branch review gets corrective rounds under the project rule, with focused RED-to-GREEN fixes. No findings are silently waived by activation.

## Review Focus

1. A real storage worktree reports external rather than outside: setup must skip Dropbox marking for both, while failing a synced attribute error. Task 1 owns result-driven fixture tests.
2. Shell metacharacters, spaces and package-relative selectors must reach the chosen runner without expansion. Task 1 owns argv/arity/failure tests for both languages.
3. Hygiene must execute when every broad child skips; missing hosted force must fail even for CI targets/nested wrappers. Task 1 owns marker/log fixtures.
4. A skipped/wholly skipped module or missing JUnit file must not turn a workflow green or disappear from the activation inventory. Task 2 owns reporter/artifact fixtures.
5. Reusable CI inherits Release's context: concurrency must not collide and validation must not publish. Tasks 2 and 3 own evaluated-key/publish-guard tests and approved branch dispatch evidence.

## Files and ownership

| File | Responsibility |
| --- | --- |
| justfile | Focused/setup/check/hook routes, CI reporting arguments, remote/ref coverage declarations |
| tools/setup | Small POSIX-shell local setup script; one work-link result drives linking/marking decisions |
| .githooks/pre-push | Adopt the established ops template routing and policy warning, preserving push protocol |
| AGENTS.md | Current gate/setup/focused-path/policy and timing semantics, outside generated regions |
| docs/test-execution-policy.md | Current development reference, evidence/coverage limitations, activation and rollback procedure |
| python/tests/test_development_routes.py | New local command/setup/hook contract tests and isolated subprocess fixtures |
| python/tests/test_ci_evidence.py | New reporting/module/artifact fixtures, including actual focused runner evidence samples |
| python/tests/test_release_scripts.py | Extend existing workflow/action-pin/release guard tests |
| .github/workflows/ci.yml | Existing matrices, all branch pushes, fork-only PR jobs, force, concurrency and persistent artifacts |
| docs/notes/2026-10-30-test-policy-activation.md | Concrete reviewed activation packet and subsequently actual results |
| .tt.toml | Activation-only policy switch |

Do not change Release publishing logic, package manifests/lockfiles, fixture oracles or vendored tools. The existing TypeScript build is tsc and does not remove its output directory; keep that behavior rather than adding a build wrapper. Setup creates/builds dist and marks it; subsequent builds must preserve the directory/mark. If implementation changes this behavior, it must reapply the mark and test it before proceeding.

## Spec round 4 clarifications

- Ruling: Minor 1 is settled in Task 1. Capture the successful output of work-link --ensure python/.venv once and use the matching result row for both classification and later marks. outside and external mean no attr; managed-link statuses mean synced and require attr. Why: a second path heuristic can disagree with the tool. Cost: a classification mistake can block outside setup or sync generated data. Inspection of work-link and an actual invocation here confirmed external for this worktree.
- Ruling: Minor 2 is settled in Tasks 2/3. Validate Release-called CI with an approved workflow_dispatch of release.yml on the prepared branch. Preserve the exact tag-push-only publish guards and test their event/ref truth table locally. Why: pushing a matching v* tag could publish packages. Cost: an incorrect guard or dispatch ref could run the wrong revision or expose publishing. No real release tag is created or pushed. Manual branch validation plus the unchanged call path and local tag-context assertions establishes declared tag coverage; actual tag-trigger execution remains explicitly untested.

### Task 1: Establish focused checks and separate local hygiene

**Files:** Create tools/setup and python/tests/test_development_routes.py; modify justfile, .githooks/pre-push, AGENTS.md; create docs/test-execution-policy.md.

**Interfaces:**
- setup runs python3 tools/tt setup -- sh tools/setup from the repository root. The script has no arguments; failure exits nonzero before subsequent installation/build steps.
- test-one <python|ts> <selector...> uses just positional arguments; Python runs uv run --frozen pytest inside python/, TS runs npm test -- <args> inside ts/. The language is consumed by dispatch, never forwarded as a selector. Missing language/selector or unknown language fails before the runner.
- check-hygiene times ops-check, ops-docs check and tasks check; check-code times the unchanged Ruff/Pyright/tsc/Biome chain. check/gate are sequential untimed aliases. test-full is the untimed TT_FORCE=1 just test alias.
- hook-pre-commit, hook-pre-push and hook-pre-push-fast time hygiene once, then call the separately timed broad children. Fast push reuses test-fast; do not add a redundant test-push-fast target. ci_remote is origin; ci_suite_refs is initially empty, becoming refs/heads/* refs/tags/v* only in Task 3 after validation.

- [ ] Execution Setup: tasks start this child, run trial-arm and refresh policy/delivery state. Run the deferred just test baseline and record both package counts, skips and any failures before editing code. Preserve an observed failure; do not call a setup failure a regression or silently turn policy off.
- [ ] Add parameterized tests in test_development_routes.py: test_focused_argv preserves spaces, apostrophes, dollar/substitution/glob characters and exit 7 for both languages; test_focused_arity_rejects_missing_or_unknown_language starts no runner. Use stub uv/npm executables recording argv/cwd, not shell-evaluated inputs. Assert Python paths resolve from python/ and TS paths from ts/.
- [ ] Add test_setup_uses_work_link_result for matching tab-separated statuses outside, external, ok, created, relinked, materialized and rewritten. Stubs require exactly work-link --ensure python/.venv before uv/npm; outside/external call no attr even if attr is unavailable. Managed statuses require the Python environment to resolve as a managed link before install, then exact node_modules and dist marks after npm ci/build. Repeated replacement requires both marks again. Unknown/missing/multiple matching rows, needs-migration, broken links and nonzero work-link fail before installation. Attribute failure stops setup and returns nonzero. Derive the target field from the fixture root, never a host path.
- [ ] Add test_hooks_keep_hygiene_and_propagate_failure with a fixture Git root containing the justfile, colocated tt and harmless stub commands. Pin absent/true policy execution and false-policy marker order: hygiene executes, broad markers do not; skip records have null exit/tests/selection/slowest. A failing hygiene step prevents later children. test_test_full_forces_failure records exactly one forced test invocation and returns its exit 7.
- [ ] Add test_push_coverage_routing for matching origin branch, nested branch feature/x, v* tag, non-v tag, another remote, malformed/deletion/mixed refs and empty declaration. Assert stdin bytes unchanged at the selected recipe, keepalive refusal remains, uncovered policy-off warns without a suite, and Git-local fixture variables cannot reach the runner.
- [ ] Add test_hosted_force_contract for both CI targets and an outer-to-inner wrapper fixture: GITHUB_ACTIONS=true without force refuses a configured broad child, logs no successful skip and starts no suite marker; TT_FORCE=1 runs it and propagates failure. Keep the real checkout's policy absent; false-policy tests belong only in fixtures.
- [ ] First RED uses documented just test-fast because the protected focused route does not yet exist. Confirm failures are missing routes/incorrect boundaries. Implement the focused route, then use just test-one python tests/test_development_routes.py for all subsequent RED/GREEN cycles. Do not introduce a temporary direct-runner bypass.
- [ ] Implement tools/setup with set -eu. Run work-link once, fail if unavailable/nonzero, and select exactly the row whose second tab-separated field is the repository-root python/.venv path. outside/external skip marks; the five managed statuses above require marks; all others fail. Frozen uv sync runs in python/, frozen npm ci in ts/, then npm run build. For synced trees, re-mark node_modules immediately after install and dist immediately after build with attr -s com.dropbox.ignored -V 1. No heuristic based on HOME, path substrings or inherited CI. CI continues package-specific frozen setup, not this host-local route.
- [ ] Split recipes and adopt the existing ops pre-push template algorithm without changing the vendored wrapper. Retain current full/fast test strings. Sequential steps stop on error. Protect the exact broad list by tests; composing aliases never add duplicate timers.
- [ ] Update current references: explain setup location behavior, language/selector examples, deliberate force, empty coverage before activation, both hook and check series discontinuities and the delayed static-check tradeoff. Leave generated guide regions to ops-docs.
- [ ] GREEN: just test-one python tests/test_development_routes.py; then actual focused smoke just test-one python tests/test_paths.py and just test-one ts tests/paths.test.ts with nonzero counts. Validate setup only in the task's outside/external worktree plus isolated synced fixtures, never npm ci in main. Run just test-fast and just check, record scopes/counts, commit feat: split local verification and add focused test routes, then tasks done this child with its evidence. Main remains enabled; floor note waits for actual integration in Task 3.

### Task 2: Preserve hosted coverage and prepare activation evidence

**Files:** Modify justfile, .github/workflows/ci.yml, python/tests/test_release_scripts.py, AGENTS.md and docs/test-execution-policy.md; create python/tests/test_ci_evidence.py and docs/notes/2026-10-30-test-policy-activation.md.

**Interfaces:**
- ci-python and ci-typescript require NODES_CI_EVIDENCE_DIR, an absolute per-job directory outside TT_JUNIT_DIR; they execute complete suites plus existing package static checks under their own tt target. Local test/test-fast remain unchanged.
- Python reporting appends --junitxml="$NODES_CI_EVIDENCE_DIR/pytest.xml". TS uses npm test -- --reporter=default --reporter=junit --outputFile.junit="$NODES_CI_EVIDENCE_DIR/vitest.xml". These reporting additions change no selection; do not add a second -q or passWithNoTests to CI.
- Workflow creates the directory under RUNNER_TEMP in a shell step and exports NODES_CI_EVIDENCE_DIR via GITHUB_ENV. Each job sets TT_FORCE: "1" explicitly. Do not interpolate runner context into job-level env.
- Evidence includes JUnit and module-inventory.txt containing the Git SHA, tracked files under the package test root and discovery configuration. Upload unique python-<version>-coverage / typescript-<version>-coverage artifacts with 30-day retention, always-run upload and explicit required-JUnit presence checks. Missing evidence cannot be hidden by uploading only the inventory.

- [ ] tasks start/trial-arm this child. Add workflow tests to the existing release test module: all branch names including feature/x, no path filter or standalone CI tag trigger; workflow_call and workflow_dispatch retained; same-repository PR job conditions skip while fork PRs run. Assert unchanged 3.11/3.13 and 20/24 matrices, Ubuntu standard runners, pinned actions/frozen installs, explicit TT_FORCE and timeout-minutes: 15 for verification jobs.
- [ ] Add test_concurrency_and_publish_event_matrix: evaluate the intended keys nodes-ci-CI-refs/heads/feature/x and nodes-ci-Release-refs/tags/v0.2.0, case-fold them and assert separation from release-refs/tags/v0.2.0. Ordinary CI cancels superseded heads; Release's existing group/cancel-in-progress:false remains untouched. Assert publish-npm and publish-pypi still require event push AND a refs/tags/v prefix: workflow_dispatch on a branch or tag is false; branch push false; matching tag push true. This is a local truth table, not a tag-push experiment.
- [ ] Add evidence tests: missing NODES_CI_EVIDENCE_DIR fails early; paths with spaces are quoted; JUnit survives after the outer tt finishes; a failed suite/static check remains failed despite successful upload. Assert the always-run required-JUnit check and uploader use the same absolute path, artifact names differ across matrix jobs, retention is 30 and missing files fail. Reuse the existing pinned upload-artifact revision from Release.
- [ ] Add actual focused reporter pilots through test-one using temporary fixture test roots: each runner executes one passing and one skipped case, plus a wholly skipped module. Invoke pytest and the installed Vitest through fixture just/tt routes with allowlisted environments, no inherited credentials. Check JUnit identifies modules/cases/counts, pytest skip reason persists, Vitest missing reason can map to the fixture source guard, and an unmappable skipped identity is recorded unknown. Missing/unmapped evidence must fail the acceptance procedure, never imply zero omissions. These pilots run only a few fixture cases, not the production broad suite under a focused name.
- [ ] RED: just test-one python tests/test_ci_evidence.py tests/test_release_scripts.py. Implement reporting arguments and workflow steps. Inventory all tracked test-root files plus runner discovery settings before the suite; do not narrow a runner selector. Keep package-default working directories explicit in inventory Git commands. Validate JUnit exists and is nonempty under an if: always() shell step; a suite/setup failure cannot go green through artifact upload. Cancellation remains unverified.
- [ ] Modify only the existing CI workflow: branch pushes ['**'], manual dispatch, reusable call and fork-only PR job conditions; literal nodes-ci namespace, with latest-ref cancellation only for standalone CI (github.workflow == 'CI'). Keep Release's own serialization. Avoid a second verification workflow and preserve all module/version coverage.
- [ ] Build the activation packet with actual local counts, current public visibility/standard-runner evidence, reader/lore revisions, known skip guards and explicit unmeasured hosted counts. Specify the prepared branch design/nodes-6fde14-test-policy and exact frozen SHA once reviewed; no tag. Request only one initial branch push and one manual Release-on-branch dispatch, then conditionally one policy-off integration push. Retries/new pushes require approval if not covered by that packet. The verification jobs each time out at 15 minutes; preserve existing Release job behavior and state its current timeout exposure in the packet rather than silently claiming all Release jobs are bounded by 15 minutes.
- [ ] In that packet, record the manual dispatch command (pending approval): GH_TOKEN=$(gh auth token --user khughitt) gh workflow run release.yml --repo verifiably/nodes --ref design/nodes-6fde14-test-policy. Check gh auth status before writes; do not switch global accounts. Release already declares workflow_dispatch on main; recheck it is published there before dispatch, as GitHub requires. Assert the branch head is still the reviewed SHA. No v* tag is created/pushed; publish jobs must skip, while gates/build/verify-artifacts run. Existing dry-run registry calls and artifact uploads are named external effects included in the request.
- [ ] GREEN: repeat the focused command and reporter pilots, then just test-fast and just check. Run actionlint if available; if absent, record the gap and rely on workflow contract tests plus later hosted validation, not an invented lint pass. Record all test counts. Commit feat: retain hosted test coverage evidence. Run the final whole-branch review on a frozen implementation revision before any publication, saving the full reviewer report and applying the required corrective rounds. Update/freeze the activation packet around the final reviewed implementation; policy and ci_suite_refs stay absent/empty. tasks done this child only when preparation/review is complete; external execution belongs to Task 3.

### Task 3: Validate approved hosted paths and activate policy

**Files:** Modify justfile coverage declaration and docs/test-execution-policy.md, AGENTS.md and the activation packet; create .tt.toml only after acceptance. Task records and evidence use the tasks CLI.

**Interfaces:**
- Consumes the reviewed packet and completed Task 1/2 interfaces; no new runner or policy implementation.
- Activation file is automatic_broad = false and broad_targets = ["test", "test-fast", "check-code", "ci-python", "ci-typescript"]. Coverage declaration becomes refs/heads/* refs/tags/v* for origin, after successful branch CI plus manual Release-called CI and local tag/event contract evidence.
- Actual integration/re-enable floor is recorded exactly as policy: enabled at <RFC3339-UTC> revision <full-sha>; actual disablement records its own revision/time. Registered main, not a branch policy edit, controls latency disposition.

- [ ] tasks start/trial-arm this child. Finish every local preparation step and present the reviewed packet to the user. Park --waiting-on user --reason approval if external authorization is absent; plan approval alone is insufficient. Do not dispatch, push or change billing/account settings while awaiting it.
- [ ] After explicit approval, recheck account, public/private status, standard runner class, reviewed SHA and dispatch guards. If private now, inspect applicable allowance/no-paid-overage controls before proceeding; do not transfer the ops pilot's spending authorization. Publish only the approved policy-enabled branch revision, then inspect its standalone CI at that exact SHA. No automatic retry beyond approval scope.
- [ ] Perform the separately approved Release dispatch on that same branch. Check the recorded run head SHA/event/ref, all four reusable CI matrix jobs, build and verify-artifacts outcomes, and publish-npm/publish-pypi skipped statuses. No tag is pushed. If the reviewed branch moved, stop and re-freeze/review the packet. Retain actual logs/artifacts; a submitted dispatch is not evidence of successful execution.
- [ ] For each required matrix job, reconcile JUnit with the tracked module inventory and discovery config. Report executed/pass/fail/skipped counts, partially and wholly skipped module counts, excluded/absent modules and reasons. Match Vitest missing reasons to that exact revision's guards and label source-derived explanations. Unexplained absence, unmapped skip, missing artifact, cancelled job, failure or zero executed tests blocks acceptance. Record that actual tag-trigger execution remains untested; shared callable code plus local event/concurrency assertions and manual Release evidence support tag coverage, not a real release claim.
- [ ] On accepted results and explicit conditional activation authorization, land the reviewed enabled hook split locally as allowed by the personal profile, recording its actual merge SHA/time with the exact enabled-floor note. Add the coverage declarations and .tt.toml, update current guidance and packet with accepted omissions and policy state. Preserve the original historical baseline; do not claim measured savings before post-adoption evidence.
- [ ] Verify a real selected Python and TS test still runs through test-one, ordinary test/check-code requests record skipped/null decisions without launching child suites, hygiene still runs, and the isolated forced-failure fixture still propagates failure. Use fresh focused evidence plus mandatory hygiene under the now-valid policy; broad skipped commands are not passing suites. Final review covers the small activation diff before integration/push; fix/rule on findings under project rules.
- [ ] Integrate and perform only the approved covered policy-off push; inspect completed forced hosted CI at its exact SHA, all matrix artifacts and counts. Record activation revision/time and remaining omissions. If post-activation coverage fails, report it accurately and prepare rollback (automatic_broad=true, restored local cadence and enabled-floor note at the actual landed revision/time); any extra push remains externally gated.
- [ ] Inspect every current test-latency incident from registered main, each host/target in its notes. Cite the landed policy revision to retire only disabled obligations and timing halts; retain unrelated halts/diagnosis. Entirely retired incidents close/drop as policy-retired, never performance-verified. Report actual adoption state to ops-39bff6 and link evidence to the existing ops-56aab7 review due 2026-11-28; no duplicate scheduler/task.
- [ ] Before closing, attach small required evidence and account for raw logs/worktree with current retained-item records, hashes and owners. tasks done children and parent only when their scopes are actually complete; unresolved activation remains parked with an exact owner/action. Integrate closed records locally as permitted, then only remove the worktree after ignored-file dispositions, required tt-report harvest, host-pointer checks and any plan-ledger retention obligations. Retain any item needed by the open regret review under an explicit transfer to that task.

## Self-review and handoff

The writer checks spec coverage, action granularity, interface consistency, all five
Review Focus fixtures and proportion before freezing this plan. No production code
or test obligation is created by planning. Each Task heading gets one direct-process
child record with explicit dependencies 1 -> 2 -> 3; block all children for user
plan review before implementation. The parent remains open across external gates.

This plan settles spec round 4's two minors; neither is deferred. Inline execution
is recommended, with a fresh whole-branch reviewer and required corrective rounds.
User approval of the complete plan starts implementation; external approval is a
later concrete packet gate. Do not ask again for an execution-method choice unless
the user wants to change the inline recommendation.

Sources for dispatch semantics (checked 2026-10-30):
[GitHub manual workflow execution](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
