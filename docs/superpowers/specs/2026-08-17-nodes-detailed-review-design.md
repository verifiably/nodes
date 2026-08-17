# The `nodes` detailed review, seam-first — scope design

**Date:** 2026-08-17
**Status:** Approved scope for the review workstream; the review itself produces the artifacts below.
**Subject:** `docs/designs/2026-08-03-nodes-under-the-system-redesign-design.md` (status: "Draft — direction approved 2026-08-03; detailed review pending") and its §4 execution seam.
**Branch:** `docs/nodes-detailed-review` (worktree `.worktrees/nodes-detailed-review`).
**Consumer:** science's composition-root adapter design, which waits on the §4 seam being frozen; science's conformance cut 4 (2026-08-17) freezes when that adapter design banks.

## 1. Why now, and why seam-first

The redesign design's §4 names the write-plan/executor seam as direction only and
gates its elaboration on "science's composition root needs it (`atoms` A7–A8)."
That gate is satisfied: A8 landed 2026-08-17 with physical certification, and
science's cut 4 — drawn against the certified engine adopted at the composition
root — is already drafted, its freeze waiting on the adapter design, which waits
on this seam. The seam is therefore the head of the critical path and freezes
first; the rest of the detailed review trails behind it without blocking anything.

## 2. Deliverables and landing order

Two artifacts, two merges, both in this repository. Each merge is followed by a
small documentation commit on science `main` recording the new fact — science is
a consumer of this review's output, and its adoption ledger row 3 is the record
that goes stale at each landing.

### 2.1 First landing: the seam design

A new dated document, `docs/designs/YYYY-MM-DD-nodes-write-plan-executor-seam-design.md`
(dated the day it is written), containing the full write-plan/executor contract
per §3 below. It carries an explicit stability clause with a stated authority
relationship to the standard:

- **Frozen on banking, pre-normative.** This repository's authority order makes
  `docs/designs/` rationale-only and the standard the sole normative contract,
  and requires tier-1/tier-2 changes to update the standard and fixtures in the
  same change — which happens at implementation, not here. The seam design is
  therefore frozen as a **contract about the future amendment**: its text lands
  in the standard amendment that ships the seam (1.3 or 2.0, per the trailing
  review's version verdict), unchanged except through the amendment procedure
  below. Until then it binds design consumers (science's adapter design builds
  against it) and changes nothing about shipped code; the standard keeps
  describing the code that exists.
- **Touchpoints with existing normative text are recorded, not applied.** The
  seam re-attributes the single-writer MUST (standard §13) and re-states
  `rename`'s crash language (§7). The seam design fixes the amendment wording
  for both now and marks them pending; the standard is not contradicted in the
  interim because the seam's surface does not exist in shipped code.
- **Graduated amendment procedure.** Any change to a part of the contract that
  a landed consumer exercises requires that consumer's sign-off, recorded in
  the document. Parts no consumer exercises yet (science's cut-4 slice is
  add-only, so replace/delete, rename recovery, and snapshot routing start
  unexercised) may be amended by `nodes`-side review alone until their first
  consumer lands — the full shape is frozen as intent, but unexercised
  decisions do not accrete cross-repo veto before anything depends on them.

This mirrors science's freeze discipline; it is the first `nodes` design to
carry such a clause because it is the first whose direct consumer is a design
in another repository.

The seam design merges to `main` **alone and first**. Immediately after, one
commit on science `main`:

- adoption ledger (`docs/designs/2026-08-03-redesign-adoption-ledger.md`) row 3
  gains the seam-frozen fact and the seam design's path;
- the open-questions guide's cut-4 bullet is updated where it names the seam
  freeze as pending.

### 2.2 Second landing: the reviewed redesign design

The 2026-08-03 design amended **in place**, in its own established style (dated
parenthetical annotations at the affected site — the document already carries
2026-08-08 notes):

- every §2, §3, and §5 delta gets its review verdict at its site (protocol in
  §4 below);
- §4 (the execution seam) is replaced by a short pointer to the seam design —
  the direction text is superseded by the frozen contract;
- the consumer-state note (dated 2026-08-08: sixteen science designs, A7–A8
  pending) is refreshed to the world at review time: the science corpus at
  twenty-three documents, `atoms` A8 certified 2026-08-17, conformance cut 4
  drafted against this seam, the tamper-evident log confirmed as a second
  consumer of §2.2;
- the status header advances from "Draft — direction approved 2026-08-03;
  detailed review pending" to "Detailed review complete YYYY-MM-DD — deltas
  await implementation," with the seam design named.

Second merge; then a second science-`main` commit updating ledger row 3's
status ("Direction approved" → detailed-review-complete wording, deltas still
blocking profile implementation, not design).

## 3. The seam design's decision list

These are settled during execution, in the seam design itself. The list is the
spec's completeness bar: the seam design must pin every item below, and a plan
task that skips one is incomplete. Current code facts the contract formalizes:
`Store.write_file` is a bare `write_text`; `Corpus.rename` prepares all rewrites
in memory, validates all before writing any, then commits in the order
write-new-file → delete-old-file → rewrite-referrers — so a crash between the
first two leaves **two files carrying one uid**, which strict construction
refuses (`CollisionError`, `structural_index.py`), an intermediate state that is
*not* forward-resolvable; substrate consolidation §7 (science) rules this write
path a validation boundary, not a durability one, and forbids any interim
transaction layer.

1. **The write-plan value.**
   - Op kinds: create, replace, delete — the file operations the three mutators
     (`add`, `rename`, `delete`) need. Whether create and replace are one op
     kind with a precondition distinguishing them, or two, is the seam design's
     call; the contract states it either way.
   - Per-op payload: root-relative POSIX path; full serialized content for
     creates/replaces (the plan carries bytes, not closures).
   - Per-op preconditions: create requires path-absent; replace/delete state
     their expected prior state (at minimum path-present; whether an expected
     content digest is carried, and who checks it under each atomicity class,
     is decided in the seam design).
   - Plan-level ordering: the plan is an ordered sequence, and the crash
     surface is stated **per operation position** under the best-effort class —
     including the known-invalid window in today's rename order (new file
     written, old not yet deleted: a duplicate uid that strict construction
     refuses and only §2.3's collecting mode can even report). The seam design
     either re-orders the emitted plan to close that window or specifies it as
     an acknowledged invalid intermediate; "renamed node first, then referrers"
     is restated as a property of the plans the mutators emit, with whatever
     precision the chosen answer supports — not as a blanket
     forward-resolvability claim, which the current order does not satisfy.
   - Purity and portability: the plan is a pure, fully-determined,
     serializable value — no closures, no callbacks. Plan **equality is
     semantic**, consistent with the standard's parity model (§1: byte-identical
     serialization is a non-goal; equivalence is defined over the canonical
     projection): both kernels emit semantically identical plans for identical
     mutations, with content payloads compared via the canonical projection
     while each language serializes with its own emitter. Whether the payload
     is the serialized document or the node value with serialization as a
     named kernel service is the seam design's call. Its conformance-tier
     placement (tier 1 vs tier 2) and its parity-fixture obligation are
     decided and stated.
