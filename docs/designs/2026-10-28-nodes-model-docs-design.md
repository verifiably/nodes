# Nodes model documentation — design

- **Date:** 2026-10-28
- **Status:** Accepted (spec round 1, 2026-10-28; two minor wording corrections applied)
- **Task:** nodes-24226f
- **Scope:** Documentation only. No kernel, standard, fixture or package change.

## 1. Intent

A reader of the nodes guides today learns the install line and the `Corpus` API, but
not the model the kernel implements, who builds on it, or where the kernel stops. The
2022–2023 sketches of this system ("structure + domain building blocks") describe the
model that shipped, under other names: a **shape** (how members hang together), **facets**
(domain mix-ins), composed into a **kind**; a kind is never a subclass. Nothing in the
tree says this in one place, and the consumer map the README once carried was dropped
when the family README template was adopted (commit 629ecd0).

This change makes the model legible from the guides, so that every verifiably project
can use the same mental model and every reader can tell what belongs in nodes and what
belongs above or beside it.

## 2. Goals, non-goals, anti-goals

Goals:

- A reader of `README.md` can answer, without opening the standard: what the building
  blocks are and what each is called in the kernel; who builds on nodes and in which
  language; whether nodes needs atoms; what nodes deliberately does not do and where
  that lives instead.
- `AGENTS.md` fixes the vocabulary agents use in this tree and states the boundary rule
  for external identifiers.
- The package guides point at the model rather than restating it.

Non-goals:

- No change to `docs/STANDARD.md`: it stays the authority and the detail.
- No reference layer, no cross-corpus index, no new facet. The separate `refs` project
  and the verifiably overview update are filed as follow-ups after this spec is
  approved, not built here.
- No reproduction of the 2022–2023 diagrams: they live outside the repository.

Anti-goals (a failure even if it reads well):

- A second normative document that can drift from the standard.
- Host paths or machine-specific locations in the consumer map.
- A README section that `tools/ops-docs check` refuses.

## 3. Constraints

- The README follows the family template in `tools/family.toml`: lead (purpose,
  abstract) then `Install`, `Usage`, `Layout`, `Documentation`, `License`. An extra `##`
  section is accepted only after `License` (probed: `ops-docs check` reports "Model must
  come after License"); `###` subsections under `Usage` pass the check (probed).
- The identity region of both guides is generated from `identity.toml`; wording there
  changes through that file and `just docs`.
- Consumers are named by project, never by path.
- Authority order from `AGENTS.md` holds: where the new text and the standard disagree,
  the standard wins and the text is wrong.

## 4. Approaches

**A. Model and consumers as `###` subsections of `Usage`, plus `identity.toml`,
`AGENTS.md` and package-guide pointers.** (Picked.) Stays inside the template, keeps one
authority, puts the explanation where the first code sample already is.

**B. A `docs/MODEL.md` reference document linked from `Documentation`.** Rejected: a
reference document named for its subject is the repository convention, but this one
would restate the standard's §2, §5 and §6 in friendlier words and become a second
place for the model to drift. If the Usage subsections grow past a screen, revisit.

**C. Change the family template to admit a `Model` section.** Rejected for now: a
cross-project change in the family home for one heading's benefit; A achieves the
same with `###`.

## 5. What changes

`identity.toml` (rendered into both guides): the abstract gains one sentence naming
the three blocks and the rule that kinds compose facets rather than subclass, and its
consumer sentence names beliefs, mindful v6 and lit.

`README.md`, under `Usage`:

- `### The model`: a short table mapping the plain words to the kernel terms with one
  consumer example each: shape → the six built-in shapes (`set`, `list`, `dict`,
  `graph`, `dag`, `tree`), a kind adopts at most one; facet → named typed payload, the
  domain mix-in; kind → name + facets + invariants, registered on a `Registry`, never a
  subclass; structure → a node of a shaped kind. Then "what nodes does not do", one line
  each with where it lives: meaning and verification of claims (beliefs); durability and
  crash safety (atoms, pluggable as a durable executor; nodes depends on atoms in neither
  language); resolving external identifiers (they are opaque strings in facets and stay
  opaque to nodes; a downstream resolver, the planned reference layer, interprets them).
- `### Consumers`: beliefs (Python; science's claims, runs, datasets and coordination
  kinds, with atoms as its executor), mindful v6 (TypeScript; `thought`, `mindmap`,
  `journal`, `set`; no atoms), lit (Python; `paper` with `paperpile` and `world`
  facets), science (Python; primarily through beliefs, with some direct nodes API use).
  One line each, by project name.

`AGENTS.md`, under `Rules`:

- Vocabulary: shape, kind, facet, structure as defined above; "subclass" and
  "inherits" never describe a kind.
- Boundary: an external identifier (a CURIE, a DOI, a vocabulary term) is an opaque
  string inside a facet; the kernel never resolves, fetches or interprets one, and a
  resolver is a downstream concern.

`python/README.md`, `ts/README.md`: one sentence after the opening paragraph pointing
at the root README's model and consumer subsections.

## 6. Left to the builder

Exact wording and table layout; whether the "does not do" list is prose or a table;
the order of the two subsections. Keep the whole addition under one screen in the
README and three bullets in `AGENTS.md`.

## 7. Verification

- `just check` passes (`ops-docs check`, `tasks check`, linters), and `just gate` at
  the hook.
- Reader check against the goals in §2: each question is answerable from `README.md`
  alone, and the model text names nothing the standard contradicts (read §2, §5, §6
  side by side before committing).

## 8. Follow-ups filed after approval

- ops: a `refs` project below the profiles for external references (vocabularies
  pinned to releases, external or self-issued), with nodes unchanged.
- vdocs: the overview's layering and vision paragraph once `refs` exists.
