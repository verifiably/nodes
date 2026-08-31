# Nodes Tasks migration ledger

**Status:** audit complete and initial task migration in progress; integration and portfolio reconciliation are not yet recorded

## Scope and evidence

- Stable HEAD audited: `5a00bba51df8bb2a06ec8a2fdc3c56ac8959e619` (`main`, three commits ahead of `origin/main`).
- Tasks source commit: `9242ac63f1004bfb682c329af1c9a90f09d714b3`.
- Audit date: 2026-08-31.
- Prefix: `nodes`.
- Authority order: `docs/STANDARD.md`, then code and tests, then dated designs and plans.
- Scope read: every tracked document, both package manifests and public source trees, parity fixtures and tests, recent history, local branches and linked worktrees, the Beliefs `nodes-remainder` evidence, and both future Mindful repositories.

## Git state inspected

| Ref or path | State inspected | Ruling |
|---|---|---|
| `main` | `5a00bba`, clean before migration, ahead of `origin/main` by three reviewed projection commits | Audit base; the three local commits are completed projection work, not a new task. |
| `origin/main` | `514d454` | Behind the audited stable branch; no outcome inferred from the push state. |
| `chore/tasks-migration-nodes` | Created from `main` at `5a00bba` in `.worktrees/tasks-migration-nodes` | Dedicated migration write location. |
| Linked worktrees | Stable checkout and this migration worktree only | No other branch or worktree evidence of active ownership. |
| Dirty paths | None before migration | No user changes were absorbed. |

## Document classification

