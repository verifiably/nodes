# Nodes test policy activation packet

Status: prepared for review; no push, workflow dispatch or policy activation has
occurred. Task nodes-6fde14, delivery steps nodes-d8dff5 / nodes-3ce05a /
nodes-75252c. User approved plan 6beecc9 for inline implementation, not external
execution. The approved design cc5df73 remains unchanged.

## Exact snapshot and requested actions

The prepared runtime snapshot is nodes commit
`1dfcc543bed337281662b4d4b7c6acb4416d0391`. A subsequent documentation-only commit
contains this packet; neither later task-record commits nor this packet silently
change the initial published runtime SHA. Final review must accept this exact
code plus the packet before the following approval is requested.

Recommend approving these three bounded actions together:

1. Publish that explicit policy-enabled SHA to origin branch
   `design/nodes-6fde14-test-policy`, triggering one standalone CI workflow with
   four matrix jobs. Command: `git push origin 1dfcc543bed337281662b4d4b7c6acb4416d0391:refs/heads/design/nodes-6fde14-test-policy`.
2. If that branch run passes with accepted coverage, dispatch the existing
   Release workflow once on the same remote branch and exact SHA:
   `GH_TOKEN=$(gh auth token --user khughitt) gh workflow run release.yml --repo verifiably/nodes --ref design/nodes-6fde14-test-policy`.
   Assert remote head and recorded run head equal the approved snapshot before
   accepting it. Both publish jobs must skip; no tag is created or pushed.
3. Only after both verification paths pass with accepted coverage, integrate
   the reviewed enabled hook split locally, record its actual enabled-floor
   SHA/time, and prepare the small activation commit in the retained worktree.
   After focused checks and fresh review, integrate it and push origin/main once.
   That final push must produce successful forced hosted verification as well.

No retries, extra verification pushes, PRs, real release tags, account/billing
changes or paid compute are included. Failure or a changed runtime revision
requires a revised packet and further approval. Check gh auth status before each
write and use the named khughitt token per command; do not switch global accounts.

The initial runtime snapshot deliberately precedes this packet's documentation
commit. This permits an immutable, exact push/dispatch target while retaining
later review and task records locally. Local branch HEAD may contain only those
additional documents/records; never substitute it for the approved runtime SHA.

## Prepared behavior and setup

- The existing CI workflow covers every branch push, including feature/x, keeps
  Python 3.11/3.13 and Node 20/24, and skips duplicate same-repository PR suites.
  Fork PRs and reusable Release calls remain. No standalone CI tag trigger is added.
- Verification jobs run on standard ubuntu-latest runners with TT_FORCE=1 and a
  hard 15-minute timeout per job. Their four jobs consume at most 60 runner-minutes
  per verification workflow, excluding setup scheduling and other Release jobs.
  No completion or detection deadline is promised under queues/cancellation.
- Release dispatch also performs its existing build and verify-artifacts jobs,
  artifact upload/download, package smoke installs and registry publish dry-runs.
  These jobs have no explicit timeout in the unchanged Release workflow; the
  platform default applies. They are not bounded by the CI jobs' 15-minute setting.
  Existing tag-push-only publish guards remain intact and are covered by local
  event/ref truth-table checks. Actual tag-trigger execution remains untested.
- Setup uses frozen uv/npm lockfiles and pinned actions. Local just setup obtains
  one work-link result, trusts its physical Git-root row and reapplies Dropbox
  marks only for managed synced environments. Outside/external setup skips attr.
  No main-checkout dependency directory, host launcher or service was repointed.
- No private sibling checkout or host-specific input appears in package setup.
  The two packages use the in-repository conformance fixtures. Python tests need
  no TS installation; the actual Vitest pilot is in the TS suite.
- Each job writes JUnit and a Git-SHA/module/discovery inventory under RUNNER_TEMP,
  outside tt's deleted temporary JUnit directory. An always-run presence check
  rejects missing JUnit/inventory; unique per-version artifacts retain them for
  30 days. Successful upload does not erase an earlier verification failure.
