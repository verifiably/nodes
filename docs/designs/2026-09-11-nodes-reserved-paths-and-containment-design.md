# Reserved paths and containment — design

**Date:** 2026-09-11
**Status:** approved; sub-task A of `2026-09-11-nodes-2.0-remainder-design.md`
**Task:** `nodes-01111b`
**Source:** `2026-08-03-nodes-under-the-system-redesign-design.md` §2.2 (as amended
2026-08-17); seam design §5.

## 1. The contract

Two guarantees, stated separately in STANDARD §4.1 and marked *(2.0)*:

**Non-Markdown content.** Nodes never reads, writes, or deletes content under the corpus
root other than `*.md` files, with one exception: its own reserved namespace. The reserved
list is closed and versioned here — exactly `.nodes-index/`, as the root's direct child.
Consumers may place **non-Markdown** artifacts at any other path under the root (a
manifest, a hash chain, a nested `.nodes-index/` of their own) with the guarantee they
are untouched; nested `.md` files are walked (§2). Nodes creates kind directories and its
cache directories on write; it never removes a directory. The reserved namespace is an
exception to this rule only — containment (next) applies inside it exactly as outside.

The guarantee is over nodes as a whole, not `Corpus` alone: `DefaultExecutor` is public,
so a plan is refused when any operation targets a path not ending in `.md`
(`PlanRefusedError`, lexical). Plans are sequences of node-document operations by
definition (seam §2); a caller wanting to write `corpus.yaml` is not using nodes to do it.

**Containment.** No path nodes yields, reads, writes, or deletes — node documents,
snapshots, vector cache entries, and their temporary siblings alike — has a symlink
component below the root. The root itself may be a symlink (`~/d/nodes` is one); containment is
stated relative to the root as given, so every touched path resolves inside the root's
own resolution. The walk never follows a symlink — file or directory, at any depth — and
skips it as a non-member.

**Boundary.** Both guarantees are checked at the moment of the operation and hold for the
filesystem as nodes observes it then. Nodes does not defend against a path being
substituted between inspection and effect, nor against the root being retargeted. That
is the deployment's obligation under the single-writer rule (STANDARD §7), which covers
every actor that edits the tree or the root's resolution, including actors outside
nodes. No locking is introduced.

Hard links are outside the guarantee by precondition, not by detection. A managed `.md`
hard-linked to a protected artifact shares its bytes, so replacing the node rewrites the
artifact, and no path-based check can see it. Nodes does not inspect link counts —
refusing `nlink > 1` would break deployments whose backup tooling hard-links live files
(`rsync --link-dest`, snapshotting filers). The deployment MUST NOT alias a managed file
to a protected artifact by hard link; STANDARD §4.1 states this precondition beside the
guarantee.

## 2. Reserved namespace: root-relative only

`.nodes-index` is reserved as the first root-relative component and nowhere else. All
three existing sites already read it that way (both walks and `validate_plan`). A nested
`<kind>/.nodes-index/x.md` is a foreign directory: the walk yields its `.md` files, and
the well-placed rule (sub-task B) then excludes them as misplaced. The reserved list is
a versioned constant in the standard; changes to it follow STANDARD §12's compatibility
rules — reserving a further root directory can hide existing nodes or take ownership of
artifacts a consumer relied on being protected, so it is not automatically minor.

Reserved-path validation must survive spelling. Today `validate_plan` checks the raw first
component, so `./.nodes-index/x` and `a/../.nodes-index/x` evade it; and it checks nothing
that would stop `C:/outside/x.md` or `..\outside\x.md`, which Python's Windows path
construction would then take outside the root. Rather than normalize, one shared
predicate — **portable root-relative path** — is defined once per language and used by
`validate_plan` and by the snapshot-manifest validator (which already rejects
backslashes and is aligned to the full rule):

