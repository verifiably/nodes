# Nodes under the system redesign — design

**Date:** 2026-08-03
**Status:** Draft — direction approved 2026-08-03; §4 frozen into the seam design 2026-08-17; detailed review of §2/§3/§5 pending
**Authority:** `docs/STANDARD.md` 1.2 remains normative until the amendments below land.
**Consumer requirements:** science's four system-redesign designs of 2026-08-02 (epistemic
kernel, substrate consolidation, world addressing, computation & reproducibility).

> **Consumer state, 2026-08-08.** Those four designs are banked on science's `main`, and the
> corpus around them has grown to sixteen. None of the later designs changes a delta below —
> the domain-extension boundary of 2026-08-04 makes a point of costing **zero `nodes` delta**
> — but two of them touch this document and are noted at their sites: the tamper-evident log
> is a second consumer of §2.2, and the domain boundary asks for one parity fixture whose
> owning repository is not yet settled (§5).

## 1. Why

Science's system redesign makes nodes the substrate of "Science as a `nodes` profile over
`atoms`": thousands of lines of science surface become nodes calls, corpora join one
addressable world, and the redesign's identities are computed from nodes' canonical
projection. Meanwhile the measured caller population today is mindful v6 (TypeScript)
alone — science imports nothing yet — and several nodes surfaces have never had a caller
in either language.

This design does four things: adds the contracts the redesign needs and nodes lacks (§2);
withdraws surface with no callers, under the standard's own tier-3 rule and the
base-vocabulary admission criteria (§3); names the execution seam that reconciles
Python-only `atoms` with nodes' language parity, without building it (§4); and lists the
mechanical housekeeping (§5).

## 2. New contracts

### 2.1 Ship the canonical projection as public, versioned API

STANDARD §11.1's canonical JSON projection is implemented only by test helpers
(`python/tests/_canonical.py` and its TS twin). The redesign digests it: node content
identity is a science-layer digest of "nodes' normative canonical JSON projection of the
whole node", and the exact corpus-state identity digests the sorted
`(uid, content identity)` pairs. An unimportable, unversioned helper cannot carry that.

- `to_canonical` / `toCanonical` move into the public API of both languages.
- The projection gets its own version (`projection.v1`), independent of the spec version;
  §12 gains a stability clause: any change to the projection is a major bump.
- Profiles derive their own bases (semantic identity, per-kind address bases) as subsets
  of the projection's fields; nodes guarantees the projection, not the subsets.
- The existing parity fixtures continue to pin it — they become tests of shipped API
  instead of a private helper.

### 2.2 Reserved-path contract

Corpus membership is stated positively (every `*.md` under the root, minus
`.nodes-index/`, skipping symlinks), but nothing states what nodes will never touch.
Science pins a corpus manifest at a fixed non-`.md` path in the corpus root; today it
survives by accident of the glob.

- Contract: nodes never reads, writes, or deletes non-`*.md` content anywhere under the
  root; the reserved namespace list (today exactly `.nodes-index/`) is closed and
  versioned in the standard. Consumers may place non-node artifacts at their own root
  paths with a contractual guarantee they are untouched.
- Traversal escape: no walk follows a symlink — file or directory, at any depth (today
  only the first path component is checked against `.nodes-index/`); every yielded path
  resolves within the root.

*(2026-08-08:)* science has a second consumer — its tamper-evident log design of 2026-08-03
puts each engine root's hash chain at a reserved in-corpus path, after `corpus.yaml`. The
contract above already covers it, because the guarantee is stated over all non-`*.md`
content rather than over an enumerated list of consumer paths. Recorded because it is the
first evidence that this clause is load-bearing for more than the manifest.

### 2.3 Recoverable construction

Corpus construction fails hard on the first unparseable file, so one stray or
half-written `.md` makes the whole corpus unconstructible and `check` unrunnable. Under
the redesign, raw writes past every boundary are a designed-for population and audits are
the detection mechanism — the audit must be able to run over a damaged corpus.

- Add a collecting construction mode: an unparseable or structurally invalid file becomes
  a `parse-error` finding (severity error) plus an excluded member; the corpus constructs
  over the remainder and `check` reports the finding.
- Strict construction remains the default; the collecting mode is the documented posture
  for audit and import boundaries. This completes the standard's own report-don't-raise
  argument, which currently stops at the parse floor.

### 2.4 Digest-shaped ids

World addresses are `kind:<basis-digest>` — 64-hex slugs, thousands of them in one flat
per-kind directory. The id grammar already admits them; three hazards remain:

- **Case-fold collisions.** Slugs admit `[A-Za-z]`; `path_for` maps exact-case with no
  existence check; on a case-insensitive volume two case-variant ids silently share one
  file, and the divergence is invisible to `check`, which never compares the index
  against `path_for`. Rule: `assert_addable` refuses an id whose mapped path equals an
  existing member's path under NFC + casefold, and `check` gains a `path-collision`
  finding for corpora that already contain one.
- **Collation.** §4.1's walk order ("sorted by root-relative POSIX path") names no
  collation; Python sorts code points, TS sorts UTF-16 code units, and they agree only
  because the id grammar is ASCII today. Pin code-point order, matching §8.2 and §9.1.
- **uid opacity.** "New nodes SHOULD mint 32-char lowercase hex (UUIDv4)" reads as a
  constraint; state that uid is opaque and any minting rule is a profile decision.

## 3. Withdrawals

