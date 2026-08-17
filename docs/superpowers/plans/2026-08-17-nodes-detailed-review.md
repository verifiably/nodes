# Nodes Detailed Review (Seam-First) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze the write-plan/executor seam as a pre-normative contract, then complete the detailed review of the 2026-08-03 redesign design, in two landings.

**Architecture:** Documents only — no code changes anywhere in this plan. Tasks 1–3 write the seam design; Task 4 is landing one (seam merge + science follow-up); Tasks 5–7 are the trailing per-delta review of the redesign design; landing two closes it. Every factual claim written into a document is verified against the tree in the same task, with the verification command recorded in the step.

**Tech Stack:** Markdown; git; the repository gates (pytest/ruff/pyright, npm test/typecheck/check) run before every commit and must pass trivially since only documents change.

**Spec:** `docs/superpowers/plans/../specs/2026-08-17-nodes-detailed-review-design.md` — the plan argues from it; executors read both. The spec's §3 is the seam design's completeness bar; its §4 is the verdict protocol.

## Global Constraints

- **No code changes.** If a task believes a code change is needed, it reports BLOCKED; it does not make the change.
- **Gates before every commit** (AGENTS.md): from `python/`: `uv run --frozen pytest -q`, `uv run --frozen ruff check .`, `uv run --frozen pyright src`; from `ts/`: `npm test`, `npm run typecheck`, `npm run check`.
- **Conventional commits; no AI-attribution trailers.**
- **Filepaths in docs use `~/d/nodes/...`** (AGENTS.md); never write `/home/keith` or `/mnt/ssd/Dropbox` into a document.
- **The seam design is pre-normative** (spec §2.1): frozen as a contract about the future standard amendment; it must never claim present normative authority over shipped code, and STANDARD.md is not edited anywhere in this plan.
- **Verdict vocabulary** (spec §4): every redesign-design delta gets exactly one of **stands / stands amended / withdrawn**, as a dated parenthetical annotation at its site, in the document's existing style (see its 2026-08-08 notes for the form).
- **Two landings, in order** (spec §2): the seam design merges to `main` before any trailing-review commit lands there. Merges are user checkpoints — stop and use superpowers:finishing-a-development-branch.
- **The similarity verdict is surfaced to the user before it lands** (spec §4).
- **Section references:** in the standard, single-writer is §7 (line ~242), rename is §3, versioning is §12, fixtures are §11; in the redesign design, the deltas are §2.1–§2.4, §3, §5, the seam is §4, the summary is §6.

---

### Task 1: Seam design scaffold and the write-plan value section

**Files:**
- Create: `docs/designs/2026-08-17-nodes-write-plan-executor-seam-design.md` (date the file the day this task runs; if that is no longer 2026-08-17, use the actual date everywhere the filename appears in later tasks)
- Read (evidence): `python/src/nodes/core/corpus.py:153-188,254-316`, `python/src/nodes/core/store.py`, `python/src/nodes/core/structural_index.py:170-205`, `docs/STANDARD.md` §1 (parity, lines ~28–34), §3, §7, `docs/designs/2026-08-03-nodes-under-the-system-redesign-design.md` §4, `docs/superpowers/specs/2026-08-17-nodes-detailed-review-design.md` §2.1 and §3 item 1

**Interfaces:**
- Produces: the seam document with sections `## 1. Why and status`, `## 2. The write plan`, and empty headings `## 3. The executor protocol`, `## 4. Boundary attribution`, `## 5. Derived indexes and reserved paths`, `## 6. Consumer sufficiency`, `## 7. Pending standard amendments`, `## 8. Amendment record`. Later tasks fill 3–8 and rely on §2's op names: `create`, `replace`, `delete` (three distinct op kinds).

- [ ] **Step 1: Write §1 (why and status) with the stability clause**

