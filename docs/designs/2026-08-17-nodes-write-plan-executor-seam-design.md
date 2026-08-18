# Nodes write-plan/executor seam design

**Date:** 2026-08-17

## 1. Why and status

The 2026-08-03 redesign design's §4 named the write-plan/executor seam as
direction and gated it on `atoms` A7–A8. A8 landed with physical certification
on 2026-08-17. Science's composition-root adapter design is this seam's first
consumer.

This design is frozen on banking and **pre-normative**. It binds the future
standard amendment (1.3 or 2.0, per the trailing review's version verdict) and
binds design consumers now, while the standard continues to describe shipped
code. Its touchpoints with existing normative text—the single-writer rule in
standard §7 and rename's crash language in standard §3—are recorded as pending
amendment wording in §7 here, not applied to the standard. A change to a part
exercised by a landed consumer requires that consumer's sign-off, recorded in
§8; `nodes`-side review alone may amend parts no landed consumer exercises.

## 2. The write plan

`WritePlan` is a pure, fully determined, serializable ordered sequence of these
distinct operation kinds, the future amendment's discriminated-union API; it
contains no closures or callbacks:

```
CreateOp  = {op: "create",  path, content}
ReplaceOp = {op: "replace", path, content, expected_digest}
DeleteOp  = {op: "delete",  path, expected_digest}
WritePlan = [CreateOp | ReplaceOp | DeleteOp, ...]
```

`path` is a root-relative POSIX string. `content` is raw bytes (`bytes` in
Python and `Uint8Array` in TypeScript); serialized node documents are UTF-8.
`expected_digest` is lowercase-hex SHA-256 of the on-disk bytes an operation
replaces or deletes. It is portable because both kernels read the same disk
state, unlike emitted content. A create implicitly requires an absent path;
replace and delete implicitly require a present path with the matching digest.
The preconditions are these fields, not a separate structure; §3 declares their
enforcement for each atomicity class. The separate operations remain necessary:
their preconditions differ and a durable executor maps them to different effect
types.

`add` selects `create` or `replace` from the live `(uid, id)` pair: an unseen
pair emits `create`; a matching existing pair emits `replace`. This preserves the
overwrite used by mindful v6's `tag()` path. Collision refusal remains
corpus-side before plan construction: `assert_addable` still refuses a uid held
by another id and an identity claim held by another uid
(`~/d/nodes/python/src/nodes/core/structural_index.py:184-193`). It never sends
either refusal to an executor. The current add path validates, calls that guard,
then writes (`~/d/nodes/python/src/nodes/core/corpus.py:153-161`).

Create and replace payloads are serialized document bytes from the emitting
kernel's serializer, so the executor remains pure file mechanics, as `Store` is
today (`~/d/nodes/python/src/nodes/core/store.py:25-45`), with no kernel
serialization service. Plan equality is semantic: plans match when operation
kinds, paths, and `expected_digest` values match position-wise and every
`content` payload parses to the same canonical JSON projection. This follows
standard §1's byte-identical-serialization non-goal. A parity fixture pins this
at implementation time as a tier-1 obligation: this is mutation semantics.

Rename emits `create` for the new document, then `delete` for the old document,
then `replace` operations for referrers, matching today's write-new → delete-old
→ referrers commit order (`~/d/nodes/python/src/nodes/core/corpus.py:254-316`).
Under the best-effort class, a crash leaves an applied prefix:

- Before the create, no operation has applied. After it and before the delete,
  two files carry the uid. This is the acknowledged invalid prefix: strict
  construction raises `CollisionError` at `Index.build`. The trailing review's
  §2.3 verdict decides whether collecting construction can report this
  corpus-level collision; as drafted it does not.
- After the delete and before a referrer replace, the renamed node survives with
  its old id in `deprecated_ids`; unchanged referrers still resolve through that
  alias. Each later referrer replace advances the prefix without changing that
  property.
- After the final referrer replace, the full rename plan has applied.

Reordering cannot remove this window. Rename changes the node's `id` field and
`deprecated_ids`, so it is not a pure move: every create/replace/delete order
has either a duplicate uid, a source deleted before its target exists, or
referrers pointing at a nonexistent target. An atomic move operation does not
help that content transition. This contract chooses the duplicate-uid window
because strict construction refuses it loudly rather than resolving it wrongly.

## 3. The executor protocol

The future API is `WritePlanExecutor`, with no result-report type: a normal
return means every operation applied, so a per-operation report would contain
only the same `applied` outcome. Failures raise instead.

```python
class WritePlanExecutor(Protocol):
    def execute(self, plan: WritePlan) -> None: ...
```

```ts
interface WritePlanExecutor {
  execute(plan: WritePlan): void
}
```

`DefaultExecutor` is the named form of today's best-effort ordered writes. A
crash can leave an applied prefix of the plan. A durable executor is supplied
by a composition root (`atoms` through science's Python composition root) and
applies a plan all-or-nothing; `nodes` depends on `atoms` in neither language.

| Executor | Atomicity and preconditions | Serialization |
| --- | --- | --- |
| `DefaultExecutor` | Checks each operation's existence precondition when it reaches that operation and stops at the first failure, leaving the applied prefix. It carries but does not enforce `expected_digest`. | Provides no serialization; the deployment retains the standard §7 single-writer obligation. |
| Durable executor | Refuses a failed precondition before any effect: the transaction aborts and nothing applies. | Owns serialization. |

The kernel never coordinates concurrency. Each executor declares whether it
serializes or passes the single-writer obligation through to the deployment.

The plan builder never emits a path outside the corpus root or in a reserved
namespace. Both executor classes additionally reject, before any effect, a
malformed plan containing a lexically escaping path (absolute, or containing
`..` after lexical normalization), a reserved-namespace path, or an unknown
operation kind. They raise `PlanRefusedError` for that lexically decidable
refusal. A durable executor's authoritative rooted resolution can additionally
refuse path or deployment topology; that is an execution failure, not malformed
plan syntax, and raises `ExecutionError(index=None, applied=0)`.

Other execution failures raise `ExecutionError(index, applied)`, where each
field is `int | None` in Python (`number | null` in TypeScript). `index=None`
means the failure is not attributable to an operation. `applied=None` means
restoration is unproved: the executor cannot prove disk is at its pre-plan
state. A known pre-effect or cleanly restored refusal carries `applied=0`; a
durable transaction-level refusal has `index=None`. The seam adds exactly these
two public error names.

The executor returns `None` / `void`; only after `execute` returns does the
corpus update its in-memory state.

An executor is root-bound at construction: `DefaultExecutor(root)`. The
protocol remains `execute(plan)` without a root parameter, keeping plans
root-relative values. `Corpus(root, executor_factory=...)` calls a root-taking
factory with its own root (`executor_factory(root) -> WritePlanExecutor` in
Python; `(root: string) => WritePlanExecutor` in TypeScript); when omitted, it
constructs `DefaultExecutor(root)`. A composition root closes over its engine
handles but lets the corpus supply the root. It never supplies a pre-bound
executor whose root the corpus cannot verify. This is the seam science's
adapter wires without re-opening `nodes`.

## 4. Boundary attribution

The kernel performs no coordination. Serialization and durability are each an
executor's declared responsibility or are explicitly passed to the deployment;
§3's posture table is the authority. Corpus-side in-memory state—the structural
index, search index, and manifest—updates only after `execute` returns.

For a durable executor, a clean refusal leaves both disk and in-memory state at
their pre-plan state. After a crash, recovery under a later lease either proves
and restores the pre-plan state or completes the fully applied plan and its
commit before returning. If the durable executor cannot prove restoration,
`execute` does not return and `ExecutionError(applied=None)` is the only honest
attribution: memory remains pre-plan, while disk is halted or otherwise
unattributable and must not be described as restored.

`TransactionHalted` is the named durable halt case. Its evidence is preserved,
and the halt persists until the diagnostic's operator action is performed; a
later lease then resumes recovery or re-raises the halt. The adapter neither
invokes nor reimplements that recovery.

For the best-effort executor, a mid-plan failure leaves the applied prefix on
disk while memory remains entirely pre-plan. The corpus object is therefore
stale by exactly that applied prefix relative to disk, and lacks the whole plan
relative to the intended final state. Reconstruction from disk, with its
existing strict or collecting behavior, is the recovery.

## 5. Derived indexes and reserved paths

`.nodes-index/` snapshot writes (`flush_index`) do not route through the
executor. They are rebuildable derived state in the reserved namespace, as
redesign design §2.2 describes, and are excluded from plans entirely. A plan
containing a reserved-namespace path is malformed and raises `PlanRefusedError`
under §3.

Consequently, a durable executor's all-or-nothing claim covers corpus content
only. Index snapshots remain best-effort and rebuildable by design.

## 6. Consumer sufficiency

This section is a consumer note verified against `atoms`' engine types, not a
`nodes` obligation. Every durable-transaction field is derivable from the plan,
adapter-side constants, or adapter-side reads, so science can implement the
`WritePlanExecutor` adapter without re-opening this contract.

The operation mapping is:

- `CreateOp` maps to `CreateFileNoClobber(effect_id, path, post)`. The adapter
  computes `post.content_hash` and `post.byte_len` from the op's `content` bytes.
  It supplies `post.mode` as its own constant: `nodes` does not model file modes,
  so the mode is an adapter decision.
- `ReplaceOp` maps to `ReplaceFile(effect_id, path, pre, post)`. The adapter
  derives `post` as for create and obtains `pre` by reading the current file when
  it builds the transaction. It cross-checks that read against
  `expected_digest`; a mismatch is a refusal before any effect.
- `DeleteOp` maps to `DeletePath(effect_id, path, pre)`. The adapter obtains and
  cross-checks `pre` as for replace.

These are the engine's actual effect signatures
(`~/d/atoms/python/src/atoms/core/effects.py:18-46`). Their digest formats differ:
the plan's `expected_digest` is raw lowercase hex, while
`FileState.content_hash` is `sha256:`-prefixed. The adapter prefixes the digest
when building states and strips the prefix when cross-checking
(`~/d/atoms/python/src/atoms/core/fingerprint.py:22-28`;
`~/d/atoms/python/src/atoms/core/compiler.py:292-295`). `MoveNoClobber` exists
but is deliberately unused: §2 establishes that rename changes content and is
never a pure move.

The complete `TransactionSpec` mapping is:

| Field | Source |
| --- | --- |
| `schema_version` | The engine's `SCHEMA_VERSION` constant. |
| `consumer_tag` | Minted by the adapter. |
| `intent_digest` | Caller-supplied: the adapter digests its own canonical intent encoding, which is derivable from the plan alone. The engine validates only the `sha256:<64 lowercase hex>` format. |
| `initial_surface` / `final_surface` | Derived from the absent/file pre- and post-states above. |
| `effects` | The mapped effects, with adapter-minted `effect_id`s. |
| `dependencies` / `fulfills` | The adapter's call; the plan requires neither. |
| `registered_paths` | `()` for this slice. The corpus-write adapter reserves nothing. |

Those fields are the complete engine model
(`~/d/atoms/python/src/atoms/core/spec.py:31-40`). `intent_digest` enters through
the caller-facing builder and compilation only validates its format
(`~/d/atoms/python/src/atoms/core/spec.py:77-101`;
`~/d/atoms/python/src/atoms/core/compiler.py:207-213`). `registered_paths=()` is
distinct from the automatic registration-chain append, which the engine performs
in every transaction regardless and which is invisible to `nodes`. Per science
cut 4's boundary, every transaction in this slice is **chained but unanchored**
(`~/d/science/docs/designs/2026-08-17-conformance-cut-4.md:64-73`).

Science supplies a root-taking executor factory to `Corpus`; that factory closes
over the engine handles and lets `Corpus` provide the root. The composition root
exclusively owns the executor choice.

## 7. Pending standard amendments

Exactly these two amendments are pending:

1. **Standard §7 — single-writer attribution (pending).** Replace the current
   single-writer paragraph with: “The kernel performs no coordination. Each
   executor declares whether it serializes corpus mutation or passes the
   single-writer obligation through to the deployment. `DefaultExecutor`
   provides no serialization, so deployments using it MUST ensure a single
   writer at a time. A durable executor owns serialization. Readers may run
   concurrently at the cost of possibly-stale derived indexes.”
2. **Standard §3 — rename crash state (pending).** After rename's preparation
   and validation rule, state: “Execution orders the rename plan as create the
   new document, delete the old document, then replace referrers. Under
   `DefaultExecutor`, a crash leaves an applied prefix. After create and before
   delete, two files carry the same uid; this prefix is invalid, is not
   forward-resolvable, and strict construction refuses it with `CollisionError`.
   After delete and before a referrer replacement, unchanged referrers still
   resolve through the renamed node's `deprecated_ids`. A durable executor
   applies the complete plan all-or-nothing.” This specified invalid prefix
   replaces every “crash-atomic” or blanket forward-resolvable characterization.

Both entries land only in the standard amendment—1.3 or 2.0, per the trailing
review's version verdict—and change nothing until that amendment lands.

## 8. Amendment record

### Exercise map

Science's composition-root adapter design banked 2026-08-18 at science commit
`2140805`. Its add-only cut-4 slice consumer-exercises the create path, so any
amendment to that path requires Science sign-off. Replace and delete remain
unexercised.

### Amendments log

| date | part | change | reviewer | consumer sign-off |
| --- | --- | --- | --- | --- |
| 2026-08-18 | §§3–4 | Made `ExecutionError.index` and `.applied` optional, with `applied=None` meaning restoration unproved; narrowed `PlanRefusedError` to lexically decidable malformedness and made durable resolution-time refusals `ExecutionError(None, 0)`; replaced the blanket durable crash claim with the persistent, evidence-preserving halt carve-out. | `nodes`-side review | n/a — no landed consumer exercises these parts |

Record each amendment as: `date | part | change | reviewer | consumer sign-off`
(consumer sign-off is required when the part is exercised; otherwise record
`n/a`).