| Document | Classification | Evidence |
|---|---|---|
| `AGENTS.md` | authority/current | Current agent authority, parity, and gate rules. |
| `README.md` | authority/current | Current repository orientation, gates, and consumer map. |
| `docs/STANDARD.md` | authority/current | Versioned normative portable contract. |
| `docs/designs/2026-06-21-nodes-knowledge-vocab-design.md` | historical/superseded | The 1.2 standard and base-vocabulary retirement supersede this dated design. |
| `docs/designs/2026-06-21-nodes-structural-index-design.md` | historical/superseded | Shipped behavior is governed by the standard and parity fixtures. |
| `docs/designs/2026-06-21-nodes-substrate-design.md` | historical/superseded | Foundational design; later boundary designs and the standard supersede its current-state claims. |
| `docs/designs/2026-06-21-nodes-ts-kernel-design.md` | historical/superseded | The port shipped and later plans expanded it and retired its vocabulary layer. |
| `docs/designs/2026-06-22-nodes-fulltext-search-design.md` | historical/superseded | Search ships in both languages and is pinned by standard §§9–11. |
| `docs/designs/2026-06-22-nodes-similarity-index-design.md` | historical/superseded | Similarity ships in both languages and the 2026-08-17 review retained it. |
| `docs/designs/2026-06-22-nodes-ts-structural-index-design.md` | historical/superseded | Implemented historical port design. |
| `docs/designs/2026-06-23-nodes-index-persistence-design.md` | historical/superseded | Implemented historical Python design. |
| `docs/designs/2026-06-23-nodes-ts-index-persistence-design.md` | historical/superseded | Implemented historical TypeScript design. |
| `docs/designs/2026-07-02-nodes-ts-corpus-fingerprints-design.md` | historical/superseded | Fingerprint APIs ship from `@nodes-dev/core`. |
| `docs/designs/2026-07-10-nodes-standard-and-check-design.md` | historical/superseded | The standard and collecting check shipped; current authority is `docs/STANDARD.md`. |
| `docs/designs/2026-07-11-nodes-membership-traversal-and-check-design.md` | historical/superseded | Implemented and oracle-pinned historical design. |
| `docs/designs/2026-07-11-nodes-package-identity-and-ownership-design.md` | historical/superseded | Accepted package-boundary decision reflected in current manifests. |
| `docs/designs/2026-07-12-nodes-base-vocabulary-boundary-design.md` | historical/superseded | Accepted retirement reflected in the shipped domain-free source trees. |
| `docs/designs/2026-07-13-nodes-python-package-layout-design.md` | historical/superseded | Accepted `nodes.core` layout reflected in the current package. |
| `docs/designs/2026-07-16-nodes-first-publish-design.md` | historical/superseded | Superseded by the 0.1.1 recovery design and completed release. |
| `docs/designs/2026-07-18-nodes-first-publish-recovery-design.md` | historical/superseded | Accepted recovery design; registry and tag evidence prove its outcome. |
| `docs/designs/2026-08-03-nodes-under-the-system-redesign-design.md` | active delivery | Detailed review is complete; §2.2–2.4, surviving §3 withdrawals, and remaining §5/§6 amendments await implementation. |
| `docs/designs/2026-08-17-nodes-write-plan-executor-seam-design.md` | active delivery | The seam ships, but its §7 standard amendments remain part of the redesign outcome. |
| `docs/plans/2026-06-21-nodes-knowledge-vocab-plan.md` | historical/superseded | Historical rollout; vocabulary was later retired. |
| `docs/plans/2026-06-21-nodes-python-kernel-plan.md` | historical/superseded | Implemented historical rollout. |
| `docs/plans/2026-06-21-nodes-structural-index-plan.md` | historical/superseded | Implemented historical rollout. |
| `docs/plans/2026-06-21-nodes-ts-kernel-plan.md` | historical/superseded | Implemented historical rollout. |
| `docs/plans/2026-06-22-nodes-fulltext-search-plan.md` | historical/superseded | Its current-state note and shipped tests prove completion. |
| `docs/plans/2026-06-22-nodes-similarity-index-plan.md` | historical/superseded | Its current-state note and shipped tests prove completion. |
| `docs/plans/2026-06-22-nodes-ts-fulltext-search-plan.md` | historical/superseded | Its current-state note and shipped tests prove completion. |
| `docs/plans/2026-06-22-nodes-ts-knowledge-vocab-plan.md` | historical/superseded | Historical rollout later superseded by vocabulary retirement. |
| `docs/plans/2026-06-22-nodes-ts-similarity-index-plan.md` | historical/superseded | Its current-state note and shipped tests prove completion. |
| `docs/plans/2026-06-22-nodes-ts-structural-index-plan.md` | historical/superseded | Its current-state note and shipped tests prove completion. |
| `docs/plans/2026-06-23-nodes-index-persistence-plan.md` | historical/superseded | Its current-state note and shipped tests prove completion. |
| `docs/plans/2026-06-23-nodes-structural-shapes-redesign-plan.md` | historical/superseded | Its current-state note and parity fixtures prove completion. |
| `docs/plans/2026-06-23-nodes-ts-index-persistence-plan.md` | historical/superseded | Its current-state note and shipped tests prove completion. |
| `docs/plans/2026-06-24-nodes-ts-structural-shapes-redesign-plan.md` | historical/superseded | Its current-state note and parity fixtures prove completion. |
| `docs/plans/2026-07-02-nodes-ts-corpus-fingerprints-plan.md` | historical/superseded | Exported APIs and Mindful consumption prove completion. |
| `docs/plans/2026-07-10-nodes-standard-and-check-plan.md` | historical/superseded | Standard 1.2, check APIs, fixtures, and tests exist. |
| `docs/plans/2026-07-11-nodes-membership-traversal-and-check-plan.md` | historical/superseded | Traversal APIs and shared oracles exist in both languages. |
| `docs/plans/2026-07-11-package-identity-implementation-plan.md` | historical/superseded | Current manifests use `nodes-core` and `@nodes-dev/core`. |
| `docs/plans/2026-07-12-nodes-base-vocabulary-retirement-plan.md` | historical/superseded | Both public source trees are domain-free. |
| `docs/plans/2026-07-13-nodes-python-package-layout-plan.md` | historical/superseded | Python imports and package metadata use `nodes.core`. |
| `docs/plans/2026-07-16-nodes-first-publish-plan.md` | historical/superseded | Superseded by the 0.1.1 recovery plan. |
| `docs/plans/2026-07-18-nodes-first-publish-recovery-plan.md` | historical/superseded | The 0.1.1 registry, tag, provenance, and deprecation outcomes are verified. |
| `docs/plans/2026-08-30-nodes-tasks-migration.md` | active delivery | Migration evidence and deferred-dependency record until integration and reconciliation finish. |
| `docs/superpowers/plans/2026-08-17-nodes-detailed-review.md` | historical/superseded | Its planned design and seam commits are ancestors of the audit base. |
| `docs/superpowers/specs/2026-08-17-nodes-detailed-review-design.md` | historical/superseded | The scoped review is complete and its artifacts landed. |

## Drift corrections

| Evidence | Correction | Outward-grep result |
|---|---|---|
| `README.md` still named the former `science` checkout as the Python consumer and shortened Mindful v6 to its parent directory; `~/d/beliefs/python/pyproject.toml` and imports prove the renamed consumer. | Name `beliefs` at `~/d/beliefs/` and Mindful v6 at `~/d/mindful/v6/`. | Current root guidance now uses the real names and paths; historical `science` references remain dated rationale. |
| The redesign review named five headers that still said draft or pending despite shipped Python/TypeScript implementations and passing parity suites. | Mark the substrate, TypeScript kernel, full-text, similarity, and TypeScript fingerprint designs as implemented historical records. | The redesign design records the correction; no current header among the five retains the stale state. |
| The release recovery plan had unchecked owner steps but no status evidence. Local/remote tags, both registries, PyPI Integrity, npm deprecation metadata, and `npm whoami` now provide readback evidence. | Add a dated outcome note without rewriting historical checkboxes. | The redesign design records the correction; no claim treats unchecked boxes as proof. |

