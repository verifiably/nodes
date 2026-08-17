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
(`~/d/nodes/python/src/nodes/core/structural_index.py:183-191`). It never sends
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
malformed plan containing a path that escapes the root after resolution, a
reserved-namespace path, or an unknown operation kind. They raise
`PlanRefusedError` for that refusal. Other execution failures raise
`ExecutionError`, carrying the failing operation's index and the number of
operations already applied. The seam adds exactly those two public error names.

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

For a durable executor, refusal or a crash leaves both disk and in-memory state
at their pre-plan state: nothing applies and nothing updates. For the
best-effort executor, a mid-plan failure leaves the applied prefix on disk while
memory remains entirely pre-plan. The corpus object is therefore stale by
exactly that applied prefix relative to disk, and lacks the whole plan relative
to the intended final state. Reconstruction from disk, with its existing strict
or collecting behavior, is the recovery.

## 5. Derived indexes and reserved paths

`.nodes-index/` snapshot writes (`flush_index`) do not route through the
executor. They are rebuildable derived state in the reserved namespace, as
redesign design §2.2 describes, and are excluded from plans entirely. A plan
containing a reserved-namespace path is malformed and raises `PlanRefusedError`
under §3.

Consequently, a durable executor's all-or-nothing claim covers corpus content
only. Index snapshots remain best-effort and rebuildable by design.

## 6. Consumer sufficiency

## 7. Pending standard amendments

## 8. Amendment record

### Exercise map

No part is consumer-exercised yet. When science's adapter design banks, it will
exercise the create path: its cut-4 slice is add-only.
