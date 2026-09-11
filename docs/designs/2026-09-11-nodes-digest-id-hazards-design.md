# Digest-id hazards — design

**Date:** 2026-09-11
**Status:** implemented on branch `nodes-2.0` (2026-09-11); the umbrella's E owns the final version bump and marker removal
**Task:** `nodes-cd59f0`, sub-task C of `nodes-ce28b8`
**Sources:** `2026-09-11-nodes-2.0-remainder-design.md` §C;
`2026-08-03-nodes-under-the-system-redesign-design.md` §2.4.
**Baseline:** `22e3a2a` on branch `nodes-2.0`; A is implemented.

## 1. Decisions and alternatives

Decisions after review:

- Preserve existing exact-path, in-place renames; refuse a rename whose destination
  differs in spelling but folds to an occupied path, including its own source path.
- Report existing path collisions as **warnings**, one per live claimant, because a
  well-placed case-variant corpus remains readable and legal on a volume that holds it.
  Mutation refusal prevents introducing the hazard through nodes.
- Commit a logical oracle and construct filesystem cases in tests. Do not commit a
  case-variant tree or depend on B's future misplaced-member handling.

Uniformly refusing every same-key rename is simpler to describe but would remove the
safe exact-path replacement already implemented in both kernels. Supporting case-only
renames instead would require a new execution strategy whose behavior differs between
filesystems. This design retains exact-path replacement and tightens case-only rename
admission; the latter is a breaking restriction on case-sensitive volumes (§4).

An `error` severity for existing collisions is a possible policy alternative. This
design chooses `warning` to distinguish an existing portability hazard from content that
cannot be read. The code and severity are tier 2 and require explicit fixture coverage.

## 2. Identity and path definitions

A node is **well-placed** when the literal root-relative path of its file equals the
canonical mapped path of its live id, exactly. The mapping remains
`kind/slug.md`, replacing every `:` in the slug with `__`. C defines this predicate;
B owns disk-member admission and the treatment of misplaced members. The snapshot
validator already rejects manifest paths that differ from the mapped id path; C feeds
that existing check with the shared mapping. Rejection discards the cache and triggers
a cold rebuild, which currently admits misplaced files. Changed-file reconciliation
also lacks placement checks. B must enforce placement on both disk-admission paths;
C introduces no new placement rejection or `path-mismatch` finding.

The **collision key** is NFC followed by default case folding of that mapped path.
Two distinct live claimants collide when their keys are equal. Physical filenames and
deprecated ids are not inputs to this comparison: deprecated ids are identity aliases,
not claims to occupied files. Existing exact identity-claim checks remain in force.

STANDARD §3 restricts valid ids to ASCII. Consequently mapped paths are ASCII, NFC is
the identity operation, and ASCII lowercase is exactly the required case fold. Both
implementations may use lowercase after validating the id through the existing parser.
No Unicode table or casefold dependency is needed. Widening the id grammar would require
revisiting this implementation shortcut in the same amendment.

Examples:

| Live ids | Mapped paths | Collision key |
| --- | --- | --- |
| `kind:A`, `kind:a` | `kind/A.md`, `kind/a.md` | `kind/a.md` |
| `kind:a:b`, `kind:a__b` | both `kind/a__b.md` | `kind/a__b.md` |
| `kind:a`, `other:a` | different kind directories | distinct keys |

## 3. One mapping and a derived path index

Move the existing id-to-relative-path calculation into the dependency-neutral `paths`
module in each language. Python's Store and snapshot validator currently duplicate it;
TypeScript's implementation currently lives in `snapshot.ts`. Store, snapshot validation,
Corpus and collision detection use the shared calculation. Keep TypeScript's public
package-index export of `pathForNodeId`, sourced directly from `paths.ts`; remove the
`snapshot.ts` export. Update `store.ts`, `corpus.ts`, `snapshot.ts`, `index.ts`, and the
snapshot-load test imports. There is no module-path compatibility re-export.
The paths module may import `ids` and `errors`; neither imports the structural index.
Update both paths module dependency comments to match.

Proposed shared names are `path_for_node_id` / `pathForNodeId` and
`path_collision_key` / `pathCollisionKey`. Keys accept ids, not arbitrary disk paths.
Python `Store.rel_path` delegates to the shared mapping rather than retaining a second
formula. Existing public Store path helpers keep their behavior.

The structural Index gains a private derived map from collision key to a set of live
uids. Populate it in `upsert`; remove the old claim in `_drop` / `drop`, which is shared
by replacement and removal, and delete empty buckets there. Rebuild it
from entries during snapshot deserialization; do not serialize it or bump snapshot schema
versions. A bucket may contain several uids: construction must be able to represent a
collision rather than silently select one winner.

