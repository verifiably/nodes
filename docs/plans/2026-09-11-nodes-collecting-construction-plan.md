# Collecting construction implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** ready for review; implementation has not started.
**Goal:** Construct a corpus over damaged files under `mode="collecting"`, reporting parse, placement and identity failures as findings, while strict construction (the default) refuses the same tree, and both kernels share one parse floor.
**Architecture:** Both kernels parse documents through a strict boundary (`node_from_bytes` / `nodeFromBytes`) that raises only the kernel `ValidationError`. `Corpus` classifies every walked file — parse, placement, uid grouping, id grouping — through one admission path used by cold build and reconciliation; strict raises at the first failure, collecting excludes the claimants and records path-anchored findings, reserved uids and reserved ids that mutation honors. `check()` folds construction findings in; `all()` iterates the manifest in code-point order. Snapshot schema versions bump so pre-B caches rebuild cold.
**Tech Stack:** Python 3.11+, Pydantic, PyYAML, pytest; TypeScript, Zod, `yaml`, Vitest; `just` recipes; shared JSON fixtures.
**Spec:** `.worktrees/nodes-2.0/docs/designs/2026-09-11-nodes-collecting-construction-design.md`.
**Baseline:** `312f3bc` on `nodes-2.0`; A and C are implemented at ancestors `22e3a2a` and `645c9dd`.

## Global Constraints

- Work in `.worktrees/nodes-2.0` on branch `nodes-2.0`; every path below is relative to the main checkout. Run commands from the worktree root unless a block says otherwise.
- Implement both languages. Tier 1/2 code, tests, fixtures and STANDARD land in **one B implementation commit**. Tasks 1–3 close in the working tree; Task 4 commits after review and gate. Do not commit intermediate code without its normative amendment.
- Keep STANDARD's `1.2` header and pending line; mark edited clauses `*(2.0)*`. E owns the version bump and marker removal.
- A content failure is exactly the kernel `ValidationError` raised by decoding and parsing one document; no other exception class is ever caught into a finding. Filesystem failures (`OSError`, `ContainmentError`) propagate in both modes.
- Findings from construction: `parse-error` (detail `""`), `path-mismatch` (detail = mapped path), `uid-collision` (detail = uid), `id-collision` (detail = contested id); all `severity: "error"`, `ref` = literal root-relative path, one per `(path, detail)`. Messages are human-only.
- Every mapping key in frontmatter, at any depth, is a string; a non-string key is malformed in both kernels. A cyclic alias is malformed; non-cyclic alias reuse is legal. `null` for a named optional top-level field (`related`, `relations`, `deprecated_ids`, `facets`, `created`, `updated`, `version`) is malformed — only absence defaults; values inside facet and relation-`attrs` payloads are unconstrained, and a relation's `weight` may be `null`.
- A file's identity claims are deduplicated (live id plus deprecated ids, first occurrence kept) before grouping; a document repeating a deprecated id never contests itself.
- Grouping completes before exclusion within each identity stage. Uid-stage claimants reserve uids; id-stage claimants reserve uids and their live and deprecated ids. Uid and id reservations are separate namespaces. Parse-failed and misplaced files reserve nothing.
- Snapshot schema versions: Python `2 → 3`, TypeScript `1 → 2`. Nothing about exclusion is persisted.
- Inner loop: `just test-fast`; it can stop after Python fails, so rerun after a Python fix to expose TS failures. Each task ends with `just gate`.
- Only task CLI mutations. `tasks start` the child before editing; `tasks done` after its gate. Task ids: Task 1 `nodes-558de1`, Task 2 `nodes-0ecf2e`, Task 3 `nodes-775188`, Task 4 `nodes-c1c23d`. Parent `nodes-c7b371`.

## File responsibilities

| Files (beneath `.worktrees/nodes-2.0/`) | Responsibility |
| --- | --- |
| `python/src/nodes/core/frontmatter.py`, `ts/src/frontmatter.ts` | The parse floor: fatal decoding, shape and type validation, `ValidationError` only |
| `python/src/nodes/core/store.py`, `ts/src/store.ts` | Read documents through the parse floor |
| `python/src/nodes/core/errors.py`, `ts/src/errors.ts`, `ts/src/index.ts` | `PlacementError`; TS exports |
| `python/src/nodes/core/snapshot.py`, `ts/src/snapshot.ts` | Schema version bump |
| `python/src/nodes/core/corpus.py`, `ts/src/corpus.ts` | Mode flag, admission, exclusion, reservations, `check()` folding, manifest-ordered `all()`, mutation refusals |
| `fixtures/frontmatter.malformed.json` | Cross-language parse-floor oracle |
| `fixtures/damaged-corpus/`, `fixtures/damaged.oracle.json` | Committed damaged tree and its collecting/strict oracle |
| `python/tests/test_frontmatter.py`, `ts/tests/frontmatter.test.ts` | Parse-floor cases |
| `python/tests/test_corpus_construction.py`, `ts/tests/corpus-construction.test.ts` | Strict placement refusal, migration, ordering |
| `python/tests/test_damaged_parity.py`, `ts/tests/damaged-parity.test.ts` | Collecting-mode parity harness |
| `docs/STANDARD.md`, umbrella and C/B designs | Normative amendment and status |

### Task 1: One parse floor in both kernels

**Files:**
- Modify: `.worktrees/nodes-2.0/python/src/nodes/core/frontmatter.py`, `store.py`, `corpus.py` (decode call sites only).
- Modify: `.worktrees/nodes-2.0/ts/src/frontmatter.ts`, `store.ts`, `corpus.ts` (decode call sites only), `index.ts` (export).
- Create: `.worktrees/nodes-2.0/fixtures/frontmatter.malformed.json`.
- Test: `.worktrees/nodes-2.0/python/tests/test_frontmatter.py`, `.worktrees/nodes-2.0/ts/tests/frontmatter.test.ts`.

**Interfaces:**
- Produces: `node_from_bytes(data: bytes) -> Node` / `nodeFromBytes(data: Uint8Array): Node` — decode UTF-8 fatally (BOM preserved), then `node_from_markdown`. Every failure raises the kernel `ValidationError`.
- `node_from_markdown` / `nodeFromMarkdown` keep their signatures; `split_frontmatter` / `splitFrontmatter` now raise `ValidationError` on invalid YAML or a non-mapping document instead of leaking.
- Later tasks call only `node_from_bytes` / `nodeFromBytes` from construction and the store.

- [ ] **Step 0: Start.** `tasks start nodes-558de1`.

- [ ] **Step 1: Write the shared oracle.** Texts are JSON strings; `﻿` is the BOM. The invalid-byte case cannot be a JSON string and lives in Task 3's damaged corpus.

```json
{
  "rejected": [
    "﻿---\nid: k:a\nuid: u\nkind: k\ntitle: T\n---\n",
    "---\nscalar\n---\n",
    "---\n- a\n---\n",
    "---\nid: [\n---\n",
    "---\nid: 5\nuid: u\nkind: k\ntitle: T\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: [1]\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nrelated: abc\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nrelated:\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nrelations: [null]\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nrelations: [3]\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\ndeprecated_ids: x\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nfacets: [1]\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nfacets:\n  f: 1\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nversion: \"2\"\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nversion: true\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\ncreated: 2026-13-01\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\ncreated: 2026-01-01T00:00:00\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nrelations:\n- predicate: p\n  target: k:b\n  weight: \"1\"\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nrelations:\n- predicate: p\n  target: k:b\n  directed: \"false\"\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nrelations:\n- predicate: p\n  target: k:b\n  attrs: 1\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\ncreated: 2026-02-30\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nrelations:\n- predicate: p\n  target: k:b\n  attrs:\n    1: x\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nfacets:\n  f:\n    1: x\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\n1: x\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nfacets: *missing\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nfacets:\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\ncreated:\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nupdated:\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nfacets:\n  f: &loop\n    self: *loop\n---\n",
    "---\n__proto__:\n  id: k:a\n  uid: u\n  kind: k\n  title: T\n---\n"
  ],
  "accepted": [
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\n---\nbody\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nrelated: []\nrelations: []\ndeprecated_ids: []\nfacets: {}\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nrelations:\n- predicate: cites\n  target: k:b\n  directed: false\n  weight: 0.5\n  attrs:\n    x: 1\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\ncreated: 2026-01-01\nupdated: \"2026-02-28\"\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nversion: 2\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\ndeprecated_ids:\n- k:old\n- k:old\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nfacets:\n  f: &shared\n    x: 1\n  g: *shared\n---\n",
    "---\nid: k:a\nuid: u\nkind: k\ntitle: T\nrelations:\n- predicate: p\n  target: k:b\n  weight: null\n  attrs:\n    n: null\n---\n"
  ]
}
```

- [ ] **Step 2: Write the failing tests.** Append to `python/tests/test_frontmatter.py` (add `import json` and `from pathlib import Path`; add `node_from_bytes` to the frontmatter import; add `from nodes.core.projection import to_canonical`):

```python
MALFORMED = json.loads((Path(__file__).parents[2] / "fixtures/frontmatter.malformed.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("text", MALFORMED["rejected"], ids=lambda t: t.replace("\n", "|")[:48])
def test_malformed_frontmatter_is_a_kernel_validation_error(text):
    with pytest.raises(ValidationError):
        node_from_markdown(text)


@pytest.mark.parametrize("text", MALFORMED["accepted"], ids=lambda t: t.replace("\n", "|")[:48])
def test_wellformed_frontmatter_round_trips(text):
    node = node_from_markdown(text)
    assert to_canonical(node_from_markdown(node_to_markdown(node))) == to_canonical(node)


def test_unquoted_and_quoted_dates_parse_identically():
    a = node_from_markdown("---\nid: k:a\nuid: u\nkind: k\ntitle: T\ncreated: 2026-01-01\n---\n")
    b = node_from_markdown('---\nid: k:a\nuid: u\nkind: k\ntitle: T\ncreated: "2026-01-01"\n---\n')
    assert to_canonical(a) == to_canonical(b)


def test_invalid_utf8_is_a_validation_error_and_bom_is_preserved():
    with pytest.raises(ValidationError):
        node_from_bytes(b"---\nid: k:a\nuid: u\nkind: k\ntitle: T\n---\n\xff")
    with pytest.raises(ValidationError):
        node_from_bytes("﻿---\nid: k:a\nuid: u\nkind: k\ntitle: T\n---\n".encode("utf-8"))
    assert node_from_bytes(b"---\nid: k:a\nuid: u\nkind: k\ntitle: T\n---\n").id == "k:a"
```

