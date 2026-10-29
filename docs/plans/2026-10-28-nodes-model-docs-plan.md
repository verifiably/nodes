# Nodes Model Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the nodes model (shape / kind / facet), its consumers, and its boundary legible from `README.md`, `AGENTS.md` and the two package guides, without touching the kernel or the standard.

**Architecture:** Three documentation edits inside the family README template: one sentence in `identity.toml` rendered into the guides by `just docs`; two `###` subsections under the README's `Usage`; two rules in `AGENTS.md`; a pointer line in each package guide. `tools/ops-docs check` (run by `just check` and the pre-commit hook) is the test for every task.

**Tech Stack:** Markdown, TOML, `tools/ops-docs` (`just docs`, `just check`), `tasks`.

**Spec:** `docs/designs/2026-10-28-nodes-model-docs-design.md` (accepted at `6ff7d20`).

## Global Constraints

- Documentation only: no change under `python/src`, `ts/src`, `fixtures/` or `docs/STANDARD.md`.
- README sections stay `Install`, `Usage`, `Layout`, `Documentation`, `License` in that order; new text under `Usage` uses `###` headings only (spec §3).
- The identity region of both guides is edited only through `identity.toml` + `just docs`, never by hand.
- Consumers are named by project, never by path; no host paths anywhere (spec §2 anti-goals).
- Where the new text and `docs/STANDARD.md` §§2, 5, 6 disagree, the text is wrong (spec §3).
- The README addition stays under one screen; `AGENTS.md` gains at most three bullets (spec §6).
- Every recipe runs through `just`; never call `ops-docs`, `pytest`, `biome` or `tsc` directly except `tools/ops-docs check`, which the recipes themselves call.
- Commits use conventional-commit subjects with no attribution trailer.

## Review Focus

1. A fresh clone's `just docs` must reproduce the committed identity regions byte for byte; a hand edit inside the `ops:identity` markers drifts on the next render. Pinned in Task 1 Step 4.
2. A model claim that contradicts the standard (for example "a kind may adopt several shapes"). Pinned in Task 2 Step 3, a side-by-side read against §2.1, §2.3, §5, §6 before commit.
3. A consumer line that names a kind the project does not register, or a dependency it does not have (science's direct nodes use; mindful's absence of atoms). Pinned in Task 2 Step 3 against the facts recorded in the spec.
4. A `##` heading added under `Usage` by mistake, which `ops-docs check` refuses only as "must come after License". Pinned in Task 2 Step 4.
5. A package-guide pointer that names a heading the README does not have. Pinned in Task 2 Step 4 (grep for the exact heading text).

---

### Task 1: Identity abstract

**Files:**
- Modify: `identity.toml` (the `abstract` value)
- Regenerated: `README.md` identity region, `AGENTS.md` identity region (via `just docs`)

**Interfaces:**
- Produces: the words *shape*, *facet*, *kind* in the abstract, which Task 2's `### The model` and Task 3's vocabulary rule reuse unchanged.

- [ ] **Step 1: Replace the abstract in `identity.toml`**

```toml
abstract = """
Entities as markdown files, typed relations, structural shapes and rebuildable derived indexes, implemented in Python and TypeScript over one shared on-disk format. Every node is built from the same blocks: a shape (how members hang together), facets (domain mix-ins) and a kind that composes them; a kind is registered, never subclassed. The kernel is domain-free; domain profiles such as beliefs, mindful v6 and lit register their own kinds on it.
"""
```

- [ ] **Step 2: Render the guides**

Run: `just docs`
Expected: `README.md` and `AGENTS.md` change only between their `ops:identity` markers (`git diff --stat` lists `identity.toml`, `README.md`; `AGENTS.md` is unchanged if its identity region carries no abstract, which is the current template).

- [ ] **Step 3: Check**

Run: `just check`
Expected: exit 0; `ops-docs check` prints nothing.

- [ ] **Step 4: Prove the render is reproducible**

Run: `just docs && git status --short`
Expected: no further change after the second render.

- [ ] **Step 5: Commit**

```bash
git add identity.toml README.md AGENTS.md
git commit -m "docs: name the model's blocks in the identity abstract"
```

### Task 2: README model and consumers, with package-guide pointers

**Files:**
- Modify: `README.md` — insert two `###` subsections at the end of `## Usage`, immediately before `## Layout` (after the `Corpus.read_and_check()` paragraph).
- Modify: `python/README.md` — one sentence after the opening paragraph (the one ending "passes the same cross-language conformance fixtures.").
- Modify: `ts/README.md` — one sentence after the opening paragraph (the one ending "Core contains the domain-free kernel.").

