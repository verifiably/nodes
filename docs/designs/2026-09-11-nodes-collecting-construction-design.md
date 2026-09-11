# Collecting construction — design

**Date:** 2026-09-11
**Status:** draft for review; implementation has not started
**Task:** `nodes-c7b371`, sub-task B of `nodes-ce28b8`
**Sources:** `2026-09-11-nodes-2.0-remainder-design.md` §B;
`2026-08-03-nodes-under-the-system-redesign-design.md` §2.3;
`2026-09-11-nodes-digest-id-hazards-design.md` §2, §5 (well-placed, `path-collision`).
**Baseline:** `007f593` on branch `nodes-2.0`; A and C are implemented.
**Consumer read:** beliefs opens corpora through `ReadView.opened_at(root)`, which
builds `Corpus(Path(root))` and requires `type(corpus) is Corpus` exactly; its audit
reads members through `all()` and folds `check()` findings into its own envelope, and
its ledger row for this work names "audits over damaged corpora".

## 1. Decisions and alternatives

- **Mode is a constructor flag on `Corpus`**, strict by default. A subclass or a second
  class would not pass beliefs' exact-type check; a module-level function would not
  give the audit a mutable handle. Python: `Corpus(root, ..., mode="collecting")`;
  TypeScript: a fifth `options` parameter `{ mode?: "strict" | "collecting" }`, so the
  four existing positional parameters keep their meaning.
- **A content failure is exactly the kernel `ValidationError` raised by decoding and
  parsing one document.** Python's floor today leaks `yaml.YAMLError`, pydantic's own
  `ValidationError` and `AttributeError`; TypeScript substitutes U+FFFD for invalid
  UTF-8 where Python raises `UnicodeDecodeError`. B closes both: Python's frontmatter
  wraps every parse failure, and both kernels decode fatally. This is tier-1 parity
  that strict construction needs as much as collecting does; catching a broad exception
  class instead would turn programming errors into findings.
- **Every construction finding is path-anchored, one per claimant, and every claimant
  of a collision is excluded.** The umbrella's "one corpus-level `uid-collision`" has no
  `ref` to anchor to and no member list; the per-claimant shape is what C chose for
  `path-collision`, and the `detail` joins the group. Live-beats-deprecated winner
  selection for `id-collision` was rejected: it is an ordering rule, and exclusion of
  every claimant never half-admits.
- **Strict construction refuses a misplaced member with a new `PlacementError`.**
  Reusing `ValidationError` would say the content is wrong when the location is;
  `CollisionError` names identity, not placement. A caller repairs the two differently.
- **An excluded path is occupied at its exact literal spelling.** `add` and `rename`
  refuse it with `CollisionError` before any preparation. Case-folded occupancy is not
  needed: on a case-insensitive volume the executor's create precondition already
  refuses the same file, and on a case-sensitive one distinct spellings are distinct
  files.
- **One admission algorithm serves cold build and reconciliation.** Findings re-derive
  on every open; nothing about exclusion is serialized and the snapshot schema does not
  change. A strict open of a snapshot written by a collecting corpus still raises,
  because the excluded files are absent from that snapshot's manifest and are parsed
  as new.
- **`all()` and registry-backed `check()` iterate the accepted set** (the manifest),
  not a fresh walk. Under the single-writer rule the two are equivalent for a strict
  corpus, and the manifest is the only way excluded files stay out.
- **The committed damaged corpus does not carry `path-collision`.** The umbrella asked
  for it, but C established that a case-variant tree is not checkout-portable; that
  finding stays in C's in-test construction, and the new fixture pins the four
  construction codes together with the interplay findings that excluded members cause.

## 2. Modes and the parse floor

`mode` is `"strict"` (default) or `"collecting"`; any other value is a programmer error
(`ValueError` / `TypeError`). The mode is fixed for the handle's life and is not
persisted.

Both kernels decode a walked file as UTF-8 fatally and parse it with
`node_from_markdown` / `nodeFromMarkdown`. Every failure of that step — undecodable
bytes, malformed YAML, frontmatter that is not a mapping, a missing required field, a
field of the wrong shape, a malformed relation row, an id that fails the grammar or
disagrees with `kind` — raises the kernel `ValidationError`. Python's frontmatter
gains the wrapping TypeScript already has; TypeScript switches its two construction
decodes and the store's read to a fatal `TextDecoder`. `Store.read_file` keeps raising
`ValidationError` on a damaged document: reads through the index never reach an
excluded file, so that path stays an error, never a finding.

