# The nodes Standard

- **Spec version:** 2.0
- **Status:** Living standard — the authoritative definition of the portable `nodes` contract.
- **Implementations:** Python (`python/src/nodes/`), TypeScript (`ts/src/`).

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as
described in RFC 2119. Where a historical document in `docs/designs/` or `docs/plans/`
disagrees with this standard, this standard wins.

## 1. Scope & conformance

`nodes` is a problem-agnostic knowledge substrate: markdown files as canonical nodes,
typed relations, structural shapes, and rebuildable derived indexes. This document
defines everything a conforming implementation must agree on with the other language.

Guarantees fall into three conformance tiers:

- **Tier 1 — portable data contract.** The data model (§2), identity grammar and
  resolution (§3), on-disk format (§4), structural shapes (§5), validation model (§6),
  and corpus mutation semantics (§7). Implementations MUST agree exactly: a corpus
  written by one language MUST be readable and safely mutable by the other.
- **Tier 2 — pinned behavior.** Derived-index behavior and corpus checking (§8–§10):
  tokenizer, BM25F constants, ranking keys, similarity semantics, snapshot reconcile
  rules, and corpus-validity finding codes. Pinned by the conformance fixtures (§11).
  Parity is semantic — ranked ids, finding tuples, and 6-decimal score keys match; raw
  floats and serialized bytes need not.
- **Tier 3 — per-language surface.** Everything else (convenience APIs such as
  `idsByKind` / `allByKind`, corpus stat fingerprints). Out of scope for this standard;
  no parity obligation until the other language has a real consumer.

**Construction modes.** `Corpus` constructs in `strict` mode by default,
refusing the first damaged, misplaced or colliding file with the error §3–§4 name; in
`collecting` mode it excludes such files, constructs over the remainder, and reports
each exclusion through `check()` (§8.2). Collecting is the documented posture for audit
and import boundaries. Reads through the index never reach an excluded file.

Byte-identical serialization is an explicit non-goal (PyYAML and the JS `yaml` emitter
format differently). Cross-language equivalence is defined over the canonical JSON
projection pinned by the fixtures (§11).

## 2. Data model

### 2.1 Node

The universal container. Fields:

| Field | Contract |
|-------|----------|
| `id` | Canonical `kind:slug` identifier (§3). Required. |
| `uid` | Immutable, corpus-unique, non-empty opaque string; survives renames. Required. Nodes preserves supplied strings without shape constraints or normalization; minting policy belongs to a profile. Convenience constructors MAY retain their UUID-hex default. An empty uid MUST raise `ValidationError`. |
| `kind` | Type name, resolved against a registry (§6). MUST equal the `id`'s kind segment. |
| `title` | Human-readable display title. Required. |
| `body` | Markdown content. May be empty. |
| `metadata` | `created` / `updated` (ISO `YYYY-MM-DD` dates, optional) and `version` (integer, default 1). |
| `relations` | Typed relations in normalized form (§2.2). |
| `facets` | Map of facet name → mapping payload (§2.3). |
| `deprecated_ids` | Previous ids retained after rename (§3). |

`related` is serialization sugar (§4.3), not a model field.

### 2.2 Relation

The single edge primitive:

```
Relation = { source, predicate, target, directed?, weight?, attrs? }
```

`source` and `target` are refs (§3). `predicate` is a free string — never enforced by
the kernel. `directed` defaults to `true`. The shape above is the **normalized**
(in-memory / indexed) form, where `source` is always explicit; serialized forms are
defined in §4.3. Untyped links use the reserved predicate `relatesTo`.

### 2.3 Facets

A facet is a named, typed payload attached to a node under `facets`. Payloads MUST be
mappings. Which facets a node may or must carry is decided by its kind's registry spec
(§6); facet payload schemas are enforced by invariants (e.g. the shape form facets §5).
Typed facet accessors MUST surface a missing or malformed payload as `FacetError` — a
raw Pydantic/Zod error never escapes a public API. Whether unknown payload keys are
rejected is a property of each facet's schema: the built-in shape form facets (§5)
currently tolerate them. New facet schemas SHOULD reject unknown keys.

## 3. Identity, references & rename

- **Id grammar.** `id = kind ":" slug` with `kind` matching `^[a-z][a-z0-9-]*$` and
  `slug` matching `^[A-Za-z0-9][A-Za-z0-9:_.-]*$`. Malformed ids MUST raise `IdError`.