Append to `ts/tests/frontmatter.test.ts` (add `readFileSync` from `node:fs`, `fileURLToPath` from `node:url`, `nodeFromBytes` to the frontmatter import, and `import { toCanonical } from "../src/projection.js";`):

```typescript
const malformed = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/frontmatter.malformed.json", import.meta.url)), "utf-8"),
) as { rejected: string[]; accepted: string[] };

for (const text of malformed.rejected) {
  it(`rejects ${JSON.stringify(text.slice(0, 48))} with ValidationError`, () => {
    expect(() => nodeFromMarkdown(text)).toThrow(ValidationError);
  });
}
for (const text of malformed.accepted) {
  it(`round-trips ${JSON.stringify(text.slice(0, 48))}`, () => {
    const node = nodeFromMarkdown(text);
    expect(toCanonical(nodeFromMarkdown(nodeToMarkdown(node)))).toEqual(toCanonical(node));
  });
}
it("parses unquoted and quoted dates identically", () => {
  const a = nodeFromMarkdown("---\nid: k:a\nuid: u\nkind: k\ntitle: T\ncreated: 2026-01-01\n---\n");
  const b = nodeFromMarkdown('---\nid: k:a\nuid: u\nkind: k\ntitle: T\ncreated: "2026-01-01"\n---\n');
  expect(toCanonical(a)).toEqual(toCanonical(b));
});
it("treats invalid UTF-8 as a ValidationError and preserves a BOM", () => {
  const valid = Buffer.from("---\nid: k:a\nuid: u\nkind: k\ntitle: T\n---\n", "utf-8");
  expect(() => nodeFromBytes(Buffer.concat([valid, Buffer.from([0xff])]))).toThrow(ValidationError);
  expect(() => nodeFromBytes(Buffer.from("﻿---\nid: k:a\nuid: u\nkind: k\ntitle: T\n---\n", "utf-8"))).toThrow(
    ValidationError,
  );
  expect(nodeFromBytes(valid).id).toBe("k:a");
});
```

