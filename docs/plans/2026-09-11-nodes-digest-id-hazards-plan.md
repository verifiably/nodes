# Digest-id hazards implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** ready for review; implementation has not started.
**Goal:** Refuse new mapped-path collisions, report existing collisions, and make uid presence and ordering agree between Python and TypeScript.
**Architecture:** Share the existing id-to-path mapping through `paths`; keep a derived collision-key-to-live-uids map in the structural Index. Separate construction's identity checks from mutation admission, then use the index for rename refusal and findings. Preserve snapshot format and executor interfaces.
**Tech Stack:** Python 3.11+, Pydantic, pytest; TypeScript, Zod, Vitest; existing `just` recipes and JSON parity fixtures. No new dependencies.
**Spec:** `.worktrees/nodes-2.0/docs/designs/2026-09-11-nodes-digest-id-hazards-design.md`.
**Baseline:** `103e31d` plus the review corrections committed with this plan; A is implemented at ancestor `22e3a2a`.

## Global Constraints

- Work in the existing `.worktrees/nodes-2.0` worktree on `nodes-2.0`; all file names below are relative to the main checkout. Run commands from the worktree root unless their block explicitly changes directory.
- Implement both languages. Tier 1/2 code, tests, oracles and STANDARD MUST land in **one C implementation commit**. Tasks 1–3 close in the working tree; Task 4 commits the combined change after review and gate. Do not commit intermediate code without its normative amendment.
- Keep STANDARD's `1.2` header and pending line. Mark C's edited clauses `*(2.0)*`; E performs the version bump and marker removal.
- No package-name edits, compatibility re-exports, new dependencies, persisted path buckets, or snapshot schema bump. B owns disk placement enforcement and collecting construction.
- Warning severity; one `path-collision` per live claimant. Physical filenames and deprecated ids are not collision-key inputs. Only non-empty uid presence is constrained; retain uid contents and current UUID-hex defaults.
- Inner loop: `just test-fast`. It can stop after Python fails, so after a red Python test is fixed run again to expose TS failures. An empty selection does not prove a new test ran; use `just test` through the same timing wrapper if necessary. Each task ends with `just gate`.
- Only task CLI mutations. Start the child before editing; close it after its gate. No intermediate commit; final closure and code share one commit. Do not merge to `main`.
- Volume-dependent tests probe the actual case-variant pair by exclusive creation. Skip only the two-file scenarios when the second name already exists; propagate other errors. Pure index and single-file mutation cases run everywhere.
- Task ids: Task 1: `nodes-7b859d`, Task 2: `nodes-45a188`, Task 3: `nodes-bbb832`, Task 4: `nodes-bf3fc1`. Execute Tasks 1 → 2 → 3 → 4. The parent is `nodes-cd59f0`.

## File responsibilities

| Files (all beneath `.worktrees/nodes-2.0/`) | Responsibility |
| --- | --- |
| `python/src/nodes/core/paths.py`, `ts/src/paths.ts` | Validated id mapping and collision key |
| `python/src/nodes/core/store.py`, `snapshot.py`; `ts/src/store.ts`, `snapshot.ts`, `index.ts` | Use shared mapping; keep package export |
| `python/src/nodes/core/structural_index.py`, `ts/src/structural-index.ts` | Derived buckets, identity/path admission split, reporting query, restore validation |
| `python/src/nodes/core/corpus.py`, `ts/src/corpus.ts` | Construction versus mutation callers, rename refusal, findings, ordering |
| `python/src/nodes/core/node.py`, `ts/src/node.ts` | Reject empty uid at node validation |
| `fixtures/path-collision.oracle.json`, new parity harnesses | Collision contract only |
| `fixtures/uid.oracle.json`, existing node tests | Non-empty opaque uid contract |
| `fixtures/corpus/`, existing rename oracles and parity tests | Non-BMP referrer ordering |
| `docs/STANDARD.md`, C/umbrella/seam docs | Normative amendment and accurate status |

### Task 1: Shared path mapping and derived collision index

**Files:**
- Modify: `.worktrees/nodes-2.0/python/src/nodes/core/{paths,store,snapshot,structural_index}.py`.
- Modify: `.worktrees/nodes-2.0/ts/src/{paths,store,snapshot,structural-index,index,corpus}.ts` (Corpus import and reconcile caller only in this task).
- Modify: `.worktrees/nodes-2.0/python/src/nodes/core/corpus.py` (reconcile caller only).
- Test: `.worktrees/nodes-2.0/python/tests/test_paths.py`, `test_index_snapshot.py`.
- Test: `.worktrees/nodes-2.0/ts/tests/paths.test.ts`, `index-snapshot.test.ts`, `snapshot-load.test.ts`.

**Interfaces:**
- Consumes: `NodeId.parse`, existing `Index.upsert`, `_drop` / `drop`, `from_dict` / `fromDict`.
- Produces: `path_for_node_id(node_id: str) -> str`, `path_collision_key(node_id: str) -> str`; TS `pathForNodeId(nodeId: string): string`, `pathCollisionKey(nodeId: string): string`.
- Produces: `Index.assert_identity_claims(node: Node) -> None`, `assert_path_available(candidate_uid: str, candidate_id: str) -> None`, `path_collisions() -> list[tuple[str, str]]` (live id, key). TS `assertIdentityClaims(node: Node): void`, `assertPathAvailable(candidateUid: string, candidateId: string): void`, `pathCollisions(): Array<[string, string]>`.
- `assert_addable` / `assertAddable` remains the public combined gate. Reporting query order is unspecified; Corpus owns final finding order.

- [ ] **Step 0: Start this task.** Run `tasks start nodes-7b859d`.

- [ ] **Step 1: Pin the shared mapping and replacement/removal/restore behavior.** Add these tests with the shown imports to the existing files. They cover exact-path aliasing as well as case folding; neither needs filesystem case support.

```python
from nodes.core.paths import path_collision_key, path_for_node_id


def test_id_mapping_and_collision_key():
    assert path_for_node_id("gene:BRCA1:v2") == "gene/BRCA1__v2.md"
    assert path_collision_key("gene:BRCA1:v2") == "gene/brca1__v2.md"
    assert path_collision_key("gene:BRCA1:v2") == path_collision_key("gene:brca1__v2")
    assert path_collision_key("other:a") != path_collision_key("gene:a")
```

```typescript
import { pathCollisionKey, pathForNodeId } from "../src/paths.js";

it("maps validated ids and folds the mapped path", () => {
  expect(pathForNodeId("gene:BRCA1:v2")).toBe("gene/BRCA1__v2.md");
  expect(pathCollisionKey("gene:BRCA1:v2")).toBe("gene/brca1__v2.md");
  expect(pathCollisionKey("gene:BRCA1:v2")).toBe(pathCollisionKey("gene:brca1__v2"));
  expect(pathCollisionKey("other:a")).not.toBe(pathCollisionKey("gene:a"));
});
```