- **Refs.** Every stored reference (relations, membership, form facets) is a node id in
  this grammar. `uid` is the join key and identity anchor — never the stored ref form.
- **Resolution.** A ref resolves to a `uid` via the live-id map first, then the
  deprecated-id map. A live id always wins over another node's deprecated id.
  Resolution MUST be O(1) via the structural index.
- **Collisions.** The corpus MUST reject a node claiming a live id or another node's
  still-active deprecated id (`CollisionError`), and MUST reject a duplicate `uid`.
  These are **identity** checks and apply at construction and mutation alike.
  **Mapped-path admission** (§4.1) applies to mutation only: `add` and `rename` refuse a
  candidate whose collision key another live uid already claims (`CollisionError`),
  while construction — cold build and snapshot reconciliation — admits otherwise legal
  path-collided claimants and `check` reports them (`path-collision`, §8.2). A
  same-`(uid, id)` add replaces its own claim and always passes mapped-path admission;
  it remains subject to the identity checks above and to registry validation (§6).
  Under collecting construction a uid claimed by more than one well-placed file
  excludes every claimant, and an id — live or deprecated — claimed by more than one of
  the remaining files excludes every claimant; each stage groups the whole population
  before excluding.
- **Rename** is a library operation. Given `old_id` → `new_id`: `old_id` MUST be live
  (`RefError` otherwise); `new_id` MUST NOT resolve (`CollisionError` otherwise).
  Then, before referrer preparation, embedding or cache work, or executor
  invocation, `new_id`'s collision key MUST be available (`CollisionError` otherwise),
  except that the source uid's own **exact** mapped path is always available to it. A
  differently spelled destination with the same key — a case-only rename — is refused
  even on a case-sensitive volume; two renames through a free temporary id remain
  available. The
  operation updates `id`, sets `kind` from the new id, appends `old_id` to
  `deprecated_ids` (once), and rewrites every position holding `old_id` — in the renamed
  node and in every referrer the reverse index names (relation `source`/`target`,
  membership members, `edges`/`order`/`keys` form-facet refs). Cost MUST be O(degree).
  `uid` never changes; a stale ref still resolves through `deprecated_ids`.
- **Rename preparation and crash state.** All rewrites are prepared in memory; with a
  registry (§6) every node that will be written is validated before anything is written.
  Execution replaces the renamed document in place when the exact mapped paths match;
  otherwise it creates the new document and deletes the old document, then in either
  case replaces referrers in ascending uid Unicode code-point order. Under
  `DefaultExecutor`, a crash leaves an applied prefix. After create and before delete,
  two files carry the same uid; this prefix is invalid, is not forward-resolvable, and
  strict construction refuses it with `CollisionError`. After delete and before a
  referrer replacement, unchanged referrers still resolve through the renamed node's
  `deprecated_ids`. A durable executor applies the complete plan all-or-nothing.

## 4. On-disk format

### 4.1 Corpus layout & membership

- One file per node: `<root>/<kind>/<slug>.md`, with any `:` in the slug mapped to `__`.
- **Well-placed and collision key.** A member is *well-placed* when its literal
  root-relative path equals its live id's mapped path exactly. A live id's **collision
  key** is NFC followed by default case folding of its mapped path; two live claimants
  *collide* when their keys are equal (`kind:A` / `kind:a`; `kind:a:b` / `kind:a__b`).
  Deprecated ids and observed physical filenames are not inputs. Because the id grammar
  (§3) is ASCII, ASCII lowercasing of the mapped path is an equivalent implementation;
  widening the grammar MUST revisit that. Strict construction refuses a misplaced
  member (`PlacementError`); collecting construction excludes it (`path-mismatch`).
  Membership is what the walk yields; **acceptance** is what admission keeps.
- Files are canonical and git-versioned; everything else is rebuildable from them.
- Corpus membership (the files a corpus walk considers): regular `*.md` files
  under the root, recursively; walk order is sorted by root-relative POSIX path in
  Unicode code-point order (cf. §8.2, §9.1). The root-relative path is the literal
  filename with the platform separator mapped to `/`; no other character is rewritten.
  `.nodes-index/` is the **reserved namespace** — nodes' private cache directory, as the
  root's direct child only — and MUST be skipped; a nested `<kind>/.nodes-index/` is not
  reserved and is walked. The reserved list is exactly `[".nodes-index/"]`; changes to it
  follow §12's compatibility rules and are not automatically minor. Symlinks and
  non-regular files MUST be skipped at every depth, without being followed. A filesystem
  failure during the walk — a missing root, an unreadable directory — MUST propagate; it
  is never a finding and never absence.
