# nodes

A problem-agnostic knowledge substrate: entities as markdown files ("nodes"), typed
relations, structural shapes (set/list/dict/graph/DAG/tree), and rebuildable derived
indexes (structural, full-text, similarity) — implemented in Python and TypeScript over
one shared on-disk format.

## Architecture

Two layers, strict downward dependency:

```
domain profiles   beliefs (Python), mindful v6 (TypeScript), …
kernel            Node, Relation, shapes, identity, format, Corpus, indexes
```

The kernel is domain-free (zero named knowledge kinds); domain profiles register
their own kinds onto the kernel's registry and live in downstream repos.

## Repo layout

| Path | Contents |
|------|----------|
| `docs/STANDARD.md` | **The authority** — the versioned, normative portable contract. |
| `docs/designs/`, `docs/plans/` | Dated historical records (rationale, not authority). |
| `python/` | Python core distribution (`verifiably-nodes`); imports are `nodes.core`. |
| `ts/` | TypeScript core package (`@verifiably/nodes`), the domain-free kernel. |
| `fixtures/` | Shared cross-language conformance oracles. |

## The standard

`docs/STANDARD.md` defines what both languages must agree on, in three tiers: the
portable data contract (tier 1), oracle-pinned behavior (tier 2), and per-language
surface with no parity obligation (tier 3). When any document here disagrees with the
standard, the standard wins.

## Development

One front door for both packages, from anywhere in the tree:

```sh
just test    # pytest and vitest
just check   # ruff, pyright, tsc, biome, tasks check
just gate    # both, and what the pre-push hook runs
```

Each recipe runs through `tools/tt`, a timing wrapper that records the run; the recipes
in `justfile` show the underlying commands. Install the git hooks in a fresh clone with
`git config core.hooksPath .githooks`.

## Consumers

- **mindful v6** (`~/d/mindful/v6/`) — tool-for-thought, builds on the TypeScript kernel.
- **beliefs** (`~/d/beliefs/`) — epistemic kernel and research knowledge graphs, builds on the Python kernel.