- [ ] **Step 3: Run `just test-fast`.** Expected: Python red on `related: abc`, `related:` (null), `version: "2"`, `version: true`, `directed: "false"`, `weight: "1"`, bad YAML (`yaml.parser.ParserError`, not `ValidationError`), `title: [1]` (pydantic's error), `relations: [3]` (`AttributeError`), `created: 2026-02-30` (`ValueError` from inside `yaml.safe_load`), `attrs:\n    1: x` (raw pydantic error from `Relation(...)`), and `node_from_bytes` missing. TS red on scalar frontmatter and `relations: [null]` / `[3]` (raw `TypeError`), `facets:\n  f: 1`, `facets: *missing` (`ReferenceError` from `toJS`), `facets:` / `created:` / `updated:` null (accepted), numeric mapping keys (accepted as strings), the cyclic alias (`RangeError` in TS, `RecursionError` in Python), the `__proto__` document (accepted through the prototype in TS), and `nodeFromBytes` missing.

- [ ] **Step 4: Replace Python's parser.** In `frontmatter.py`, replace `split_frontmatter` and `node_from_markdown` with the following and add `node_from_bytes`. New imports: `import re`, `from datetime import date, datetime`, `from pydantic import ValidationError as PydanticValidationError`.

```python
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _malformed(message: str) -> ValidationError:
    return ValidationError(f"malformed frontmatter: {message}")


def split_frontmatter(text: str) -> tuple[dict, str]:
    """Split a document into its frontmatter mapping and body. A document without a
    frontmatter block yields `{}`; invalid YAML or a non-mapping block is malformed."""
    if text.startswith("---\r\n"):
        nl = "\r\n"
    elif text.startswith("---\n"):
        nl = "\n"
    else:
        return {}, text
    rest = text[len("---") + len(nl):]
    sep = f"{nl}---{nl}"
    idx = rest.find(sep)
    if idx == -1:
        return {}, text
    try:
        # PyYAML's timestamp constructor raises a bare ValueError for an impossible date.
        fm = yaml.safe_load(rest[:idx])
    except (yaml.YAMLError, ValueError) as exc:
        raise ValidationError(f"invalid frontmatter YAML: {exc}") from exc
    if fm is None:
        fm = {}
    if not isinstance(fm, dict):
        raise _malformed("frontmatter must be a mapping")
    _require_string_keys(fm)
    return fm, rest[idx + len(sep):]


def _require_string_keys(value: object, path: set[int] | None = None) -> None:
    """Every mapping key at any depth is a string; YAML admits other scalars, the
    boundary does not (TypeScript's object keys would silently stringify them). A
    cyclic alias is malformed; `path` holds the ids of the containers being walked,
    so a container reused on a sibling branch (a shared alias) is legal."""
    if not isinstance(value, (dict, list)):
        return
    path = path if path is not None else set()
    if id(value) in path:
        raise _malformed("frontmatter contains a cyclic alias")
    path.add(id(value))
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise _malformed(f"mapping key {key!r} must be a string")
            _require_string_keys(item, path)
    else:
        for item in value:
            _require_string_keys(item, path)
    path.remove(id(value))


def _require_str(fm: dict, name: str) -> str:
    value = fm.get(name)
    if not isinstance(value, str):
        raise _malformed(f"{name!r} must be a string")
    return value


def _optional_list(fm: dict, name: str, element: type, label: str) -> list:
    if name not in fm:
        return []
    value = fm[name]
    if not isinstance(value, list):
        raise _malformed(f"{name!r} must be a list")
    for item in value:
        if not isinstance(item, element):
            raise _malformed(f"{name!r} entries must be {label}")
    return value


def _date_field(name: str, value: object) -> date:
    # The one conversion at the boundary: YAML's unquoted date scalar or the ISO string.
    if isinstance(value, datetime):
        raise _malformed(f"{name!r} must be a calendar date, not a timestamp")
    if isinstance(value, date):
        return value
    if isinstance(value, str) and _DATE_RE.match(value):
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise _malformed(f"{name!r} is not a real calendar date") from exc
    raise _malformed(f"{name!r} must be a YYYY-MM-DD date")


def _relation_from_row(row: dict, container_id: str) -> Relation:
    source = row.get("source", container_id)
    predicate = row.get("predicate")
    target = row.get("target")
    for name, value in (("source", source), ("predicate", predicate), ("target", target)):
        if not isinstance(value, str):
            raise _malformed(f"relation {name!r} must be a string")
    directed = row.get("directed", True)
    if not isinstance(directed, bool):
        raise _malformed("relation 'directed' must be a boolean")
    weight = row.get("weight")
    if weight is not None and (isinstance(weight, bool) or not isinstance(weight, (int, float))):
        raise _malformed("relation 'weight' must be a number or null")
    attrs = row.get("attrs", {})
    if not isinstance(attrs, dict):
        raise _malformed("relation 'attrs' must be a mapping")
    try:
        return Relation(source=source, predicate=predicate, target=target, directed=directed, weight=weight, attrs=attrs)
    except PydanticValidationError as exc:
        raise _malformed(f"relation: {exc.errors()[0]['msg']}") from exc


def node_from_markdown(text: str) -> Node:
    """The boundary parser. Every malformed input leaves as the kernel `ValidationError`;
    types are exact — nothing is coerced."""
    fm, body = split_frontmatter(text)
    missing = [k for k in ("id", "uid", "kind", "title") if k not in fm]
    if missing:
        raise ValidationError(f"frontmatter missing required field(s): {missing}")
    node_id = _require_str(fm, "id")
    relations = [relates_to(node_id, ref) for ref in _optional_list(fm, "related", str, "strings")]
    relations += [_relation_from_row(row, node_id) for row in _optional_list(fm, "relations", dict, "mappings")]
    facets = fm["facets"] if "facets" in fm else {}  # absence defaults; null does not
    if not isinstance(facets, dict) or any(not isinstance(v, dict) for v in facets.values()):
        raise _malformed("'facets' must be a mapping of mappings")
    meta: dict[str, Any] = {}
    for name in ("created", "updated"):
        if name in fm:
            meta[name] = _date_field(name, fm[name])
    if "version" in fm:
        version = fm["version"]
        if isinstance(version, bool) or not isinstance(version, int):
            raise _malformed("'version' must be an integer")
        meta["version"] = version
    try:
        return Node(
            id=node_id,
            uid=_require_str(fm, "uid"),
            kind=_require_str(fm, "kind"),
            title=_require_str(fm, "title"),
            body=body,
            metadata=NodeMetadata(**meta),
            relations=relations,
            facets=facets,
            deprecated_ids=_optional_list(fm, "deprecated_ids", str, "strings"),
        )
    except PydanticValidationError as exc:
        raise _malformed(exc.errors()[0]["msg"]) from exc


def node_from_bytes(data: bytes) -> Node:
    """Decode fatally, BOM preserved, then parse. A document begins with `---` at byte zero."""
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValidationError(f"document is not valid UTF-8: {exc}") from exc
    return node_from_markdown(text)
```

`Relation.from_serialized` stays for in-code callers; the boundary no longer uses it. Route the three Python decode sites through `node_from_bytes`: `store.py` `read_file` (`node_from_bytes(path.read_bytes())`) and `all_nodes` (`node_from_bytes(f.data)`), and `corpus.py`'s two `node_from_markdown(f.data.decode("utf-8"))` calls in `_full_rebuild` and `_reconcile`; update each module's import.

- [ ] **Step 5: Tighten TypeScript's parser.** In `frontmatter.ts`, replace the two lines from `const fm = (doc.toJS() ?? {}) ...` through the `return` with:

```typescript
  let raw: unknown;
  try {
    // mapAsMap keeps key scalars typed, so a numeric key is visible; toJS also resolves
    // aliases and throws a raw ReferenceError on an undefined one — a document error.
    raw = doc.toJS({ mapAsMap: true });
  } catch (e) {
    throw new ValidationError(`invalid frontmatter YAML: ${(e as Error).message}`);
  }
  const fm = raw === null || raw === undefined ? {} : plain(raw);
  if (!isMapping(fm)) throw new ValidationError("malformed frontmatter: frontmatter must be a mapping");
  return [fm, rest.slice(idx + sep.length)];
```

and add this walker above `splitFrontmatter` (it needs `isMapping`, defined below it in this same task — move the two `is*` helpers above `splitFrontmatter`):

```typescript
/** Convert the typed-key tree to plain objects, refusing any non-string mapping key at
 * any depth (Python refuses the same; object keys would otherwise stringify silently)
 * and any cyclic alias. `path` holds the containers being walked, so a container
 * reused on a sibling branch (a shared alias) is legal. Objects are built through
 * `Object.fromEntries`, which defines own properties only — an assignment would let a
 * `__proto__` key reach the prototype setter. */
function plain(value: unknown, path: Set<object> = new Set()): unknown {
  if (!(value instanceof Map) && !Array.isArray(value)) return value;
  if (path.has(value)) throw new ValidationError("malformed frontmatter: frontmatter contains a cyclic alias");
  path.add(value);
  let out: unknown;
  if (value instanceof Map) {
    const entries: Array<[string, unknown]> = [];
    for (const [key, item] of value) {
      if (typeof key !== "string") {
        throw new ValidationError(`malformed frontmatter: mapping key ${JSON.stringify(key)} must be a string`);
      }
      entries.push([key, plain(item, path)]);
    }
    out = Object.fromEntries(entries);
  } else {
    out = value.map((item) => plain(item, path));
  }
  path.delete(value);
  return out;
}
```

Replace the body of `nodeFromMarkdown` from the `missing` check down to the `return makeNode(...)` with:

```typescript
  const missing = (["id", "uid", "kind", "title"] as const).filter((k) => !(k in fm));
  if (missing.length > 0) {
    throw new ValidationError(`frontmatter missing required field(s): ${JSON.stringify(missing)}`);
  }
  const nodeId = requireString(fm, "id");
  const relations: Relation[] = optionalList(fm, "related", isString, "strings").map((ref) => relatesTo(nodeId, ref));
  try {
    for (const row of optionalList(fm, "relations", isMapping, "mappings")) relations.push(fromSerialized(row, nodeId));
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new ValidationError(
        `malformed frontmatter: invalid relation in ${JSON.stringify(nodeId)}: ${e.issues.map((i) => i.message).join("; ")}`,
      );
    }
    throw e;
  }
  const facets = "facets" in fm ? fm.facets : {}; // absence defaults; null does not
  if (!isMapping(facets) || Object.values(facets).some((v) => !isMapping(v))) {
    throw new ValidationError("malformed frontmatter: 'facets' must be a mapping of mappings");
  }
  const metadata: Record<string, unknown> = {};
  for (const k of ["created", "updated"] as const) {
    if (!(k in fm)) continue;
    if (fm[k] === null) throw new ValidationError(`malformed frontmatter: '${k}' must be a YYYY-MM-DD date`);
    metadata[k] = fm[k];
  }
  if ("version" in fm) {
    if (typeof fm.version !== "number" || !Number.isInteger(fm.version)) {
      throw new ValidationError("malformed frontmatter: 'version' must be an integer");
    }
    metadata.version = fm.version;
  }
  return makeNode({
    id: nodeId,
    uid: requireString(fm, "uid"),
    kind: requireString(fm, "kind"),
    title: requireString(fm, "title"),
    body,
    metadata,
    relations,
    facets: facets as Record<string, Record<string, unknown>>,
    deprecatedIds: optionalList(fm, "deprecated_ids", isString, "strings"),
  });
```

Add these module-level helpers above `nodeFromMarkdown`, and `nodeFromBytes` after it:

```typescript
const isString = (v: unknown): v is string => typeof v === "string";
const isMapping = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function requireString(fm: Record<string, unknown>, name: string): string {
  const value = fm[name];
  if (typeof value !== "string") throw new ValidationError(`malformed frontmatter: '${name}' must be a string`);
  return value;
}

function optionalList<T>(
  fm: Record<string, unknown>,
  name: string,
  check: (v: unknown) => v is T,
  label: string,
): T[] {
  if (!(name in fm)) return [];
  const value = fm[name];
  if (!Array.isArray(value)) throw new ValidationError(`malformed frontmatter: '${name}' must be a list`);
  for (const item of value) {
    if (!check(item)) throw new ValidationError(`malformed frontmatter: '${name}' entries must be ${label}`);
  }
  return value as T[];
}

// Fatal on invalid UTF-8; the BOM is preserved so a BOM-prefixed document fails the
// `---`-at-byte-zero rule exactly as it does in Python.
const DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

export function nodeFromBytes(data: Uint8Array): Node {
  let text: string;
  try {
    text = DECODER.decode(data);
  } catch (e) {
    throw new ValidationError(`document is not valid UTF-8: ${(e as Error).message}`);
  }
  return nodeFromMarkdown(text);
}
```

`created` / `updated` keep flowing into `makeNode`, whose `dateStr` schema already rejects a non-string, a timestamp, and an impossible date; `makeNode` wraps the Zod error. Route the three TS decode sites through `nodeFromBytes`: `store.ts` `load` (`nodeFromBytes(data)`), and `corpus.ts`'s two `nodeFromMarkdown(f.data.toString("utf-8"))` calls; update imports. Add `nodeFromBytes` to `index.ts`'s frontmatter export block.

- [ ] **Step 6: Run `just test-fast`, then `just gate`.** All new cases green in both languages. `test_check_parity.py` / `check_parity.test.ts` must still pass: the committed `check-corpus` has no document the tightened floor rejects. Run `tasks done nodes-558de1 "Task 1 verified; held for the single B implementation commit"`; leave changes uncommitted.

### Task 2: Strict tightenings — placement refusal, snapshot bump, manifest-ordered reads

**Files:**
- Modify: `.worktrees/nodes-2.0/python/src/nodes/core/errors.py`, `snapshot.py`, `corpus.py`.
- Modify: `.worktrees/nodes-2.0/ts/src/errors.ts`, `snapshot.ts`, `corpus.ts`, `index.ts`.
- Modify: `.worktrees/nodes-2.0/python/tests/test_snapshot_io.py`, `.worktrees/nodes-2.0/ts/tests/snapshot-io.test.ts` (version constants).
- Create: `.worktrees/nodes-2.0/python/tests/test_corpus_construction.py`, `.worktrees/nodes-2.0/ts/tests/corpus-construction.test.ts`.

**Interfaces:**
- Produces: `PlacementError(NodesError)` in both kernels, exported from the TS package index.
- Produces: `Corpus._parse_member(f: CorpusFile) -> Node` / `private parseMember(f: CorpusFile): Node` — parse then placement, raising `ValidationError` / `PlacementError`. Task 3 extends it with mode dispatch.
- Produces: `all()` ordered by manifest path in code-point order; registry-backed `check()` iterates `all()`.
- `SNAPSHOT_SCHEMA_VERSION` is `3` (Python) and `2` (TypeScript).

- [ ] **Step 0: Start.** `tasks start nodes-0ecf2e`.

- [ ] **Step 1: Write the failing tests.** Update the two constant assertions: `python/tests/test_snapshot_io.py:46` → `== 3`; `ts/tests/snapshot-io.test.ts:42` → `toBe(2)`. Create `python/tests/test_corpus_construction.py`:

```python
from __future__ import annotations

import pytest

from nodes.core.corpus import Corpus
from nodes.core.errors import PlacementError, ValidationError
from nodes.core.node import Node
from nodes.core.paths import read_json, write_json_atomic
from nodes.core.search import SearchIndex
from nodes.core.snapshot import SNAPSHOT_REL_PATH, ManifestEntry, hash_bytes, write_snapshot
from nodes.core.store import Store
from nodes.core.structural_index import Index


def _node(slug: str, uid: str, **extra) -> Node:
    fields = {"title": slug, **extra}
    return Node(id=f"topic:{slug}", uid=uid, kind="topic", **fields)


def test_strict_refuses_a_misplaced_member_cold(tmp_path):
    (tmp_path / "topic").mkdir()
    (tmp_path / "topic/wrong.md").write_bytes(b"---\nid: topic:right\nuid: r\nkind: topic\ntitle: R\n---\n")
    with pytest.raises(PlacementError):
        Corpus(tmp_path)


def test_strict_refuses_a_misplaced_member_at_reconcile(tmp_path):
    Store(tmp_path).write_file(_node("a", "a"))
    Corpus(tmp_path).flush_index()
    (tmp_path / "topic/wrong.md").write_bytes(b"---\nid: topic:right\nuid: r\nkind: topic\ntitle: R\n---\n")
    with pytest.raises(PlacementError):
        Corpus(tmp_path)


def test_pre_b_snapshot_is_discarded_and_the_corpus_rebuilds_cold(tmp_path):
    # A pre-B writer admitted this document; its snapshot must not let it through.
    good = _node("a", "a")
    Store(tmp_path).write_file(good)
    bad_bytes = b"---\nid: topic:bad\nuid: b\nkind: topic\ntitle: B\n---\n\xff"
    (tmp_path / "topic/bad.md").write_bytes(bad_bytes)
    bad = _node("bad", "b", title="B")  # what the old parser produced, minus the substitution
    manifest = [
        ManifestEntry(path="topic/a.md", sha256=hash_bytes((tmp_path / "topic/a.md").read_bytes()), uid="a"),
        ManifestEntry(path="topic/bad.md", sha256=hash_bytes(bad_bytes), uid="b"),
    ]
    write_snapshot(tmp_path, manifest, Index.build([good, bad]), SearchIndex.build([good, bad]), None)
    doc = read_json(tmp_path, SNAPSHOT_REL_PATH)
    assert isinstance(doc, dict)
    doc["version"] = 2
    write_json_atomic(tmp_path, SNAPSHOT_REL_PATH, doc)
    with pytest.raises(ValidationError):
        Corpus(tmp_path)


def test_all_follows_manifest_paths_in_codepoint_order(tmp_path):
    store = Store(tmp_path)
    store.write_file(_node("a", "a"))
    store.write_file(_node("b", "b"))
    Corpus(tmp_path).flush_index()
    store.write_file(_node("a", "a", title="changed"))  # a reconciles last; order must not follow
    c = Corpus(tmp_path)
    assert [n.id for n in c.all()] == ["topic:a", "topic:b"]
    c.add(_node("0", "zero"))
    assert [n.id for n in c.all()] == ["topic:0", "topic:a", "topic:b"]
    c.rename("topic:b", "topic:1")
    assert [n.id for n in c.all()] == ["topic:0", "topic:1", "topic:a"]
```

Create `ts/tests/corpus-construction.test.ts`:

```typescript
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { Corpus } from "../src/corpus.js";
import { PlacementError, ValidationError } from "../src/errors.js";
import { type Node, makeNode } from "../src/node.js";
import { readJson, writeJsonAtomic } from "../src/paths.js";
import { SearchIndex } from "../src/search.js";
import { SNAPSHOT_REL_PATH, hashBytes, writeSnapshot } from "../src/snapshot.js";
import { Store } from "../src/store.js";
import { Index } from "../src/structural-index.js";

function node(slug: string, uid: string, extra: Partial<Node> = {}): Node {
  return makeNode({ id: `topic:${slug}`, uid, kind: "topic", title: slug, ...extra });
}

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "nodes-construction-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const misplaced = Buffer.from("---\nid: topic:right\nuid: r\nkind: topic\ntitle: R\n---\n", "utf-8");

it("strict refuses a misplaced member cold", () => {
  mkdirSync(join(root, "topic"));
  writeFileSync(join(root, "topic/wrong.md"), misplaced);
  expect(() => new Corpus(root)).toThrow(PlacementError);
});

it("strict refuses a misplaced member at reconcile", () => {
  new Store(root).writeFile(node("a", "a"));
  new Corpus(root).flushIndex();
  writeFileSync(join(root, "topic/wrong.md"), misplaced);
  expect(() => new Corpus(root)).toThrow(PlacementError);
});

it("discards a pre-B snapshot and rebuilds cold", () => {
  const good = node("a", "a");
  new Store(root).writeFile(good);
  const badBytes = Buffer.concat([
    Buffer.from("---\nid: topic:bad\nuid: b\nkind: topic\ntitle: B\n---\n", "utf-8"),
    Buffer.from([0xff]),
  ]);
  writeFileSync(join(root, "topic/bad.md"), badBytes);
  const bad = node("bad", "b", { title: "B" });
  const manifest = [
    { path: "topic/a.md", sha256: hashBytes(readFileSync(join(root, "topic/a.md"))), uid: "a" },
    { path: "topic/bad.md", sha256: hashBytes(badBytes), uid: "b" },
  ];
  writeSnapshot(root, manifest, Index.build([good, bad]), SearchIndex.build([good, bad]), undefined);
  const doc = readJson(root, SNAPSHOT_REL_PATH) as Record<string, unknown>;
  writeJsonAtomic(root, SNAPSHOT_REL_PATH, { ...doc, version: 1 });
  expect(() => new Corpus(root)).toThrow(ValidationError);
});

it("all() follows manifest paths in code-point order", () => {
  const store = new Store(root);
  store.writeFile(node("a", "a"));
  store.writeFile(node("b", "b"));
  new Corpus(root).flushIndex();
  store.writeFile(node("a", "a", { title: "changed" }));
  const c = new Corpus(root);
  expect(c.all().map((n) => n.id)).toEqual(["topic:a", "topic:b"]);
  c.add(node("0", "zero"));
  expect(c.all().map((n) => n.id)).toEqual(["topic:0", "topic:a", "topic:b"]);
  c.rename("topic:b", "topic:1");
  expect(c.all().map((n) => n.id)).toEqual(["topic:0", "topic:1", "topic:a"]);
});
```

- [ ] **Step 2: Run `just test-fast`.** Expected: `PlacementError` import fails in both; version assertions fail; the migration test fails (the old-version snapshot is at the current version, so the forged entry is kept — the bypass); ordering fails after reconcile.

- [ ] **Step 3: Add `PlacementError` and bump the versions.**

```python
# errors.py, after ContainmentError
class PlacementError(NodesError):
    """A member's literal root-relative path differs from its id's mapped path."""
```

```typescript
// errors.ts, after ContainmentError
/** A member's literal root-relative path differs from its id's mapped path. */
export class PlacementError extends NodesError {}
```

Add `PlacementError` to the `index.ts` errors export block (alphabetical, after `NodesError`). Set `SNAPSHOT_SCHEMA_VERSION = 3` in `snapshot.py` and `= 2` in `snapshot.ts`.

- [ ] **Step 4: Parse-and-place through one helper; read through the manifest.** Python `corpus.py` — add the import `from nodes.core.errors import PlacementError` and `from nodes.core.paths import path_for_node_id`, add the helper, and use it in both construction paths:

```python
    def _parse_member(self, f: CorpusFile) -> Node:
        """Parse a walked file and check its placement. Raises ValidationError or PlacementError."""
        node = node_from_bytes(f.data)
        expected = path_for_node_id(node.id)
        if f.path != expected:
            raise PlacementError(f"{f.path!r} holds {node.id!r}, whose mapped path is {expected!r}")
        return node
```

In `_full_rebuild`: `node = self._parse_member(f)`. In `_reconcile`: `changed.append((f.path, f.sha256, self._parse_member(f)))`. Import `CorpusFile` from `nodes.core.snapshot`. Replace `all()` and the registry loop in `check()`:

```python
    def all(self) -> list[Node]:
        """Accepted members, ordered by manifest path in Unicode code-point order."""
        entries = sorted(self.manifest.values(), key=lambda m: m.path)
        return [self.store.read_file(self.index.by_uid[m.uid].id) for m in entries]
```

```python
        if reg is not None:
            for node in self.all():
```

TypeScript `corpus.ts` — import `PlacementError` and `type CorpusFile`; add:

```typescript
  /** Parse a walked file and check its placement. Throws ValidationError or PlacementError. */
  private parseMember(f: CorpusFile): Node {
    const node = nodeFromBytes(f.data);
    const expected = pathForNodeId(node.id);
    if (f.path !== expected) {
      throw new PlacementError(
        `${JSON.stringify(f.path)} holds ${JSON.stringify(node.id)}, whose mapped path is ${JSON.stringify(expected)}`,
      );
    }
    return node;
  }
```

Use it in `fullRebuild` (`const node = this.parseMember(f);`) and `reconcile` (`node: this.parseMember(f)`). Replace `all()` and the registry loop in `check()`:

```typescript
  /** Accepted members, ordered by manifest path in Unicode code-point order. */
  all(): Node[] {
    return [...this.manifest.values()]
      .sort((a, b) => compareCodepoints(a.path, b.path))
      .map((m) => this.store.readFile(this.idFor(m.uid)));
  }
```

```typescript
    if (reg !== undefined) {
      for (const node of this.all()) {
```

`Store.all_nodes` / `Store.allNodes` remain as store-level helpers; nothing in `Corpus` calls them after this step.

- [ ] **Step 5: Run `just test-fast`, then `just gate`.** Confirm with `rg -n 'all_nodes\(\)|allNodes\(\)' python/src ts/src` that only the store definitions remain. Run `tasks done nodes-0ecf2e "Task 2 verified; held for the single B implementation commit"`; leave changes uncommitted.

### Task 3: Collecting mode — admission, exclusion, reservations, findings, fixture

**Files:**
- Modify: `.worktrees/nodes-2.0/python/src/nodes/core/corpus.py`, `.worktrees/nodes-2.0/ts/src/corpus.ts`, `.worktrees/nodes-2.0/ts/src/index.ts` (export `ConstructionMode`).
- Create: `.worktrees/nodes-2.0/fixtures/damaged-corpus/` (nine files), `.worktrees/nodes-2.0/fixtures/damaged.oracle.json`.
- Create: `.worktrees/nodes-2.0/python/tests/test_damaged_parity.py`, `.worktrees/nodes-2.0/ts/tests/damaged-parity.test.ts`.
- Reuse: `.worktrees/nodes-2.0/python/tests/_executors.py`, `.worktrees/nodes-2.0/ts/tests/_executors.ts`.

**Interfaces:**
- Consumes: Task 1's `node_from_bytes`, Task 2's `PlacementError` and `_parse_member` / `parseMember`.
- Produces: `Corpus(root, registry=None, embedder=None, executor_factory=None, mode="strict")` with `mode: Literal["strict", "collecting"]`; TS `new Corpus(root, registry?, embedder?, executorFactory?, options?: { mode?: ConstructionMode })` with `export type ConstructionMode = "strict" | "collecting"`.
- Produces: `check()` findings with codes `parse-error`, `path-mismatch`, `uid-collision`, `id-collision`; `add` / `rename` refusals for excluded paths, reserved uids and reserved ids.
- No new public accessor: `check()` and `all()` are the surface.

- [ ] **Step 0: Start.** `tasks start nodes-775188`.

- [ ] **Step 1: Write the damaged corpus.** Create the files with this Python snippet run from the worktree root (it writes bytes so the invalid-UTF-8 member is exact):

```python
from pathlib import Path
root = Path("fixtures/damaged-corpus/topic"); root.mkdir(parents=True)
def doc(id, uid, title, extra=""):
    return f"---\nid: {id}\nuid: \"{uid}\"\nkind: topic\ntitle: {title}\n{extra}---\n".encode("utf-8")
(root / "good.md").write_bytes(doc("topic:good", "g", "Good", "related:\n- topic:garbled\n- topic:twin-a\n"))
(root / "garbled.md").write_bytes(b"---\nid: [\n---\n")
(root / "typed.md").write_bytes(b"---\nid: topic:typed\nuid: \"y\"\nkind: topic\ntitle: [1]\n---\n")
(root / "bytes.md").write_bytes(doc("topic:bytes", "b", "Bytes") + b"\xff")
(root / "moved.md").write_bytes(doc("topic:elsewhere", "m", "Moved"))
(root / "twin-a.md").write_bytes(doc("topic:twin-a", "t", "Twin A", "deprecated_ids:\n- topic:good\n"))
(root / "twin-b.md").write_bytes(doc("topic:twin-b", "t", "Twin B"))
(root / "current.md").write_bytes(doc("topic:current", "c", "Current"))
(root / "former.md").write_bytes(doc("topic:former", "f", "Former", "deprecated_ids:\n- topic:current\n"))
```

Write `fixtures/damaged.oracle.json`:

```json
{
  "findings": [
    {"severity":"error","code":"parse-error","ref":"topic/bytes.md","detail":""},
    {"severity":"error","code":"id-collision","ref":"topic/current.md","detail":"topic:current"},
    {"severity":"error","code":"id-collision","ref":"topic/former.md","detail":"topic:current"},
    {"severity":"error","code":"parse-error","ref":"topic/garbled.md","detail":""},
    {"severity":"error","code":"path-mismatch","ref":"topic/moved.md","detail":"topic/elsewhere.md"},
    {"severity":"error","code":"uid-collision","ref":"topic/twin-a.md","detail":"t"},
    {"severity":"error","code":"uid-collision","ref":"topic/twin-b.md","detail":"t"},
    {"severity":"error","code":"parse-error","ref":"topic/typed.md","detail":""},
    {"severity":"warning","code":"dangling-ref","ref":"topic:good","detail":"topic:garbled"},
    {"severity":"warning","code":"dangling-ref","ref":"topic:good","detail":"topic:twin-a"}
  ],
  "accepted": ["topic:good"],
  "strict_raises": "ValidationError",
  "subsets": [
    {"name":"misplaced","files":["topic/moved.md"],"strict_raises":"PlacementError"},
    {"name":"twins","files":["topic/twin-a.md","topic/twin-b.md"],"strict_raises":"CollisionError"},
    {"name":"contested","files":["topic/current.md","topic/former.md"],"strict_raises":"CollisionError"}
  ]
}
```

- [ ] **Step 2: Write the failing parity harness.** `python/tests/test_damaged_parity.py`:

```python
"""Collecting construction over the committed damaged corpus, and the interactions
the design pins around it (reopen stability, repair, mutation refusals, eviction)."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from nodes.core import errors
from nodes.core.corpus import Corpus
from nodes.core.errors import CollisionError, RefError, ValidationError
from nodes.core.node import Node
from nodes.core.registry import KindSpec, Registry
from nodes.core.store import Store

from tests._executors import RecordingExecutor

FIXTURES = Path(__file__).parents[2] / "fixtures"
ORACLE = json.loads((FIXTURES / "damaged.oracle.json").read_text(encoding="utf-8"))


def findings(c: Corpus) -> list[dict]:
    return [{k: getattr(f, k) for k in ("severity", "code", "ref", "detail")} for f in c.check()]


def ids(c: Corpus) -> list[str]:
    return [n.id for n in c.all()]


def damaged(tmp_path: Path, files: list[str] | None = None) -> Path:
    root = tmp_path / "damaged"
    if files is None:
        shutil.copytree(FIXTURES / "damaged-corpus", root)
    else:
        for rel in files:
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(FIXTURES / "damaged-corpus" / rel, root / rel)
    return root


def _node(slug: str, uid: str, **extra) -> Node:
    fields = {"title": slug, **extra}
    return Node(id=f"topic:{slug}", uid=uid, kind="topic", **fields)


def test_collecting_matches_the_oracle_and_strict_refuses(tmp_path):
    root = damaged(tmp_path)
    c = Corpus(root, mode="collecting")
    assert findings(c) == ORACLE["findings"]
    assert ids(c) == ORACLE["accepted"]
    with pytest.raises(RefError):
        c.get("topic:current")
    with pytest.raises(getattr(errors, ORACLE["strict_raises"])):
        Corpus(root)


def test_registry_backed_check_iterates_accepted_members_only(tmp_path):
    # A re-walk would re-raise on the damaged files; the registry check reads the manifest.
    reg = Registry()
    reg.register(KindSpec(name="topic"))
    c = Corpus(damaged(tmp_path), registry=reg, mode="collecting")
    assert findings(c) == ORACLE["findings"]


def test_a_repeated_deprecated_id_never_contests_itself(tmp_path):
    Store(tmp_path).write_file(_node("a", "a", deprecated_ids=["topic:old", "topic:old"]))
    c = Corpus(tmp_path, mode="collecting")
    assert findings(c) == [] and ids(c) == ["topic:a"]
    c.flush_index()
    again = Corpus(tmp_path, mode="collecting")
    assert findings(again) == [] and ids(again) == ["topic:a"]
    assert ids(Corpus(tmp_path)) == ["topic:a"]


@pytest.mark.parametrize("subset", ORACLE["subsets"], ids=lambda s: s["name"])
def test_single_fault_subsets_pin_strict_errors(tmp_path, subset):
    root = damaged(tmp_path, subset["files"])
    with pytest.raises(getattr(errors, subset["strict_raises"])):
        Corpus(root)
    assert ids(Corpus(root, mode="collecting")) == []


def test_unknown_mode_is_a_programmer_error(tmp_path):
    with pytest.raises(ValueError):
        Corpus(tmp_path, mode="lenient")  # type: ignore[arg-type]


def test_reopen_reproduces_findings_and_strict_reopen_raises(tmp_path):
    root = damaged(tmp_path)
    Corpus(root, mode="collecting").flush_index()
    assert findings(Corpus(root, mode="collecting")) == ORACLE["findings"]
    with pytest.raises(ValidationError):
        Corpus(root)


def test_repairing_a_misplaced_file_admits_it(tmp_path):
    root = damaged(tmp_path)
    Corpus(root, mode="collecting").flush_index()
    (root / "topic/moved.md").rename(root / "topic/elsewhere.md")
    c = Corpus(root, mode="collecting")
    assert "topic:elsewhere" in ids(c)
    assert not any(f["code"] == "path-mismatch" for f in findings(c))


class _Embedder:
    cache_namespace = "damaged-test"

    def embed(self, texts):
        return [(1.0, 0.0) for _ in texts]


def test_mutation_honors_exclusions_and_reservations_and_survives_reopen(tmp_path, monkeypatch):
    root = damaged(tmp_path)
    ex = RecordingExecutor(root)
    c = Corpus(root, embedder=_Embedder(), executor_factory=lambda r: ex, mode="collecting")
    before = c.index.to_dict()
    assert c.vector_index is not None
    real_prepare = c.vector_index.prepare

    def forbidden_prepare(*args, **kwargs):
        raise AssertionError("prepare must not run before a refusal")

    monkeypatch.setattr(c.vector_index, "prepare", forbidden_prepare)
    # Excluded path, reserved uid (twins), reserved id (former/current): refused before any effect.
    with pytest.raises(CollisionError):
        c.add(_node("garbled", "new"))
    with pytest.raises(CollisionError):
        c.rename("topic:good", "topic:garbled")
    with pytest.raises(CollisionError):
        c.add(_node("c", "t"))
    with pytest.raises(CollisionError):
        c.add(_node("later", "l", deprecated_ids=["topic:current"]))
    assert ex.plans == []
    assert c.index.to_dict() == before
    monkeypatch.setattr(c.vector_index, "prepare", real_prepare)
    # A misplaced file reserves nothing; the accepted member replaces itself although
    # twin-a lists its id as deprecated; a fresh id is admitted.
    c.add(_node("fresh", "m"))
    c.add(_node("good", "g", title="Replaced"))
    c.add(_node("new", "n"))
    assert ids(c) == ["topic:fresh", "topic:good", "topic:new"]
    c.flush_index()
    again = Corpus(root, embedder=_Embedder(), mode="collecting")
    assert ids(again) == ["topic:fresh", "topic:good", "topic:new"]
    assert again.get("topic:good").title == "Replaced"
    assert [f for f in findings(again) if f["severity"] == "error"] == [
        f for f in ORACLE["findings"] if f["severity"] == "error"
    ]


def _three_claimants() -> tuple[Node, Node, Node]:
    return (
        _node("a", "a", deprecated_ids=["topic:x"]),
        _node("b", "b", deprecated_ids=["topic:x", "topic:y"]),
        _node("c", "c", deprecated_ids=["topic:y"]),
    )


THREE = [
    {"severity": "error", "code": "id-collision", "ref": "topic/a.md", "detail": "topic:x"},
    {"severity": "error", "code": "id-collision", "ref": "topic/b.md", "detail": "topic:x"},
    {"severity": "error", "code": "id-collision", "ref": "topic/b.md", "detail": "topic:y"},
    {"severity": "error", "code": "id-collision", "ref": "topic/c.md", "detail": "topic:y"},
]


def test_three_claimants_are_grouped_simultaneously_cold(tmp_path):
    store = Store(tmp_path)
    for n in _three_claimants():
        store.write_file(n)
    c = Corpus(tmp_path, mode="collecting")
    assert findings(c) == THREE
    assert ids(c) == []


def test_three_claimants_are_grouped_simultaneously_cached(tmp_path):
    a, b, c_ = _three_claimants()
    store = Store(tmp_path)
    store.write_file(a)
    store.write_file(c_)
    Corpus(tmp_path, mode="collecting").flush_index()  # a and c do not conflict
    store.write_file(b)
    c = Corpus(tmp_path, mode="collecting")
    assert findings(c) == THREE
    assert ids(c) == []


def test_a_candidate_evicts_the_kept_claimant_from_every_index(tmp_path):
    store = Store(tmp_path)
    store.write_file(_node("a", "u"))
    Corpus(tmp_path, embedder=_Embedder(), mode="collecting").flush_index()
    store.write_file(_node("b", "u"))
    c = Corpus(tmp_path, embedder=_Embedder(), mode="collecting")
    assert ids(c) == []
    assert c.index.by_uid == {}
    assert c.search_index.lengths == {}
    assert c.vector_index is not None and c.vector_index.vectors == {}
    assert c.manifest == {}
    assert [f["ref"] for f in findings(c)] == ["topic/a.md", "topic/b.md"]
    with pytest.raises(RefError):
        c.get("topic:a")
```

`ts/tests/damaged-parity.test.ts`:

```typescript
/** Collecting construction over the committed damaged corpus, and the interactions the
 * design pins around it (reopen stability, repair, mutation refusals, eviction). */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Corpus } from "../src/corpus.js";
import * as errors from "../src/errors.js";
import { CollisionError, RefError, ValidationError } from "../src/errors.js";
import { type Node, makeNode } from "../src/node.js";
import { Registry } from "../src/registry.js";
import { Store } from "../src/store.js";
import { RecordingExecutor } from "./_executors.js";

const FIXTURES = fileURLToPath(new URL("../../fixtures/", import.meta.url));
type Row = { severity: string; code: string; ref: string; detail: string };
const oracle = JSON.parse(readFileSync(join(FIXTURES, "damaged.oracle.json"), "utf-8")) as {
  findings: Row[];
  accepted: string[];
  strict_raises: keyof typeof errors;
  subsets: Array<{ name: string; files: string[]; strict_raises: keyof typeof errors }>;
};

const findings = (c: Corpus): Row[] =>
  c.check().map(({ severity, code, ref, detail }) => ({ severity, code, ref, detail }));
const ids = (c: Corpus): string[] => c.all().map((n) => n.id);
const errorClass = (name: keyof typeof errors) => errors[name] as new (...args: never[]) => Error;
function node(slug: string, uid: string, extra: Partial<Node> = {}): Node {
  return makeNode({ id: `topic:${slug}`, uid, kind: "topic", title: slug, ...extra });
}

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "nodes-damaged-"));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(tmp, { recursive: true, force: true });
});
const embedder = { cacheNamespace: "damaged-test", embed: (texts: string[]) => texts.map(() => [1, 0]) };

function damaged(files?: string[]): string {
  const root = join(tmp, "damaged");
  if (files === undefined) {
    cpSync(join(FIXTURES, "damaged-corpus"), root, { recursive: true });
  } else {
    for (const rel of files) {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      cpSync(join(FIXTURES, "damaged-corpus", rel), join(root, rel));
    }
  }
  return root;
}

it("collecting matches the oracle and strict refuses", () => {
  const root = damaged();
  const c = new Corpus(root, undefined, undefined, undefined, { mode: "collecting" });
  expect(findings(c)).toEqual(oracle.findings);
  expect(ids(c)).toEqual(oracle.accepted);
  expect(() => c.get("topic:current")).toThrow(RefError);
  expect(() => new Corpus(root)).toThrow(errorClass(oracle.strict_raises));
});

it("registry-backed check iterates accepted members only", () => {
  // A re-walk would re-throw on the damaged files; the registry check reads the manifest.
  const reg = new Registry();
  reg.register({ name: "topic" });
  const c = new Corpus(damaged(), reg, undefined, undefined, { mode: "collecting" });
  expect(findings(c)).toEqual(oracle.findings);
});

it("a repeated deprecated id never contests itself", () => {
  new Store(tmp).writeFile(node("a", "a", { deprecatedIds: ["topic:old", "topic:old"] }));
  const c = new Corpus(tmp, undefined, undefined, undefined, { mode: "collecting" });
  expect(findings(c)).toEqual([]);
  expect(ids(c)).toEqual(["topic:a"]);
  c.flushIndex();
  const again = new Corpus(tmp, undefined, undefined, undefined, { mode: "collecting" });
  expect(findings(again)).toEqual([]);
  expect(ids(again)).toEqual(["topic:a"]);
  expect(ids(new Corpus(tmp))).toEqual(["topic:a"]);
});

for (const subset of oracle.subsets) {
  it(`single-fault subset ${subset.name} pins strict's error`, () => {
    const root = damaged(subset.files);
    expect(() => new Corpus(root)).toThrow(errorClass(subset.strict_raises));
    expect(ids(new Corpus(root, undefined, undefined, undefined, { mode: "collecting" }))).toEqual([]);
  });
}