Filesystem failures — an unreadable directory, a vanished file, a symlink on an
inspected prefix — propagate as `OSError` / `ContainmentError` in both modes. A
content failure is never one of these and one of these is never a finding.

## 3. Admission

Construction classifies every walked file in this order, and a file leaves the process
at its first failure:

1. **Parse.** `ValidationError` → excluded, `parse-error`, `detail` `""`. The message is
   human-only; error text differs between languages and is not oracle-pinned.
2. **Placement.** The literal root-relative path must equal `path_for_node_id(id)`
   exactly (C §2). Otherwise → excluded, `path-mismatch`, `detail` = the mapped path.
3. **Uid.** Among the survivors together with the kept set (§4), any uid claimed by more
   than one file → every claimant excluded, `uid-collision`, `detail` = the uid.
4. **Identity claims.** Among the survivors, any id — live or deprecated — claimed by
   more than one file → every claimant excluded, `id-collision`, `detail` = the id.
   Two well-placed files cannot share a live id, so this arises only through
   `deprecated_ids`.
5. **Index.** The remainder builds through `Index.build` / identity-only reconciliation
   exactly as today. Path-collided well-placed members are ordinary members in both
   modes (C §5).

Strict mode raises at the first failure instead of excluding: `ValidationError` at
step 1, `PlacementError` at step 2, `CollisionError` at steps 3 and 4 (the existing
messages). Under collecting, the finding's `ref` is the file's root-relative path.
A path-anchored `ref` and an id-anchored `ref` never collide: valid ids always contain
`:` and portable paths never do.

The `excluded` set — path → finding — lives on the corpus handle. It is not a member
list: excluded files are absent from the index, the search index, the vector index,
the manifest, `all()`, `get()`, and every graph query. A reference into one is
dangling and reports as such.

## 4. One algorithm for cold build and reconciliation

Admission takes a **kept** set and a **candidate** list. Cold build: kept is empty,
candidates are every walked file. Reconciliation: kept is the snapshot-loaded index
restricted to files whose digest is unchanged; candidates are the new and changed
files, parsed. Files that disappeared are dropped first, as today.

The kept set is internally consistent — a snapshot only ever records accepted members,
whichever mode wrote it — so collisions are checked candidate-against-kept and
candidate-against-candidate, never kept-against-kept. A candidate that collides with a
kept entry **evicts** it: the entry leaves the index, the search index, the vector index
and the manifest, and both files are excluded with the same finding. The kept entry's
path comes from the old manifest by uid. This is what makes the audit's view the same
whether or not a cache exists, which C required of identity checks and B now requires
of exclusion.

Excluded files are never in the manifest, so every open re-walks and re-parses them;
their findings re-derive and nothing is persisted. `flush_index` writes the accepted
set. Reopening in collecting mode over that snapshot reproduces the same findings;
reopening in strict mode raises on the first excluded file, which is the contract.
A file that was excluded and has since been repaired is admitted on the next open; a
file that was accepted and has since been damaged is dropped by digest and excluded.

## 5. Mutation and occupancy

Mutation on a collecting corpus is allowed and unchanged for accepted members. Two
additions, both before referrer preparation, embedding or cache work, or executor
invocation:

- `add` refuses (`CollisionError`) when the candidate's mapped path is in `excluded`.
- `rename` refuses (`CollisionError`) when the new mapped path differs from the old and
  is in `excluded`.

`delete` and the exact-path rename branch only ever target live manifest paths, so no
plan can name an excluded file. The executor's existence precondition stays as the
backstop. Repairing an excluded file is a filesystem edit followed by reopen; nodes
never rewrites a document it could not parse.

Strict corpora have an empty `excluded` set, so strict mutation is unchanged.

## 6. Reporting

`check()` is the single reporting surface. It emits every finding in `excluded`, then
registry findings over accepted members read through the manifest, then the existing
structural findings including C's `path-collision`, and sorts by `(ref, code, detail)`
in code-point order. The four construction findings:

| Code | Severity | `ref` | `detail` |
| --- | --- | --- | --- |
| `parse-error` | error | root-relative path | `""` |
| `path-mismatch` | error | root-relative path | mapped path of the document's id |
| `uid-collision` | error | root-relative path, one per claimant | the uid |
| `id-collision` | error | root-relative path, one per claimant | the contested id |