- non-empty, no leading `/`;
- split on `/` only; every segment non-empty and neither `.` nor `..`;
- no segment contains `\` or `:` — `path_for` maps `:` to `__` and kind names admit
  neither character, so a legitimate segment never carries them, and this is what closes
  drive-qualified and backslash spellings before any platform path is built;
- the final segment ends in `.md`.

A plan path failing the predicate is lexically malformed (`PlanRefusedError`); a
reserved-namespace first segment is refused separately. Plan paths come from `path_for`
and are canonical by construction; nothing legitimate is lost, and the rule also closes
`link/../kind/x.md`, where the operating system resolves `..` through the link *target's*
parent — a hole lexical normalization would erase rather than catch. The physical
preflight (§4) then walks canonical segments only.

## 3. The walk

Python's `iter_corpus_files` moves from `Path.rglob` to an explicit `os.scandir`
recursion, the same shape as TypeScript's. This is not a traversal fix — CPython 3.11's
recursive glob already uses `is_dir(follow_symlinks=False)` — it is error propagation:
`rglob` suppresses `PermissionError`, silently dropping an unreadable subtree from
membership. TypeScript's walk today catches and ignores `readdirSync` failures for the
same silent outcome, and its `existsSync(root)` guard turns a missing root into an empty
corpus. Both walks now:

- skip any entry whose `lstat` says symlink, at any depth, without following it;
- exclude `.nodes-index` as the root's direct child only;
- yield regular `*.md` files, sorted by root-relative POSIX path in code-point order;
- propagate every filesystem failure — unreadable directory, missing root, `lstat`
  failure — as an exception. A filesystem failure is never a content finding and never
  absence (sub-task B keeps that line for construction findings).

## 4. Physical containment: the shared check and its callers

One helper per language — `assert_contained(root, rel_path)` /
`assertContained(root, relPath)` — inspects every prefix of a canonical root-relative
path below the root (`a`, `a/b`, `a/b/c.md`) with `lstat`:

- a prefix that does not exist is tolerated (a create's parents may be absent);
- a prefix that is a symlink refuses;
- a permission failure or any other inspection error refuses — it is not absence.

Refusal raises `ContainmentError`, a new kernel error under `NodesError`, so that the
condition is named rather than folded into "no node here". Callers:

**`DefaultExecutor.execute`** runs `validate_plan`, then a **whole-plan preflight**:
`assert_contained` over every operation's path before any effect. A refusal at
operation *i* raises `ExecutionError(index=i, applied=0)` with the containment error as
cause; nothing has been written. Per-op existence checks and writes then run as today.
A plan that passes preflight and then fails an existence check still leaves an applied
prefix, as seam §3 specifies.

**`Store.read_file` / `readFile`** and **`all_nodes` / `allNodes`** — the read paths
`Corpus.get`, `neighbors`, `rename`, and `check` use — call `assert_contained` before
opening. This is not redundant with the walk: until sub-task B lands, a misplaced member
makes `get()` reconstruct a path the walk never yielded, and after it the guard is what
makes the read guarantee enforced rather than inferred.

**Cache I/O.** Snapshot load runs before the walk (`Corpus.__init__`), and the snapshot
writer and `VectorCache` read and write `.nodes-index/...` directly, writing a `.tmp`
sibling and renaming, with `mkdir(parents=True)` on the way. A symlinked `.nodes-index`
therefore reaches outside the root today through every one of these. The helpers cannot
check what they cannot see: `read_json(path)` and `write_json_atomic(path, obj)` take an
arbitrary absolute path, and inferring a root from the file's parent would miss a
symlinked ancestor. Their signatures become root-aware — `read_json(root, rel_path)` and
`write_json_atomic(root, rel_path, obj)`, likewise in TypeScript where both are public
exports — and `rel_path` must be a portable root-relative path (§2, without the `.md`
rule) whose first segment is the reserved namespace; anything else is a `ValueError` /
`TypeError` programming error, not a containment refusal. `snapshot_path` returns that
relative path. `VectorCache` builds its entry paths the same way and calls the helpers.

Reads check the final path only; writes check the final path *and* the `.tmp` sibling,
before any `mkdir`, write, or rename. A read never touches the sibling, so a stray
symlink at `snapshot.py.json.tmp` must not block reading a sound snapshot.

`ContainmentError` propagates from construction and from `flush_index`; it is a
filesystem failure, never a finding, and never a rebuild trigger. Python's
`load_snapshot` fallback catches `(OSError, ValueError)` and so lets a `NodesError`
through already; TypeScript's catches every `Error` and must exempt `ContainmentError`
explicitly (`if (e instanceof ContainmentError) throw e`).

**`Store.write_file` / `delete_file`** and their TypeScript forms are public tier-3
conveniences that bypass the executor. They call `assert_contained` too; the contract
is stated over nodes, not over `Corpus` alone.

## 5. Shared fixture

Symlinks are not checkout-portable, so the tier-1 oracle is a description, not a tree:
`fixtures/containment.oracle.json` lists cases, each with a filesystem to materialize
(files with content, directories, symlinks whose targets are relative to the corpus root
or to a sibling `outside/` directory the harness creates), a root spelling (direct or via
a symlink), and an expectation. Each language's test harness materializes every case in
a temporary directory and asserts the outcome. Cases:

| case | expectation |
|---|---|
| directory symlink to an outside tree of `.md` files | not walked |
| file symlink to a `.md` inside the root | not walked |
| root is a symlink | walk yields the same paths; an add plan succeeds |
| `.nodes-index/x.md` at root | not walked |
| `<kind>/.nodes-index/x.md` nested | walked (B decides its status) |
| `corpus.yaml` and `<kind>/notes.txt` present | byte-identical after an add, rename, and delete plan |
| create onto a dangling symlink | `ExecutionError(index=0, applied=0)`; link target still absent |
| replace onto a file symlink | refused, `applied=0`; target bytes unchanged |
| delete onto a file symlink | refused, `applied=0`; link and target intact |
| create under a symlinked parent directory | refused, `applied=0` |
| two-op plan, symlink at op 1 | `index=1, applied=0`; op 0's path still absent |
| segment rule: plan paths `/a.md`, `a//b.md`, `./a.md`, `a/../b.md` | `PlanRefusedError` (each already carries the `.md` suffix, so only the segment rule can be what refuses it) |
| reserved rule: `.nodes-index/a.md`, `./.nodes-index/a.md`, `a/../.nodes-index/a.md` | `PlanRefusedError` |
| portability rule: `C:/outside/x.md`, `..\outside\x.md`, `a\b.md`, `kind/a:b.md` | `PlanRefusedError`; `outside/` untouched |
| suffix rule: `kind/a.txt`, `kind/a.md/` | `PlanRefusedError` |
| snapshot manifest row with `a\b.md` or `kind/a:b.md` | snapshot rejected as malformed (rebuild), matching the plan rule |
| `.nodes-index/snapshot.<lang>.json.tmp` is a stray symlink | construction reads the snapshot normally; `flush_index` raises `ContainmentError` and the target is unchanged |
| direct plan creating `corpus.yaml`, replacing `<kind>/notes.txt` | `PlanRefusedError`; both untouched |
| `.nodes-index` is a symlink to an outside directory | construction and `flush_index` raise `ContainmentError`; nothing written outside |
| `.nodes-index/snapshot.<lang>.json` is a file symlink | construction raises `ContainmentError`; target unread and unchanged |
| `.nodes-index/vectors/<ns>` is a directory symlink | vector cache put raises `ContainmentError`; target directory empty |
| `Store.read_file` of an id whose mapped path is a file symlink | `ContainmentError` |
| `Store.write_file` of a node whose mapped path is a file symlink | `ContainmentError`; target bytes unchanged |
| `Store.delete_file` of an id whose mapped path is a file symlink | `ContainmentError`; link and target intact |
| root does not exist | construction raises (the language's filesystem error), not an empty corpus |

Permission-failure cases (an unreadable directory under the root) stay in each language's
own tests, skipped when running as root, since their materialization is not portable to
a JSON description. The fixture's §11.2 row lands with it.

## 6. Standard and seam amendments

STANDARD §4.1 gains the two guarantees of §1, the hard-link precondition, the versioned
reserved list, and the portable root-relative path rule (shared with §10's snapshot
manifest); §7's write-path bullet cross-references seam §5 for the executor's
part. All marked *(2.0)*. `ContainmentError` joins the error list.

Seam design §3's `DefaultExecutor` row gains the whole-plan preflight and its
`ExecutionError(index=i, applied=0)`; the "lexically escaping path" sentence becomes the
canonical-segment rule. Both are amendments to a part Science's add-only cut-4 slice
exercises (create), so seam §8 requires Science sign-off. Two rows go in the log:

| date | part | change | reviewer | consumer sign-off |
| --- | --- | --- | --- | --- |
| 2026-09-11 | §3 | `DefaultExecutor` whole-plan symlink preflight refusing with `ExecutionError(index=i, applied=0)` before any effect; `validate_plan` applies the portable root-relative path rule (canonical segments, no `\\` or `:`, `.md` suffix) instead of normalizing. | `nodes`-side review | Science: **pending** |
| 2026-09-11 | §8 process | Implementation proceeds on branch `nodes-2.0` before Science's sign-off on the row above — a maintainer decision departing from §1's rule. Evidence offered, not sign-off: every plan the cut-4 adapter produces today targets a canonical `.md` path and no symlink, so its observed behaviour is unchanged. The row above stays pending until Science records its response. | maintainer | n/a — process record |

## 7. Files

`python/src/nodes/core/snapshot.py` (walk, cache I/O), `similarity.py` (`VectorCache`),
`store.py`, `write_plan.py`, `errors.py`; `ts/src/snapshot.ts`, `similarity.ts`,
`store.ts`, `write-plan.ts`, `errors.ts`, `index.ts` (export);
`fixtures/containment.oracle.json`; one parity test per language plus permission cases;
`docs/STANDARD.md` §§4.1, 7, 11.2, and the error list; the seam design §§3, 8.
