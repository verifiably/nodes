# @nodes-dev/core (TypeScript)

TypeScript implementation of Nodes core — behavioral and on-disk-format parity with
the Python distribution. Core contains the domain-free kernel.

## Scope

Mirrors the current Python kernel: `Node`/`Relation`, ids, errors, frontmatter
parse/serialize, registry, structural shapes, a slimmed `Store` (pure file mechanics),
the in-memory structural `Index`, and the `Corpus` coordinator — the primary API for
mutations (`add`/`get`/`rename`/`delete`), graph queries
(`outbound`/`inbound`/`neighbors`), membership queries (`members`/`containers`), BM25F
full-text `search`, opt-in
embedding `similar`/`queryVector`/`similarText`, snapshot persistence (`flushIndex`),
and corpus checking (`check`). TS-only conveniences (tier 3): `idsByKind`/`allByKind`
and corpus stat fingerprints.

The portable contract this kernel implements is specified in `../docs/STANDARD.md`
(spec version 1.2); parity with Python is pinned by the shared `../fixtures/` oracles.

## Conventions

- **camelCase API, snake_case on disk.** The on-disk YAML format is identical to Python's; the only
  field that differs API-vs-disk is `deprecatedIds` (API) ↔ `deprecated_ids` (file).
- Dates are `YYYY-MM-DD` strings (never JS `Date`), validated by Zod.
- Validation failures surface as the kernel error hierarchy (`ValidationError`, `FacetError`, …),
  never raw Zod errors.

## Scripts

The repository front door is `just` (`just test`, `just check`, `just gate`), which runs
these through a timing wrapper; call them directly only when working on this package
alone without the wrapper.

- `npm test` — Vitest suite (includes the cross-language parity checks)
- `npm run typecheck` — `tsc --noEmit` (the type gate)
- `npm run check` — Biome lint + format