`all()` returns accepted members in manifest (walk) order, read from disk as today.
Registry-backed `check()` iterates the same set. Both change from "walk the directory"
to "read the manifest", which is behavior-preserving under §7's single-writer rule and
removes the re-raise that a damaged file would otherwise cause mid-report.

## 7. Fixtures and verification

Add `fixtures/damaged-corpus/` and `fixtures/damaged.oracle.json`. The tree is
checkout-portable: every member path is ASCII and no two differ only in case.

| File | Content | Expected |
| --- | --- | --- |
| `topic/good.md` | valid; `related: [topic:garbled, topic:twin-a]` | member; `dangling-ref` ×2 |
| `topic/garbled.md` | unterminated YAML flow sequence | `parse-error` |
| `topic/typed.md` | `title: [1]` | `parse-error` (exercises the Python wrapping) |
| `topic/bytes.md` | valid frontmatter followed by a lone `0xFF` byte | `parse-error` (exercises fatal decoding) |
| `topic/moved.md` | valid; `id: topic:elsewhere` | `path-mismatch`, detail `topic/elsewhere.md` |
| `topic/twin-a.md`, `topic/twin-b.md` | valid; same uid | `uid-collision` ×2 |
| `topic/current.md` | valid | `id-collision`, detail `topic:current` |
| `topic/former.md` | valid; `deprecated_ids: [topic:current]` | `id-collision`, detail `topic:current` |

The oracle pins the collecting `check()` output over the whole tree with no registry,
the accepted member ids from `all()`, and strict's refusal: `ValidationError`, since
parse failures precede everything and `topic/bytes.md` is first in walk order among
them. Three logical single-fault subsets — misplaced only, twins only, former/current
only — are constructed in-test from the same documents and pin `PlacementError`,
`CollisionError`, `CollisionError` respectively.

Cross-language harnesses over the committed tree also pin: `flush_index` then
collecting reopen reproduces the oracle; strict reopen over that snapshot raises;
repairing `topic/moved.md` in place (rename the file) admits it on reopen; `add` of
`topic:garbled` and `rename` of `topic:good` → `topic:garbled` are refused with no
executor, embedder or cache effect (the recording executor and failing-`prepare` spy
from C's harness); `add` of a fresh id succeeds and `check()` still carries every
construction finding. A reconciliation case constructs the eviction: one-node snapshot,
then an external twin with the same uid, then reopen — both excluded, the kept entry
gone from every index.

Python frontmatter gains unit cases for each wrapped failure class; TypeScript gains the
fatal-decode case. The existing `check-corpus` oracle is unchanged; strict construction
over it must still succeed. No Python-only finding, error, or persisted field is added.

## 8. Normative and process closeout

B is tier 1 (construction modes, the parse floor, placement refusal, occupancy) plus
tier 2 (findings). Implementation, tests, fixtures and STANDARD amendments land in one
commit on `nodes-2.0`:

- §1 or §7: the two construction modes, strict as default, collecting as the documented
  posture for audit and import boundaries.
- §3: construction under collecting excludes every claimant of a uid or identity
  collision; the parse floor is `ValidationError` in both kernels, decoding included.
- §4.1: membership (the walk) versus **acceptance**; strict refuses a misplaced member
  (`PlacementError`); C's "not enforced by this clause" sentence is replaced.
- §6: `PlacementError` row; excluded-path occupancy under `CollisionError`.
- §7: `all()` and registry `check()` iterate accepted members; mutation on a
  collecting corpus; excluded paths as refused targets.
- §8.2: the four finding rows; path-anchored `ref`; exhaustive structural inventory
  updated; "MUST NOT raise on content" now holds from the parse floor up.
- §10: a snapshot records accepted members only; exclusion is never persisted.
- §11.2: `damaged-corpus/` and `damaged.oracle.json`.

Mark edited clauses `*(2.0)*`, retaining header 1.2 and the pending note for E. Amend
the umbrella's §B at closeout with the decided shapes and the `path-collision` fixture
deviation, and C's design §2 note that B "must enforce placement on both disk-admission
paths" to record that it does. `just gate`, `tasks check` and the marker inspection run
before the commit. E still owns the version bump and marker removal.