This is an index, not an additional corpus scan. Mutation path availability uses a
bucket lookup and the existing uid entry. Reporting enumerates the buckets. It adds
O(n) derived storage and does not introduce an O(n) scan into each rename.

Split current admission logic into identity-claim validation and mutation admission:

- `assert_identity_claims(node)` / `assertIdentityClaims(node)` preserves the current
  `assert_addable` checks for uid ownership, live ids and deprecated ids.
- `assert_path_available(candidate_uid, candidate_id)` /
  `assertPathAvailable(candidateUid, candidateId)` implements §4 using the derived map.
- `assert_addable` / `assertAddable` runs both checks, in that order.
- Index construction and snapshot reconciliation run identity checks, including the
  existing separate duplicate-uid rejection, but **not** mutation path refusal.
  Deserialization likewise preserves its existing identity validation and derives buckets.

The umbrella currently names `assert_addable` as a reconcile caller. That is true today,
but adding path refusal there without splitting the checks would make a valid collided
corpus load differently depending on whether it has a snapshot. This design corrects
that interaction while retaining the umbrella's required construction behavior.

## 4. Mutation rules

`assert_path_available` uses the candidate's uid as well as its id:

1. If that uid already has a live entry and its **exact mapped path** equals the
   candidate's exact mapped path, permit the path check. The operation changes no path
   claim. This also permits updating a member of an already-collided corpus.
2. Otherwise, an occupied candidate-key bucket raises `CollisionError`.
3. An unoccupied key is available.

`assert_addable` still rejects same-uid/different-id misuse through its identity checks,
so rule 1 does not turn `add` into rename. A same-(uid, id) replacement remains allowed,
subject to existing registry and identity validation. A new uid claiming the same mapped
path or a case variant refuses, even on a case-sensitive volume.

Rename retains its existing live-source and unresolved-target checks, then calls the
path check with the source uid and new id before referrer preparation, embedder/cache
work or executor invocation:

| Rename | Result |
| --- | --- |
| `kind:A` → `kind:a` | `CollisionError`, including on case-sensitive volumes |
| `kind:a:b` → `kind:a__b`, target id otherwise free | existing in-place replace plan |
| source → an occupied key belonging to another uid | `CollisionError` |
| source → an unoccupied key | existing create/delete/referrer plan |
| id → itself or an already-resolving alias | existing `CollisionError` |

The exact-path branch already exists in both Corpus implementations and never emits a
delete for that file. Keep it. Do not extend it to differently spelled paths: the
ordinary create/delete plan is unsuitable when those spellings address one physical file.
Case-only rename currently succeeds on a case-sensitive volume, so refusing it is a
2.0 tightening. Two renames through a free temporary id remain available:
`kind:A` → `kind:tmp` → `kind:a`. Deprecated ids do not occupy path buckets and identity
checks compare exact strings, so the old `kind:A` alias does not block `kind:a`. Pin
this sequence in a regression test. Renaming out of an existing collision and deleting
a claimant remain permitted.
Direct Store and executor APIs retain their existing lower-level responsibilities;
they do not have a corpus identity index and cannot enforce corpus admission policy.

## 5. Reporting

Expose an Index query returning every live id and its collision key for buckets with
more than one uid. `Corpus.check()` turns these into findings regardless of registry:

`{severity: "warning", code: "path-collision", ref: <live id>, detail: <collision key>}`.

There is one finding per claimant, not one per pair. Three claimants produce three
findings, avoiding quadratic output. The common `detail` joins the group; the `ref`
values identify its members. Existing final `(ref, code, detail)` code-point ordering
applies; messages remain human-only. No finding is emitted for an alias by itself or a
single live claimant. Replacing, removing, renaming or reloading updates the result
through the derived map, with no separately cached finding list.

Strict rebuild and reconciliation accept well-placed case-variant claimants with
distinct uids and otherwise legal identity claims. This is a latent portability hazard,
not a duplicate uid. At rest, two well-placed case variants require a case-sensitive
volume; the exact `:`/`__` pair cannot occupy two well-placed files on any volume.
Until B lands, cold rebuild and changed-file reconciliation also accept misplaced
claimants, as today. B later applies its own placement/exclusion rules and consumes
the same reporting query for retained members.

## 6. Uid opacity and remaining ordering

Replace the uid-minting SHOULD in STANDARD's field table with a statement that nodes
treats supplied uid strings opaquely and minting policy belongs to a profile. Existing
UUID-hex convenience defaults remain available; do not change default minting or impose
hex, UUID, digest, case, or normalization validation on supplied uids.