it("an unknown mode is a programmer error", () => {
  expect(() => new Corpus(tmp, undefined, undefined, undefined, { mode: "lenient" as "strict" })).toThrow(TypeError);
});

it("reopen reproduces findings and strict reopen raises", () => {
  const root = damaged();
  new Corpus(root, undefined, undefined, undefined, { mode: "collecting" }).flushIndex();
  expect(findings(new Corpus(root, undefined, undefined, undefined, { mode: "collecting" }))).toEqual(oracle.findings);
  expect(() => new Corpus(root)).toThrow(ValidationError);
});

it("repairing a misplaced file admits it", () => {
  const root = damaged();
  new Corpus(root, undefined, undefined, undefined, { mode: "collecting" }).flushIndex();
  renameSync(join(root, "topic/moved.md"), join(root, "topic/elsewhere.md"));
  const c = new Corpus(root, undefined, undefined, undefined, { mode: "collecting" });
  expect(ids(c)).toContain("topic:elsewhere");
  expect(findings(c).some((f) => f.code === "path-mismatch")).toBe(false);
});

it("mutation honors exclusions and reservations and survives reopen", () => {
  const root = damaged();
  const ex = new RecordingExecutor(root);
  const c = new Corpus(root, undefined, embedder, () => ex, { mode: "collecting" });
  const before = c.index.toDict();
  if (c.vectorIndex === undefined) throw new Error("test requires vector index");
  const spy = vi.spyOn(c.vectorIndex, "prepare").mockImplementation(() => {
    throw new Error("prepare must not run before a refusal");
  });
  expect(() => c.add(node("garbled", "new"))).toThrow(CollisionError);
  expect(() => c.rename("topic:good", "topic:garbled")).toThrow(CollisionError);
  expect(() => c.add(node("c", "t"))).toThrow(CollisionError);
  expect(() => c.add(node("later", "l", { deprecatedIds: ["topic:current"] }))).toThrow(CollisionError);
  expect(ex.plans).toEqual([]);
  expect(c.index.toDict()).toEqual(before);
  spy.mockRestore();
  c.add(node("fresh", "m"));
  c.add(node("good", "g", { title: "Replaced" }));
  c.add(node("new", "n"));
  expect(ids(c)).toEqual(["topic:fresh", "topic:good", "topic:new"]);
  c.flushIndex();
  const again = new Corpus(root, undefined, embedder, undefined, { mode: "collecting" });
  expect(ids(again)).toEqual(["topic:fresh", "topic:good", "topic:new"]);
  expect(again.get("topic:good").title).toBe("Replaced");
  expect(findings(again).filter((f) => f.severity === "error")).toEqual(
    oracle.findings.filter((f) => f.severity === "error"),
  );
});