- Missing policy remains enabled. No .tt.toml exists and ci_suite_refs remains
  empty until accepted publication/coverage. The intended origin declarations
  are refs/heads/* refs/tags/v*, with the latter covered by the validated shared
  Release-called workflow plus unchanged trigger/guard contracts, not a real tag run.

## Delivery and billing evidence

ops-68729d records accepted hosted runs before and after shared policy activation
at ops a9089dc73a70bc92a87fbb67cfbe960dd8f96d74. tools/tt v8 is present locally.
lore-fdbe86 records merged instruction delivery at 7098138 with fresh harness
comprehension checks; the policy-aware instructions are active in this session.
The shared readers were delivered before producers; no new vendored code is edited.

Read-only API checks on 2026-10-30 with khughitt report verifiably/nodes public,
admin access, main as default branch, and Release active/published. Global gh's
active account is different; the token is named per command rather than switched.
Standard hosted compute for a public repository is free under the current
[GitHub billing documentation](https://docs.github.com/en/actions/concepts/billing-and-usage).
Private remaining allowance and no-paid-overage settings are inapplicable while
that visibility and runner class remain. Recheck both before approval is exercised;
if private or paid runners are now involved, stop for the applicable controls.
No ops-pilot spending authorization transfers to this task. Artifact storage and
usage remain subject to GitHub's normal public-repository service terms; no new
paid storage or account setting is authorized.

## Executed local evidence and limits

Local implementation ran with Python 3.13.12, Node 26.5.0, npm 11.17.0 and
just 1.59.0. These are not the four hosted matrix environments.

| Check | Observed result |
| --- | --- |
| Deferred full baseline before code edits | Python 755 passed; TypeScript 592 passed; no skips |
| Local setup | Passed in the external storage worktree; synced/attribute-error behavior exercised only in isolated fixtures |
| Task 1 integration | 41 passed after 26 expected initial RED failures |
| Real package path smoke | Python 52 passed; TypeScript 49 passed |
| Focused Task 2 Python including connected Task 1 checks | 81 passed; initial Task 2 RED had 11 failures and 29 passes |
| Actual TS reporter pilot | 1 parent test passed; its isolated child has 1 passing case and 2 deliberate skips, including one wholly skipped module |
| Actual pytest reporter pilot | Isolated child has 1 passing case and 2 deliberate skips, with persisted module identities and skip reasons |
| Latest fast route before runtime commit | Python 40 selected tests passed; TS 1 selected test passed; affected-only, not a full current suite |
| Mandatory hygiene and broad static checks | ops-check, ops-docs, tasks check, Ruff, Pyright, tsc and Biome passed |
| Workflow lint | actionlint 1.7.12 passed for CI and Release |

The runtime snapshot has 52 Python test modules and 51 TS test modules in its
tracked test roots. No module exclusion or selector was added to the hosted
commands. Actual hosted executed/pass/fail/skipped counts, partially/wholly skipped
module counts, excluded/absent modules and reasons remain unmeasured and are
required before activation. Fixture-child skips above are intentional test inputs,
not capability omissions from the package suites.

Potential capability omissions: symlinks, case-sensitive filename distinctions,
permission checks for an unprivileged POSIX user, and platform-specific path
behavior. Reconcile actual JUnit identities against the exact revision's module
inventory and job summaries for every matrix entry. Pytest supplies runtime skip
reasons; Vitest may require source-derived guard explanations. Unmapped reasons,
unexplained absent modules, missing artifacts, zero executed tests, failure or
cancellation block coverage acceptance. No hosted coverage is inferred from a
local pass or from a green workflow alone.

The lockfile install reported 10 existing dependency advisories (3 moderate,
5 high, 2 critical). This task changes no dependency versions; that install output
is not a reachability assessment. Dependency remediation remains outside this
approved infrastructure change and the advisories remain unassessed.

Historical successful gate medians were roughly test4.8s/check6.6s/commit7.3s/
push12.9s, with counts and limits in the approved design. Savings remain unmeasured.
The chosen broad check-code contract delays routine static feedback until pushed
CI completes. New hygiene-only hook timings and split check timings do not
continue the old series.

## Conditional activation and rollback

Only after accepted hosted results and the explicit conditional approval above,
commit automatic_broad=false with broad targets test, test-fast, check-code,
ci-python and ci-typescript. Do so on design/nodes-6fde14-test-policy in the
retained worktree, after bringing in enabled main's integration/floor-note commit.
Run real selected Python/TS tests, verify skipped/null records and mandatory
hygiene, and prove a forced fixture failure propagates. Freeze/review that small
diff, then integrate locally and perform the one approved origin/main push.

Record actual integration/activation revisions and UTC times on nodes-6fde14.
At hook-split integration and any rollback use the exact enabled-floor note:
policy: enabled at <RFC3339-UTC> revision <full-sha>.
From registered main, inspect each current timing incident's host/target notes;
retire only disabled timing obligations/halts with the landed policy revision.
No performance-verification claim follows from disablement. Preserve other halts
and remaining diagnosis. The preparation inventory found none; recheck at activation.

If coverage fails before activation, leave policy enabled. If activation's covered
push fails, report that actual state and prepare rollback to automatic_broad=true,
restore documented local cadence and record the actual re-enable floor. A rollback
push or further remote run is not silently included beyond the three actions above.
Preserve evidence on the task and report concrete status to ops-39bff6. The existing
regret review is ops-56aab7, due 2026-11-28; no duplicate scheduler or task is created.