Append to the index snapshot tests (reuse existing Node/Index and test-framework imports):

```python
from nodes.core.errors import CollisionError


def test_collision_buckets_follow_upsert_remove_and_restore():
    a = Node(id="kind:A", uid="a", kind="kind", title="A")
    b = Node(id="kind:a", uid="b", kind="kind", title="B")
    index = Index.build([a, b])
    expected = [("kind:A", "kind/a.md"), ("kind:a", "kind/a.md")]
    assert sorted(index.path_collisions()) == expected
    index = Index.from_dict(index.to_dict())
    assert sorted(index.path_collisions()) == expected
    index.assert_addable(a)  # same claim in an already-collided bucket
    with pytest.raises(CollisionError):
        index.assert_addable(Node(id="kind:a", uid="new", kind="kind", title="New"))
    moved = b.model_copy(update={"id": "kind:b", "deprecated_ids": ["kind:a"]})
    index.assert_path_available(b.uid, moved.id)
    index.upsert(moved)  # _drop must remove b from the old bucket
    assert index.path_collisions() == []
    index.remove(a.uid)
    index.assert_path_available("new", "kind:A")  # empty bucket was removed
    assert Index.from_dict(index.to_dict()).path_collisions() == []
```

```typescript
import { CollisionError } from "../src/errors.js";

it("maintains collision buckets through replacement, removal and restore", () => {
  const a = makeNode({ id: "kind:A", uid: "a", kind: "kind", title: "A" });
  const b = makeNode({ id: "kind:a", uid: "b", kind: "kind", title: "B" });
  let index = Index.build([a, b]);
  const expected = [["kind:A", "kind/a.md"], ["kind:a", "kind/a.md"]];
  expect(index.pathCollisions().sort()).toEqual(expected);
  index = Index.fromDict(index.toDict());
  expect(index.pathCollisions().sort()).toEqual(expected);
  index.assertAddable(a);
  expect(() => index.assertAddable(makeNode({
    id: "kind:a", uid: "new", kind: "kind", title: "New",
  }))).toThrow(CollisionError);
  const moved = { ...b, id: "kind:b", deprecatedIds: ["kind:a"] };
  index.assertPathAvailable(b.uid, moved.id);
  index.upsert(moved);
  expect(index.pathCollisions()).toEqual([]);
  index.remove(a.uid);
  index.assertPathAvailable("new", "kind:A");
  expect(Index.fromDict(index.toDict()).pathCollisions()).toEqual([]);
});
```

- [ ] **Step 2: Run `just test-fast`.** Expected failure: shared helpers or index methods absent.

- [ ] **Step 3: Centralize mapping and wire all imports.** Add the helpers below to `paths`, update the dependency comment to say imports `ids` and `errors`, and import NodeId. Move the snapshot function rather than keeping an alias.

```python
def path_for_node_id(node_id: str) -> str:
    nid = NodeId.parse(node_id)
    return f"{nid.kind}/{nid.slug.replace(':', '__')}.md"


def path_collision_key(node_id: str) -> str:
    # Valid ids are ASCII; NFC is identity and lowercase equals casefold.
    return path_for_node_id(node_id).lower()
```

```typescript
export function pathForNodeId(nodeId: string): string {
  const nid = NodeId.parse(nodeId);
  return `${nid.kind}/${nid.slug.replaceAll(":", "__")}.md`;
}

export function pathCollisionKey(nodeId: string): string {
  // Valid ids are ASCII; NFC is identity and lowercase equals casefold.
  return pathForNodeId(nodeId).toLowerCase();
}
```

Python `Store.rel_path` becomes `return path_for_node_id(node_id)`; remove its unused NodeId import. Remove snapshot's private mapping and call the shared helper at manifest validation. TS Store, Corpus, snapshot and snapshot-load tests import `pathForNodeId` from `paths.js`. Remove it from the package index's snapshot export block and add `export { pathForNodeId } from "./paths.js";`. Do not add a snapshot re-export or expose other new helpers through the package index.

- [ ] **Step 4: Add buckets and split admission.** Rename the existing identity-check method to `assert_identity_claims` / `assertIdentityClaims`, preserving its body. Replace obsolete caller comments. Add:

```python
# Index.__init__:
self._path_uids: dict[str, set[str]] = {}

# Index methods:
def assert_addable(self, node: Node) -> None:
    self.assert_identity_claims(node)
    self.assert_path_available(node.uid, node.id)


def assert_path_available(self, candidate_uid: str, candidate_id: str) -> None:
    candidate_path = path_for_node_id(candidate_id)
    existing = self.by_uid.get(candidate_uid)
    if existing is not None and path_for_node_id(existing.id) == candidate_path:
        return
    key = path_collision_key(candidate_id)
    if self._path_uids.get(key):
        raise CollisionError(f"mapped path for {candidate_id!r} collides at {key!r}")


def path_collisions(self) -> list[tuple[str, str]]:
    return [
        (self.by_uid[uid].id, key)
        for key, uids in self._path_uids.items()
        if len(uids) > 1
        for uid in uids
    ]
```

```typescript
// Index field:
private pathUids = new Map<string, Set<string>>();

assertAddable(node: Node): void {
  this.assertIdentityClaims(node);
  this.assertPathAvailable(node.uid, node.id);
}

assertPathAvailable(candidateUid: string, candidateId: string): void {
  const candidatePath = pathForNodeId(candidateId);
  const existing = this.byUid.get(candidateUid);
  if (existing !== undefined && pathForNodeId(existing.id) === candidatePath) return;
  const key = pathCollisionKey(candidateId);
  if (this.pathUids.has(key)) {
    throw new CollisionError(`mapped path for ${JSON.stringify(candidateId)} collides at ${JSON.stringify(key)}`);
  }
}

pathCollisions(): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  for (const [key, uids] of this.pathUids) {
    if (uids.size < 2) continue;
    for (const uid of uids) rows.push([(this.byUid.get(uid) as IndexEntry).id, key]);
  }
  return rows;
}
```

Immediately after installing `entry` in `upsert`, populate its bucket:

```python
self._path_uids.setdefault(path_collision_key(entry.id), set()).add(entry.uid)
```

```typescript
const key = pathCollisionKey(entry.id);
const bucket = this.pathUids.get(key) ?? new Set<string>();
bucket.add(entry.uid);
this.pathUids.set(key, bucket);
```