const three = (): [Node, Node, Node] => [
  node("a", "a", { deprecatedIds: ["topic:x"] }),
  node("b", "b", { deprecatedIds: ["topic:x", "topic:y"] }),
  node("c", "c", { deprecatedIds: ["topic:y"] }),
];
const THREE: Row[] = [
  { severity: "error", code: "id-collision", ref: "topic/a.md", detail: "topic:x" },
  { severity: "error", code: "id-collision", ref: "topic/b.md", detail: "topic:x" },
  { severity: "error", code: "id-collision", ref: "topic/b.md", detail: "topic:y" },
  { severity: "error", code: "id-collision", ref: "topic/c.md", detail: "topic:y" },
];

it("groups three claimants simultaneously, cold", () => {
  const store = new Store(tmp);
  for (const n of three()) store.writeFile(n);
  const c = new Corpus(tmp, undefined, undefined, undefined, { mode: "collecting" });
  expect(findings(c)).toEqual(THREE);
  expect(ids(c)).toEqual([]);
});

it("groups three claimants simultaneously, cached", () => {
  const [a, b, cc] = three();
  const store = new Store(tmp);
  store.writeFile(a);
  store.writeFile(cc);
  new Corpus(tmp, undefined, undefined, undefined, { mode: "collecting" }).flushIndex();
  store.writeFile(b);
  const c = new Corpus(tmp, undefined, undefined, undefined, { mode: "collecting" });
  expect(findings(c)).toEqual(THREE);
  expect(ids(c)).toEqual([]);
});