**Interfaces:**
- Consumes: the block names from Task 1.
- Produces: the headings `### The model` and `### Consumers`, which the package guides and Task 3 refer to by exact text.

- [ ] **Step 1: Insert the two subsections in `README.md`**

```markdown
### The model

Every node is built from the same blocks. The standard's terms, with where each is
used today:

| Plain words | Kernel term | Today |
|-------------|-------------|-------|
| How members hang together | **shape**: one of `set`, `list`, `dict`, `graph`, `dag`, `tree`; a kind adopts at most one | mindful v6's `mindmap` is a `graph`, its `journal` a `list` |
| A domain mix-in | **facet**: a named, typed payload a kind requires or allows | lit's `paper` carries `paperpile` and `world` |
| A type | **kind**: a name, its facets and its invariants, registered on a `Registry`; never a subclass | beliefs registers `proposition`, `run`, `dataset`, … |
| A container | **structure**: a node whose kind adopts a shape; members are refs in its `membership` facet | a mindful `set` of thoughts |

The kernel names zero knowledge kinds; a profile registers its own. What nodes
deliberately does not do, and where it lives instead:

- Meaning and verification of claims: beliefs.
- Durability and crash safety: atoms, pluggable as a durable write executor. nodes
  depends on atoms in neither language, and runs without it.
- Resolving external identifiers (a CURIE, a DOI, a vocabulary term): they are opaque
  strings inside facets and stay opaque to nodes; a downstream resolver interprets them.

### Consumers

- **beliefs** (Python): science's claims, runs, datasets and coordination kinds, with
  atoms as its executor.
- **mindful v6** (TypeScript): `thought`, `mindmap`, `journal`, `set`; no atoms.
- **lit** (Python): `paper`, with the `paperpile` and `world` facets.
- **science** (Python): primarily through beliefs, with some direct nodes API use.
```

- [ ] **Step 2: Add the pointer sentence to both package guides**

`python/README.md`, new paragraph after the opening paragraph:

```markdown
The model the kernel implements (shape, kind, facet) and the projects that build on it
are described under "The model" and "Consumers" in the repository README.
```

`ts/README.md`: the same sentence, in the same position.

- [ ] **Step 3: Read the model table against the standard**

Read `docs/STANDARD.md` §2.1 (Node fields), §2.3 (facets), §5 (shapes: the six names, "a kind adopts at most one shape", `membership = {members: [ref]}`), §6 (kind = name + facets + invariants) beside the table.
Expected: every claim in the table and the bullet list is stated or entailed by those sections; the consumer bullets match the kinds and dependencies the spec §5 records. Fix the text, never the standard.

- [ ] **Step 4: Check headings and template**

Run: `grep -n '^## \|^### ' README.md && grep -c 'The model' python/README.md ts/README.md && just check`
Expected: the `##` list is exactly `Install`, `Usage`, `Layout`, `Documentation`, `License`; the two `###` lines sit between `## Usage` and `## Layout`; each package guide matches once; `just check` exits 0.

- [ ] **Step 5: Commit**

```bash
git add README.md python/README.md ts/README.md
git commit -m "docs: describe the model, its consumers and its boundary in the README"
```

### Task 3: AGENTS.md vocabulary and boundary rules

**Files:**
- Modify: `AGENTS.md` — append two bullets to `## Rules`, after the bullet ending "Kinds are name + facets + invariants, never subclasses."

**Interfaces:**
- Consumes: the block names from Task 1 and the heading `### The model` from Task 2.

- [ ] **Step 1: Append the two rules**

```markdown
- Vocabulary: a **shape** is how members hang together (`set`, `list`, `dict`, `graph`,
  `dag`, `tree`); a **facet** is a named, typed payload (the domain mix-in); a **kind**
  composes facets and invariants under a name; a **structure** is a node whose kind
  adopts a shape. "Subclass" and "inherits" never describe a kind. The README's
  "The model" subsection is the reader's version of this list.
- Boundary: an external identifier (a CURIE, a DOI, a vocabulary term) is an opaque
  string inside a facet. The kernel never resolves, fetches or interprets one; a
  resolver is a downstream concern, and no kernel code path may branch on its content.
```

- [ ] **Step 2: Check**

Run: `just check`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): fix the model vocabulary and the external-identifier boundary"
```