In `from_dict` / `fromDict`, immediately after each validated entry is installed, use the same three-line TS insertion with `idx.pathUids` (Python `idx._path_uids.setdefault(path_collision_key(entry.id), set()).add(entry.uid)`). Preserve all existing duplicate uid/id/alias validations; derive buckets from entry ids only. Do not call mutation admission here or change `to_dict` / `toDict`.

In `_drop` / `drop`, after the missing-entry early return, remove its bucket claim:

```python
key = path_collision_key(entry.id)
bucket = self._path_uids[key]
bucket.remove(uid)
if not bucket:
    del self._path_uids[key]
```

```typescript
const key = pathCollisionKey(entry.id);
const bucket = this.pathUids.get(key) as Set<string>;
bucket.delete(uid);
if (bucket.size === 0) this.pathUids.delete(key);
```

In Index.build and Corpus's changed-file reconcile loop only, replace calls to `assert_addable` / `assertAddable` with identity-only calls. Preserve their separate duplicate-uid refusal. Corpus.add keeps combined admission. This change must land with the new gate so a snapshot cannot change construction acceptance.

- [ ] **Step 5: Run `just test-fast`, then `just gate`.** New index tests and existing collision, snapshot and Corpus tests must pass. Confirm `rg -n 'pathForNodeId|_path_for_node_id|assert_addable|assertAddable|assert_identity_claims|assertIdentityClaims' python/src ts/src ts/tests/snapshot-load.test.ts` shows the intended caller split and no snapshot alias. Run `tasks done nodes-7b859d "Task 1 verified; held for the single C implementation commit"`; leave changes uncommitted for Task 4.

### Task 2: Corpus admission, collision findings and shared oracle

**Files:**
- Modify: `.worktrees/nodes-2.0/python/src/nodes/core/corpus.py`, `.worktrees/nodes-2.0/ts/src/corpus.ts`.
- Create: `.worktrees/nodes-2.0/fixtures/path-collision.oracle.json`.
- Create: `.worktrees/nodes-2.0/python/tests/test_path_collision_parity.py`, `.worktrees/nodes-2.0/ts/tests/path-collision-parity.test.ts`.
- Reuse: `.worktrees/nodes-2.0/python/tests/_executors.py`, `.worktrees/nodes-2.0/ts/tests/_executors.ts`.

**Interfaces:**
- Consumes: Task 1's path helpers, Index gates and `path_collisions() -> list[tuple[str, str]]` / `pathCollisions(): Array<[string, string]>`.
- Produces: Corpus rename refusal before preparation/effects, and warning findings `{severity, code, ref, detail, message}`. No new constructor flag or finding severity.

- [ ] **Step 0: Start this task.** Run `tasks start nodes-45a188`.

- [ ] **Step 1: Add the collision-only oracle below.** Node seeds use snake-case `deprecated_ids` in shared JSON; harnesses adapt it to each Node constructor. Kind is the prefix before `:` and title is the id. Group rows compare `[live_id, collision_key]`; mutations expect error class or operation-kind sequence. These are logical descriptions, never a committed colliding file tree.

```json
{
  "groups": [
    {"name":"case", "nodes":[{"id":"kind:A","uid":"a"},{"id":"kind:a","uid":"b"}], "rows":[["kind:A","kind/a.md"],["kind:a","kind/a.md"]]},
    {"name":"exact", "nodes":[{"id":"kind:a:b","uid":"a"},{"id":"kind:a__b","uid":"b"}], "rows":[["kind:a:b","kind/a__b.md"],["kind:a__b","kind/a__b.md"]]},
    {"name":"three", "nodes":[{"id":"kind:AA","uid":"a"},{"id":"kind:Aa","uid":"b"},{"id":"kind:aa","uid":"c"}], "rows":[["kind:AA","kind/aa.md"],["kind:Aa","kind/aa.md"],["kind:aa","kind/aa.md"]]},
    {"name":"kinds", "nodes":[{"id":"kind:a","uid":"a"},{"id":"other:a","uid":"b"}], "rows":[]},
    {"name":"aliases", "nodes":[{"id":"kind:x","uid":"a","deprecated_ids":["kind:A"]},{"id":"kind:a","uid":"b"}], "rows":[]},
    {"name":"single", "nodes":[{"id":"kind:A","uid":"a"}], "rows":[]}
  ],
  "mutations": [
    {"name":"add-case", "source":"kind:A", "action":"add", "target":"kind:a", "result":"CollisionError"},
    {"name":"add-exact", "source":"kind:a:b", "action":"add", "target":"kind:a__b", "result":"CollisionError"},
    {"name":"rename-case", "source":"kind:A", "action":"rename", "target":"kind:a", "result":"CollisionError"},
    {"name":"rename-exact", "source":"kind:a:b", "action":"rename", "target":"kind:a__b", "result":["replace"]},
    {"name":"rename-free", "source":"kind:a", "action":"rename", "target":"kind:b", "result":["create","delete"]}
  ],
  "case_findings": [
    {"severity":"warning","code":"path-collision","ref":"kind:A","detail":"kind/a.md"},
    {"severity":"warning","code":"path-collision","ref":"kind:a","detail":"kind/a.md"}
  ]
}
```

- [ ] **Step 2: Add group and mutation runners.** Python file imports json, Path, pytest, Corpus, CollisionError, Node, Store, Index, and RecordingExecutor; load `Path(__file__).parents[2] / "fixtures/path-collision.oracle.json"`. TS imports fs temp/read/remove/write functions, tmpdir, join, fileURLToPath, Vitest, Corpus, CollisionError, makeNode/Node, Store, Index, RecordingExecutor, compareCodepoints. Resolve the fixture with `new URL("../../fixtures/path-collision.oracle.json", import.meta.url)` and use fresh mkdtemp/beforeEach and rmSync/afterEach roots. Define these seed adapters and runners:

```python
ORACLE = json.loads((Path(__file__).parents[2] / "fixtures/path-collision.oracle.json").read_text())


def seed(raw):
    return Node(kind=raw["id"].split(":", 1)[0], title=raw["id"], **raw)


@pytest.mark.parametrize("case", ORACLE["groups"], ids=lambda c: c["name"])
def test_group(case):
    index = Index.build(seed(raw) for raw in case["nodes"])
    expected = [tuple(row) for row in case["rows"]]
    assert sorted(index.path_collisions()) == expected
    assert sorted(Index.from_dict(index.to_dict()).path_collisions()) == expected


@pytest.mark.parametrize("case", ORACLE["mutations"], ids=lambda c: c["name"])
def test_mutation(case, tmp_path, monkeypatch):
    ex = RecordingExecutor(tmp_path)
    embedder = CountingEmbedder()
    c = Corpus(tmp_path, embedder=embedder, executor_factory=lambda root: ex)
    c.add(seed({"id": case["source"], "uid": "source"}))
    ex.plans.clear()
    embedder.calls.clear()
    if case["result"] == "CollisionError":
        def forbidden_prepare(*args, **kwargs):
            raise AssertionError("prepare must not run")
        assert c.vector_index is not None
        monkeypatch.setattr(c.vector_index, "prepare", forbidden_prepare)
    before = c.index.to_dict()
    before_files = {p.relative_to(tmp_path): p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}
    def mutate():
        if case["action"] == "add":
            return c.add(seed({"id": case["target"], "uid": "candidate"}).model_copy(update={"title": "uncached"}))
        return c.rename(case["source"], case["target"])
    if case["result"] == "CollisionError":
        with pytest.raises(CollisionError):
            mutate()
        assert ex.plans == []
        assert embedder.calls == []
        assert c.index.to_dict() == before
        assert {p.relative_to(tmp_path): p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()} == before_files
    else:
        result = mutate()
        assert result.uid == "source"
        assert [op.op for op in ex.plans[0]] == case["result"]
        assert c.get(case["source"]).id == case["target"]
        assert Corpus(tmp_path).get(case["target"]).uid == "source"
```

```typescript
type Seed = { id: string; uid: string; deprecated_ids?: string[] };
type Group = { name: string; nodes: Seed[]; rows: Array<[string, string]> };
type Mutation = { name: string; source: string; action: "add" | "rename"; target: string; result: "CollisionError" | string[] };
const oracle = JSON.parse(readFileSync(fileURLToPath(new URL("../../fixtures/path-collision.oracle.json", import.meta.url)), "utf-8")) as {
  groups: Group[]; mutations: Mutation[]; case_findings: Array<Record<string, string>>;
};
function seed(raw: Seed): Node {
  return makeNode({ id: raw.id, uid: raw.uid, kind: raw.id.split(":", 1)[0], title: raw.id, deprecatedIds: raw.deprecated_ids ?? [] });
}
for (const group of oracle.groups) {
  it(`index group: ${group.name}`, () => {
    const index = Index.build(group.nodes.map(seed));
    const sortRows = (rows: Array<[string, string]>) => rows.sort((a, b) => compareCodepoints(a[0], b[0]));
    expect(sortRows(index.pathCollisions())).toEqual(group.rows);
    expect(sortRows(Index.fromDict(index.toDict()).pathCollisions())).toEqual(group.rows);
  });
}
for (const row of oracle.mutations) {
  it(`mutation: ${row.name}`, () => {
    const ex = new RecordingExecutor(root);
    const calls: string[] = [];
    const embedder = {
      cacheNamespace: "path-collision-test",
      embed(texts: string[]): number[][] {
        calls.push(...texts);
        return texts.map(() => [1, 0]);
      },
    };
    const c = new Corpus(root, undefined, embedder, () => ex);
    c.add(seed({ id: row.source, uid: "source" }));
    ex.plans.length = 0;
    calls.length = 0;
    if (row.result === "CollisionError") {
      if (c.vectorIndex === undefined) throw new Error("test requires vector index");
      vi.spyOn(c.vectorIndex, "prepare").mockImplementation(() => { throw new Error("prepare must not run"); });
    }
    const beforeFiles = filesAt(root);
    const before = c.index.toDict();
    const sourcePath = c.store.pathFor(row.source);
    const beforeBytes = readFileSync(sourcePath);
    const mutate = () => row.action === "add"
      ? c.add({ ...seed({ id: row.target, uid: "candidate" }), title: "uncached" })
      : c.rename(row.source, row.target);
    if (row.result === "CollisionError") {
      expect(mutate).toThrow(CollisionError);
      expect(ex.plans).toEqual([]);
      expect(calls).toEqual([]);
      expect(filesAt(root)).toEqual(beforeFiles);
      expect(c.index.toDict()).toEqual(before);
      expect(readFileSync(sourcePath)).toEqual(beforeBytes);
      expect(c.all().map(n => n.id)).toEqual([row.source]);
    } else {
      expect(mutate().uid).toBe("source");
      expect(ex.plans[0].map(op => op.op)).toEqual(row.result);
      expect(c.get(row.source).id).toBe(row.target);
      expect(new Corpus(root).get(row.target).uid).toBe("source");
    }
  });
}
```

The runners use these test-local helpers. Python's rglob reads only the controlled
regular test tree. TS's helper includes cache entries and empty directory names so
refusal proves no side effects. Import `readdirSync` and Vitest `vi` in TS. Restore
spies in the existing afterEach cleanup with `vi.restoreAllMocks()`.

```python
class CountingEmbedder:
    cache_namespace = "path-collision-test"
    def __init__(self):
        self.calls = []
    def embed(self, texts):
        self.calls.extend(texts)
        return [(1.0, 0.0) for _ in texts]
```

```typescript
function filesAt(root: string): Array<[string, Buffer | null]> {
  const rows: Array<[string, Buffer | null]> = [];
  function walk(rel: string): void {
    for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
      const name = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        rows.push([`${name}/`, null]);
        walk(name);
      } else {
        rows.push([name, readFileSync(join(root, name))]);
      }
    }
  }
  walk("");
  return rows.sort((a, b) => compareCodepoints(a[0], b[0]));
}
```

A cache hit can conceal premature preparation on rename, so the refusal cases also
replace `prepare` with an immediate failing spy. The expected CollisionError proves
refusal preceded preparation, even when the existing node already has a cached vector.

- [ ] **Step 3: Run `just test-fast`.** Expected red: case-only rename reaches execution or collision findings absent. Index-only groups may already pass after Task 1.

- [ ] **Step 4: Add Corpus integration.** After live-source/unresolved-target checks and binding the source uid in rename, before reading/referrer gathering/vector preparation, insert:

```python
self.index.assert_path_available(uid, new_id)
```

```typescript
this.index.assertPathAvailable(uid, newId);
```

Keep existing exact-path ReplaceOp branch unchanged. Append findings before existing final sorting:

```python
for live_id, key in self.index.path_collisions():
    findings.append(Finding(
        severity="warning", code="path-collision", ref=live_id, detail=key,
        message=f"{live_id}: mapped path collides at {key!r}",
    ))
```

```typescript
for (const [liveId, key] of this.index.pathCollisions()) {
  findings.push({ severity: "warning", code: "path-collision", ref: liveId, detail: key,
    message: `${liveId}: mapped path collides at ${JSON.stringify(key)}` });
}
```