it("a candidate evicts the kept claimant from every index", () => {
  const store = new Store(tmp);
  store.writeFile(node("a", "u"));
  new Corpus(tmp, undefined, embedder, undefined, { mode: "collecting" }).flushIndex();
  store.writeFile(node("b", "u"));
  const c = new Corpus(tmp, undefined, embedder, undefined, { mode: "collecting" });
  expect(ids(c)).toEqual([]);
  expect(c.index.byUid.size).toBe(0);
  expect(c.searchIndex.lengths.size).toBe(0);
  expect(c.vectorIndex?.vectors.size).toBe(0);
  expect(c.manifest.size).toBe(0);
  expect(findings(c).map((f) => f.ref)).toEqual(["topic/a.md", "topic/b.md"]);
  expect(() => c.get("topic:a")).toThrow(RefError);
});
```

- [ ] **Step 3: Run `just test-fast`.** Expected red: `mode` is an unknown argument in both languages.

- [ ] **Step 4: Implement collecting mode in Python.** In `corpus.py`:

Imports: `from typing import Literal, NamedTuple`; `from nodes.core.errors import CollisionError, EmbedderRequiredError, PlacementError, RefError, ValidationError`.

Module level, after `Finding`:

```python
ConstructionMode = Literal["strict", "collecting"]


class _Claimant(NamedTuple):
    """One parsed, well-placed file's identity claims, for admission grouping."""

    path: str
    uid: str
    id: str
    deprecated_ids: tuple[str, ...]


def _claimant(path: str, node: Node) -> _Claimant:
    # Deduplicate: a document repeating a deprecated id never contests itself, and
    # snapshot entries hold deprecated ids as a set, so cold and warm must agree.
    return _Claimant(path, node.uid, node.id, tuple(dict.fromkeys(d for d in node.deprecated_ids if d != node.id)))
```

Constructor: add the parameter `mode: ConstructionMode = "strict"` last, and before the snapshot load:

```python
        if mode not in ("strict", "collecting"):
            raise ValueError(f"unknown construction mode {mode!r}")
        self.mode: ConstructionMode = mode
        # Collecting-mode state. Strict corpora leave all four empty.
        self._excluded_paths: set[str] = set()
        self._construction_findings: list[Finding] = []
        self._reserved_uids: set[str] = set()
        self._reserved_ids: set[str] = set()
