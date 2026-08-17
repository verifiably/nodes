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

## 4. Boundary attribution

## 5. Derived indexes and reserved paths

## 6. Consumer sufficiency

## 7. Pending standard amendments

## 8. Amendment record

### Exercise map

No part is consumer-exercised yet. When science's adapter design banks, it will
exercise the create path: its cut-4 slice is add-only.