Update check docstrings to include portability warnings; no registry required. Existing add wiring from Task 1 needs no second guard.

- [ ] **Step 5: Pin temporary-id rename, occupied-other-uid refusal, same-(uid,id) replacement and existing-collision lifecycle.** Add these tests in both harnesses:

```python
def test_temporary_id_rename_and_occupied_destination(tmp_path):
    c = Corpus(tmp_path)
    c.add(seed({"id": "kind:A", "uid": "a"}))
    c.rename("kind:A", "kind:tmp")
    c.rename("kind:tmp", "kind:a")
    assert c.get("kind:A").id == "kind:a"
    assert c.get("kind:tmp").uid == "a"
    c.add(seed({"id": "kind:x", "uid": "x"}))
    c.add(seed({"id": "kind:C", "uid": "c"}))
    with pytest.raises(CollisionError):
        c.rename("kind:x", "kind:c")
```

```typescript
it("allows a temporary-id rename and refuses another uid's folded path", () => {
  const c = new Corpus(root);
  c.add(seed({ id: "kind:A", uid: "a" }));
  c.rename("kind:A", "kind:tmp");
  c.rename("kind:tmp", "kind:a");
  expect(c.get("kind:A").id).toBe("kind:a");
  expect(c.get("kind:tmp").uid).toBe("a");
  c.add(seed({ id: "kind:x", uid: "x" }));
  c.add(seed({ id: "kind:C", uid: "c" }));
  expect(() => c.rename("kind:x", "kind:c")).toThrow(CollisionError);
});
```

The occupied destination `kind:c` is unresolved by identity; it exercises the path
check against a different uid, not an already-resolving alias.

For the well-placed case pair, use exclusive creation before writing valid seed contents. Python probe:

```python
def require_case_pair(root):
    folder = root / "kind"
    folder.mkdir()
    (folder / "A.md").write_bytes(b"")
    try:
        with (folder / "a.md").open("xb"):
            pass
    except FileExistsError:
        pytest.skip("volume cannot hold kind/A.md and kind/a.md separately")
```

TS probe in the individual filesystem test, with Vitest test context:

```typescript
function requireCasePair(root: string): boolean {
  mkdirSync(join(root, "kind"));
  writeFileSync(join(root, "kind/A.md"), "", { flag: "wx" });
  try {
    writeFileSync(join(root, "kind/a.md"), "", { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
  return true;
}
// Inside it("...", (ctx) => { ... }):
if (!requireCasePair(root)) { ctx.skip(); return; }
```

After the successful probe, these tests cover cold rebuild, incremental admission,
full restore, replacement and both repair operations. Import Registry/KindSpec,
snapshot_path/load_snapshot (TS Registry, snapshotPath/loadSnapshot). The explicit
load assertion prevents a rejected snapshot fallback from passing as restore coverage.

```python
@pytest.mark.parametrize("with_registry", [False, True])
def test_case_corpus_lifecycle(tmp_path, with_registry):
    require_case_pair(tmp_path)
    (tmp_path / "kind/A.md").unlink()
    (tmp_path / "kind/a.md").unlink()
    reg = None
    if with_registry:
        reg = Registry()
        reg.register(KindSpec(name="kind"))
    store = Store(tmp_path)
    a = seed({"id": "kind:A", "uid": "a"})
    b = seed({"id": "kind:a", "uid": "b"})
    store.write_file(a)
    Corpus(tmp_path, registry=reg).flush_index()
    store.write_file(b)  # external introduction after one-node snapshot
    c = Corpus(tmp_path, registry=reg)
    def findings(corpus):
        return [{k: getattr(f, k) for k in ("severity", "code", "ref", "detail")} for f in corpus.check()]
    assert findings(c) == ORACLE["case_findings"]
    c.flush_index()
    assert load_snapshot(tmp_path, None) is not None
    c = Corpus(tmp_path, registry=reg)
    assert findings(c) == ORACLE["case_findings"]
    snapshot_path(tmp_path).unlink()
    c = Corpus(tmp_path, registry=reg)
    assert findings(c) == ORACLE["case_findings"]
    assert c.get(a.id).uid == "a" and c.get(b.id).uid == "b"
    c.add(a.model_copy(update={"title": "Replacement"}))
    assert findings(c) == ORACLE["case_findings"]
    c.rename("kind:a", "kind:b")
    assert findings(c) == []
    c.delete("kind:b")  # release its deprecated kind:a identity claim
    store.write_file(b)
    c = Corpus(tmp_path, registry=reg)
    assert findings(c) == ORACLE["case_findings"]
    c.delete("kind:a")
    assert findings(c) == []
```

```typescript
for (const withRegistry of [false, true]) {
  it(`case corpus lifecycle, registry=${withRegistry}`, (ctx) => {
    if (!requireCasePair(root)) { ctx.skip(); return; }
    rmSync(join(root, "kind/A.md"));
    rmSync(join(root, "kind/a.md"));
    const reg = withRegistry ? new Registry() : undefined;
    reg?.register({ name: "kind" });
    const store = new Store(root);
    const a = seed({ id: "kind:A", uid: "a" });
    const b = seed({ id: "kind:a", uid: "b" });
    store.writeFile(a);
    new Corpus(root, reg).flushIndex();
    store.writeFile(b);
    let c = new Corpus(root, reg);
    const findings = (corpus: Corpus) => corpus.check().map(({ severity, code, ref, detail }) => ({ severity, code, ref, detail }));
    expect(findings(c)).toEqual(oracle.case_findings);
    c.flushIndex();
    expect(loadSnapshot(root, null)).not.toBeNull();
    c = new Corpus(root, reg);
    expect(findings(c)).toEqual(oracle.case_findings);
    rmSync(snapshotPath(root));
    c = new Corpus(root, reg);
    expect(findings(c)).toEqual(oracle.case_findings);
    expect(c.get(a.id).uid).toBe("a");
    expect(c.get(b.id).uid).toBe("b");
    c.add({ ...a, title: "Replacement" });
    expect(findings(c)).toEqual(oracle.case_findings);
    c.rename("kind:a", "kind:b");
    expect(findings(c)).toEqual([]);
    c.delete("kind:b");
    store.writeFile(b);
    c = new Corpus(root, reg);
    expect(findings(c)).toEqual(oracle.case_findings);
    c.delete("kind:a");
    expect(findings(c)).toEqual([]);
  });
}
```

The exact `:`/`__` two-claimant case remains index-only. The registry case must emit
exactly the same two findings; it must not suppress or duplicate them.