```

Replace `_parse_member` with the mode-aware version and add the identity stage:

```python
    def _exclude(self, path: str, code: str, detail: str, message: str) -> None:
        self._excluded_paths.add(path)
        self._construction_findings.append(
            Finding(severity="error", code=code, ref=path, detail=detail, message=message)
        )

    def _parse_member(self, f: CorpusFile) -> Node | None:
        """Admission steps 1–2. Strict raises; collecting excludes and returns None."""
        try:
            node = node_from_bytes(f.data)
        except ValidationError as exc:
            if self.mode == "strict":
                raise
            self._exclude(f.path, "parse-error", "", f"{f.path}: {exc}")
            return None
        expected = path_for_node_id(node.id)
        if f.path != expected:
            message = f"{f.path!r} holds {node.id!r}, whose mapped path is {expected!r}"
            if self.mode == "strict":
                raise PlacementError(message)
            self._exclude(f.path, "path-mismatch", expected, message)
            return None
        return node

    def _admit_identities(self, kept: list[_Claimant], candidates: list[_Claimant]) -> tuple[set[str], set[str]]:
        """Admission steps 3–4 over kept + candidates, each stage grouped in full before
        any exclusion. Returns (excluded paths, evicted kept uids). Strict raises."""
        population = [*kept, *candidates]
        losers: dict[str, _Claimant] = {}
        by_uid: dict[str, list[_Claimant]] = {}
        for c in population:
            by_uid.setdefault(c.uid, []).append(c)
        for uid, group in by_uid.items():
            if len(group) < 2:
                continue
            if self.mode == "strict":
                raise CollisionError(f"duplicate uid {uid!r} in corpus")
            for c in group:
                losers[c.path] = c
                self._reserved_uids.add(c.uid)
                self._exclude(c.path, "uid-collision", uid, f"{c.path}: uid {uid!r} is claimed by another document")
        by_id: dict[str, list[_Claimant]] = {}
        for c in population:
            if c.path in losers:
                continue
            for claim in dict.fromkeys((c.id, *c.deprecated_ids)):
                by_id.setdefault(claim, []).append(c)
        for claim in sorted(by_id):
            group = by_id[claim]
            if len(group) < 2:
                continue
            if self.mode == "strict":
                raise CollisionError(f"identity claim {claim!r} is made by more than one document")
            for c in group:
                losers[c.path] = c
                self._reserved_uids.add(c.uid)
                self._reserved_ids.update((c.id, *c.deprecated_ids))
                self._exclude(c.path, "id-collision", claim, f"{c.path}: id {claim!r} is claimed by another document")
        kept_paths = {c.path for c in kept}
        return set(losers), {c.uid for p, c in losers.items() if p in kept_paths}
```

Rewrite `_full_rebuild`:

```python
    def _full_rebuild(self) -> None:
        parsed: list[tuple[CorpusFile, Node]] = []
        for f in iter_corpus_files(self.store.root):
            node = self._parse_member(f)
            if node is not None:
                parsed.append((f, node))
        excluded, _ = self._admit_identities([], [_claimant(f.path, node) for f, node in parsed])
        accepted = [(f, node) for f, node in parsed if f.path not in excluded]
        nodes = [node for _, node in accepted]
        self.index = Index.build(nodes)
        self.search_index = SearchIndex.build(nodes)
        if self.embedder is not None:
            assert self.vector_cache is not None
            self.vector_index: VectorIndex | None = VectorIndex.build(nodes, self.embedder, self.vector_cache)
        else:
            self.vector_index = None
        self.manifest = {f.path: ManifestEntry(path=f.path, sha256=f.sha256, uid=node.uid) for f, node in accepted}
```

In `_reconcile`, replace the parse line and the changed-file loop:

```python
            if prev is not None:
                drops.append(prev.uid)
            node = self._parse_member(f)
            if node is not None:
                changed.append((f.path, f.sha256, node))
```

```python
        for uid in drops:
            self.index.remove(uid)
            self.search_index.remove(uid)
            if self.vector_index is not None:
                self.vector_index.remove(uid)
        # Kept = every entry still in the index (unchanged files); its path is in the old manifest.
        path_by_uid = {m.uid: m.path for m in snap.manifest}
        kept = [
            _Claimant(path_by_uid[uid], uid, e.id, tuple(sorted(e.deprecated_ids)))
            for uid, e in self.index.by_uid.items()
        ]
        excluded, evicted = self._admit_identities(kept, [_claimant(p, n) for p, _, n in changed])
        for uid in evicted:
            self.index.remove(uid)
            self.search_index.remove(uid)
            if self.vector_index is not None:
                self.vector_index.remove(uid)
            new_manifest.pop(path_by_uid[uid], None)
        for path, sha, node in changed:
            if path in excluded:
                continue
            self.index.assert_identity_claims(node)  # holds by construction; guards the invariant
            prepared = None
            ...  # the existing prepare / upsert / commit / manifest lines, unchanged
```

`check()`: before the registry block, `findings: list[Finding] = list(self._construction_findings)`. Update the docstring: "Construction findings (collecting mode) come first; …".

`add`: move the existing `path = self._rel_path(node.id)` up to directly after `self.index.assert_addable(node)` and follow it with:

```python
        self._assert_not_reserved(path, node.uid, (node.id, *node.deprecated_ids))
```

`rename`: after `self.index.assert_path_available(uid, new_id)`:

```python
        new_rel_path = self._rel_path(new_id)
        old_rel_path = self._rel_path(old_id)
        self._assert_not_reserved(new_rel_path if new_rel_path != old_rel_path else None, None, (new_id,))
```

and remove the later duplicate `old_rel_path` / `new_rel_path` assignments. The shared check:

```python
    def _assert_not_reserved(self, path: str | None, uid: str | None, claims: tuple[str, ...]) -> None:
        """Excluded files occupy their paths; excluded identity claimants reserve their
        uids and (at the id stage) their ids. Strict corpora reserve nothing."""
        if path is not None and path in self._excluded_paths:
            raise CollisionError(f"path {path!r} is occupied by an excluded document")
        if uid is not None and uid in self._reserved_uids:
            raise CollisionError(f"uid {uid!r} is reserved by an excluded document")
        for claim in claims:
            if claim in self._reserved_ids:
                raise CollisionError(f"id {claim!r} is reserved by an excluded document")
```

- [ ] **Step 5: Implement collecting mode in TypeScript.** In `corpus.ts`:

Imports: add `PlacementError`, `ValidationError` to the errors import. Module level:

```typescript
export type ConstructionMode = "strict" | "collecting";