Historical code paths and former package names inside dated plans remain historical evidence rather than current instructions. Their current-state notes, the root authority order, and this classification prevent them from overriding the shipped tree.

## Candidate outcomes

| Outcome | Evidence | Sources | Active state | Size | Proposed status | Blockers | Disposition | Task ID |
|---|---|---|---|---|---|---|---|---|
| Preserve the shipped domain-free kernels, projection API, write-plan seam, and 0.1.1 release | Both suites pass; the projection and seam commits are ancestors of the audit base; package registries and immutable tags prove the release. | `docs/STANDARD.md`; seam design; release recovery plan; source, fixtures, tests, history | No active branch or owner | n/a | n/a | n/a | no task: completed history | n/a |
| Implement the remaining Nodes 2.0 redesign contract | The reviewed design still requires reserved non-Markdown path and no-follow containment guarantees, recoverable construction with parse and duplicate-uid findings, digest-id path-collision and ordering rules, the surviving corpus-local API withdrawals, seam/identity standard amendments, and the namespaced-facet parity fixture. Current source and standard lack those changes. Beliefs names these §2.2–2.4 items `nodes-remainder`. | `docs/designs/2026-08-03-nodes-under-the-system-redesign-design.md` §§2.2–2.4, §3, §5–6; `docs/designs/2026-08-17-nodes-write-plan-executor-seam-design.md` §7; Beliefs roadmap `nodes-remainder`; current source and fixtures | No active branch or verified owner | xl | todo | none; its own design gate is complete | create | `nodes-ce28b8` |
| Re-open package-name transfer or scalability work | The Python layout decision makes the transfer optional, while standard §13 deliberately accepts the single-writer and personal-corpus ceilings. No current consumer requires a change. | Python package-layout design; `docs/STANDARD.md` §13 | No active branch or owner | n/a | n/a | n/a | no task: optional or accepted limitation | n/a |

The created outcome will use priority `1`, size `xl`, status `todo`, and tags `migration`, `redesign`, `contract`, and `parity`. One task keeps the standard amendment, both implementations, and shared fixtures together: separately shipping any of them would violate the repository's tier-1/tier-2 parity rule. Its emitted ID is the stable producer ID Beliefs and either Mindful migration may reference when their evidence proves a direct delivery dependency.

## Deferred foreign dependencies

None. The audit found no Nodes-owned task blocked on a future Mindful v3 or v6 outcome. Mindful v6's shipped similarity caller is evidence for retaining that API, not a dependency edge; Mindful v3 has no current Nodes dependency. Future consumer tasks may depend on the Nodes producer ID after their own migrations establish that blocker.

## Verification

| Command or inspection | Result | Commit containing result |
|---|---|---|
| `uv run --frozen pytest -q` | Passed all 531 collected Python tests before edits. | `5a00bba` |
| `uv run --frozen ruff check .` | Passed with `All checks passed!` before edits. | `5a00bba` |
| `uv run --frozen pyright src` | Passed with 0 errors, 0 warnings, and 0 information messages before edits. | `5a00bba` |
| `npm ci && npm test` | Clean install succeeded; 44 files and 359 TypeScript tests passed before edits. | `5a00bba` |
| `npm run typecheck && npm run check` | TypeScript typecheck passed and Biome checked 64 files with no fixes. | `5a00bba` |
| Source/fixture parity audit | Both kernels expose the current tier-1/tier-2 surfaces and share projection, rename-plan, search, similarity, check, and traversal oracles; the remaining redesign gaps are absent in both. | `5a00bba` |
| Branch, worktree, and history inspection | Only `main` and the migration branch exist locally; no unexplained worktree or dirty path existed before migration. | `5a00bba` |
| PyPI/npm/tag readback | Remote tags match the immutable release commits; PyPI has exactly the 0.1.1 wheel/sdist with release provenance; npm 0.1.1 has provenance and 0.0.0 is deprecated; `npm whoami` fails `ENEEDAUTH`. | Registry state verified 2026-08-31; recorded by `docs: reconcile project status for tasks migration` |
| Exact document coverage comparison and repository gates | Coverage diff was empty; all six Python and TypeScript gates passed after the documentation corrections. | `docs: reconcile project status for tasks migration` |
| Tasks CLI creation and field-by-field review | `tasks add` emitted `nodes-ce28b8`; `tasks show` matched every reviewed field, body, and empty dependency set. | `chore(tasks): initialize project task tracking` |
| `tasks check`, `tasks prime`, and `tasks ready` in the temporary four-project registry | Check returned empty errors and warnings; prime reported prefix `nodes` with one todo; ready returned only `nodes-ce28b8`. | `chore(tasks): initialize project task tracking` |
| Final Python and TypeScript gates | All 531 Python tests, Ruff, Pyright, all 359 TypeScript tests, typecheck, and Biome passed after Tasks initialization. | `chore(tasks): initialize project task tracking` |