§1 states: the redesign design's §4 named this seam as direction and gated it on `atoms` A7–A8; A8 landed 2026-08-17; science's composition-root adapter design is the first consumer. Then the stability clause, carrying all three bullets from spec §2.1 in the seam design's own voice: (a) frozen on banking, **pre-normative** — the text binds the future standard amendment (1.3 or 2.0 per the trailing review's version verdict) and binds design consumers now, while the standard keeps describing shipped code; (b) touchpoints with existing normative text (single-writer, standard §7; rename crash language, standard §3) are recorded in §7 of this document as pending amendment wording, not applied; (c) the graduated amendment procedure — changes to a part a landed consumer exercises need that consumer's sign-off recorded in §8; parts no landed consumer exercises may be amended by nodes-side review alone. §8 starts with an exercise map saying **no part is consumer-exercised yet**; science's adapter design, when it banks, will exercise the create path (its cut-4 slice is add-only).

- [ ] **Step 2: Verify the code facts §2 will cite, and record the evidence**

Run and save outputs (they become the section's citations):

```bash
sed -n '153,188p;254,316p' python/src/nodes/core/corpus.py
sed -n '183,195p' python/src/nodes/core/structural_index.py   # assert_addable
sed -n '25,45p' python/src/nodes/core/store.py                # write_file/delete_file
grep -n "single writer" docs/STANDARD.md
```

Confirm before writing: `add` permits an overwrite when uid and id both match (`assert_addable`); rename commits write-new → delete-old → referrers; `Index.build` raises `CollisionError` on a duplicate uid.

- [ ] **Step 3: Write §2 (the write plan)**

Pin every spec §3 item-1 decision. The pre-made positions below are the plan's recommendations with their rationale; the implementer adopts them unless the evidence from Step 2 contradicts one, and records the rationale in the section either way:

- **The value is named `WritePlan`** — an ordered sequence of ops with an exact discriminated-union schema, written into the section as the amendment's future API:
  - `CreateOp` — `{op: "create", path, content}`; implicit precondition: path absent.
  - `ReplaceOp` — `{op: "replace", path, content, expected_digest}`; implicit precondition: path present with matching digest.
  - `DeleteOp` — `{op: "delete", path, expected_digest}`; implicit precondition: path present with matching digest.
  - `path` is a root-relative POSIX string; `content` is raw bytes (Python `bytes`, TypeScript `Uint8Array`; serialized node documents are UTF-8); `expected_digest` is lowercase-hex SHA-256 over the on-disk bytes the op replaces or deletes — portable across languages because both read the same disk state, unlike emitted content. Preconditions are these fields, not a separate structure; enforcement is declared per atomicity class in the seam doc's §3.
  - Three distinct op kinds rather than a merged upsert: the preconditions differ and the durable executor maps them to different effect types.
- **`add` selects create vs replace** by whether the (uid, id) pair is live: unseen → `create`; matching existing entry → `replace` (the overwrite path mindful v6's `tag()` uses in production). Collision refusal stays **corpus-side, before plan construction** — `assert_addable`'s two refusals (uid claimed by a different id; identity claim owned by a different uid) are unchanged and never reach an executor.
- **Payload: serialized document bytes**, produced by the emitting kernel's own serializer. Rationale: the executor stays pure file mechanics (as `Store` is today) and needs no kernel serialization service. **Plan equality is semantic**: two plans are equal when op kinds, paths, and `expected_digest` values match position-wise and each `content` payload parses to the same canonical JSON projection (standard §1: byte-identical serialization is a non-goal). Parity fixture obligation: pinned at implementation time as part of the standard amendment; **tier 1** (it is mutation semantics).
- **Ordering and the crash surface, per operation position.** Rename's emitted plan keeps write-new-first → delete-old → referrer replaces. State the crash surface at each position under the best-effort class, including the one **acknowledged invalid prefix**: after the new file lands and before the old file's delete, two files carry one uid; strict construction refuses this state (`CollisionError` at `Index.build`), and whether the collecting mode can report it is §2.3's verdict in the trailing review (cite the spec). State why reordering cannot close the window and why an atomic move op does not help either: rename changes the node's content (id field, `deprecated_ids`), so the transition is never a pure move — every order of create/replace/delete has an invalid or misleading intermediate, and this design chooses the duplicate-uid window as the specified one because it is the only intermediate strict construction refuses loudly rather than resolving wrongly.

- [ ] **Step 4: Run the gates**

From `python/`: `uv run --frozen pytest -q && uv run --frozen ruff check . && uv run --frozen pyright src`. From `ts/`: `npm test && npm run typecheck && npm run check`. All must pass.

- [ ] **Step 5: Commit**

```bash
git add docs/designs/2026-08-17-nodes-write-plan-executor-seam-design.md
git commit -m "docs(designs): scaffold the seam design and pin the write-plan value"
```

### Task 2: Executor protocol, boundary attribution, and derived indexes

**Files:**
- Modify: `docs/designs/2026-08-17-nodes-write-plan-executor-seam-design.md` (sections 3, 4, 5)
- Read (evidence): `python/src/nodes/core/corpus.py:74-151` (`_full_rebuild`, `_reconcile`, `flush_index`), `python/src/nodes/core/snapshot.py` (what `.nodes-index/` holds and `iter_corpus_files`), `docs/STANDARD.md` §7 and §10, spec §3 items 2–4

**Interfaces:**
- Consumes: Task 1's `WritePlan` and its op types (`CreateOp`/`ReplaceOp`/`DeleteOp`).
- Produces: the executor protocol names later tasks cite — `WritePlanExecutor` (the protocol/interface name), `execute(plan)` returning `None`/`void`, `DefaultExecutor` (best-effort class), the error names `PlanRefusedError` and `ExecutionError`.

- [ ] **Step 1: Write §3 (the executor protocol)**

Pin, per spec §3 item 2:

- Signatures in both languages, as future API (pre-normative — these are the amendment's text, not shipped code): Python `class WritePlanExecutor(Protocol): def execute(self, plan: WritePlan) -> None: ...`; TypeScript `interface WritePlanExecutor { execute(plan: WritePlan): void }`. **Success is a normal return; there is no report type** — on full success every per-op outcome is identical ("applied"), so a report would carry no information the return does not; failures are exceptions (below).
- **Atomicity classes:** `DefaultExecutor` — best-effort ordered writes; a crash leaves a prefix of the plan applied; this is today's `Store` behavior, now named. Durable executor — supplied by a composition root (`atoms` via science's Python composition root); applies the plan all-or-nothing; `nodes` depends on `atoms` in neither language.
- **Concurrency posture, per executor:** `DefaultExecutor` provides **no serialization** — the single-writer obligation stays with the deployment exactly as standard §7 places it today; the durable executor owns serialization. Re-attribution of the single-writer MUST means: the kernel never coordinates; each executor declares whether it serializes or passes the obligation through.
- **Refusal semantics per class:** the durable executor refuses before any effect (precondition failure aborts the transaction; nothing applied); `DefaultExecutor` checks each op's existence precondition at that op and stops at the first failure, leaving the applied prefix — `expected_digest` values are carried but not enforced by `DefaultExecutor` (declared, so the limit is stated rather than implied).
- **Plan validation:** the **plan builder** (corpus-side) never emits a path outside the corpus root or inside a reserved namespace; the **executor** additionally refuses a malformed plan — a path escaping the root (after resolution), a reserved-namespace path, an unknown op kind — with `PlanRefusedError` before any effect, in both classes. Execution failures surface as `ExecutionError` carrying the failing op's index and the count of applied ops.
- **Return:** `None`/`void`; the corpus applies its in-memory updates only after `execute` returns.
- **Supply surface** (spec §3 item 2's last bullet): an executor is **root-bound at construction** — `DefaultExecutor(root)`; the protocol itself stays `execute(plan)` with no root parameter, so plans stay root-relative values. Injection happens at `Corpus` construction (a `Corpus(root, executor=...)` parameter; omitted → the corpus constructs `DefaultExecutor(root)` itself). An injected executor is built by the composition root against the same corpus root — a stated obligation of the composition root; `Corpus` does not rebind it. The seam's public error additions are exactly `PlanRefusedError` and `ExecutionError`. These are the pieces science's adapter wires without re-opening `nodes`.

- [ ] **Step 2: Write §4 (boundary attribution)**

Per spec §3 item 3: the kernel performs no coordination; serialization and durability are each executor's declared responsibility or explicitly passed to the deployment (§3's posture table is the authority). In-memory state (structural index, search index, manifest) updates happen corpus-side only after `execute` returns; the partial-failure story per class: durable — refusal or crash leaves disk and in-memory state at the pre-plan state (nothing applied, nothing updated); best-effort — a mid-plan failure leaves the **applied prefix on disk while memory remains entirely pre-plan**, so the corpus object is stale by exactly the applied prefix relative to disk (and lacks the whole plan relative to the intended final state), with reconstruction from disk (and its strict/collecting behavior) as the stated recovery.

- [ ] **Step 3: Write §5 (derived indexes and reserved paths)**

Per spec §3 item 4, pinned: `.nodes-index/` snapshot writes (`flush_index`) do **not** route through the executor — they are rebuildable derived state in the reserved namespace (redesign design §2.2), excluded from plans entirely; a plan containing a reserved-namespace path is malformed (§3's `PlanRefusedError`). State the consequence: the durable executor's all-or-nothing claim covers corpus content only; index snapshots remain best-effort and rebuildable by design.

- [ ] **Step 4: Run the gates** (same commands as Task 1 Step 4).

- [ ] **Step 5: Commit**

```bash
git add docs/designs/2026-08-17-nodes-write-plan-executor-seam-design.md
git commit -m "docs(designs): pin the executor protocol and boundary attribution"
```

### Task 3: Consumer sufficiency, pending amendments, and the freeze pass

**Files:**
- Modify: `docs/designs/2026-08-17-nodes-write-plan-executor-seam-design.md` (sections 6, 7, 8; whole-document pass)
- Read (evidence): science `docs/designs/2026-08-17-conformance-cut-4.md` §1–§2 (the add-only slice, the chained-but-unanchored close), science `docs/designs/2026-08-03-redesign-adoption-ledger.md` rows 3–4, spec §3 item 5; **the engine itself**: `~/d/atoms/python/src/atoms/core/effects.py` (`FileState(content_hash, mode, byte_len)`; `CreateFileNoClobber(effect_id, path, post)`; `ReplaceFile(effect_id, path, pre, post)`; `DeletePath(effect_id, path, pre)`; `MoveNoClobber`) and `~/d/atoms/python/src/atoms/core/spec.py:31-40` (`TransactionSpec`: `schema_version`, `consumer_tag`, `intent_digest`, `initial_surface`, `final_surface`, `effects`, `dependencies`, `fulfills`, `registered_paths`)

**Interfaces:**
- Consumes: §2's ops and preconditions, §3's protocol names.
- Produces: the finished seam design, ready to freeze at landing one.

- [ ] **Step 1: Write §6 (consumer sufficiency)**

Per spec §3 item 5: demonstrate — as a consumer note verified against the engine's actual types, not a `nodes` obligation — that every field a durable transaction needs is derivable from (the plan, adapter-side constants, adapter-side reads), so science's adapter design can wire `WritePlanExecutor` without re-opening `nodes`. Write the mapping field-by-field:

- `CreateOp` → `CreateFileNoClobber(effect_id, path, post)`: `post.content_hash` and `post.byte_len` computed from the op's `content` bytes; `post.mode` an adapter-supplied constant (`nodes` does not model file modes — state this explicitly as an adapter decision).
- `ReplaceOp` → `ReplaceFile(effect_id, path, pre, post)`: `post` as above; `pre` obtained by the adapter's own read of the current file at transaction build, cross-checked against the op's `expected_digest` (a mismatch is a refusal before any effect).
- `DeleteOp` → `DeletePath(effect_id, path, pre)`: `pre` as for replace.
- `TransactionSpec` fields: `schema_version` (engine constant), `consumer_tag` and `effect_id`s (adapter-minted), `intent_digest` (adapter-computed per engine rules), `initial_surface`/`final_surface` (derived from the pre/post states above), `dependencies`/`fulfills` (adapter's call; none required by the plan), `registered_paths` (the engine's registration surface — record verbatim the engine fact from the spec: the durable engine appends registration-chain entries in every transaction, invisible to `nodes`; science cut 4's "chained but unanchored" fact).
- Note that `MoveNoClobber` exists and is deliberately unused: rename is never a pure move because the renamed node's content changes (seam §2's argument).

Close with what the adapter supplies from its side: executor construction bound to the corpus root, injection at `Corpus` construction, and the composition root's exclusive ownership of executor choice.

- [ ] **Step 2: Write §7 (pending standard amendments)**

Exactly two entries, each with the amendment wording fixed now and marked pending: (a) standard §7's single-writer MUST re-attributed per this design's §3–§4; (b) standard §3's rename crash language restated per this design's §2 (the specified invalid prefix replaces "crash-atomic"/forward-resolvable phrasing). State that both land only in the standard amendment (1.3 or 2.0 per the trailing review's version verdict) and change nothing until then.

- [ ] **Step 3: Write §8 (amendment record) and run the freeze pass**

§8: the exercise map from Task 1 Step 1 (no part consumer-exercised yet; the create path becomes exercised when science's adapter design banks) and an empty amendments log with the recording format (date, part, change, reviewer, consumer sign-off if the part is exercised). Then the freeze pass over the whole document: every spec §3 decision item has a pinned answer (grep the spec's §3 list against the document); no TBDs; every code citation checked against the file it names; internal names consistent (`WritePlan`, `CreateOp`/`ReplaceOp`/`DeleteOp`, `WritePlanExecutor` with `execute(plan)` returning `None`/`void`, `DefaultExecutor`, `PlanRefusedError`, `ExecutionError`).

- [ ] **Step 4: Run the gates** (same commands as Task 1 Step 4).

- [ ] **Step 5: Commit**

```bash
git add docs/designs/2026-08-17-nodes-write-plan-executor-seam-design.md
git commit -m "docs(designs): complete the seam contract for freeze"
```

### Task 4: Landing one — redesign §4 annotation, then the seam merge and science follow-up

**Files:**
- Modify: `docs/designs/2026-08-03-nodes-under-the-system-redesign-design.md` (§4 and the status header only)
- After merge, in science (`~/d/science`, on `main` directly): `docs/designs/2026-08-03-redesign-adoption-ledger.md` (row 3), `docs/guide/open-questions.md` (the cut-4 bullet, lines ~175–194)

**Interfaces:**
- Consumes: the finished seam design and its exact filename.

- [ ] **Step 1: Annotate the redesign design's §4 and narrow the header**

In the document's own annotation style, add to §4: *(2026-08-XX:)* superseded — the seam contract is frozen in `2026-08-17-nodes-write-plan-executor-seam-design.md`, which now owns it; the direction text above and its spent A7–A8 gate line no longer speak for the seam. Change the status header to: `**Status:** Draft — direction approved 2026-08-03; §4 frozen into the seam design 2026-08-XX; detailed review of §2/§3/§5 pending`. (2026-08-XX = the date the step runs.) Touch nothing else in the document.

- [ ] **Step 2: Run the gates, commit**

```bash
git add docs/designs/2026-08-03-nodes-under-the-system-redesign-design.md
git commit -m "docs(designs): supersede the seam direction and narrow the review status"
```

- [ ] **Step 3: USER CHECKPOINT — merge landing one**

Stop. Use superpowers:finishing-a-development-branch scoped to this landing: gates green, then present the merge decision to the user. On approval, merge `docs/nodes-detailed-review` to `main` (do not delete the branch or remove the worktree — Tasks 5–7 continue on it), and do not push unless asked.

- [ ] **Step 4: Science follow-up commit (after the merge, on science `main`)**

In `~/d/science`: ledger row 3's status cell gains: "Seam frozen 2026-08-XX (`nodes` `2026-08-17-nodes-write-plan-executor-seam-design.md`, pre-normative — binds the future standard amendment); §2/§3/§5 detailed review in progress." In `docs/guide/open-questions.md`, the cut-4 bullet's clause naming the seam freeze as pending is updated to name it frozen (the adapter design's dependency is now satisfied; the adapter design itself remains the open item). Run science's gates from its `python/`: `uv run --frozen pytest -q` (10-minute timeout; science's pytest config suppresses the summary line — verify exit 0), `uv run --frozen ruff check .`, `uv run --frozen pyright`. Commit:

```bash
git add docs/designs/2026-08-03-redesign-adoption-ledger.md docs/guide/open-questions.md
git commit -m "docs: record the nodes seam freeze"
```

### Task 5: Trailing review — §2 contract-delta verdicts

**Files:**
- Modify: `docs/designs/2026-08-03-nodes-under-the-system-redesign-design.md` (§2.1–§2.4 annotations)
- Read (evidence): commands below

**Interfaces:**
- Consumes: the seam design (for §2.3's collision question and §2.4's cross-references).
- Produces: four dated verdicts.

- [ ] **Step 1: Verify §2.1 (projection API) and write its verdict**

```bash
grep -rn "to_canonical\|toCanonical" python/ ts/ --include="*.py" --include="*.ts" -l
```

Expected: only `python/tests/_canonical.py` and the TS test twin (plus fixture references). If the projection is still test-helper-only and science's digest requirements still name it (science world-addressing/kernel designs), verdict **stands**.

- [ ] **Step 2: Verify §2.2 (reserved paths) and write its verdict**

Read `python/src/nodes/core/snapshot.py:40-42` and `ts/src/snapshot.ts` (`listCorpusMarkdownPaths`), and keep two separate checks that §2.2's text conflates:

- **The reserved-namespace exclusion**: Python checks `rel.parts[0] == ".nodes-index"` — first path component only — and TS compares the root-relative path at directory level; confirm both as the delta's "stated positively, minus `.nodes-index/`" premise.
- **Symlink traversal**: verify actual current behavior per language, not the delta's blanket claim. Known going in: TS skips **every** symlink entry, file or directory, at any depth (`entry.isSymbolicLink()` → `continue`); Python skips symlink **files** at any depth (`p.is_symlink()` at snapshot.py:42), and directory-symlink recursion depends on `Path.rglob`'s behavior on the running Python version — test it (create a temp corpus with a symlinked directory and run `iter_corpus_files`) rather than asserting it.

Confirm the tamper-evident log consumer (science `docs/designs/2026-08-03-tamper-evident-log-design.md`, the reserved in-corpus path). Expected verdict: **stands amended** — the contract direction holds, but the delta's description of today's symlink handling must be corrected to the per-language mechanics found above.

- [ ] **Step 3: Verify §2.3 (recoverable construction), write its verdict with the collision decision**

Confirm fail-hard: construction (`Corpus._full_rebuild`, corpus.py:92, and `_reconcile`, corpus.py:108, via `node_from_markdown`) raises on the first unparseable file (cite lines). Then the spec-required addition: the verdict decides whether **corpus-level collisions** (duplicate uid — `CollisionError` at `Index.build`, `structural_index.py:175`) join the collecting mode. Recommendation to adopt unless evidence argues otherwise: yes — the collecting mode gains a corpus-level `uid-collision` finding (severity error) with **both** claimants excluded from the constructed corpus, because the seam's specified invalid prefix (rename's duplicate-uid window) is exactly this state and an audit that cannot see it cannot report the crash the seam acknowledges. Verdict: **stands amended** (scope grows by the collision finding).

- [ ] **Step 4: Verify §2.4 (digest-shaped ids) and write its verdict**

Confirm each hazard: `path_for` maps exact-case with no existence check (`store.py:21-23`); `check` never compares index against `path_for`; walk-order collation unpinned (find the sort sites: `sorted(...)` in Python snapshot/index code vs `.sort(...)` in TS — cite both); the uid SHOULD wording in the standard (§2/§3 — locate the line). Verdict expected **stands**.

- [ ] **Step 5: Gates, commit**

```bash
git add docs/designs/2026-08-03-nodes-under-the-system-redesign-design.md
git commit -m "docs(designs): record the §2 contract-delta verdicts"
```

### Task 6: Trailing review — §3 withdrawal verdicts (user checkpoint on similarity)

**Files:**
- Modify: `docs/designs/2026-08-03-nodes-under-the-system-redesign-design.md` (§3 annotations)
- Read (evidence): commands below; `~/d/mindful/v6/src/`

**Interfaces:**
- Consumes: the seam design §2 (rename's specified invalid prefix, for the rename verdict).
- Produces: four dated verdicts; the similarity verdict approved by the user before commit.

- [ ] **Step 1: Re-run the caller measurements**

```bash
grep -rn "similar\|dangling\|descendants\|ancestors" ~/d/mindful/v6/src --include="*.ts" -l
grep -rn "\.similar(\|\.similarText(\|\.dangling(\|\.descendants(\|\.ancestors(" ~/d/mindful/v6/src
wc -l python/src/nodes/core/similarity.py ts/src/similarity.ts
grep -rln "similarity\|vector" python/tests ts/tests fixtures | head -20
```

Known going in (spec §4): `api.ts` ships production `similar()`/`similarText()` delegating to `corpus.similar` — the zero-caller basis fails. Record the actual current counts for all four surfaces.

- [ ] **Step 2: Draft the similarity verdict and STOP — user checkpoint**

Draft the verdict from the evidence. The honest default given a production caller: **withdrawn** (the withdrawal, not the facet — the delta's factual basis failed; similarity stays, and the standard's similarity section stays pinned tier-2), with the annotation recording the measurement that reversed it and noting the consequence for §6's version arithmetic (no tier-2 removal → the removal clause is moot for similarity). If instead the mindful callers turn out dead/unreachable code, the delta could be **stands amended** on a corrected basis. Present the evidence and the drafted verdict to the user; do not commit until they rule.

- [ ] **Step 3: Write the remaining three verdicts**

- `dangling()`: if the mindful grep shows no caller, **stands**.
- `descendants`/`ancestors`: if no caller, **stands**.
- `rename` re-specification: **stands amended** — the direction (ordering only, no atomicity claim) holds, but its own ordering language ("a crash leaves a forward-resolvable state") is false at the write-new/delete-old window; the annotation points at the seam design §2's specified invalid prefix as the correct statement, and confirms the `(crash-atomic)` code comment still exists (`grep -rn "crash-atomic" python/ ts/`) and is queued for the implementation plan, not edited here.

- [ ] **Step 4: Gates, commit**

```bash
git add docs/designs/2026-08-03-nodes-under-the-system-redesign-design.md
git commit -m "docs(designs): record the §3 withdrawal verdicts"
```

### Task 7: Trailing review — §5 housekeeping, consumer state, version verdict, header

**Files:**
- Modify: `docs/designs/2026-08-03-nodes-under-the-system-redesign-design.md` (§5 and §6 annotations, the consumer-state note, the status header)
- Read (evidence): commands below

**Interfaces:**
- Consumes: every verdict from Tasks 5–6 (the version verdict and header depend on them).
- Produces: the fully reviewed document, ready for landing two.

- [ ] **Step 1: Verify and annotate each §5 item**

- Status refresh: read the status headers of the fulltext, similarity, ts-corpus-fingerprints, substrate, and ts-kernel designs (`head -6` each) and record which still misdescribe shipped code.
- Path corrections: `grep -rln "src/nodes/kernel\|@nodes/kernel" docs/designs/` — list the actual files.
- README: `grep -n "science" README.md` — confirm or correct the consumer claim's current state.
- Identity boundary: confirm the standard still lacks the one-sentence boundary (grep STANDARD.md for "corpus-state identity").
- Release follow-ups: read `docs/plans/2026-07-18-nodes-first-publish-recovery-plan.md` §4's post-tag steps; record whether any status note exists.
- The undecided `biology/gene-axis` item: rule it or re-park it with a named owner and trigger. Recommendation: **re-park with an owner** — it lands with the projection-API implementation (§2.1's plan), because the fixture tests the shipped projection and cannot exist before the API does; owner: the future implementation plan; trigger: §2.1 landing.

- [ ] **Step 2: Refresh the consumer-state note**

Replace the 2026-08-08 note's facts with the current world, verified against science: the science corpus's current document count (read README's explicit count sentence — "Twenty-three documents" as of 2026-08-17 — and cross-check with `ls ~/d/science/docs/designs/*.md | wc -l`; use whatever the count is when the step runs), `atoms` A8 certified 2026-08-17 (ledger row 4), conformance cut 4 drafted against this seam (cut-4 §1), the tamper log confirmed as §2.2's second consumer. Keep it a dated note in the same style.

- [ ] **Step 3: Write the §6 version-policy verdict**

Annotate §6 with the ruling required by spec §4, over the **full inventory of pinned surfaces the deltas touch** — not similarity alone:

- similarity: pinned tier-2 (`similarity-corpus/`, `similarity.vectors.json`, `similarity.oracle.json` in the §11 fixture table);
- `descendants`/`ancestors`: **also pinned tier-2** — `traversal.oracle.json` explicitly pins all four membership-traversal operations (§11 table), so their withdrawal touches pinned behavior regardless of the similarity verdict;
- `dangling()`: check the §11 table and §8's finding codes for any fixture pinning the *API* (the `dangling-ref`/`dangling-member` findings stay either way).

The honest default: if **any** surviving withdrawal removes a surface a §11 fixture pins, the amendment is **2.0 (major)** under §12's "changes pinned tier-2 behavior." A **1.3 (minor)** ruling is reachable only if every surviving withdrawal is unpinned, or if the review explicitly rules that deleting a pinned surface *with its fixture* is a "removal … that breaks neither reading/writing existing corpora nor pinned tier-2 behavior" rather than a change to it — if so, that reading of §12's removal-vs-change boundary must be recorded in the annotation as the ruling's basis. Record whichever ruling the Task 5–6 verdicts imply.

- [ ] **Step 4: Advance the status header**

`**Status:** Detailed review complete 2026-08-XX — §4 frozen into 2026-08-17-nodes-write-plan-executor-seam-design.md; deltas await implementation` (2026-08-XX = the date the step runs).

- [ ] **Step 5: Gates, commit**

```bash
git add docs/designs/2026-08-03-nodes-under-the-system-redesign-design.md
git commit -m "docs(designs): complete the detailed review of the redesign deltas"
```

- [ ] **Step 6: USER CHECKPOINT — landing two, then the science follow-up**

Stop; superpowers:finishing-a-development-branch for the remaining branch commits (merge to `main`; worktree cleanup per the skill). After the merge, in `~/d/science` on `main`: ledger row 3's status becomes "Detailed review complete 2026-08-XX; deltas await implementation" (keeping the seam-frozen fact and replacing "Direction approved"); grep science docs for any other "direction approved"-era claim about the nodes review (`grep -rn "Direction approved\|detailed review" docs/ --include="*.md"`) and correct what the landing made stale. Science gates green from its `python/` (`uv run --frozen pytest -q` exit 0, `uv run --frozen ruff check .`, `uv run --frozen pyright`), then stage **exactly the files the sweep edited** — the ledger plus whichever files the grep surfaced, each named explicitly:

```bash
git add docs/designs/2026-08-03-redesign-adoption-ledger.md   # plus each swept file, by name
git commit -m "docs: record the nodes detailed-review completion"
```

---

## Verification summary (acceptance, spec §6)

1. Seam design: every spec §3 decision item pinned; stability clause present; merged ahead of all trailing-review commits.
2. Every §2/§3/§5 delta site carries a dated verdict; header and consumer-state note current; §4 annotated as superseded at landing one.
3. Stale-phrase checks per landing (spec §6 item 3): after landing one — no unannotated §4 direction text, no spent A7–A8 gate line speaking for the seam, no science seam-pending wording, ledger row 3 carries the freeze; after landing two — no "detailed review … pending" form anywhere, no "Direction approved" in ledger row 3.
4. Gates green before every commit (both repos' suites at their respective commits).
5. Science `main` carries both follow-up commits, each immediately after its landing.