/** One parsed, well-placed file's identity claims, for admission grouping. */
interface Claimant {
  readonly path: string;
  readonly uid: string;
  readonly id: string;
  readonly deprecatedIds: readonly string[];
}
// Deduplicate: a document repeating a deprecated id never contests itself, and snapshot
// entries hold deprecated ids as a set, so cold and warm must agree.
const claimant = (path: string, node: Node): Claimant => ({
  path,
  uid: node.uid,
  id: node.id,
  deprecatedIds: [...new Set(node.deprecatedIds.filter((d) => d !== node.id))],
});
```

Fields and constructor:

```typescript
  readonly mode: ConstructionMode;
  // Collecting-mode state. Strict corpora leave all four empty.
  private readonly excludedPaths = new Set<string>();
  private readonly constructionFindings: Finding[] = [];
  private readonly reservedUids = new Set<string>();
  private readonly reservedIds = new Set<string>();

  constructor(
    root: string,
    registry?: Registry,
    embedder?: Embedder,
    executorFactory?: (root: string) => WritePlanExecutor,
    options: { mode?: ConstructionMode } = {},
  ) {
    const mode = options.mode ?? "strict";
    if (mode !== "strict" && mode !== "collecting") throw new TypeError(`unknown construction mode ${JSON.stringify(mode)}`);
    this.mode = mode;
```

(the rest of the constructor unchanged; the mode check precedes `loadSnapshot`). Replace `parseMember` and add the identity stage:

```typescript
  private exclude(path: string, code: string, detail: string, message: string): void {
    this.excludedPaths.add(path);
    this.constructionFindings.push({ severity: "error", code, ref: path, detail, message });
  }

  /** Admission steps 1–2. Strict throws; collecting excludes and returns undefined. */
  private parseMember(f: CorpusFile): Node | undefined {
    let node: Node;
    try {
      node = nodeFromBytes(f.data);
    } catch (e) {
      if (!(e instanceof ValidationError) || this.mode === "strict") throw e;
      this.exclude(f.path, "parse-error", "", `${f.path}: ${e.message}`);
      return undefined;
    }
    const expected = pathForNodeId(node.id);
    if (f.path !== expected) {
      const message = `${JSON.stringify(f.path)} holds ${JSON.stringify(node.id)}, whose mapped path is ${JSON.stringify(expected)}`;
      if (this.mode === "strict") throw new PlacementError(message);
      this.exclude(f.path, "path-mismatch", expected, message);
      return undefined;
    }
    return node;
  }

  /** Admission steps 3–4 over kept + candidates, each stage grouped in full before any
   * exclusion. Returns excluded paths and evicted kept uids. Strict throws. */
  private admitIdentities(kept: Claimant[], candidates: Claimant[]): { excluded: Set<string>; evicted: Set<string> } {
    const population = [...kept, ...candidates];
    const losers = new Map<string, Claimant>();
    const byUid = new Map<string, Claimant[]>();
    for (const c of population) byUid.set(c.uid, [...(byUid.get(c.uid) ?? []), c]);
    for (const [uid, group] of byUid) {
      if (group.length < 2) continue;
      if (this.mode === "strict") throw new CollisionError(`duplicate uid ${JSON.stringify(uid)} in corpus`);
      for (const c of group) {
        losers.set(c.path, c);
        this.reservedUids.add(c.uid);
        this.exclude(c.path, "uid-collision", uid, `${c.path}: uid ${JSON.stringify(uid)} is claimed by another document`);
      }
    }
    const byId = new Map<string, Claimant[]>();
    for (const c of population) {
      if (losers.has(c.path)) continue;
      for (const claim of new Set([c.id, ...c.deprecatedIds])) byId.set(claim, [...(byId.get(claim) ?? []), c]);
    }
    for (const claim of [...byId.keys()].sort(compareCodepoints)) {
      const group = byId.get(claim) as Claimant[];
      if (group.length < 2) continue;
      if (this.mode === "strict") {
        throw new CollisionError(`identity claim ${JSON.stringify(claim)} is made by more than one document`);
      }
      for (const c of group) {
        losers.set(c.path, c);
        this.reservedUids.add(c.uid);
        this.reservedIds.add(c.id);
        for (const dep of c.deprecatedIds) this.reservedIds.add(dep);
        this.exclude(c.path, "id-collision", claim, `${c.path}: id ${JSON.stringify(claim)} is claimed by another document`);
      }
    }
    const keptPaths = new Set(kept.map((c) => c.path));
    const evicted = new Set<string>();
    for (const [path, c] of losers) if (keptPaths.has(path)) evicted.add(c.uid);
    return { excluded: new Set(losers.keys()), evicted };
  }
```

Rewrite `fullRebuild`:

```typescript
  private fullRebuild(): void {
    const parsed: Array<{ f: CorpusFile; node: Node }> = [];
    for (const f of iterCorpusFiles(this.store.root)) {
      const node = this.parseMember(f);
      if (node !== undefined) parsed.push({ f, node });
    }
    const { excluded } = this.admitIdentities([], parsed.map(({ f, node }) => claimant(f.path, node)));
    const accepted = parsed.filter(({ f }) => !excluded.has(f.path));
    const nodes = accepted.map(({ node }) => node);
    this.index = Index.build(nodes);
    this.searchIndex = SearchIndex.build(nodes);
    this.vectorIndex =
      this.embedder !== undefined ? VectorIndex.build(nodes, this.embedder, this.vectorCache as VectorCache) : undefined;
    this.manifest = new Map(accepted.map(({ f, node }) => [f.path, { path: f.path, sha256: f.sha256, uid: node.uid }]));
  }
```

In `reconcile`, replace the parse line and the changed-file loop:

```typescript
      if (prev !== undefined) drops.push(prev.uid);
      const node = this.parseMember(f);
      if (node !== undefined) changed.push({ path: f.path, sha256: f.sha256, node });
```

```typescript
    for (const uid of drops) {
      this.index.remove(uid);
      this.searchIndex.remove(uid);
      this.vectorIndex?.remove(uid);
    }
    // Kept = every entry still in the index (unchanged files); its path is in the old manifest.
    const pathByUid = new Map(snap.manifest.map((m) => [m.uid, m.path]));
    const kept: Claimant[] = [...this.index.byUid.entries()].map(([uid, e]) => ({
      path: pathByUid.get(uid) as string,
      uid,
      id: e.id,
      deprecatedIds: [...e.deprecatedIds].sort(compareCodepoints),
    }));
    const { excluded, evicted } = this.admitIdentities(kept, changed.map(({ path, node }) => claimant(path, node)));
    for (const uid of evicted) {
      this.index.remove(uid);
      this.searchIndex.remove(uid);
      this.vectorIndex?.remove(uid);
      newManifest.delete(pathByUid.get(uid) as string);
    }
    for (const { path, sha256, node } of changed) {
      if (excluded.has(path)) continue;
      this.index.assertIdentityClaims(node); // holds by construction; guards the invariant
      const prepared = ... // the existing prepare / upsert / commit / manifest lines, unchanged
```

`check()`: `const findings: Finding[] = [...this.constructionFindings];` and update the doc comment. `add`: move the existing `const path = this.relPath(node.id);` (`corpus.ts:209` today) up to directly after `this.index.assertAddable(node);` and follow it with:

```typescript
    this.assertNotReserved(path, node.uid, [node.id, ...node.deprecatedIds]);
```

`rename`: after `this.index.assertPathAvailable(uid, newId);`:

```typescript
    const newRelPath = this.relPath(newId);
    const oldRelPath = this.relPath(oldId);
    this.assertNotReserved(newRelPath !== oldRelPath ? newRelPath : null, null, [newId]);
```

removing the later duplicate `oldRelPath` / `newRelPath` declarations. The shared check:

```typescript
  /** Excluded files occupy their paths; excluded identity claimants reserve their uids
   * and (at the id stage) their ids. Strict corpora reserve nothing. */
  private assertNotReserved(path: string | null, uid: string | null, claims: string[]): void {
    if (path !== null && this.excludedPaths.has(path)) {
      throw new CollisionError(`path ${JSON.stringify(path)} is occupied by an excluded document`);
    }
    if (uid !== null && this.reservedUids.has(uid)) {
      throw new CollisionError(`uid ${JSON.stringify(uid)} is reserved by an excluded document`);
    }
    for (const claim of claims) {
      if (this.reservedIds.has(claim)) throw new CollisionError(`id ${JSON.stringify(claim)} is reserved by an excluded document`);
    }
  }
```

Export the type from `index.ts`: `export { Corpus, type ConstructionMode, type Finding } from "./corpus.js";`.

- [ ] **Step 6: Run `just test-fast`, then `just gate`.** Every damaged-parity case green in both languages; `check_parity`, `path-collision-parity`, and the rename parity runners unchanged. Run `tasks done nodes-775188 "Task 3 verified; held for the single B implementation commit"`; leave changes uncommitted.

### Task 4: Normative amendment and B closeout

**Files:**
- Modify: `.worktrees/nodes-2.0/docs/STANDARD.md`.
- Modify: `.worktrees/nodes-2.0/docs/designs/2026-09-11-nodes-2.0-remainder-design.md` (§B), `2026-09-11-nodes-digest-id-hazards-design.md` (§2 note), `2026-09-11-nodes-collecting-construction-design.md` (status), and this plan (status, checklists).
- Mutate task records only through the CLI.

- [ ] **Step 0: Start.** `tasks start nodes-c1c23d`.

- [ ] **Step 1: Amend STANDARD.** Every amended clause gets `*(2.0)*` once.

| Section | Amendment |
| --- | --- |
| §1 (conformance, after the tiers) | Add: *Construction modes.* `Corpus` constructs in `strict` mode by default, refusing the first damaged, misplaced or colliding file with the error §3–§4 name; in `collecting` mode it excludes such files, constructs over the remainder, and reports each exclusion through `check()` (§8.2). Collecting is the documented posture for audit and import boundaries. Reads through the index never reach an excluded file. |
| §3 collisions bullet | Append: Under collecting construction a uid claimed by more than one well-placed file excludes every claimant, and an id — live or deprecated — claimed by more than one of the remaining files excludes every claimant; each stage groups the whole population before excluding. |
| §4.1 well-placed clause | Replace "Whether a member is well-placed is not enforced by this clause; §3 governs admission and §8.2 reporting." with: Strict construction refuses a misplaced member (`PlacementError`); collecting construction excludes it (`path-mismatch`). Membership is what the walk yields; **acceptance** is what admission keeps. |
| §4.2 (new bullet after the required-fields rule) | *Parse floor.* A document is decoded as UTF-8 fatally, BOM preserved, and begins with `---` at byte zero. The frontmatter is a mapping. `id`, `uid`, `kind`, `title` are strings. `related`, `relations`, `deprecated_ids` are absent or lists — `null` is malformed — of strings, mappings, strings respectively. `facets` is absent or a mapping of mappings. Every mapping key, at any depth, is a string; a cyclic alias is malformed. `null` for a named optional top-level field is malformed — only absence defaults; payload interiors (facets, relation `attrs`) are unconstrained. `version` is an integer; a relation's `directed` is a boolean, `weight` a number or `null`, `attrs` a mapping. `created` / `updated` are calendar dates, as the ISO string or the date scalar YAML yields for the unquoted spelling — the boundary's only conversion. Nothing is coerced. Every violation raises `ValidationError`, the only error the parse floor raises. |
| §6 error table | Add row: `Member's literal path differs from its id's mapped path (strict construction)` → `PlacementError`. Extend the `CollisionError` row: `; excluded-path occupancy and reserved-claim refusal (collecting mutation)`. |
| §7 `add` bullet | Append: On a collecting corpus, `add` also refuses (`CollisionError`) a mapped path an excluded file occupies, a uid reserved by a file excluded at either identity stage, and an id — live or deprecated — reserved by a file excluded at the id stage; uid and id reservations are separate namespaces. |
| §7 `rename` bullet | Append: the same refusals apply to the new id and, when it differs from the old, the new mapped path. |
| §7 new bullet after `rename` | `all()` returns accepted members ordered by manifest path in Unicode code-point order; registry-backed `check()` iterates the same sequence. Neither walks the directory. |
| §8.2 intro | After "MUST NOT raise on content": *(2.0)* This holds from the parse floor up: under collecting construction, content that cannot be parsed is a finding, never an exception. `ref` is a node id or a literal root-relative path; the finding code alone says which. |
| §8.2 table | Four rows: `parse-error` / error / `""` / a walked document the parse floor refuses (`ref` = path); `path-mismatch` / error / mapped path / a well-formed document at a path other than its id's (`ref` = path); `uid-collision` / error / the uid / one per claimant of a uid claimed by more than one accepted-so-far document (`ref` = path); `id-collision` / error / the contested id / one per `(claimant, contested id)` among the remaining documents (`ref` = path). All four appear only under collecting construction. |
| §8.2 exhaustive list | Prepend: every construction finding of the handle (collecting mode), then the existing items. |
| §10 | Append: A snapshot records accepted members only; exclusion is never persisted and re-derives on open. A snapshot at an earlier schema version is discarded and the corpus rebuilds cold; schema versions are per language and changed by the 2.0 parse floor. |
| §11.2 | Rows: `damaged-corpus/`, `damaged.oracle.json` — *(2.0)* collecting-mode findings, accepted members and strict's refusal over one committed damaged tree (parse, placement, uid and id collisions, and a dangling ref into an excluded member), plus single-fault subsets pinning each strict error; `frontmatter.malformed.json` — *(2.0)* the parse floor: texts both kernels refuse and texts both accept. |

- [ ] **Step 2: Update the design records.** Umbrella §B: replace the bullet list of open questions with the decided shapes (mode flag; parse floor; four path-anchored findings, all claimants excluded, per-`(path, contested id)`; `PlacementError`; excluded-path occupancy and stage-specific reservations; one admission algorithm with eviction; manifest-ordered reads; version bump; `path-collision` stays in C's in-test construction). C design §2: replace "B must enforce placement on both disk-admission paths" with a sentence recording that B does, dated. Mark the B design "implemented on branch `nodes-2.0` (date)" only after verifying the code exists; mark this plan completed with gate evidence. No future commit hash in either status.

- [ ] **Step 3: Review the diff and propagated claims.** `git diff --check`, `git diff --stat`, read the combined diff. Then:

```bash
rg -n 'all_nodes|allNodes|node_from_markdown\(.*decode|toString\("utf-8"\)|first unparseable|fails hard|write-new-then-delete-old' docs/STANDARD.md README.md python/README.md ts/README.md
rg -n '\*\(2\.0\)\*|\*\*Pending:\*\*' docs/STANDARD.md | wc -l
```

Correct live instructions the change contradicts; leave dated historical designs and plans alone. Confirm the pre-B bypass is closed in both languages by re-reading the migration tests' assertions against the version constants.

- [ ] **Step 4: Close, gate, commit.** `tasks done nodes-c1c23d "B normative amendment and review complete"`, then `tasks done nodes-c7b371 "Collecting construction implemented in both languages: parse floor, placement, exclusion with reservations, findings, fixture"`. `tasks check` (zero errors; report warnings), `just gate`. With both green:

```bash
git add python ts fixtures docs tasks
git diff --cached --check
git commit -m 'feat!: collecting construction over damaged corpora'
git status --short
```

Report the commit hash, gate counts, task-check warnings. Keep `nodes-2.0` for F/E/G; do not merge.