- [ ] **Step 6: Run `just test-fast`, then `just gate`.** All logical cases run on every volume; only the two-file lifecycle can skip. Inspect test output for expected executed cases. Run `tasks done nodes-45a188 "Task 2 verified; held for the single C implementation commit"`; leave changes uncommitted.

### Task 3: Non-empty opaque uids and code-point ordering

**Files:**
- Modify: `.worktrees/nodes-2.0/python/src/nodes/core/node.py`, `structural_index.py`; `.worktrees/nodes-2.0/ts/src/node.ts`, `structural-index.ts`, `corpus.ts`.
- Create: `.worktrees/nodes-2.0/fixtures/uid.oracle.json`.
- Modify: `.worktrees/nodes-2.0/python/tests/test_node.py`, `test_index_snapshot.py`, `test_snapshot_load.py`, `test_corpus_traversal.py`.
- Modify: `.worktrees/nodes-2.0/ts/tests/node.test.ts`, `index-snapshot.test.ts`, `snapshot-load.test.ts`, `corpus-traversal.test.ts`.
- Extend: `.worktrees/nodes-2.0/fixtures/corpus/`, `corpus.rename.canonical.json`, `write-plan.rename.canonical.json`; their four existing parity runners.

**Interfaces:**
- Consumes: existing `compareCodepoints(a: string, b: string): number` from search.ts, Node constructors, Markdown parsers, snapshot fallback and semantic rename projections.
- Produces: empty uid → kernel ValidationError; non-empty supplied uid preserved exactly; empty structural snapshot entry → invalid-cache fallback. Existing snapshots with valid uids retain their schema and acceptance.
- Produces: code-point order for neighbor uids, referrer uids and manifest paths. Python already supplies this ordering.

- [ ] **Step 0: Start this task.** Run `tasks start nodes-bbb832`.

- [ ] **Step 1: Add the uid-only oracle and schema/parsing tests.**

```json
{"accepted":["not-a-digest"," ","é","é","","𐀀"],"rejected":[""]}
```

The fourth accepted string is `e` + U+0301, distinct from U+00E9. Load the JSON in both node test files; for every accepted uid construct a node, serialize and parse Markdown, and assert exact uid equality. For each rejected uid assert kernel ValidationError from both direct construction and Markdown parsing with a quoted uid. Code:

```python
import json
from pathlib import Path
from nodes.core.frontmatter import node_from_markdown, node_to_markdown

UID_ORACLE = json.loads((Path(__file__).parents[2] / "fixtures/uid.oracle.json").read_text())

@pytest.mark.parametrize("uid", UID_ORACLE["accepted"])
def test_opaque_uid(uid):
    node = Node(id="kind:a", uid=uid, kind="kind", title="A")
    assert node.uid == uid
    assert node_from_markdown(node_to_markdown(node)).uid == uid


@pytest.mark.parametrize("uid", UID_ORACLE["rejected"])
def test_empty_uid_refused(uid):
    with pytest.raises(ValidationError):
        Node(id="kind:a", uid=uid, kind="kind", title="A")
    with pytest.raises(ValidationError):
        node_from_markdown('---\nid: kind:a\nuid: ""\nkind: kind\ntitle: A\n---\n')
```

```typescript
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { nodeFromMarkdown, nodeToMarkdown } from "../src/frontmatter.js";
const uidOracle = JSON.parse(readFileSync(fileURLToPath(new URL("../../fixtures/uid.oracle.json", import.meta.url)), "utf-8")) as { accepted: string[]; rejected: string[] };

for (const uid of uidOracle.accepted) {
  it(`preserves opaque uid ${JSON.stringify(uid)}`, () => {
    const node = makeNode({ id: "kind:a", uid, kind: "kind", title: "A" });
    expect(node.uid).toBe(uid);
    expect(nodeFromMarkdown(nodeToMarkdown(node)).uid).toBe(uid);
  });
}
for (const uid of uidOracle.rejected) {
  it("refuses empty uid in construction and Markdown", () => {
    expect(() => makeNode({ id: "kind:a", uid, kind: "kind", title: "A" })).toThrow(ValidationError);
    expect(() => nodeFromMarkdown('---\nid: kind:a\nuid: ""\nkind: kind\ntitle: A\n---\n')).toThrow(ValidationError);
  });
}
```

Add to index snapshot tests:

```python
def test_opaque_uid_resolution_and_invalid_empty_restore():
    node = Node(id="kind:a", uid="not a digest", kind="kind", title="A", deprecated_ids=["kind:old"])
    index = Index.from_dict(Index.build([node]).to_dict())
    assert index.resolve_uid("kind:a") == node.uid
    assert index.resolve_uid("kind:old") == node.uid
    with pytest.raises(CollisionError):
        index.assert_addable(Node(id="kind:old", uid="other", kind="kind", title="Other"))
    doc = index.to_dict()
    doc["entries"][0]["uid"] = ""
    with pytest.raises(ValueError):
        Index.from_dict(doc)


def test_resolution_uses_none_not_truthiness():
    index = Index()
    index.id_to_uid["kind:a"] = ""
    index.deprecated_to_uid["kind:a"] = "alias-owner"
    assert index.resolve_uid("kind:a") == ""
```

```typescript
it("resolves opaque uid claims and rejects an empty restored uid", () => {
  const node = makeNode({ id: "kind:a", uid: "not a digest", kind: "kind", title: "A", deprecatedIds: ["kind:old"] });
  const index = Index.fromDict(Index.build([node]).toDict());
  expect(index.resolveUid("kind:a")).toBe(node.uid);
  expect(index.resolveUid("kind:old")).toBe(node.uid);
  expect(() => index.assertAddable(makeNode({ id: "kind:old", uid: "other", kind: "kind", title: "Other" }))).toThrow(CollisionError);
  const doc = index.toDict();
  doc.entries[0].uid = "";
  expect(() => Index.fromDict(doc)).toThrow("non-empty");
});
```

The Python lookup test sets maps directly to isolate sentinel behavior; it does not
represent an empty uid as a valid Node.

- [ ] **Step 2: Run `just test-fast`.** Expected red: empty uid is accepted; Python truthiness lookup chooses the alias owner.

- [ ] **Step 3: Enforce presence at existing validation boundaries.** Extend Python's existing after-model validator before its id/kind checks, so direct Node construction raises the kernel error (a Field min_length alone would leak Pydantic's exception):

```python
if self.uid == "":
    raise ValidationError("uid must be non-empty")
```

TS NodeSchema's uid line becomes `uid: z.string().min(1, "uid must be non-empty").default(() => newUid()),`; makeNode already wraps Zod errors. Do not trim or normalize. Fix Python resolve_uid:

```python
uid = self.id_to_uid.get(ref)
return uid if uid is not None else self.deprecated_to_uid.get(ref)
```

Extend the existing structural snapshot string check:

```python
if not isinstance(uid, str) or uid == "":
    raise ValueError("structural snapshot: entry uid must be a non-empty string")
```

```typescript
if (typeof uid !== "string" || uid.length === 0) {
  throw new Error("structural snapshot: entry uid must be a non-empty string");
}
```

Add this cache-bypass regression to the existing snapshot-load test files. Import
Corpus, Store, kernel ValidationError, Markdown serialization and hash_bytes/hashBytes.
The test deliberately mutates a valid Node after construction to reproduce a cache
written by the old schema; no production code gains a bypass.

```python
def test_old_empty_uid_snapshot_cannot_bypass_document_validation(tmp_path):
    node = Node(id="topic:a", uid="valid", kind="topic", title="A")
    node.uid = ""
    Store(tmp_path).write_file(node)
    data = (tmp_path / "topic/a.md").read_bytes()
    manifest = [ManifestEntry(path="topic/a.md", sha256=hash_bytes(data), uid="")]
    write_snapshot(tmp_path, manifest, Index.build([node]), SearchIndex.build([node]), None)
    assert load_snapshot(tmp_path, None) is None
    with pytest.raises(ValidationError):
        Corpus(tmp_path)
    node.uid = "repaired"
    Store(tmp_path).write_file(node)
    assert Corpus(tmp_path).get("topic:a").uid == "repaired"
```

```typescript
it("rejects an old empty-uid snapshot before it can bypass document validation", () => {
  const node = makeNode({ id: "topic:a", uid: "valid", kind: "topic", title: "A" });
  node.uid = "";
  new Store(root).writeFile(node);
  const data = readFileSync(join(root, "topic/a.md"));
  const manifest = [{ path: "topic/a.md", sha256: hashBytes(data), uid: "" }];
  writeSnapshot(root, manifest, Index.build([node]), SearchIndex.build([node]), undefined);
  expect(loadSnapshot(root, null)).toBeNull();
  expect(() => new Corpus(root)).toThrow(ValidationError);
  node.uid = "repaired";
  new Store(root).writeFile(node);
  expect(new Corpus(root).get("topic:a").uid).toBe("repaired");
});
```

Neither rejection is a finding. A valid non-empty opaque-uid snapshot must continue
loading without a schema bump.

- [ ] **Step 4: Extend the existing rename fixture to expose UTF-16 sorting.** Add two referrers with uids U+E000 and U+10000, ids `note:bmp` and `note:nonbmp`, and one `related: [topic:old]` relation each. The existing three documents retain their uid values and bytes. New Markdown, with actual Unicode characters represented by JSON-style YAML escapes:

```yaml
---
id: note:bmp
uid: "\uE000"
kind: note
title: BMP
related:
- topic:old
---
```

```yaml
---
id: note:nonbmp
uid: "\U00010000"
kind: note
title: NonBMP
related:
- topic:old
---
```

Each file ends in a newline. Update `corpus.rename.canonical.json` by inserting the two canonical documents in live-id order. Canonical shape equals note:r except: respective id/uid/title, one relatesTo relation sourced at its own id targeting topic:new, no cites relation. Append their ReplaceOp rows to `write-plan.rename.canonical.json`, after note:r and graph:g, in order **note:bmp then note:nonbmp**. The expected digests are SHA-256 of the exact new fixture Markdown bytes; compute with stdlib hashlib, not the implementation under test. Set content to the same canonical post-rename document. Existing rows stay unchanged.

Add explicit sequence assertions to the existing write-plan parity runners:

```python
assert [op.path for op in plan] == [
    "topic/new.md", "topic/old.md", "note/r.md", "graph/g.md", "note/bmp.md", "note/nonbmp.md",
]
```

```typescript
expect(captured[0].plans[0].map(op => op.path)).toEqual([
  "topic/new.md", "topic/old.md", "note/r.md", "graph/g.md", "note/bmp.md", "note/nonbmp.md",
]);
```

Add neighbor ordering tests to the traversal tests; import relates_to / relatesTo.
Python code points U+E000 and U+10000 have the opposite UTF-16 ordering, and Node
objects remain the return type:

```python
def test_neighbor_uid_codepoint_order_survives_reload(tmp_path):
    c = Corpus(tmp_path)
    for slug, uid in [("bmp", "\uE000"), ("nonbmp", "\U00010000")]:
        c.add(Node(id=f"kind:{slug}", uid=uid, kind="kind", title=slug))
    c.add(Node(id="kind:center", uid="center", kind="kind", title="Center", relations=[
        relates_to("kind:center", "kind:nonbmp"), relates_to("kind:center", "kind:bmp"),
    ]))
    assert [n.uid for n in c.neighbors("kind:center")] == ["\uE000", "\U00010000"]
    c.flush_index()
    assert [n.uid for n in Corpus(tmp_path).neighbors("kind:center")] == ["\uE000", "\U00010000"]
```

```typescript
it("orders neighbor nodes by uid code points before and after reload", () => {
  const c = new Corpus(root);
  for (const [slug, uid] of [["bmp", "\uE000"], ["nonbmp", "\u{10000}"]]) {
    c.add(makeNode({ id: `kind:${slug}`, uid, kind: "kind", title: slug }));
  }
  c.add(makeNode({ id: "kind:center", uid: "center", kind: "kind", title: "Center", relations: [
    relatesTo("kind:center", "kind:nonbmp"), relatesTo("kind:center", "kind:bmp"),
  ] }));
  expect(c.neighbors("kind:center").map(n => n.uid)).toEqual(["\uE000", "\u{10000}"]);
  c.flushIndex();
  expect(new Corpus(root).neighbors("kind:center").map(n => n.uid)).toEqual(["\uE000", "\u{10000}"]);
});
```

- [ ] **Step 5: Run `just test-fast`.** Expected TS red: rename's referrer plan order and neighbor uid order put the non-BMP uid first. Python is the code-point baseline.

- [ ] **Step 6: Replace the three remaining TS sorts.** Use the already imported comparator; retain all other mutation/order behavior:

```typescript
// flushIndex manifest:
const manifest = [...this.manifest.values()].sort((a, b) => compareCodepoints(a.path, b.path));
// neighbors' existing uid collection:
return [...neighborUids].sort(compareCodepoints).map((u) => this.store.readFile(this.idFor(u)));
// rename's existing referrer loop:
for (const referrerUid of [...referrerUids].sort(compareCodepoints)) {
```

