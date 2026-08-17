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
per §3 below. It carries an explicit stability clause: **frozen on banking** —
consumers in other repositories build against it, and any later change is an
amendment requiring consumer sign-off, recorded in the document. This mirrors
science's freeze discipline; it is the first `nodes` design to carry one because
it is the first whose direct consumer is a design in another repository.

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
in memory, validates all before writing any, then commits renamed-node-first
then referrers; substrate consolidation §7 (science) rules this a validation
boundary, not a durability one, and forbids any interim transaction layer.

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
   - Plan-level ordering: the plan is an ordered sequence; `rename`'s existing
     promise (renamed node first, then referrers — a crash leaves a
     forward-resolvable state) is restated as a property of the plans the
     mutators emit, not of the executor.
   - Purity and portability: the plan is a pure, serializable, language-neutral
     value; both kernels emit identical plans for identical mutations. Its
     conformance-tier placement (tier 1 vs tier 2) and its parity-fixture
     obligation are decided and stated.
2. **The executor protocol.**
   - The execute operation's signature and result type in both languages.
   - Atomicity classes, declared per executor: the **default executor** is
     today's behavior — best-effort ordered writes, a crash leaves a prefix of
     the plan applied — now named as such; a **durable executor** (supplied by
     a composition root; `atoms` via science's Python composition root) applies
     the plan all-or-nothing. `nodes` depends on `atoms` in neither language.
   - Refusal semantics: what a precondition failure does and when, per class —
     before any effect, or at the failing op — and what the caller can assume
     about applied state after a refusal, per class.
   - What the executor returns to the corpus, and what the corpus does with it.
3. **Boundary attribution.**
   - The single-writer MUST re-attributed: `nodes` performs no coordination;
     the executor owns serialization and durability.
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
  comment still overclaims.
- **§5 (housekeeping):** each item's stale fact re-checked (which design
  statuses still misdescribe shipped code; the four path corrections; the
  README consumer claim; the identity-boundary sentence; the release
  follow-ups' status). The **undecided item** — the `biology/gene-axis` parity
  fixture's home repository — is ruled or explicitly re-parked with a named
  owner and trigger.
- **The consumer-state note:** refreshed as the second landing (this spec's
  §2.2) describes.

§6 (standard changes summary) is reviewed only for consistency with the
verdicts — the amendment itself does not land (see §5 below).

## 5. Out of scope

- **No code changes.** The suite is run before each merge and must be green,
  trivially.
- **No STANDARD amendment.** 1.2 → 1.3 lands with the future implementation
  plan, as the redesign design's §6 envisions. The standard remains authoritative
  at 1.2 throughout this workstream.
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
4. The `nodes` test suite is green at both merges.
5. Science `main` carries the two follow-up commits, each landed immediately
   after its `nodes` merge.
