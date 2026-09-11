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
Consumers may place artifacts at any other path under the root (a manifest, a hash chain,
a nested `.nodes-index/` of their own) with the guarantee they are untouched. Nodes creates
kind directories on write; it never removes a directory.

**Containment.** No path nodes yields, reads, writes, or deletes has a symlink component
below the root. The root itself may be a symlink (`~/d/nodes` is one); containment is
stated relative to the root as given, so every touched path resolves inside the root's
own resolution. The walk never follows a symlink — file or directory, at any depth — and
skips it as a non-member.

**Boundary.** Both guarantees are checked at the moment of the operation and hold for the
filesystem as nodes observes it then. Nodes does not defend against a path being
substituted between inspection and effect, nor against the root being retargeted. That
is the deployment's obligation under the single-writer rule (STANDARD §7), which covers
every actor that edits the tree or the root's resolution, including actors outside
nodes. No locking is introduced.

## 2. Reserved namespace: root-relative only

`.nodes-index` is reserved as the first root-relative component and nowhere else. All
three existing sites already read it that way (both walks and `validate_plan`). A nested
`<kind>/.nodes-index/x.md` is a foreign directory: the walk yields its `.md` files, and
the well-placed rule (sub-task B) then excludes them as misplaced. The reserved list is
a versioned constant in the standard; adding to it is a minor amendment.

Reserved-path validation must survive spelling. Today `validate_plan` checks the raw first
component, so `./.nodes-index/x` and `a/../.nodes-index/x` evade it. Rather than normalize,
`validate_plan` refuses any plan path containing an empty, `.`, or `..` segment, or a
leading `/`, as lexically malformed (`PlanRefusedError`). Plan paths come from `path_for`
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

## 4. Physical containment: the shared check and its three callers

One helper per language — `assert_contained(root, rel_path)` /
`assertContained(root, relPath)` — inspects every prefix of a canonical root-relative
path below the root (`a`, `a/b`, `a/b/c.md`) with `lstat`:

- a prefix that does not exist is tolerated (a create's parents may be absent);
- a prefix that is a symlink refuses;
- a permission failure or any other inspection error refuses — it is not absence.

Refusal raises `ContainmentError`, a new kernel error under `NodesError`, so that the
condition is named rather than folded into "no node here". Three callers:

**`DefaultExecutor.execute`** runs `validate_plan`, then a **whole-plan preflight**:
`assert_contained` over every operation's path before any effect. A refusal at
operation *i* raises `ExecutionError(index=i, applied=0)` with the containment error as
cause; nothing has been written. Per-op existence checks and writes then run as today.
A plan that passes preflight and then fails an existence check still leaves an applied
prefix, as seam §3 specifies.

**`Store.read_file` / `readFile`** and **`all_nodes` / `allNodes`** — the read paths
`Corpus.get`, `neighbors`, `rename`, and `check` use — call `assert_contained` before
opening. `Corpus` never asks for a path the walk did not yield, so under the
single-writer rule this never fires; it exists so that the read guarantee is enforced,
not inferred.

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
| plan paths `./.nodes-index/x`, `a/../.nodes-index/x`, `a//b`, `/a` | `PlanRefusedError` |

Permission-failure cases (an unreadable directory under the root) stay in each language's
own tests, skipped when running as root, since their materialization is not portable to
a JSON description. The fixture's §11.2 row lands with it.

## 6. Standard and seam amendments

STANDARD §4.1 gains the two guarantees of §1, the versioned reserved list, and the
canonical-path rule; §7's write-path bullet cross-references seam §5 for the executor's
part. All marked *(2.0)*. `ContainmentError` joins the error list.

Seam design §3's `DefaultExecutor` row gains the whole-plan preflight and its
`ExecutionError(index=i, applied=0)`; the "lexically escaping path" sentence becomes the
canonical-segment rule. Both are amendments to a part Science's add-only cut-4 slice
exercises (create), so seam §8 requires Science sign-off. Two rows go in the log:

| date | part | change | reviewer | consumer sign-off |
| --- | --- | --- | --- | --- |
| 2026-09-11 | §3 | `DefaultExecutor` whole-plan symlink preflight refusing with `ExecutionError(index=i, applied=0)` before any effect; `validate_plan` refuses non-canonical segments instead of normalizing them. | `nodes`-side review | Science: **pending** |
| 2026-09-11 | §8 process | Implementation proceeds on branch `nodes-2.0` before Science's sign-off on the row above — a maintainer decision departing from §1's rule. Evidence offered, not sign-off: no plan the cut-4 adapter produces today targets a symlink or contains a non-canonical segment, so its observed behaviour is unchanged. The row above stays pending until Science records its response. | maintainer | n/a — process record |

## 7. Files

`python/src/nodes/core/snapshot.py` (walk), `store.py`, `write_plan.py`, `errors.py`;
`ts/src/snapshot.ts`, `store.ts`, `write-plan.ts`, `errors.ts`, `index.ts` (export);
`fixtures/containment.oracle.json`; one parity test per language plus permission cases;
`docs/STANDARD.md` §§4.1, 7, 11.2, and the error list; the seam design §§3, 8.