The tests are the standard's own tier-3 rule ("no parity obligation until the other
language has a real consumer") and the base-vocabulary admission criteria (two
independent consumers with matching semantics, or a pinned interchange requirement).
Measured against them:

- **The similarity facet** — `Embedder`, `VectorCache`, `VectorIndex`,
  `similar`/`similar_text`/`query_vector`, `EmbedderRequiredError`, the vector snapshot
  sections, and their fixtures: roughly 2,800 lines of source and tests across both
  languages, tier-2 normative. Zero production callers ever, in either language; the one
  consumer (mindful) shipped its own semantic stack instead; no redesign document
  mentions embeddings. Withdraw whole: delete code and fixtures in both languages, remove
  the standard's similarity section, and simplify the prepare/commit ordering it forced
  into `Corpus.add`/`rename`. Re-admission goes through the admission criteria like any
  other candidate.
- **`Corpus.dangling()`** — zero callers (mindful hand-rolls the same check inline), and
  the world design rules the corpus-local answer wrong by construction in a multi-corpus
  world. Withdraw the API; the `dangling-ref`/`dangling-member` findings stay — they are
  reports, and the world layer reinterprets them.
- **`descendants` / `ancestors`** — zero callers in the only consumer; the world layer's
  traversal supersedes the corpus-local walk, which truncates at the corpus edge.
  Withdraw, with their oracle rows. `members`/`containers`/`outbound`/`inbound`/
  `neighbors` stay and are declared the complete one-hop graph surface —
  `outbound`/`inbound` are exactly what the world layer consumes.
- **`rename`, re-specified rather than withdrawn.** It keeps a prospective caller — the
  redesign's address correction, and merge's inbound rewrite is "nodes' rename mechanics
  applied across corpora" — but its atomicity language overclaims: the referrer rewrite
  is a multi-file mutation with no journal, and even the single-file write is a bare
  `write_text`. Until §4's seam lands, the standard states ordering only (renamed node
  first, then referrers; a crash leaves a forward-resolvable state, not an atomic one),
  and the `(crash-atomic)` code comment is corrected to match.

## 4. The execution seam (direction, not built now)

The substrate ruling stands: durability and concurrency are `atoms`', and no interim
transaction layer is built here. What nodes can do now is name the seam so the write path
stops growing away from it:

- Mutators (`add`, `rename`, `delete`) compute a **write plan** — an ordered, pure value
  of file creates/replaces/deletes with expected preconditions — and hand it to an
  executor. The default executor is today's behavior (best-effort ordered writes), now
  named as such. A composition root may substitute a durable executor (`atoms`, via
  science's Python composition root) without nodes depending on `atoms` in either
  language.
- This dissolves the parity conflict: both kernels emit the same portable plan; only the
  executor is deployment-specific. It also re-attributes the single-writer MUST: nodes
  performs no coordination; the executor owns serialization and durability.
- Not scheduled until science's composition root needs it (`atoms` A7–A8 — this gate was
  written as A6–A8 and lost its first stage when `atoms` landed coherent capture on
  2026-08-08); recorded so intermediate work does not entangle the write path further.

*(2026-08-17:)* superseded — the seam contract is frozen in
`2026-08-17-nodes-write-plan-executor-seam-design.md`, which now owns it; the direction
text above and its spent A7–A8 gate line no longer speak for the seam.

## 5. Housekeeping

Mechanical; lands with this design's plan:

- **Status refresh.** The fulltext ("pending implementation plan"), similarity ("pending
  spec review" — moot if §3 lands), and ts-corpus-fingerprints ("draft") designs all
  describe shipped, published code; the substrate and ts-kernel designs carry superseded
  sections (layering, the fat `Store`, the science migration path) with no banner.
- **Path corrections.** `src/nodes/kernel/…` → `python/src/nodes/core/…` in four designs;
  `@nodes/kernel` → `@nodes-dev/core` in the fingerprints design.
- **README.** Science is listed as a consumer that "builds on the Python kernel" — false
  today; restate as the intended consumer via the redesign. The mindful path is
  `~/d/mindful/v6/`.
- **Identity boundary.** One sentence in the standard: the exact corpus-state identity is
  a distinct, science-owned primitive (digest over `corpus_id` plus sorted
  `(uid, content identity)` pairs); neither the `(path, mtime, size)` fingerprint nor the
  path-keyed snapshot manifest may be extended toward it.
- **Release follow-ups.** First-publish-recovery §4's post-tag steps (npm 0.0.0
  deprecation, attestation verification, credential revocation) get a status note
  recording whether they happened.
- **Undecided, added 2026-08-08.** Science's domain-extension-boundary design (D4) requires
  one parity fixture pinning a *namespaced* facet key — `biology/gene-axis` — identically
  through both canonical projections, so that the facet-key freedom stays deliberate rather
  than incidental. Whether it lands here or in science is open: it tests `nodes`' projection,
  which argues for here, but §2.1 makes that projection public API, which lets science pin it
  from outside. Not a fifth contract delta either way — nothing about `nodes` changes.

## 6. Standard changes summary

STANDARD 1.2 → 1.3 in one amendment commit, per the standard's own policy: the §2
additions (projection API and version, reserved paths, collecting construction,
`path-collision` finding, collation pin, uid opacity note) are additive or clarifying;
the §3 removals (similarity, `dangling()`, `descendants`/`ancestors` and their oracle
rows) are minor under §12's removal clause; the single-writer re-attribution is editorial
until §4 lands.