2. **The executor protocol.**
   - The execute operation's signature and result type in both languages.
   - Atomicity classes, declared per executor: the **default executor** is
     today's behavior — best-effort ordered writes, a crash leaves a prefix of
     the plan applied — now named as such; a **durable executor** (supplied by
     a composition root; `atoms` via science's Python composition root) applies
     the plan all-or-nothing. `nodes` depends on `atoms` in neither language.
   - Concurrency posture, declared per executor and stated explicitly: the
     **default executor provides no serialization** — the single-writer
     obligation stays with the deployment, exactly as standard §13 places it
     today; the durable executor owns serialization. "Re-attribution" of the
     single-writer MUST therefore means: the kernel never coordinates, and
     each executor declares whether it does or passes the obligation through.
   - Refusal semantics: what a precondition failure does and when, per class —
     before any effect, or at the failing op — and what the caller can assume
     about applied state after a refusal, per class.
   - Plan validation: an executor's obligations on a malformed plan and on a
     path that escapes the corpus root or enters the reserved namespace —
     which of plan builder and executor refuses, and with what error.
   - What the executor returns to the corpus, and what the corpus does with it.
   - The supply surface: how a composition root injects an executor (the
     `Corpus` construction point), how the executor learns the corpus root,
     and the public error types the seam adds — the pieces science's adapter
     must wire without re-opening `nodes`.
3. **Boundary attribution.**
   - The single-writer MUST re-attributed as item 2's concurrency posture
     states: the kernel performs no coordination; serialization and durability
     are each executor's declared responsibility or explicitly passed to the
     deployment.
   - In-memory state (structural index, search index, manifest) updates happen
     corpus-side only after the executor reports success; the partial-failure
     story is stated per atomicity class (what the corpus object's state is
     when a best-effort executor fails mid-plan).
4. **The derived-index question.** Whether `.nodes-index/` snapshot writes
   (`flush_index`) route through the executor or are exempt as rebuildable
   derived state — settled explicitly either way, with the reserved-path
   contract (§2.2 of the redesign design) cited.
5. **Consumer sufficiency.** The contract must let science's adapter design map
   a plan onto an `atoms` transaction without re-opening `nodes`: the plan's
   ops and preconditions must be expressible as an `atoms` transaction's
   intents, and the seam design records — as a consumer note, not a `nodes`
   obligation — that the durable engine appends registration-chain entries in
   every transaction, invisible to `nodes` (science cut 4's "chained but
   unanchored" fact).

## 4. The trailing review's protocol

Every §2/§3/§5 delta of the redesign design is adjudicated against the tree,
not re-argued from the document. Verdicts are one of:

- **stands** — the claim re-verified; dated annotation says so;
- **stands amended** — the direction holds but a stated fact changed; the
  annotation carries the amendment;
- **withdrawn** — the delta no longer holds; the annotation says why and what
  replaces it (expected rare; a withdrawal that changes the design's shape is
  surfaced to the user before landing).

What is re-verified, per delta:

- **§2.1 (projection API):** the canonical projection still lives only in test
  helpers (`python/tests/_canonical.py` and its TS twin); the science-side
  digest requirements still name the projection as their base.
- **§2.2 (reserved paths):** membership is still stated positively with the
  manifest surviving "by accident of the glob"; symlink handling in the walk is
  still first-component-only; the tamper-evident log's reserved-path use is
  confirmed as the second consumer.
- **§2.3 (recoverable construction):** construction still fails hard on the
  first unparseable file; `check` is unrunnable over a damaged corpus.
- **§2.4 (digest-shaped ids):** the case-fold hazard reproduced against
  `path_for` (exact-case mapping, no existence check, no `check` comparison);
  the collation gap confirmed (Python code points vs TS UTF-16 code units);
  the uid-minting wording still reads as a constraint.
- **§3 (withdrawals):** the zero-caller measurements re-run — grep mindful v6
  (`~/d/mindful/v6/`) and both `nodes` languages for the similarity facet,
  `dangling()`, and `descendants`/`ancestors`; the line-count claim (~2,800)
  re-measured; `rename`'s prospective caller (address correction / inbound
  rewrite) still stands in the science designs; the `(crash-atomic)` code
  comment still overclaims. **One outcome is already known:** mindful v6's
  `api.ts` ships production `similar()` and `similarText()` calls delegating
  to `corpus.similar`, so the similarity withdrawal's stated basis — "zero
  production callers ever, in either language; the one consumer (mindful)
  shipped its own semantic stack instead" — fails against the current tree.
  The review adjudicates whether the delta is withdrawn or re-argued on a
  different basis; either way the verdict is surfaced to the user before it
  lands, since it changes the design's largest delta. The rename delta is
  expected to land **stands amended** at minimum: its ordering language
  ("a crash leaves a forward-resolvable state") is false at the
  write-new/delete-old window (§3 above).
- **§5 (housekeeping):** each item's stale fact re-checked (which design
  statuses still misdescribe shipped code; the four path corrections; the
  README consumer claim; the identity-boundary sentence; the release
  follow-ups' status). The **undecided item** — the `biology/gene-axis` parity
  fixture's home repository — is ruled or explicitly re-parked with a named
  owner and trigger.
- **The consumer-state note:** refreshed as the second landing (this spec's
  §2.2) describes.

§6 (standard changes summary) is reviewed for consistency with the verdicts
**and gets an explicit version-policy verdict against standard §12**: §6 calls
the tier-2 removals "minor under §12's removal clause," but §12 defines a
**major** bump as one that "changes pinned tier-2 behavior," and the similarity
facet is pinned tier-2 with fixtures in the §11 table. The review rules whether
the amendment the deltas imply is 1.3 or 2.0, and records the reading of §12's
removal-vs-change boundary that the ruling rests on. The amendment itself still
does not land (see §5 below).

## 5. Out of scope

- **No code changes.** The repository gates are run before each merge and must
  pass, trivially.
- **No STANDARD amendment.** The amendment (1.3 or 2.0, per the version
  verdict) lands with the future implementation plan, as the redesign design's
  §6 envisions. The standard remains authoritative at 1.2 throughout this
  workstream; the seam design's authority until then is exactly what its
  stability clause states (§2.1) — a frozen pre-normative contract binding the
  future amendment, not a competing normative text.
- **No science adapter design.** That is the next front, consuming the frozen
  seam.
- **No implementation scheduling.** The deltas' implementation plan is future
  work; this review leaves it unblocked, not started.

## 6. Acceptance

1. The seam design exists, is self-contained (every §3 decision-list item
   pinned; no TBDs), carries the stability clause, and is merged to `main`
   ahead of the trailing review.
2. Every §2/§3/§5 delta site in the redesign design carries a dated verdict;
   the status header and consumer-state note are current; §4 points to the
   seam design.
3. No stale claim survives in either repository, grep-verified at each landing:
   "detailed review pending," the A7–A8 gate line, science ledger row 3's
   "Direction approved," and the open-questions seam-pending wording.
4. The full AGENTS.md gate set passes at both merges: from `python/`,
   `uv run --frozen pytest -q`, `uv run --frozen ruff check .`,
   `uv run --frozen pyright src`; from `ts/`, `npm test`, `npm run typecheck`,
   `npm run check`.
5. Science `main` carries the two follow-up commits, each landed immediately
   after its `nodes` merge.