- **Non-Markdown content.** Nodes never reads, writes, or deletes content under
  the root other than `*.md` files on its own initiative — every operation `Corpus`
  derives targets a node document — with one exception: its own reserved namespace.
  Consumers may place non-Markdown artifacts at any other path under the root with the
  guarantee that nodes leaves them untouched; a write plan a consumer authors is that
  consumer's instruction and may name its own artifacts (a manifest, a registry record)
  at any portable, non-reserved path. Nodes creates kind directories and its cache directories
  on write and never removes a directory. Hard links are a precondition, not a check: a
  deployment MUST NOT hard-link a managed file — a node document, a cache entry, or a
  cache temporary — to a protected artifact, since rewriting the managed file would
  rewrite the artifact through the shared inode.
- **Containment.** No path nodes yields, reads, writes, or deletes — node
  documents, snapshots, cache entries, and their temporary siblings alike — has a symlink
  component below the root. Walks inspect directory entries without following symlinks
  and skip links; direct I/O inspects every path prefix with `lstat` and refuses
  (`ContainmentError`) if any prefix is a symlink or cannot be inspected; an absent prefix
  is tolerated. The root itself MAY be a symlink. Checks hold for the filesystem as nodes
  observes it at the moment of the operation; substitution between inspection and
  effect, and retargeting of the root, are excluded by the single-writer rule (§7),
  which binds every actor that edits the tree, including actors outside nodes.
- **Portable root-relative path.** A write-plan operation path and a snapshot
  manifest row path MUST be non-empty, have no leading `/`, split on `/` only into
  segments that are non-empty and neither `.` nor `..`, and contain no `\` or `:` in
  any segment; a snapshot manifest row path MUST also end in `.md`, while a plan path
  carries no suffix rule. Reserved-namespace paths are refused separately. There is
  no normalization: a spelling that would normalize to a legal path is malformed. The
  rule binds what nodes *accepts as an instruction*, not what it observes: the walk
  reports any regular `*.md` file it finds by its literal name (a POSIX filename may
  contain `\`), and cache paths follow §10's own rule.

### 4.2 Frontmatter

YAML frontmatter followed by the markdown body (everything below the closing `---`,
preserved verbatim). Top-level fields:

- `id`, `uid`, `kind`, `title` — required; parsing MUST fail (`ValidationError`) when
  any is missing or when `kind` ≠ the id's kind segment.
- `created`, `updated` — optional ISO dates, top-level.
- `version` — optional integer; default 1; MUST be omitted when 1.
- `related` — optional list of target ids (sugar, §4.3).
- `relations` — optional list of typed relations in node-relation form (§4.3).
- `facets` — optional nested map keyed by facet name.
- `deprecated_ids` — optional list of previous ids.
- **Parse floor.** A document is decoded as UTF-8 fatally, BOM preserved, and
  begins with `---` at byte zero. The frontmatter is a mapping. `id`, `uid`, `kind`,
  `title` are strings. `related`, `relations`, `deprecated_ids` are absent or lists —
  `null` is malformed — of strings, mappings, strings respectively. `facets` is absent
  or a mapping of mappings. Every mapping key, at any depth, is a string; a cyclic
  alias is malformed. `null` for a named optional top-level field is malformed — only
  absence defaults; payload interiors (facets, relation `attrs`) are unconstrained.
  `version` is an integer; a relation's `directed` is a boolean, `weight` a number or
  `null`, `attrs` a mapping. `created` / `updated` are calendar dates, as the ISO
  string or the date scalar YAML yields for the unquoted spelling — the boundary's only
  conversion. Nothing is coerced. Every violation raises `ValidationError`, the only
  error the parse floor raises.

### 4.3 Serialized relation forms

- **Node-relation** (in `related` / `relations`): `{ predicate, target, … }` — `source`
  defaults to the containing node. Serializers MUST omit `source` when it equals the
  container; a relation sourced elsewhere carries an explicit `source`.
- **Graph edge** (in a structure's `edges` facet): `{ source, predicate, target, … }` —
  both endpoints explicit (the structure node is the container, not an endpoint).
- `related: [ref, …]` is sugar for `relatesTo` relations sourced at the node. On
  serialization, a plain `relatesTo` relation (directed, no weight, no attrs, sourced at
  the node) MUST emit into `related`; all other relations emit into `relations`.
- Parsers MUST fill an omitted `source` from the container into the normalized form.
  Serializers MUST omit optional relation fields at their defaults (`directed: true`,
  no `weight`, empty `attrs`). Round-trip MUST be lossless.

Example:

```yaml
---
id: gene:PHF19
uid: 7b2c9d1e4f5a48b3a6c7d8e9f0a1b2c3
kind: gene
title: PHF19
created: 2026-06-21
related: [pathway:PRC2, topic:polycomb]
relations:
  - { predicate: interacts_with, target: gene:EZH2 }