Neighbors continues returning Node objects; only their ordering comparator changes. No new traversal API. Manifest paths produced from valid ids are ASCII, so the sort is a consistency pin; do not invent invalid-id filesystem fixtures to test it. Keep the existing path-sorted snapshot assertions.

- [ ] **Step 7: Run `just test-fast`, then `just gate`.** Check the four rename parity runners still read the same shared input corpus and both updated oracles; no uid case appears in path-collision.oracle.json. Run `tasks done nodes-bbb832 "Task 3 verified; held for the single C implementation commit"`; leave changes uncommitted.

### Task 4: Normative amendment and C closeout

**Files:**
- Modify: `.worktrees/nodes-2.0/docs/STANDARD.md`.
- Modify: `.worktrees/nodes-2.0/docs/designs/2026-08-17-nodes-write-plan-executor-seam-design.md` (§2 and §8 only; preserve E's broad status transition).
- Modify: `.worktrees/nodes-2.0/docs/designs/2026-09-11-nodes-2.0-remainder-design.md`, `2026-09-11-nodes-digest-id-hazards-design.md`, and this plan's verified status/checklists.
- Mutate task records only through CLI.

**Interfaces:**
- Consumes: verified behavior and fixtures from Tasks 1–3.
- Produces: one reviewable C commit on nodes-2.0 with same-change STANDARD/fixtures/code, closed children and parent. E still owns version/history/marker cleanup and the main merge remains the umbrella's closeout.

- [ ] **Step 0: Start this task.** Run `tasks start nodes-bf3fc1`.

- [ ] **Step 1: Amend STANDARD with the following contract, retaining adjacent guarantees.** Every amended clause/row gets `*(2.0)*` once; reuse existing markers where the whole clause is already marked.

| Section | Exact amendment content |
| --- | --- |
| §2.1 uid row | `Immutable, corpus-unique, non-empty opaque string; survives renames. Required. Nodes preserves supplied strings without shape constraints or normalization; minting policy belongs to a profile. Convenience constructors may retain their UUID-hex default. An empty uid MUST raise ValidationError.` |
| §3 collision bullet | Existing live/deprecated-id and duplicate-uid refusals remain. Construction admits otherwise legal path-collided claimants; mutation checks path availability (§4.1). Same-(uid,id) add replaces its own claim. |
| §3 rename | Before referrer preparation, embedding/cache work or executor invocation, refuse an occupied collision key with CollisionError, except when the source uid already owns the exact mapped path. A differently spelled same-key destination is refused, including case-only rename on a case-sensitive volume. Preserve live-source/unresolved-target checks and every reference rewrite guarantee. |
| §3 rename atomicity | Execution replaces the source in place when exact mapped paths match; otherwise it creates the new document then deletes the old. Referrer replacements follow in ascending uid Unicode code-point order. Keep preparation/validation guarantees and leave the seam's pending crash amendment to E. |
| §4.1 | A well-placed member's literal root-relative path equals its live id's mapped path exactly. The collision key is NFC followed by default case folding of that mapped path; deprecated ids and observed physical filenames are not inputs. Current ASCII id grammar permits lowercase as the equivalent implementation. Do not claim C enforces disk placement. |
| §6 error row | Add mapped-path admission collision to the existing CollisionError row. |
| §7 add | Collision checking includes identity claims and mapped-path admission, before vector preparation or effects. A same-(uid,id) replacement stays allowed even if the corpus already has a path-collision warning. |
| §7 relation queries | neighbors returns nodes ordered by their distinct resolved uids in ascending Unicode code-point order. Preserve dangling and input-ref rules. |
| §8.2 finding table | `path-collision | warning | collision key | one per live claimant in a key bucket containing multiple uids; ref = live id` |
| §8.2 exhaustive structural list | Preserve dangling-ref and dangling-member counts/dedup; add one path-collision per live claimant, registry-independent. Three claimants produce three findings. Existing final (ref,code,detail) code-point sort remains. |
| §11.2 | Add path-collision.oracle.json for mapped-path collision admission/reporting; uid.oracle.json for non-empty opaque uid acceptance; include write-plan.rename.canonical.json alongside corpus/ and corpus.rename.canonical.json, naming code-point referrer ordering and semantic plan parity. |

- [ ] **Step 2: Update seam and design records.** Seam §2's rename plan description must distinguish exact-path in-place replacement from create/delete and specify code-point uid referrer order. Add §8 row: `2026-09-11 | §2 | exact-path rename replacement and code-point referrer order | nodes-side review | rename unexercised by recorded Science add-only slice`. Preserve A's pending Science sign-off and other rows verbatim. No consumer notification.

Replace umbrella §C's “one helper for add and reconcile” with the identity-only construction/reconcile versus mutation-admission split. Record reviewed policy: warning, exact-path replace, case-only refusal, temporary-id workaround, non-empty opaque uid; shared collision oracle and existing rename collation fixtures. Mention snapshot manifest placement validation already exists but its cold fallback and changed-file reconciliation still require B's admission checks. Mark C's own design implemented on nodes-2.0 only after verifying the implementation exists; mark this plan completed on the branch with verification evidence. Do not fabricate a future commit hash in either status.

- [ ] **Step 3: Review the complete diff and propagated claims.** Use `git diff --check`, `git diff --stat`, and inspect the combined code/fixture/docs diff. Search user-facing docs:

```bash
rg -n '32-char|uid.*SHOULD|assert_addable|assertAddable|case.only|write-new-then-delete-old|referrer.*order|pathForNodeId|path-collision' docs python/README.md ts/README.md
rg -n '\*\(2\.0\)\*|\*\*Pending:\*\*' docs/STANDARD.md
```

Correct current instructions contradicted by C; retain explicitly historical descriptions. E still owns broad redesign/seam status headers and §12 history. Confirm no package rename drift. Review staged code against design, including `_drop` replacement cleanup, index restoration, refusal before cache writes, and exact-path file preservation. Use the selected execution skill's review workflow; resolve concrete findings before closeout.

- [ ] **Step 4: Close tasks, gate, commit.** After review, run `tasks done nodes-bf3fc1 "C normative amendment and review complete"`, then `tasks done nodes-cd59f0 "Path collision admission/reporting and non-empty opaque uid ordering implemented in both languages"`. Run `tasks check` (zero errors; report every warning), then `just gate`. If either fails, fix the cause before committing and rerun the affected check. With gate green:

```bash
git add python ts fixtures docs tasks
git diff --cached --check
git commit -m 'feat!: guard digest-id paths and define opaque uid presence'
git status --short
```

Report commit hash, gate results, task-check warnings and any skipped volume-specific cases. Keep nodes-2.0 for B/F/E/G; do not merge or remove the worktree.