Both current Node schemas accept an empty uid. Reject it in both languages with the
kernel `ValidationError` at node construction and Markdown parsing boundaries. Non-empty
is a presence constraint, not a shape constraint: do not trim, normalize, or otherwise
restrict supplied strings. This is another 2.0 tightening. Reject empty uids in restored
structural entries too, so an old snapshot cannot bypass node validation; the normal
invalid-cache fallback then parses the documents and reports their actual validity.

Fix Python `Index.resolve_uid`, which currently uses
`live.get(ref) or deprecated.get(ref)`: absence is `None` / `null`, never truthiness.
Exercise live and deprecated resolution, identity refusal and snapshot round trips for
non-empty opaque uids, and rejection of empty uids. A focused lower-level test may
pin the explicit-absence lookup without representing an empty uid as a valid node.

A already delivered the walk's code-point sort and STANDARD §4.1 wording. Remaining
relevant TypeScript sorts are Corpus manifest output, neighbor uid order and rename
referrer uid order; use the existing `compareCodepoints` for these. In particular,
non-BMP uids must not reorder rename's canonical plan relative to Python.
Sorts over validated ASCII ids need no behavioral rewrite; registry validation message
selection and unrelated convenience ordering are outside C.

## 7. Fixtures and verification

Add a shared `path-collision.oracle.json` containing logical node/id/uid descriptions,
expected keys, collision-related mutation outcomes and reporting rows. Do not commit
case-variant or misplaced Markdown claimants. The oracle has three kinds of coverage:

- Pure Index cases run everywhere: case variants, exact `:`/`__` aliasing, three-member
  buckets, distinct kind directories, deprecated-only aliases, replacement admission,
  removal/rename bucket maintenance and deserialization.
- Filesystem mutation cases run everywhere with one existing claimant: refused second
  add, refused case-only rename, safe exact-path rename, ordinary rename and the
  temporary-id workaround. Refusal
  tests assert unchanged documents/indexes and no executor or embedder/cache effects.
- A constructed, well-placed case-variant corpus pins public `check()` findings,
  replacement, repair by rename/delete, cold rebuild, cached reload and externally added
  claimants during reconcile. Probe case sensitivity by exclusive creation of the two
  actual case-variant filenames in a temporary directory. Skip only these two-file
  scenarios when the second spelling is the same file; propagate other setup failures.

The exact `:`/`__` collision cannot have two well-placed files at rest, so its detector
case stays in memory and its refusal/safe-rename cases use one on-disk file. Every platform
still runs the collision algorithm and mutation-refusal oracle arms.

Keep uid validation and collation out of the collision oracle. Add opaque-uid coverage
to node, snapshot and neighbor tests, with a small `uid.oracle.json` pinning accepted
non-empty strings and empty-string rejection. Extend the existing rename corpus and
`write-plan.rename.canonical.json` / `corpus.rename.canonical.json` with non-BMP versus
BMP referrer uids to pin the captured rename plan order. Use semantic plan comparisons,
as those existing rename tests do; do not depend on language-specific serialized byte formatting.
Snapshot tests must verify derived buckets after both full restore and incremental
reconciliation. No Python-only finding, error taxonomy or persisted index field is added.

## 8. Normative and process closeout

C is tier 1 (admission, rename and identity) plus tier 2 (findings). Its implementation,
tests, oracle and STANDARD amendments land together in one commit on `nodes-2.0`:

- §2 uid field: non-empty presence constraint and opacity/profile wording.
- §3 and §7: identity versus path admission; construction acceptance; exact-path rename
  and differently spelled same-key refusal; code-point ordering of deterministic uid
  sequences.
- §4.1: well-placed and mapped-path collision definitions, retaining A's walk ordering.
- §6: path-admission refusal also uses `CollisionError`.
- §8.2: new finding row and updated exhaustive structural-finding inventory.
- §11.2: collision and uid oracles, plus the existing rename plan/corpus ordering fixture.

Mark edited clauses `*(2.0)*`, retaining header 1.2 and the pending note for E. Amend the
seam's §2 rename description, §7 item 2 quoted pending STANDARD amendment, and §8
amendment log to record the existing exact-path replace branch and code-point referrer
order. E must copy the corrected pending text so its amendment preserves both clauses.
The recorded exercise map leaves rename unexercised by Science's add-only slice.
Keep A's existing pending Science sign-off row unchanged.
Do not infer new consumer sign-off or send notifications on consumers' behalf.

At implementation closeout, reconcile the umbrella's C caller wording and scope, mark
this design implemented on the branch, and grep user-facing docs for the same changed
claims. E still owns the final broad redesign/seam status transition and version bump.
Run `just gate`, `tasks check` and the marker inspection before the implementation commit.
Package renaming, B's placement enforcement, collecting construction and main merge
remain separate work.