facets:
  bio-axes: { primary_external_id: HGNC:7296 }
---
PHF19 is a PRC2-associated component …
```

## 5. Structural shapes

A **structure** is a node of a kind that adopts a registered *shape*. Shapes compose
required facets + invariants into the kind (§6). The built-in shapes and their
convenience kinds (a kind named after each shape) are registered by
`register_builtin_shapes` / `registerBuiltinShapes`:

| Shape | Required facets | Invariants |
|-------|-----------------|------------|
| `set` | `membership` | unique members |
| `list` | `membership`, `order` | unique members; `order` is a permutation of members |
| `dict` | `membership`, `keys` | unique members; every key value is a member |
| `graph` | `membership`, `edges` | unique members; every edge endpoint is a member |
| `dag` | `membership`, `edges` | graph invariants + acyclic |
| `tree` | `membership`, `edges` | dag invariants + single parent |

Facet payloads: `membership = {members: [ref]}` (scope-only — a unique, unordered set);
`edges = {edges: [Relation]}` (graph-edge form, §4.3); `order = {order: [ref]}`;
`keys = {keys: {key: ref}}`. Order/edges/keys never leak through member position. A kind
adopts at most one shape. Membership and form-facet refs participate in rename rewriting
and dangling tracking but are not relation-graph edges.

## 6. Registry & validation

- A **kind** is a name + a set of required/optional facets + invariants
  (`KindSpec`), optionally adopting one shape (`ShapeSpec`) whose facets and invariants
  compose into it. Registration MUST reject duplicate names and unknown shapes.
- `validate(node)` MUST: resolve the kind (`UnknownKindError` if unregistered); fail on
  missing required facets and on unexpected facets (`FacetError`); then run invariants
  (shape invariants before kind invariants, in registration order).
- **Error taxonomy.** Conforming implementations map these conditions to these error
  names (each language's error classes):

| Condition | Error |
|-----------|-------|
| Malformed canonical id | `IdError` |
| Unresolvable input ref; delete/rename of a non-live id | `RefError` |
| Live-id / deprecated-id / uid collision; mapped-path admission collision; excluded-path occupancy and reserved-claim refusal (collecting mutation) | `CollisionError` |
| Member's literal path differs from its id's mapped path (strict construction) | `PlacementError` |
| Unregistered kind | `UnknownKindError` |
| Missing, unexpected, or malformed facet payload | `FacetError` |
| Shape or registry invariant violation | `InvariantError` |
| Symlink component below the root, or a direct-I/O path that cannot be inspected | `ContainmentError` |
| Structural node/frontmatter failure (missing required field, id/kind mismatch) | `ValidationError` |
| Similarity API on a corpus without an embedder | `EmbedderRequiredError` |

- **Write-boundary enforcement.** A corpus MAY be constructed with a registry. When
  present, `add` MUST validate before any disk write, and `rename` MUST validate the
  renamed node and every rewritten referrer before any disk write. Without a registry,
  no registry validation occurs (a deliberate composition default, not a fallback).
- **Structured checking.** The registry MUST also provide a collecting counterpart to
  `validate` (`Registry.check`, §8) that reports all violations of a node with
  machine-stable codes, without raising on content.

## 7. Corpus semantics

`Corpus` is the primary API — a coordinator over the file store and the derived indexes.

- `add(node)`: registry validation (when configured) → collision check → similarity
  vector preparation (when configured) → file write → index upserts. Any failure MUST
  precede the disk write. The collision check is identity claims then
  mapped-path admission (§3), both before vector preparation or any effect; a
  same-`(uid, id)` replacement still passes mapped-path admission when the corpus
  already carries a `path-collision` warning. On a collecting corpus, `add` also
  refuses (`CollisionError`) a mapped path an excluded file occupies, a uid reserved by
  a file excluded at either identity stage, and an id — live or deprecated — reserved
  by a file excluded at the id stage; uid and id reservations are separate namespaces.
  `DefaultExecutor` preflights every operation's
  containment (§4.1) over the whole plan before any effect, refusing with
  `ExecutionError` whose `index` is the offending operation and `applied = 0`; a durable
  executor keeps its own pre-effect refusal contract (`ExecutionError(index=None,
  applied=0)` for a topology or resolution refusal, per the seam design §3). Any
  executor refuses a plan naming a non-portable path as malformed
  (`PlanRefusedError`).
- `get(ref)` / `resolve(ref)`: resolve via the index (live then deprecated), read the
  file; `RefError` when the ref does not resolve.
- `delete(id)`: **live-id-only** — a stale/deprecated id MUST raise `RefError` so a
  stale alias never deletes the renamed live node. Inbound refs to a deleted node remain
  on disk and become dangling.
- `rename(old, new)`: as specified in §3. On a collecting corpus the same
  refusals as `add` apply to the new id and, when it differs from the old, the new
  mapped path.
- `all()` returns accepted members ordered by manifest path in Unicode
  code-point order; registry-backed `check()` iterates the same sequence. Neither walks
  the directory.
- Relation queries (`outbound`, `inbound`, `neighbors`) are relations-only and
  uid-based. A **dangling** target (a relation whose target no longer resolves) is a
  normal state — surfaced in the edge (`target_uid` null) and reported by `check`
  (`dangling-ref`, §8.2), never raised. `inbound`/`outbound` raise `RefError` only when
  the *input* ref does not resolve. `neighbors` returns nodes ordered by their distinct
  resolved uids in ascending Unicode code-point order.
- Membership queries (`members`, `containers`) expose the containment graph over
  `membership.members` refs, one hop each. Each method MUST resolve its input ref (live
  then deprecated; `RefError` when it resolves to no live node — the only raising path)
  and return a sorted (Unicode code point), uid-deduplicated list of **live ids**. They
  read the literal facet content, resolved, so a container listing itself appears in its
  own `members` and its own `containers`. Member refs listed under deprecated ids resolve
  normally; dangling member refs are silently skipped (`check` reports them, §8.2).
  Traversal MUST be cycle-safe for every shape: `dag` / `tree` acyclicity constrains only
  a container's internal `edges` facet, so cross-node membership containment cycles are
  legal. A node without a membership facet has no members; a node no container lists
  has no containers — both are empty results, never errors.
- These five methods — `outbound`, `inbound`, `neighbors`, `members`,
  `containers` — are the complete one-hop graph-query surface. Transitive walks
  (formerly `descendants` / `ancestors`) and the corpus-local dangling-edge list
  (formerly `dangling()`) are withdrawn: a corpus-local closure truncates at the corpus
  edge, and the layer that joins corpora owns traversal across it.
- **Single-writer obligation.** The kernel performs no coordination. Each executor
  declares whether it serializes corpus mutation or passes the single-writer obligation
  through to the deployment. `DefaultExecutor` provides no serialization, so
  deployments using it MUST ensure a single writer at a time. A durable executor owns
  serialization. Readers may run concurrently at the cost of possibly-stale derived
  indexes.

## 8. Corpus validity & checking

A corpus is **valid** with respect to a registry when every node passes that registry's
validation. Because files are canonical and hand-editable, nodes can bypass the write
boundary; conforming implementations MUST therefore provide a *reporting* check.

### 8.1 `Registry.check(node)`

Returns a list of violations; MUST NOT raise on content. Each violation carries
`{code, detail, message}`:

- Unregistered kind → a single `unknown-kind` violation (`detail` = the kind); nothing
  else is checked for that node.
- Otherwise, facet presence is computed directly (same composition as `validate`): each
  missing required facet → `facet-missing`; each unexpected facet → `facet-unexpected`
  (`detail` = the facet name, sorted within each code by Unicode code point).
- Invariants run only when the facet-presence checks pass (they presuppose their
  facets). An invariant raising `FacetError` → `facet-invalid`; `InvariantError` →
  `invariant-violated` (`detail` = `""` — invariants are opaque callables and cannot be
  attributed to a facet). **Only these kernel content errors are converted**; any other
  exception from an invariant is a programmer bug and MUST propagate.

### 8.2 `Corpus.check(registry?)`

Returns a list of findings; MUST NOT raise on content. This holds from the
parse floor up: under collecting construction, content that cannot be parsed is a
finding, never an exception. `ref` is a node id or a literal root-relative path; the
finding code alone says which. Uses the passed registry, else
the corpus's own; there is deliberately no way to ignore a corpus's registry
(`dangling-ref` and `dangling-member` are registry-independent codes — filter by code instead).

Finding fields: `{severity, code, ref, detail, message}` where `ref` is the id of the
node the finding anchors to.

| Code | Severity | `detail` | Condition |
|------|----------|----------|-----------|
| `unknown-kind` | error | kind name | node's kind not registered |
| `facet-missing` | error | facet name | required facet absent |
| `facet-unexpected` | error | facet name | facet present but not allowed |
| `facet-invalid` | error | `""` | invariant raised `FacetError` (malformed payload) |
| `invariant-violated` | error | `""` | invariant raised `InvariantError` |
| `dangling-ref` | warning | target ref | top-level relation target resolves to no live node (`ref` = the relation's source node) |
| `dangling-member` | warning | member ref | a `membership.members` entry resolves to no live node (`ref` = the container node) |
| `path-collision` | warning | collision key | one per live claimant in a key bucket holding more than one uid (`ref` = the live id) |
| `parse-error` | error | `""` | a walked document the parse floor refuses (`ref` = path; collecting only) |
| `path-mismatch` | error | mapped path | a well-formed document at a path other than its id's (`ref` = path; collecting only) |
| `uid-collision` | error | the uid | one per claimant of a uid claimed by more than one accepted-so-far document (`ref` = path; collecting only) |
| `id-collision` | error | the contested id | one per `(claimant, contested id)` among the remaining documents (`ref` = path; collecting only) |

- With a registry: every node runs through `Registry.check`; each violation becomes an
  `error` finding.
- Always (registry or not), the exhaustive list of structural findings: every
  construction finding of the handle (collecting mode), then one `dangling-ref` per unresolved top-level relation target — every outbound edge whose
  `target_uid` is null, over the whole corpus — and one `dangling-member` per unresolved
  `(container, member ref)` pair, deduplicated (a duplicated dangling entry reports
  once), and one `path-collision` per live claimant of a collision key (§4.1) claimed
  by more than one uid — three claimants produce three findings, never pairs. A member
  listed under a deprecated-but-resolvable id is not dangling. A path collision is a
  latent portability hazard, not an unreadable corpus, hence `warning`.
  Malformed structural facet payloads remain a registry concern (shape invariants).
- Ordering MUST be `(ref, code, detail)` ascending, comparing strings by Unicode
  code-point order (not UTF-16 code-unit order, cf. §9.1) — all normative,
  oracle-pinned fields. `message` is human-readable, non-normative, and never used for
  ordering or parity.

## 9. Derived indexes: search & similarity

Derived indexes are disposable caches, always rebuildable from files.

### 9.1 Full-text search (BM25F)

- **Tokenizer:** NFC-normalize → lowercase → split into Unicode-alphanumeric runs →
  drop a fixed 33-word stop list; no stemming. Pinned by `fixtures/search.tokenizer.json`.
- **Scoring:** BM25F over two fields (`title`, `body`) with the standard `(K1 + 1)`
  numerator and a non-negative Lucene IDF. Constants: `K1 = 1.5`, `B = 0.75`,
  `TITLE_BOOST = 2.0`, `BODY_BOOST = 1.0`.
- **Results:** hits carry `id`, `uid`, `score`, matched terms; ordered by descending
  6-decimal half-up score key (§9.3), then ascending `id`. Query-term iteration MUST use
  Unicode code-point order (not UTF-16 code-unit order).
- The index MUST stay current through `add` / `delete` / `rename`.

### 9.2 Similarity (embeddings)

- **Opt-in seam:** the kernel ships no model. An `Embedder` (`cache_namespace`,
  `embed(texts) -> vectors`) is injected at corpus construction; without one the
  similarity APIs MUST raise `EmbedderRequiredError`.
- **Text contract:** one vector per node over `embed_text(node) = title + "\n\n" + body`.
- **Vectors:** L2-normalized in memory (cosine = dot product); exact brute-force — no
  ANN. Raw embedder output is cached content-addressed at
  `<root>/.nodes-index/vectors/<namespace>/<sha256>.json` (git-ignored, atomic writes).
- **Determinism & failure:** one namespace and one dimension per index; namespace/dim
  mismatches, zero-norm, boolean/non-numeric, and non-finite vectors MUST fail early —
  on `add`, before any disk write.
- **Results:** hits carry `id`, `uid`, `score`; ordered like search results.
  `similar(ref)` excludes the node itself.

### 9.3 Ranking key

The cross-language ranking contract is the 6-decimal, round-half-up score key
(`score_key` / `scoreKey`). Oracle scores are compared numerically, never as strings.

## 10. Index persistence

- The derived indexes persist to a **private, disposable, per-language** snapshot:
  `<root>/.nodes-index/snapshot.py.json` (Python) / `snapshot.ts.json` (TypeScript).
  A language MUST NOT read the other's snapshot.
- Snapshot and vector-cache paths are portable root-relative paths in §4.1's
  sense with `.json` in place of `.md`, strictly beneath `.nodes-index/` (first segment
  `.nodes-index` and at least one more), and are subject to the same containment rule
  as node documents (§4.1): a read inspects the final path; a write inspects the final
  path and its `.tmp` sibling before any directory creation, write, or rename. A
  containment refusal propagates from construction and from `flush_index` — it is never
  a rebuild trigger.
- **Writing is explicit** (`flush_index` / `flushIndex`); construction never writes.
- **Loading reconciles by content hash:** construction hashes current file bytes
  (sha256) against the snapshot manifest — unchanged files skip parsing; changed/added
  files re-parse and re-index; deleted files drop. Reconcile enforces the same collision
  contract as a from-scratch build.
- **Fail-closed:** an absent, corrupt, wrong-version/lang, namespace-mismatched, or
  internally inconsistent snapshot MUST be discarded silently and trigger a full
  rebuild. Files remain the single source of truth; deleting a snapshot only costs
  startup speed.
- A snapshot records accepted members only; exclusion is never persisted and
  re-derives on open. A snapshot at an earlier schema version is discarded and the
  corpus rebuilds cold; schema versions are per language and were changed by the 2.0
  parse floor.

## 11. Conformance fixtures

The shared oracles under `fixtures/` are the conformance suite. Both languages MUST
assert against them.

### 11.1 Canonical JSON projection

Cross-language node equality is defined over the public `projection.v1` projection
(`to_canonical` / `toCanonical`). The parsed accessor is convenience only; its normative
serialized form is the RFC 8785 UTF-8 JSON text returned by `to_canonical_json` /
`toCanonicalJson`:

```json
{
  "id": "...", "uid": "...", "kind": "...", "title": "...", "body": "...",
  "metadata": { "created": "YYYY-MM-DD or null", "updated": "YYYY-MM-DD or null", "version": 1 },
  "relations": [ { "source": "...", "predicate": "...", "target": "...",
                   "directed": true, "weight": null, "attrs": {} } ],
  "facets": { },
  "deprecated_ids": [ ]
}
```

Relations are normalized (`source` explicit, every field present) in source order;
dates render as `YYYY-MM-DD` strings or `null`; field names use the on-disk forms
(`deprecated_ids`). Arrays, including relations, preserve source order. Object keys use
RFC 8785 UTF-16 ordering. Non-finite numbers and values outside JSON MUST be refused.
Any change to this projection's value or canonical text requires a major
projection-version bump.

**Identity boundary.** Node content identity (a digest of this canonical text) and the
exact corpus-state identity (a digest over `corpus_id` plus the sorted
`(uid, content identity)` pairs) are distinct, science-owned primitives: nodes owns the
projection, not identity or digest policy. Neither the tier-3 `(path, mtime, size)`
fingerprint nor the path-keyed snapshot manifest (§10) may be extended toward them.

### 11.2 Fixture inventory

| Fixture | Pins |
|---------|------|
| `projection.v1.canonical.json` | byte/text oracle for `projection.v1` RFC 8785 canonical JSON |
| `gene_phf19.md`, `gene_phf19.canonical.json` | frontmatter parse → canonical JSON projection |
| `gene-axis.md`, `gene-axis.canonical.json` | namespaced facet name `biology/gene-axis` projected identically through both `projection.v1` projections: one facet name distinct from `biology`, the slash no path separator; the oracle is RFC 8785 text, read as text and as value |
| `gene_phf19.py-emit.md`, `gene_phf19.ts-emit.md` | cross-emitted samples: each language re-emits (regenerate-and-diff) and parses the other's |
| `corpus/`, `corpus.rename.canonical.json`, `write-plan.rename.canonical.json` | rename semantics across referrers (whole-corpus post-rename oracle) and the captured rename plan, semantically compared, with referrer replaces in uid code-point order (BMP versus non-BMP referrers) |
| `path-collision.oracle.json` | mapped-path collision admission and reporting: key groups, refused and admitted mutations, `check` findings; logical descriptions only — the well-placed case pair is constructed in-test |
| `uid.oracle.json` | non-empty opaque uid acceptance (round-trip) and empty-uid rejection |
| `damaged-corpus/`, `damaged.oracle.json` | collecting-mode findings, accepted members and strict's refusal over one committed damaged tree (parse, placement, uid and id collisions, and a dangling ref into an excluded member), plus single-fault subsets pinning each strict error |
| `frontmatter.malformed.json` | the parse floor: texts both kernels refuse and texts both accept |
| `search.tokenizer.json` | tokenizer freeze |
| `search-corpus/`, `search.oracle.json` | BM25F ranked ids + 6-dp scores |
| `similarity-corpus/`, `similarity.vectors.json`, `similarity.oracle.json` | similarity ranking over frozen vectors (model embeddings are not portable) |
| `check-corpus/`, `check.oracle.json` | corpus-validity findings (severity, code, ref, detail); includes a membership cluster (nesting, a cycle, self-membership, one dangling member) |
| `traversal.oracle.json` | membership queries (`members` / `containers`) over `check-corpus/`, including the two-node cycle and self-membership |
| `containment.oracle.json` | reserved namespace, non-Markdown preservation, symlink containment across the walk, executor, store, and caches, and the portable-path rule; describes filesystems for each language's harness to materialize |

## 12. Versioning & change policy

- This standard carries a spec version (header). **Minor** bumps are
  backward-compatible: additive changes (new optional fields, new finding codes, new
  fixtures), or removals and relaxations that break neither reading/writing existing
  corpora nor pinned tier-2 behavior. **Major** bumps break reading or writing
  existing corpora, or change pinned tier-2 behavior.
- Any tier-1/tier-2 change MUST update this document and the affected fixtures in the
  same change. Tier-3 additions do not touch this document.
- Projection versions are stable: changing a projection's value or canonical text is a
  major bump of that projection version.
- History: **1.0** (2026-07-10) — initial consolidation; adds §8 corpus validity.
  **1.1** (2026-07-11) — membership traversal (§7); `dangling-member` finding (§8.2).
  **1.2** (2026-07-12) — knowledge vocab retired from the shipped surface
  (base-vocabulary boundary design); §2.3 source-facet rule removed; minor bumps
  redefined to cover backward-compatible removals.
  **2.0** (2026-09-12) — major because the pinned transitive traversal surface
  (`descendants`, `ancestors`, `dangling()`) is withdrawn and its `traversal.oracle.json`
  rows deleted, leaving the five one-hop methods (§7). Landed with it: construction
  modes and the parse floor (§1, §4.2, `frontmatter.malformed.json`); the reserved
  namespace, non-Markdown preservation, containment, and portable-path rules (§4.1,
  §10, `containment.oracle.json`); well-placedness, the collision key, mapped-path
  admission, and the `path-collision` finding (§3, §4.1, §8.2,
  `path-collision.oracle.json`); `PlacementError` and the collecting-mode findings
  (§6, §8.2, `damaged.oracle.json`); non-empty opaque uids (§2.1, `uid.oracle.json`);
  code-point collation of query results and referrer replaces (§3, §7,
  `write-plan.rename.canonical.json`); the executor's attribution of the single-writer
  obligation and rename's crash state (§3, §7, from the write-plan/executor seam design
  §7); per-language snapshot schema versions bumped (§10); the identity boundary
  (§11.1); the `biology/gene-axis` facet-name fixture (§11.2). *Corrected the same
  day, before any consumer read it:* the plan-path suffix rule was withdrawn when
  Beliefs' landed executor — which takes `validate_plan` as its one lexical authority —
  was shown to write its manifests, registry and epoch records through the seam; §4.1's
  non-Markdown guarantee is stated over nodes' own derived effects.

## 13. Known limitations

- No coordination (§7): `DefaultExecutor` serializes nothing, so a deployment using it
  supplies the single writer; a durable executor owns serialization.
- Graph queries are one-hop and corpus-local (§7); joining corpora, and any traversal
  across them, belongs to the consuming layer.
- Collecting construction excludes and reports (§1, §8.2); it never repairs.
- In-memory indexes and brute-force cosine target personal-corpus scale (order of
  10⁴–10⁵ nodes), not bulk graph workloads.
