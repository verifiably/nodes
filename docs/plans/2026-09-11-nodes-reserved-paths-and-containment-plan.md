# Reserved Paths and Containment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nodes never touches non-Markdown content outside `.nodes-index/`, and never follows a symlink below the corpus root on any path it walks, reads, writes, or deletes — in both kernels, pinned by one shared fixture.

**Architecture:** A new dependency-neutral module per language (`nodes.core.paths` / `ts/src/paths.ts`) holds the portable root-relative path predicate, `assert_contained`, and the root-aware JSON cache helpers. Its callers are the walk, `validate_plan` and `DefaultExecutor`'s whole-plan preflight, `Store`'s direct paths, and the snapshot and vector caches. `containment.oracle.json` describes filesystems to materialize; each language's harness builds them in a temp dir and asserts the outcome.

**Tech Stack:** Python 3.11+ (`os.scandir`, `os.lstat`, pytest), TypeScript / Node 20+ (`node:fs` `lstatSync`, vitest), biome, ruff, pyright.

**Spec:** `docs/designs/2026-09-11-nodes-reserved-paths-and-containment-design.md` (sub-task A of `docs/designs/2026-09-11-nodes-2.0-remainder-design.md`). Task: `nodes-01111b`.

## Global Constraints

- Work happens in the worktree `.worktrees/nodes-2.0` on branch `nodes-2.0`; every path below is relative to that worktree root.
- Every test run goes through `just` so `tools/tt` records it: `just test-fast` is the TDD inner loop (affected-only: pytest-testmon and `vitest --changed`, so a new or edited test file is exactly what runs), `just gate` is the checkpoint at the end of every task. Never call `pytest`, `vitest`, `npm test`, `ruff`, `pyright`, `tsc`, or `biome` directly.
- **One commit for A.** The umbrella's same-commit rule (code, STANDARD clauses, fixtures together) is met by committing sub-task A once, in Task 7. Tasks 1–6 end with a green `just gate` and a `tasks done` on their child record in the working tree, not a commit. Never commit mid-plan.
- **Child records.** Task N starts with `tasks start <child>` and ends with `tasks done <child> "<result>"`; the ids are Task 1 `nodes-e48507`, 2 `nodes-904ecf`, 3 `nodes-989525`, 4 `nodes-f072a8`, 5 `nodes-b72b50`, 6 `nodes-ceccb8`, 7 `nodes-c1fde3`. Task 7 closes the parent `nodes-01111b` and makes the single commit.
- **Symlink tests never pass vacuously.** Each test file that creates symlinks probes once at module load; the probe disables those tests (an explicit skip) only on a recognized unsupported platform — Windows without the symlink privilege (`EPERM` / `WinError 1314`) — and re-raises any other failure. On Linux and macOS CI every symlink case executes.
- Walk order is Unicode code-point order in both languages (spec §3); TypeScript's walk sort uses `compareCodepoints` from this plan on, so sub-task C inherits it done.
- STANDARD edits in this plan are marked `*(2.0)*` per the umbrella design §2; the header's `1.2` and the pending line stay as they are.
- No AI-attribution trailer in commit messages. Conventional commits.
- Reserved namespace: exactly `.nodes-index`, root-relative first segment only.
- Portable root-relative path: non-empty; no leading `/`; split on `/` only; every segment non-empty and neither `.` nor `..`; no segment contains `\` or `:`; the final segment ends in the required suffix (`.md` for plans and manifest rows; `.json` for cache paths).
- Cache paths are strictly beneath the namespace: first segment `.nodes-index` and at least one more segment.
- `assert_contained`: absent prefix tolerated; symlink refuses; any other inspection failure refuses. Refusal is `ContainmentError`.
- Executor preflight runs over the whole plan before any effect and raises `ExecutionError(index=i, applied=0)`.
- Reads check the final path only; writes check the final path and its `.tmp` sibling.
- Spec adjustments made by this plan (recorded in Task 7): `snapshot_path(root)` / `snapshotPath(root)` keep returning the absolute path — tests use it for filesystem assertions — and a relative constant `SNAPSHOT_REL_PATH` feeds the helpers; `all_nodes` / `allNodes` are contained by the walk (every component `lstat`ed on the way down) rather than by a second `assert_contained` pass.

---

### Task 1: `ContainmentError`, the portable-path predicate, and `assert_contained`

**Files:**
- Modify: `python/src/nodes/core/errors.py` (append after `PlanRefusedError`)
- Create: `python/src/nodes/core/paths.py`
- Modify: `python/src/nodes/core/write_plan.py:10` (`RESERVED_NAMESPACE` moves to `paths`)
- Modify: `ts/src/errors.ts` (append after `PlanRefusedError`)
- Create: `ts/src/paths.ts`
- Modify: `ts/src/write-plan.ts:5` (`RESERVED_NAMESPACE` moves to `paths`)
- Modify: `ts/src/index.ts` (export `ContainmentError`, `assertContained`, `isPortableRelativePath`)
- Test: `python/tests/test_paths.py`, `ts/tests/paths.test.ts`

**Interfaces:**
- Produces (Python): `nodes.core.errors.ContainmentError(NodesError)`; `nodes.core.paths.RESERVED_NAMESPACE = ".nodes-index"`; `is_portable_relative_path(path: str, *, suffix: str | None = ".md") -> bool`; `assert_contained(root: Path | str, rel_path: str) -> None` (raises `ValueError` for a non-portable `rel_path`, `ContainmentError` for a refusal).
- Produces (TypeScript): `ContainmentError extends NodesError`; `RESERVED_NAMESPACE`; `isPortableRelativePath(path: string, suffix: string | null = ".md"): boolean`; `assertContained(root: string, relPath: string): void` (throws `TypeError` for a non-portable `relPath`, `ContainmentError` for a refusal).

- [ ] **Step 0: Claim the child record**

Run: `tasks start nodes-e48507`

- [ ] **Step 1: Write the failing Python tests**

`python/tests/test_paths.py`:

```python
from __future__ import annotations

import os
import shutil
import stat
import tempfile
from pathlib import Path

import pytest

from nodes.core.errors import ContainmentError, NodesError
from nodes.core.paths import RESERVED_NAMESPACE, assert_contained, is_portable_relative_path


def _symlinks_supported() -> bool:
    """Probe once. Only a recognized unsupported-platform failure disables the symlink
    tests (an explicit skip); any other failure is a real error and propagates."""
    probe = Path(tempfile.mkdtemp(prefix="nodes-symlink-probe-"))
    try:
        (probe / "link").symlink_to(probe / "target")
        return True
    except OSError as exc:
        if os.name == "nt" and getattr(exc, "winerror", None) == 1314:
            return False
        raise
    finally:
        shutil.rmtree(probe, ignore_errors=True)


needs_symlinks = pytest.mark.skipif(not _symlinks_supported(), reason="symlinks unsupported on this platform")


def test_reserved_namespace_constant():
    assert RESERVED_NAMESPACE == ".nodes-index"


def test_containment_error_subclasses_base():
    assert issubclass(ContainmentError, NodesError)


@pytest.mark.parametrize("path", ["kind/a.md", "a.md", "kind/sub/deep.md", "kind/a__b.md"])
def test_portable_accepts_canonical_md_paths(path):
    assert is_portable_relative_path(path)


@pytest.mark.parametrize(
    "path",
    ["", "/a.md", "a//b.md", "./a.md", "a/../b.md", "a/./b.md", "a/", "a/b.md/"],
)
def test_portable_rejects_segment_violations(path):
    assert not is_portable_relative_path(path)


@pytest.mark.parametrize("path", ["C:/outside/x.md", "..\\outside\\x.md", "a\\b.md", "kind/a:b.md"])
def test_portable_rejects_backslash_and_colon(path):
    assert not is_portable_relative_path(path)


@pytest.mark.parametrize("path", ["kind/a.txt", "kind/a.md.bak", "kind/a"])
def test_portable_rejects_wrong_suffix(path):
    assert not is_portable_relative_path(path)


def test_portable_suffix_is_configurable():
    assert is_portable_relative_path(".nodes-index/snapshot.py.json", suffix=".json")
    assert not is_portable_relative_path(".nodes-index/snapshot.py.json", suffix=".md")
    assert is_portable_relative_path("kind/anything", suffix=None)


def test_assert_contained_rejects_non_portable_input(tmp_path):
    with pytest.raises(ValueError):
        assert_contained(tmp_path, "a/../b.md")


def test_assert_contained_tolerates_absent_prefix(tmp_path):
    assert_contained(tmp_path, "kind/not/yet/there.md")


def test_assert_contained_accepts_regular_path(tmp_path):
    (tmp_path / "kind").mkdir()
    (tmp_path / "kind" / "a.md").write_text("x", encoding="utf-8")
    assert_contained(tmp_path, "kind/a.md")


@needs_symlinks
def test_assert_contained_refuses_symlink_at_final_segment(tmp_path):
    (tmp_path / "kind").mkdir()
    target = tmp_path / "kind" / "real.md"
    target.write_text("x", encoding="utf-8")
    (tmp_path / "kind" / "a.md").symlink_to(target)
    with pytest.raises(ContainmentError):
        assert_contained(tmp_path, "kind/a.md")


@needs_symlinks
def test_assert_contained_refuses_dangling_symlink(tmp_path):
    (tmp_path / "kind").mkdir()
    (tmp_path / "kind" / "a.md").symlink_to(tmp_path / "kind" / "missing.md")
    with pytest.raises(ContainmentError):
        assert_contained(tmp_path, "kind/a.md")


@needs_symlinks
def test_assert_contained_refuses_symlinked_parent(tmp_path):
    outside = tmp_path.parent / f"{tmp_path.name}-outside"
    outside.mkdir()
    (tmp_path / "kind").symlink_to(outside)
    with pytest.raises(ContainmentError):
        assert_contained(tmp_path, "kind/a.md")


@needs_symlinks
def test_assert_contained_allows_symlinked_root(tmp_path):
    real = tmp_path / "real"
    (real / "kind").mkdir(parents=True)
    (real / "kind" / "a.md").write_text("x", encoding="utf-8")
    link = tmp_path / "link-root"
    link.symlink_to(real)
    assert_contained(link, "kind/a.md")


def test_assert_contained_treats_file_as_dir_as_refusal(tmp_path):
    (tmp_path / "kind").write_text("not a dir", encoding="utf-8")
    with pytest.raises(ContainmentError):
        assert_contained(tmp_path, "kind/a.md")


@pytest.mark.skipif(os.name != "posix" or os.geteuid() == 0, reason="needs an unprivileged POSIX user")
def test_assert_contained_refuses_on_permission_failure(tmp_path):
    locked = tmp_path / "kind"
    locked.mkdir()
    (locked / "a.md").write_text("x", encoding="utf-8")
    locked.chmod(0)
    try:
        with pytest.raises(ContainmentError):
            assert_contained(tmp_path, "kind/a.md")
    finally:
        locked.chmod(stat.S_IRWXU)
```

- [ ] **Step 2: Run to verify they fail**

Run: `just test-fast`
Expected: collection error — `ImportError: cannot import name 'ContainmentError'`.

- [ ] **Step 3: Add the error and the module (Python)**

Append to `python/src/nodes/core/errors.py`, directly after the `PlanRefusedError` class:

```python
class ContainmentError(NodesError):
    """Raised when a path under the corpus root has a symlink component below the
    root, or cannot be inspected. Refused before any effect."""
```

Also update `PlanRefusedError`'s docstring in the same file to the new rule:

```python
class PlanRefusedError(NodesError):
    """Raised when a write plan is lexically malformed: an unknown operation kind,
    a path that is not a portable root-relative `.md` path, or a reserved-namespace
    path. Refused before any effect."""
```

Create `python/src/nodes/core/paths.py`:

```python
"""Path rules shared by the walk, the write plan, the store, and the caches.

Imports only `errors`, so `snapshot` and `similarity` can both depend on it.
"""

from __future__ import annotations

import os
import stat
from pathlib import Path

from nodes.core.errors import ContainmentError

RESERVED_NAMESPACE = ".nodes-index"


def is_portable_relative_path(path: str, *, suffix: str | None = ".md") -> bool:
    """The one lexical rule for every root-relative path nodes accepts: split on `/`
    only, no empty/`.`/`..` segment, no segment carrying `\\` or `:` (a canonical
    segment never does — `path_for` maps `:` to `__`), and the required suffix."""
    if not path or path.startswith("/"):
        return False
    segments = path.split("/")
    for segment in segments:
        if segment in ("", ".", "..") or "\\" in segment or ":" in segment:
            return False
    if suffix is not None and not segments[-1].endswith(suffix):
        return False
    return True


def assert_contained(root: Path | str, rel_path: str) -> None:
    """Refuse (`ContainmentError`) when any prefix of `rel_path` below `root` is a
    symlink or cannot be inspected. An absent prefix is tolerated: nothing below it
    exists either. The root itself may be a symlink; it is not inspected."""
    if not is_portable_relative_path(rel_path, suffix=None):
        raise ValueError(f"not a portable root-relative path: {rel_path!r}")
    current = Path(root)
    for segment in rel_path.split("/"):
        current = current / segment
        try:
            st = os.lstat(current)
        except FileNotFoundError:
            return
        except OSError as exc:
            raise ContainmentError(f"cannot inspect {rel_path!r} at {segment!r}: {exc}") from exc
        if stat.S_ISLNK(st.st_mode):
            raise ContainmentError(f"symlink at {segment!r} on {rel_path!r}")
```

In `python/src/nodes/core/write_plan.py`, replace line 10 (`RESERVED_NAMESPACE = ".nodes-index"`) with an explicit re-export so existing importers keep working:

```python
from nodes.core.paths import RESERVED_NAMESPACE as RESERVED_NAMESPACE
```

(Place it with the other imports, after `from nodes.core.errors import ...`.)

- [ ] **Step 4: Run to verify they pass**

Run: `just test-fast`
Expected: all PASS.

- [ ] **Step 5: Write the failing TypeScript tests**

`ts/tests/paths.test.ts`:

```ts
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContainmentError, NodesError } from "../src/errors.js";
import { RESERVED_NAMESPACE, assertContained, isPortableRelativePath } from "../src/paths.js";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "nodes-paths-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** Probe once. Only a recognized unsupported platform disables the symlink tests (an
 * explicit skip); any other failure is a real error and propagates. */
const SYMLINKS = (() => {
  const probe = mkdtempSync(join(tmpdir(), "nodes-symlink-probe-"));
  try {
    symlinkSync(join(probe, "target"), join(probe, "link"));
    return true;
  } catch (e) {
    if (process.platform === "win32" && (e as NodeJS.ErrnoException).code === "EPERM") return false;
    throw e;
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
})();

describe("portable root-relative paths", () => {
  it("names the reserved namespace", () => {
    expect(RESERVED_NAMESPACE).toBe(".nodes-index");
  });

  it("ContainmentError extends NodesError", () => {
    expect(new ContainmentError("x")).toBeInstanceOf(NodesError);
  });

  it.each(["kind/a.md", "a.md", "kind/sub/deep.md", "kind/a__b.md"])("accepts %s", (p) => {
    expect(isPortableRelativePath(p)).toBe(true);
  });

  it.each(["", "/a.md", "a//b.md", "./a.md", "a/../b.md", "a/./b.md", "a/", "a/b.md/"])("rejects segment violation %s", (p) => {
    expect(isPortableRelativePath(p)).toBe(false);
  });

  it.each(["C:/outside/x.md", "..\\outside\\x.md", "a\\b.md", "kind/a:b.md"])("rejects backslash or colon in %s", (p) => {
    expect(isPortableRelativePath(p)).toBe(false);
  });

  it.each(["kind/a.txt", "kind/a.md.bak", "kind/a"])("rejects wrong suffix %s", (p) => {
    expect(isPortableRelativePath(p)).toBe(false);
  });

  it("suffix is configurable", () => {
    expect(isPortableRelativePath(".nodes-index/snapshot.ts.json", ".json")).toBe(true);
    expect(isPortableRelativePath(".nodes-index/snapshot.ts.json", ".md")).toBe(false);
    expect(isPortableRelativePath("kind/anything", null)).toBe(true);
  });
});

describe("assertContained", () => {
  it("rejects non-portable input as a programming error", () => {
    expect(() => assertContained(root, "a/../b.md")).toThrow(TypeError);
  });

  it("tolerates an absent prefix", () => {
    expect(() => assertContained(root, "kind/not/yet/there.md")).not.toThrow();
  });

  it("accepts a regular path", () => {
    mkdirSync(join(root, "kind"));
    writeFileSync(join(root, "kind", "a.md"), "x");
    expect(() => assertContained(root, "kind/a.md")).not.toThrow();
  });

  it.skipIf(!SYMLINKS)("refuses a symlink at the final segment", () => {
    mkdirSync(join(root, "kind"));
    writeFileSync(join(root, "kind", "real.md"), "x");
    symlinkSync(join(root, "kind", "real.md"), join(root, "kind", "a.md"));
    expect(() => assertContained(root, "kind/a.md")).toThrow(ContainmentError);
  });

  it.skipIf(!SYMLINKS)("refuses a dangling symlink", () => {
    mkdirSync(join(root, "kind"));
    symlinkSync(join(root, "kind", "missing.md"), join(root, "kind", "a.md"));
    expect(() => assertContained(root, "kind/a.md")).toThrow(ContainmentError);
  });

  it.skipIf(!SYMLINKS)("refuses a symlinked parent", () => {
    const outside = mkdtempSync(join(tmpdir(), "nodes-paths-outside-"));
    try {
      symlinkSync(outside, join(root, "kind"));
      expect(() => assertContained(root, "kind/a.md")).toThrow(ContainmentError);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it.skipIf(!SYMLINKS)("allows a symlinked root", () => {
    const real = join(root, "real");
    mkdirSync(join(real, "kind"), { recursive: true });
    writeFileSync(join(real, "kind", "a.md"), "x");
    const link = join(root, "link-root");
    symlinkSync(real, link);
    expect(() => assertContained(link, "kind/a.md")).not.toThrow();
  });

  it("treats a file where a directory is expected as a refusal", () => {
    writeFileSync(join(root, "kind"), "not a dir");
    expect(() => assertContained(root, "kind/a.md")).toThrow(ContainmentError);
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)("refuses on a permission failure", () => {
    const locked = join(root, "kind");
    mkdirSync(locked);
    writeFileSync(join(locked, "a.md"), "x");
    chmodSync(locked, 0);
    try {
      expect(() => assertContained(root, "kind/a.md")).toThrow(ContainmentError);
    } finally {
      chmodSync(locked, 0o700);
    }
  });
});
```

- [ ] **Step 6: Run to verify they fail**

Run: `just test-fast`
Expected: FAIL — `Cannot find module '../src/paths.js'`.

- [ ] **Step 7: Add the error and the module (TypeScript)**

In `ts/src/errors.ts`, after `export class PlanRefusedError extends NodesError {}` (and update its doc comment to: "Write plan is lexically malformed: unknown operation kind, a path that is not a portable root-relative `.md` path, or a reserved-namespace path. Refused before any effect."), add:

```ts
/** A path under the corpus root has a symlink component below the root, or cannot
 * be inspected. Refused before any effect. */
export class ContainmentError extends NodesError {}
```

Create `ts/src/paths.ts`:

```ts
/** Path rules shared by the walk, the write plan, the store, and the caches.
 * Imports only `errors`, so `snapshot` and `similarity` can both depend on it. */
import { type Stats, lstatSync } from "node:fs";
import { join } from "node:path";
import { ContainmentError } from "./errors.js";

export const RESERVED_NAMESPACE = ".nodes-index";

/** The one lexical rule for every root-relative path nodes accepts: split on `/` only,
 * no empty/`.`/`..` segment, no segment carrying `\` or `:` (a canonical segment never
 * does — `pathForNodeId` maps `:` to `__`), and the required suffix. */
export function isPortableRelativePath(path: string, suffix: string | null = ".md"): boolean {
  if (path === "" || path.startsWith("/")) return false;
  const segments = path.split("/");
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") return false;
    if (segment.includes("\\") || segment.includes(":")) return false;
  }
  if (suffix !== null && !segments[segments.length - 1].endsWith(suffix)) return false;
  return true;
}

/** Refuse (`ContainmentError`) when any prefix of `relPath` below `root` is a symlink or
 * cannot be inspected. An absent prefix is tolerated: nothing below it exists either.
 * The root itself may be a symlink; it is not inspected. */
export function assertContained(root: string, relPath: string): void {
  if (!isPortableRelativePath(relPath, null)) {
    throw new TypeError(`not a portable root-relative path: ${JSON.stringify(relPath)}`);
  }
  let current = root;
  for (const segment of relPath.split("/")) {
    current = join(current, segment);
    let st: Stats;
    try {
      st = lstatSync(current);
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return;
      throw new ContainmentError(`cannot inspect ${JSON.stringify(relPath)} at ${JSON.stringify(segment)}: ${err.message}`);
    }
    if (st.isSymbolicLink()) {
      throw new ContainmentError(`symlink at ${JSON.stringify(segment)} on ${JSON.stringify(relPath)}`);
    }
  }
}
```

In `ts/src/write-plan.ts`, delete line 5 (`export const RESERVED_NAMESPACE = ".nodes-index";`) and add, with the imports:

```ts
import { RESERVED_NAMESPACE } from "./paths.js";
export { RESERVED_NAMESPACE };
```

In `ts/src/index.ts`: add `ContainmentError,` to the `./errors.js` export block (alphabetical: between `CollisionError` and `EmbedderRequiredError`), and add a new block after the `./write-plan.js` block:

```ts
export { assertContained, isPortableRelativePath } from "./paths.js";
```

(`RESERVED_NAMESPACE` stays exported from `./write-plan.js`.)

- [ ] **Step 8: Run to verify they pass**

Run: `just test-fast`
Expected: all PASS.

- [ ] **Step 9: Gate and close the child record**

Run: `just gate`
Expected: check green, Python and TypeScript suites green. No commit — A commits once, in Task 7.

```bash
tasks done nodes-e48507 "ContainmentError, the portable path predicate, and assert_contained in nodes.core.paths and ts/src/paths.ts with unit tests in both languages"
```

---

### Task 2: Root-aware cache helpers

**Files:**
- Modify: `python/src/nodes/core/paths.py` (append `read_json`, `write_json_atomic`, `assert_cache_path`)
- Modify: `python/src/nodes/core/snapshot.py:22-24, 56-73, 100, 155` (helpers move out; `SNAPSHOT_REL_PATH`; callers)
- Modify: `python/src/nodes/core/similarity.py:99-131` (`VectorCache` uses the helpers)
- Modify: `python/tests/test_snapshot_io.py`, `python/tests/test_snapshot_load.py`, `python/tests/test_corpus_persistence_rename.py` (call-site migration)
- Modify: `ts/src/paths.ts` (append `readJson`, `writeJsonAtomic`, `assertCachePath`)
- Modify: `ts/src/snapshot.ts:25-27, 125-160, 190, 245, 283-291` (helpers move out; `SNAPSHOT_REL_PATH`; callers; catch exemption)
- Modify: `ts/src/similarity.ts:92-135` (`VectorCache` uses the helpers)
- Modify: `ts/src/index.ts` (re-export `readJson`, `writeJsonAtomic` from `./paths.js`)
- Modify: `ts/tests/snapshot-io.test.ts` (call-site migration)
- Test: `python/tests/test_paths.py`, `ts/tests/paths.test.ts` (append)

**Interfaces:**
- Consumes: Task 1's `assert_contained` / `assertContained`, `is_portable_relative_path` / `isPortableRelativePath`, `RESERVED_NAMESPACE`.
- Produces (Python, in `nodes.core.paths`): `assert_cache_path(rel_path: str) -> None` (raises `ValueError` unless portable with suffix `.json` and strictly beneath the namespace); `read_json(root: Path | str, rel_path: str) -> dict | None`; `write_json_atomic(root: Path | str, rel_path: str, obj: dict) -> None`. In `nodes.core.snapshot`: `SNAPSHOT_REL_PATH = ".nodes-index/snapshot.py.json"`; `snapshot_path(root)` unchanged (absolute); `read_json` and `write_json_atomic` still importable from `nodes.core.snapshot` (re-exported).
- Produces (TypeScript, in `paths.ts`): `assertCachePath(relPath: string): void` (throws `TypeError`); `readJson(root: string, relPath: string): unknown`; `writeJsonAtomic(root: string, relPath: string, obj: unknown): void`. In `snapshot.ts`: `SNAPSHOT_REL_PATH = ".nodes-index/snapshot.ts.json"`; `snapshotPath(root)` unchanged; `readJson`/`writeJsonAtomic` re-exported from `snapshot.ts` and `index.ts`.

- [ ] **Step 0: Claim the child record**

Run: `tasks start nodes-904ecf`

- [ ] **Step 1: Write the failing Python tests**

Append to `python/tests/test_paths.py`:

```python
from nodes.core.paths import assert_cache_path, read_json, write_json_atomic  # noqa: E402


@pytest.mark.parametrize(
    "rel",
    [".nodes-index", ".nodes-index/", "kind/a.json", ".nodes-index/a.md", "./.nodes-index/a.json", ".nodes-index/../a.json"],
)
def test_assert_cache_path_rejects(rel):
    with pytest.raises(ValueError):
        assert_cache_path(rel)


@pytest.mark.parametrize("rel", [".nodes-index/snapshot.py.json", ".nodes-index/vectors/ns/" + "0" * 64 + ".json"])
def test_assert_cache_path_accepts(rel):
    assert_cache_path(rel)


def test_cache_round_trip_and_no_tmp_left(tmp_path):
    write_json_atomic(tmp_path, ".nodes-index/a.json", {"x": [1, 2]})
    assert read_json(tmp_path, ".nodes-index/a.json") == {"x": [1, 2]}
    assert not (tmp_path / ".nodes-index" / "a.json.tmp").exists()


def test_cache_read_missing_returns_none(tmp_path):
    assert read_json(tmp_path, ".nodes-index/a.json") is None


def test_cache_read_rejects_null_document(tmp_path):
    (tmp_path / ".nodes-index").mkdir()
    (tmp_path / ".nodes-index" / "a.json").write_text("null", encoding="utf-8")
    with pytest.raises(ValueError):
        read_json(tmp_path, ".nodes-index/a.json")


def test_vector_cache_null_document_is_corruption_not_a_miss(tmp_path):
    from nodes.core.similarity import VectorCache

    digest = "0" * 64
    (tmp_path / ".nodes-index" / "vectors" / "ns").mkdir(parents=True)
    (tmp_path / ".nodes-index" / "vectors" / "ns" / f"{digest}.json").write_text("null", encoding="utf-8")
    with pytest.raises(ValueError):
        VectorCache(tmp_path).get("ns", digest)


def test_cache_write_refuses_single_segment_namespace_and_leaves_tmp_sibling_alone(tmp_path):
    protected = tmp_path / ".nodes-index.tmp"
    protected.write_bytes(b"consumer artifact")
    with pytest.raises(ValueError):
        write_json_atomic(tmp_path, ".nodes-index", {"x": 1})
    assert protected.read_bytes() == b"consumer artifact"


@needs_symlinks
def test_cache_read_refuses_symlinked_namespace(tmp_path):
    outside = tmp_path.parent / f"{tmp_path.name}-outside"
    outside.mkdir()
    (outside / "a.json").write_text('{"x": 1}', encoding="utf-8")
    (tmp_path / ".nodes-index").symlink_to(outside)
    with pytest.raises(ContainmentError):
        read_json(tmp_path, ".nodes-index/a.json")


@needs_symlinks
def test_cache_write_refuses_symlinked_namespace_without_touching_target(tmp_path):
    outside = tmp_path.parent / f"{tmp_path.name}-outside"
    outside.mkdir()
    (tmp_path / ".nodes-index").symlink_to(outside)
    with pytest.raises(ContainmentError):
        write_json_atomic(tmp_path, ".nodes-index/a.json", {"x": 1})
    assert list(outside.iterdir()) == []


@needs_symlinks
def test_cache_read_ignores_stray_tmp_symlink_but_write_refuses_it(tmp_path):
    (tmp_path / ".nodes-index").mkdir()
    (tmp_path / ".nodes-index" / "a.json").write_text('{"x": 1}', encoding="utf-8")
    target = tmp_path / "protected.txt"
    target.write_bytes(b"keep")
    (tmp_path / ".nodes-index" / "a.json.tmp").symlink_to(target)
    assert read_json(tmp_path, ".nodes-index/a.json") == {"x": 1}
    with pytest.raises(ContainmentError):
        write_json_atomic(tmp_path, ".nodes-index/a.json", {"x": 2})
    assert target.read_bytes() == b"keep"
    assert read_json(tmp_path, ".nodes-index/a.json") == {"x": 1}


@needs_symlinks
def test_cache_read_refuses_symlinked_file(tmp_path):
    (tmp_path / ".nodes-index").mkdir()
    target = tmp_path / "elsewhere.json"
    target.write_text('{"x": 1}', encoding="utf-8")
    (tmp_path / ".nodes-index" / "a.json").symlink_to(target)
    with pytest.raises(ContainmentError):
        read_json(tmp_path, ".nodes-index/a.json")
```

- [ ] **Step 2: Run to verify they fail**

Run: `just test-fast`
Expected: `ImportError: cannot import name 'assert_cache_path'`.

- [ ] **Step 3: Implement the Python helpers and move the callers**

Append to `python/src/nodes/core/paths.py` (add `import json` at the top):

```python
def assert_cache_path(rel_path: str) -> None:
    """A cache path is a portable `.json` path strictly beneath the reserved namespace:
    first segment `.nodes-index` and at least one more. The single-segment form is
    refused because its `.tmp` sibling would land outside the namespace."""
    if not is_portable_relative_path(rel_path, suffix=".json"):
        raise ValueError(f"not a portable cache path: {rel_path!r}")
    segments = rel_path.split("/")
    if segments[0] != RESERVED_NAMESPACE or len(segments) < 2:
        raise ValueError(f"cache path must be strictly beneath {RESERVED_NAMESPACE}/: {rel_path!r}")


def _reject_json_constant(value: str) -> None:
    raise ValueError(f"invalid JSON constant {value}")


def read_json(root: Path | str, rel_path: str) -> dict | None:
    """Read a cache document. `None` only for a genuinely absent file; a document whose
    JSON is `null` is corruption and raises `ValueError`. Checks the final path only — a
    read never touches the `.tmp` sibling."""
    assert_cache_path(rel_path)
    assert_contained(root, rel_path)
    path = Path(root) / rel_path
    try:
        doc = json.loads(path.read_text(encoding="utf-8"), parse_constant=_reject_json_constant)
    except FileNotFoundError:
        return None
    if doc is None:
        raise ValueError(f"cache document {rel_path!r} is null")  # absence is None; a null document is corruption
    return doc


def write_json_atomic(root: Path | str, rel_path: str, obj: dict) -> None:
    """Write a cache document via a `.tmp` sibling and rename. Checks the final path and
    the sibling before any `mkdir`, write, or rename."""
    assert_cache_path(rel_path)
    assert_contained(root, rel_path)
    assert_contained(root, f"{rel_path}.tmp")
    path = Path(root) / rel_path
    payload = json.dumps(obj, allow_nan=False)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.parent / f"{path.name}.tmp"
    tmp.write_text(payload, encoding="utf-8")
    os.replace(tmp, path)
```

In `python/src/nodes/core/snapshot.py`:

- Delete `write_json_atomic`, `_reject_json_constant`, and `read_json` (lines 56–73).
- Add to the imports: `from nodes.core.paths import RESERVED_NAMESPACE, read_json as read_json, write_json_atomic as write_json_atomic` (explicit re-exports keep `from nodes.core.snapshot import read_json` working for tests). Remove `import json` only if nothing else in the module uses it (the module still uses `json` nowhere else after this change — verify with ruff).
- After `SNAPSHOT_LANG = "py"` add `SNAPSHOT_REL_PATH = f"{RESERVED_NAMESPACE}/snapshot.py.json"`, and rewrite `snapshot_path` as `return Path(root) / SNAPSHOT_REL_PATH`.
- In `write_snapshot`: `write_json_atomic(root, SNAPSHOT_REL_PATH, doc)`.
- In `load_snapshot`: `doc = read_json(root, SNAPSHOT_REL_PATH)`.

In `python/src/nodes/core/similarity.py`, replace `VectorCache._path`, `get`, and `put`:

```python
    def _rel(self, namespace: str, text_hash: str) -> str:
        validate_namespace(namespace)
        validate_text_hash(text_hash)
        return f"{RESERVED_NAMESPACE}/vectors/{namespace}/{text_hash}.json"

    def get(self, namespace: str, text_hash: str) -> Vector | None:
        rel = self._rel(namespace, text_hash)
        try:
            data = read_json(self.root, rel)
        except (ValueError, OSError) as exc:
            raise ValueError(f"corrupt cache file {rel}: {exc}") from exc
        if data is None:
            return None
        if not isinstance(data, dict) or "dim" not in data or "vector" not in data:
            raise ValueError(f"corrupt cache file {rel}: missing dim/vector")
        raw = data["vector"]
        if not isinstance(raw, list) or len(raw) != data["dim"]:
            raise ValueError(f"corrupt cache file {rel}: dim/vector length mismatch")
        raw_tuple = tuple(raw)
        _validate_finite(raw_tuple)
        return tuple(float(x) for x in raw_tuple)

    def put(self, namespace: str, text_hash: str, vector: Vector) -> None:
        _validate_finite(vector)
        write_json_atomic(self.root, self._rel(namespace, text_hash), {"dim": len(vector), "vector": list(vector)})
```

Add `from nodes.core.paths import RESERVED_NAMESPACE, read_json, write_json_atomic` to `similarity.py`'s imports; remove `import json` and `import os` if now unused (ruff will say). Note `ContainmentError` is a `NodesError`, not `ValueError`/`OSError`, so it propagates out of `get` unwrapped — that is the intent.

Migrate the Python test call sites (mechanical):

```bash
cd python
sed -i 's/write_json_atomic(snapshot_path(tmp_path), /write_json_atomic(tmp_path, SNAPSHOT_REL_PATH, /g' tests/test_snapshot_load.py tests/test_snapshot_io.py
sed -i 's/read_json(snapshot_path(tmp_path))/read_json(tmp_path, SNAPSHOT_REL_PATH)/g' tests/test_snapshot_load.py tests/test_snapshot_io.py tests/test_corpus_persistence_rename.py
```

Then add `SNAPSHOT_REL_PATH` to each file's `from nodes.core.snapshot import (...)` list, and fix the remaining hand-written sites in `python/tests/test_snapshot_io.py`:

- `test_write_json_atomic_round_trip_and_no_tmp_left`: body becomes `write_json_atomic(tmp_path, SNAPSHOT_REL_PATH, {"version": 1, "x": [1, 2]})`, `assert read_json(tmp_path, SNAPSHOT_REL_PATH) == ...`, keep the no-tmp assertion using `snapshot_path(tmp_path)`.
- `test_write_json_atomic_rejects_non_finite_values_without_snapshot`: `write_json_atomic(tmp_path, SNAPSHOT_REL_PATH, {"x": float("nan")})`.
- `test_read_json_missing_returns_none`: `read_json(tmp_path, SNAPSHOT_REL_PATH)`.
- `test_read_json_directory_raises`: `read_json(tmp_path, SNAPSHOT_REL_PATH)` — still `OSError` (`IsADirectoryError`).
- `test_read_json_broken_symlink_raises`: rename to `test_read_json_symlink_refused` and expect `ContainmentError` (import it from `nodes.core.errors`).
- `test_read_json_invalid_json_raises` and `test_read_json_rejects_non_finite_constants`: `read_json(tmp_path, SNAPSHOT_REL_PATH)`.

- [ ] **Step 4: Run to verify they pass**

Run: `just test-fast`
Expected: all PASS.

- [ ] **Step 5: Write the failing TypeScript tests**

Append to `ts/tests/paths.test.ts` (add `readFileSync` to the `node:fs` import and `assertCachePath, readJson, writeJsonAtomic` to the `../src/paths.js` import):

```ts
describe("cache helpers", () => {
  it.each([".nodes-index", ".nodes-index/", "kind/a.json", ".nodes-index/a.md", "./.nodes-index/a.json", ".nodes-index/../a.json"])(
    "assertCachePath rejects %s",
    (rel) => {
      expect(() => assertCachePath(rel)).toThrow(TypeError);
    },
  );

  it.each([".nodes-index/snapshot.ts.json", `.nodes-index/vectors/ns/${"0".repeat(64)}.json`])("assertCachePath accepts %s", (rel) => {
    expect(() => assertCachePath(rel)).not.toThrow();
  });

  it("round-trips and leaves no tmp file", () => {
    writeJsonAtomic(root, ".nodes-index/a.json", { x: [1, 2] });
    expect(readJson(root, ".nodes-index/a.json")).toEqual({ x: [1, 2] });
    expect(existsSync(join(root, ".nodes-index", "a.json.tmp"))).toBe(false);
  });

  it("read of a missing file returns null", () => {
    expect(readJson(root, ".nodes-index/a.json")).toBeNull();
  });

  it("read rejects a null document", () => {
    mkdirSync(join(root, ".nodes-index"));
    writeFileSync(join(root, ".nodes-index", "a.json"), "null");
    expect(() => readJson(root, ".nodes-index/a.json")).toThrow(TypeError);
  });

  it("VectorCache treats a null document as corruption, not a miss", () => {
    const digest = "0".repeat(64);
    mkdirSync(join(root, ".nodes-index", "vectors", "ns"), { recursive: true });
    writeFileSync(join(root, ".nodes-index", "vectors", "ns", `${digest}.json`), "null");
    expect(() => new VectorCache(root).get("ns", digest)).toThrow(TypeError);
  });

  it("refuses the single-segment namespace and leaves .nodes-index.tmp alone", () => {
    const protectedPath = join(root, ".nodes-index.tmp");
    writeFileSync(protectedPath, "consumer artifact");
    expect(() => writeJsonAtomic(root, ".nodes-index", { x: 1 })).toThrow(TypeError);
    expect(readFileSync(protectedPath, "utf-8")).toBe("consumer artifact");
  });

  it.skipIf(!SYMLINKS)("read refuses a symlinked namespace", () => {
    const outside = mkdtempSync(join(tmpdir(), "nodes-paths-outside-"));
    try {
      writeFileSync(join(outside, "a.json"), '{"x": 1}');
      symlinkSync(outside, join(root, ".nodes-index"));
      expect(() => readJson(root, ".nodes-index/a.json")).toThrow(ContainmentError);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it.skipIf(!SYMLINKS)("write refuses a symlinked namespace without touching the target", () => {
    const outside = mkdtempSync(join(tmpdir(), "nodes-paths-outside-"));
    try {
      symlinkSync(outside, join(root, ".nodes-index"));
      expect(() => writeJsonAtomic(root, ".nodes-index/a.json", { x: 1 })).toThrow(ContainmentError);
      expect(readdirSync(outside)).toEqual([]);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it.skipIf(!SYMLINKS)("read ignores a stray tmp symlink but write refuses it", () => {
    mkdirSync(join(root, ".nodes-index"));
    writeFileSync(join(root, ".nodes-index", "a.json"), '{"x": 1}');
    const target = join(root, "protected.txt");
    writeFileSync(target, "keep");
    symlinkSync(target, join(root, ".nodes-index", "a.json.tmp"));
    expect(readJson(root, ".nodes-index/a.json")).toEqual({ x: 1 });
    expect(() => writeJsonAtomic(root, ".nodes-index/a.json", { x: 2 })).toThrow(ContainmentError);
    expect(readFileSync(target, "utf-8")).toBe("keep");
    expect(readJson(root, ".nodes-index/a.json")).toEqual({ x: 1 });
  });

  it.skipIf(!SYMLINKS)("read refuses a symlinked file", () => {
    mkdirSync(join(root, ".nodes-index"));
    const target = join(root, "elsewhere.json");
    writeFileSync(target, '{"x": 1}');
    symlinkSync(target, join(root, ".nodes-index", "a.json"));
    expect(() => readJson(root, ".nodes-index/a.json")).toThrow(ContainmentError);
  });
});
```

Add `existsSync, readdirSync` to the `node:fs` import and `import { VectorCache } from "../src/similarity.js";`.

- [ ] **Step 6: Run to verify they fail**

Run: `just test-fast`
Expected: FAIL — `assertCachePath` is not exported.

- [ ] **Step 7: Implement the TypeScript helpers and move the callers**

Append to `ts/src/paths.ts` (extend the `node:fs` import to `{ type Stats, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync }` and add `import { dirname } from "node:path"` alongside `join`):

```ts
/** A cache path is a portable `.json` path strictly beneath the reserved namespace: first
 * segment `.nodes-index` and at least one more. The single-segment form is refused because
 * its `.tmp` sibling would land outside the namespace. */
export function assertCachePath(relPath: string): void {
  if (!isPortableRelativePath(relPath, ".json")) {
    throw new TypeError(`not a portable cache path: ${JSON.stringify(relPath)}`);
  }
  const segments = relPath.split("/");
  if (segments[0] !== RESERVED_NAMESPACE || segments.length < 2) {
    throw new TypeError(`cache path must be strictly beneath ${RESERVED_NAMESPACE}/: ${JSON.stringify(relPath)}`);
  }
}

/** Read a cache document. `null` only for a genuinely absent file; a document whose JSON
 * is `null` is corruption and throws `TypeError`. Checks the final path only — a read never
 * touches the `.tmp` sibling. JS `JSON.parse` already rejects the `NaN`/`Infinity`
 * constants. */
export function readJson(root: string, relPath: string): unknown {
  assertCachePath(relPath);
  assertContained(root, relPath);
  let raw: string;
  try {
    raw = readFileSync(join(root, relPath), "utf-8");
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return null;
    throw err; // EISDIR and anything else
  }
  const doc: unknown = JSON.parse(raw);
  if (doc === null) throw new TypeError(`cache document ${JSON.stringify(relPath)} is null`); // absence is null; a null document is corruption
  return doc;
}

/** Write a cache document via a `.tmp` sibling and rename. Checks the final path and the
 * sibling before any `mkdir`, write, or rename. Rejects any non-finite number — JS
 * `JSON.stringify` silently emits `null` for NaN/Infinity, so a replacer enforces the
 * rejection (parity with Python's `json.dumps(..., allow_nan=False)`). */
export function writeJsonAtomic(root: string, relPath: string, obj: unknown): void {
  assertCachePath(relPath);
  assertContained(root, relPath);
  assertContained(root, `${relPath}.tmp`);
  const payload = JSON.stringify(obj, (_key, value) => {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new RangeError("cannot serialize non-finite number to JSON");
    }
    return value;
  });
  const path = join(root, relPath);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, payload, "utf-8");
  renameSync(tmp, path);
}
```

In `ts/src/snapshot.ts`:

- Delete `writeJsonAtomic` and `readJson` (lines 125–160) and their now-unused `node:fs` imports (`lstatSync`, `mkdirSync`, `renameSync`, `writeFileSync`, `readFileSync` stays for `iterCorpusFiles`; `dirname` goes if unused).
- Add `import { RESERVED_NAMESPACE, readJson, writeJsonAtomic } from "./paths.js";` and `export { readJson, writeJsonAtomic };` so `../src/snapshot.js` importers keep working.
- After `SNAPSHOT_LANG` add `export const SNAPSHOT_REL_PATH = `${RESERVED_NAMESPACE}/snapshot.ts.json`;` and rewrite `snapshotPath` as `return join(root, SNAPSHOT_REL_PATH);`.
- In `writeSnapshot`: `writeJsonAtomic(root, SNAPSHOT_REL_PATH, doc);`.
- In `loadSnapshot`: `const doc = readJson(root, SNAPSHOT_REL_PATH);` and in the `catch (e)` at the end, before `if (!(e instanceof Error)) throw e;`, add:

```ts
    if (e instanceof ContainmentError) throw e; // a containment refusal is never a rebuild trigger
```

with `import { ContainmentError } from "./errors.js";`.

In `ts/src/similarity.ts`, replace `VectorCache.pathFor`, `get`, and `put`:

```ts
  private relFor(namespace: string, hash: string): string {
    validateNamespace(namespace);
    validateTextHash(hash);
    return `${RESERVED_NAMESPACE}/vectors/${namespace}/${hash}.json`;
  }

  get(namespace: string, hash: string): Vector | null {
    const rel = this.relFor(namespace, hash);
    let data: unknown;
    try {
      data = readJson(this.root, rel);
    } catch (e) {
      if (e instanceof ContainmentError) throw e;
      throw new TypeError(`corrupt cache file ${rel}: ${(e as Error).message}`);
    }
    if (data === null) return null;
    if (typeof data !== "object" || !("dim" in data) || !("vector" in data)) {
      throw new TypeError(`corrupt cache file ${rel}: missing dim/vector`);
    }
    const { dim, vector } = data as { dim: unknown; vector: unknown };
    if (!Array.isArray(vector) || vector.length !== dim) {
      throw new TypeError(`corrupt cache file ${rel}: dim/vector length mismatch`);
    }
    validateFinite(vector);
    return [...(vector as number[])];
  }

  put(namespace: string, hash: string, vector: Vector): void {
    validateFinite(vector);
    writeJsonAtomic(this.root, this.relFor(namespace, hash), { dim: vector.length, vector });
  }
```

Add `import { ContainmentError } from "./errors.js";` (extend the existing errors import) and `import { RESERVED_NAMESPACE, readJson, writeJsonAtomic } from "./paths.js";`; drop the `node:fs`/`node:path` imports that become unused.

In `ts/src/index.ts`, leave `readJson, writeJsonAtomic` in the `./snapshot.js` block (they are re-exported there), add `SNAPSHOT_REL_PATH,` to that block, and add `assertCachePath` to the `./paths.js` export block.

Migrate `ts/tests/snapshot-io.test.ts`: add `SNAPSHOT_REL_PATH` to the `../src/snapshot.js` import and `ContainmentError` from `../src/errors.js`; then:

- "writeJsonAtomic round-trips…": `writeJsonAtomic(root, SNAPSHOT_REL_PATH, { version: 1, x: [1, 2] })`, `expect(readJson(root, SNAPSHOT_REL_PATH))…`.
- "rejects non-finite…": `writeJsonAtomic(root, SNAPSHOT_REL_PATH, { x: Number.NaN })`.
- "readJson returns null for a missing file": `readJson(root, SNAPSHOT_REL_PATH)`.
- "readJson throws for a broken symlink" → rename to "readJson refuses a symlink" and `expect(() => readJson(root, SNAPSHOT_REL_PATH)).toThrow(ContainmentError)`.
- Every other `readJson(p)` / `writeJsonAtomic(p, …)` in that file: `readJson(root, SNAPSHOT_REL_PATH)` / `writeJsonAtomic(root, SNAPSHOT_REL_PATH, …)`; keep `p = snapshotPath(root)` wherever it is used for `writeFileSync`/`mkdirSync`/`existsSync`.

- [ ] **Step 8: Run to verify they pass**

Run: `just test-fast`
Expected: all PASS.

- [ ] **Step 9: Gate and close the child record**

Run: `just gate`
Expected: check green, Python and TypeScript suites green. No commit — A commits once, in Task 7.

```bash
tasks done nodes-904ecf "read_json/write_json_atomic take (root, rel_path) strictly beneath .nodes-index, reject null documents, check final path on read and .tmp sibling on write; snapshot and VectorCache route through them; TS loadSnapshot rethrows ContainmentError"
```

---

### Task 3: The walk propagates filesystem failures

**Files:**
- Modify: `python/src/nodes/core/snapshot.py:37-46` (`iter_corpus_files`)
- Modify: `ts/src/snapshot.ts:60-84` (`listCorpusMarkdownPaths`)
- Test: `python/tests/test_snapshot_io.py`, `ts/tests/snapshot-io.test.ts` (append)

**Interfaces:**
- Consumes: `RESERVED_NAMESPACE` from `paths`.
- Produces: unchanged signatures — `iter_corpus_files(root) -> list[CorpusFile]`, `listCorpusFileStats(root)`, `iterCorpusFiles(root)` — now raising on a missing root or an unreadable directory, and skipping every symlink at every depth without following it.

- [ ] **Step 0: Claim the child record**

Run: `tasks start nodes-989525`

- [ ] **Step 1: Write the failing Python tests**

Append to `python/tests/test_snapshot_io.py` (add `import os`, `import shutil`, `import stat`, `import tempfile`, `from pathlib import Path`, the `_symlinks_supported` probe and `needs_symlinks` marker exactly as in `python/tests/test_paths.py`, and `from nodes.core.snapshot import iter_corpus_files` if missing):

```python
def test_iter_corpus_files_missing_root_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        iter_corpus_files(tmp_path / "absent")


@needs_symlinks
def test_iter_corpus_files_does_not_follow_directory_symlink(tmp_path):
    outside = tmp_path.parent / f"{tmp_path.name}-outside"
    (outside / "tree").mkdir(parents=True)
    (outside / "tree" / "a.md").write_text("---\nid: kind:a\nkind: kind\ntitle: A\n---\n", encoding="utf-8")
    (tmp_path / "kind").mkdir()
    (tmp_path / "kind" / "b.md").write_text("---\nid: kind:b\nkind: kind\ntitle: B\n---\n", encoding="utf-8")
    (tmp_path / "linked").symlink_to(outside / "tree")
    assert [f.path for f in iter_corpus_files(tmp_path)] == ["kind/b.md"]


def test_iter_corpus_files_skips_nested_reserved_name_only_at_root(tmp_path):
    (tmp_path / ".nodes-index").mkdir()
    (tmp_path / ".nodes-index" / "x.md").write_text("x", encoding="utf-8")
    (tmp_path / "kind" / ".nodes-index").mkdir(parents=True)
    (tmp_path / "kind" / ".nodes-index" / "y.md").write_text("y", encoding="utf-8")
    assert [f.path for f in iter_corpus_files(tmp_path)] == ["kind/.nodes-index/y.md"]


@pytest.mark.skipif(os.name != "posix", reason="a backslash is a separator on Windows")
def test_iter_corpus_files_keeps_literal_backslash(tmp_path):
    (tmp_path / "kind\\a.md").write_text("x", encoding="utf-8")
    assert [f.path for f in iter_corpus_files(tmp_path)] == ["kind\\a.md"]


@pytest.mark.skipif(os.name != "posix" or os.geteuid() == 0, reason="needs an unprivileged POSIX user")
def test_iter_corpus_files_unreadable_directory_raises(tmp_path):
    locked = tmp_path / "kind"
    locked.mkdir()
    (locked / "a.md").write_text("x", encoding="utf-8")
    locked.chmod(0)
    try:
        with pytest.raises(PermissionError):
            iter_corpus_files(tmp_path)
    finally:
        locked.chmod(stat.S_IRWXU)
```

- [ ] **Step 2: Run to verify they fail**

Run: `just test-fast`
Expected: `test_iter_corpus_files_missing_root_raises` and `test_iter_corpus_files_unreadable_directory_raises` FAIL (no exception raised); the two others PASS already (they pin behaviour the rewrite must keep).

- [ ] **Step 3: Rewrite the Python walk**

Replace `iter_corpus_files` in `python/src/nodes/core/snapshot.py`:

```python
def iter_corpus_files(root: Path | str) -> list[CorpusFile]:
    """Every regular `*.md` file under the root, sorted by root-relative POSIX path in
    code-point order. Never follows a symlink at any depth; `.nodes-index` is skipped as
    the root's direct child only. Filesystem failures — a missing root, an unreadable
    directory — propagate: a walk that silently drops a subtree is not a walk."""
    root = Path(root)
    files: list[CorpusFile] = []

    def walk(directory: Path, rel_parts: tuple[str, ...]) -> None:
        with os.scandir(directory) as it:
            entries = list(it)
        for entry in entries:
            if entry.is_symlink():
                continue
            if entry.is_dir(follow_symlinks=False):
                if not rel_parts and entry.name == RESERVED_NAMESPACE:
                    continue
                walk(Path(entry.path), (*rel_parts, entry.name))
            elif entry.is_file(follow_symlinks=False) and entry.name.endswith(".md"):
                data = Path(entry.path).read_bytes()
                files.append(CorpusFile(path="/".join((*rel_parts, entry.name)), data=data, sha256=hash_bytes(data)))

    walk(root, ())
    files.sort(key=lambda f: f.path)
    return files
```

- [ ] **Step 4: Run to verify they pass**

Run: `just test-fast`
Expected: all PASS.

- [ ] **Step 5: Write the failing TypeScript tests**

Append to `ts/tests/snapshot-io.test.ts` (add `chmodSync` to the `node:fs` import, and the `SYMLINKS` probe exactly as in `ts/tests/paths.test.ts`):

```ts
describe("walk failure propagation", () => {
  it("a missing root throws instead of yielding an empty corpus", () => {
    expect(() => iterCorpusFiles(join(root, "absent"))).toThrow();
  });

  it.skipIf(!SYMLINKS)("does not follow a directory symlink", () => {
    const outside = mkdtempSync(join(tmpdir(), "nodes-snap-io-outside-"));
    try {
      mkdirSync(join(outside, "tree"));
      writeFileSync(join(outside, "tree", "a.md"), "---\nid: kind:a\nkind: kind\ntitle: A\n---\n");
      mkdirSync(join(root, "kind"));
      writeFileSync(join(root, "kind", "b.md"), "---\nid: kind:b\nkind: kind\ntitle: B\n---\n");
      symlinkSync(join(outside, "tree"), join(root, "linked"));
      expect(iterCorpusFiles(root).map((f) => f.path)).toEqual(["kind/b.md"]);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("skips the reserved name at the root only", () => {
    mkdirSync(join(root, ".nodes-index"));
    writeFileSync(join(root, ".nodes-index", "x.md"), "x");
    mkdirSync(join(root, "kind", ".nodes-index"), { recursive: true });
    writeFileSync(join(root, "kind", ".nodes-index", "y.md"), "y");
    expect(iterCorpusFiles(root).map((f) => f.path)).toEqual(["kind/.nodes-index/y.md"]);
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)("an unreadable directory throws", () => {
    const locked = join(root, "kind");
    mkdirSync(locked);
    writeFileSync(join(locked, "a.md"), "x");
    chmodSync(locked, 0);
    try {
      expect(() => iterCorpusFiles(root)).toThrow();
    } finally {
      chmodSync(locked, 0o700);
    }
  });

  it.skipIf(process.platform === "win32")("keeps a literal backslash in a POSIX filename", () => {
    writeFileSync(join(root, "kind\\a.md"), "x");
    expect(iterCorpusFiles(root).map((f) => f.path)).toEqual(["kind\\a.md"]);
  });
});
```

And append to `ts/tests/store.test.ts` (this file gets the `SYMLINKS` probe in Task 5; add it now, exactly as in `ts/tests/paths.test.ts`, with `symlinkSync` and `mkdtempSync` imported) — the test that pins the escape the `relPosix` fix closes:

```ts
describe("Store reads address the walked path", () => {
  it.skipIf(process.platform === "win32" || !SYMLINKS)("allNodes reads a backslash-named file, not a separator-substituted path", () => {
    const outside = mkdtempSync(join(tmpdir(), "nodes-store-outside-"));
    try {
      writeFileSync(join(outside, "a.md"), nodeToMarkdown(n("topic:leak", "topic")));
      symlinkSync(outside, join(root, "kind")); // root/kind -> outside: the walk skips it
      writeFileSync(join(root, "kind\\a.md"), nodeToMarkdown(n("kind:a", "kind"))); // one file, literal backslash
      expect(store.allNodes().map((x) => x.id)).toEqual(["kind:a"]);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
```

Before the `relPosix` fix this test reads `topic:leak` through the symlink; after it, `kind:a`.

- [ ] **Step 6: Run to verify they fail**

Run: `just test-fast`
Expected: "a missing root throws", "an unreadable directory throws", and the `allNodes` backslash test FAIL; the others PASS.

- [ ] **Step 7: Rewrite the TypeScript walk**

Replace `relPosix` and `listCorpusMarkdownPaths` in `ts/src/snapshot.ts`. `relPosix` must split on the platform separator only: today's `split(/[\\/]/)` turns a literal backslash in a POSIX filename into a separator, so the walk reports `kind\a.md` as `kind/a.md` and a later `Store.load` reconstructs a path the walk never inspected — through a symlinked `kind/` if one exists. On Windows `sep` is `\` and no filename can contain it, so the mapping stays lossless there.

```ts
/** Root-relative POSIX path (forward slashes on every platform), the cross-language form.
 * Splits on the platform separator only, so a literal backslash in a POSIX filename is
 * preserved and later reads address exactly the path the walk inspected. */
function relPosix(root: string, full: string): string {
  return relative(root, full).split(sep).join("/");
}
```

(add `sep` to the `node:path` import, and `import { compareCodepoints } from "./search.js";` — `SearchIndex` is already imported from there.)

```ts
/** Every regular `*.md` path under the root, sorted by root-relative POSIX path in code-point order. Never
 * follows a symlink at any depth; `.nodes-index` is skipped as the root's direct child
 * only. Filesystem failures — a missing root, an unreadable directory — propagate: a
 * walk that silently drops a subtree is not a walk. */
function listCorpusMarkdownPaths(root: string): WalkedCorpusPath[] {
  const files: WalkedCorpusPath[] = [];
  const walk = (dir: string, atRoot: boolean): void => {
    const entries: Dirent[] = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (atRoot && entry.name === RESERVED_NAMESPACE) continue;
        walk(full, false);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push({ path: relPosix(root, full), fullPath: full });
      }
    }
  };
  walk(root, true);
  files.sort((a, b) => compareCodepoints(a.path, b.path)); // code-point order, matching Python's str sort
  return files;
}
```

Remove `existsSync` from the `node:fs` import if now unused.

- [ ] **Step 8: Run to verify they pass**

Run: `just test-fast`
Expected: all PASS, including the `allNodes` backslash test in `store.test.ts`.

- [ ] **Step 9: Gate and close the child record**

Run: `just gate`
Expected: check green, Python and TypeScript suites green. No commit — A commits once, in Task 7.

```bash
tasks done nodes-989525 "Both walks are explicit recursions that skip every symlink, reserve .nodes-index at the root only, keep literal filenames, sort by code point, and propagate filesystem failures"
```

---

### Task 4: Plan validation and the executor's whole-plan preflight

**Files:**
- Modify: `python/src/nodes/core/write_plan.py:48-108`
- Modify: `python/src/nodes/core/snapshot.py:136-146` (`_validate_manifest_path` uses the predicate)
- Modify: `ts/src/write-plan.ts:41-107`
- Modify: `ts/src/snapshot.ts:193-205` (`validateManifestPath` uses the predicate)
- Test: `python/tests/test_write_plan.py`, `ts/tests/write-plan.test.ts` (append)

**Interfaces:**
- Consumes: `is_portable_relative_path`, `assert_contained`, `ContainmentError`, `RESERVED_NAMESPACE`.
- Produces: `validate_plan` / `validatePlan` refusing non-portable and non-`.md` paths; `DefaultExecutor.execute` raising `ExecutionError(index=i, applied=0)` from preflight before any effect.

- [ ] **Step 0: Claim the child record**

Run: `tasks start nodes-f072a8`

- [ ] **Step 1: Write the failing Python tests**

Append to `python/tests/test_write_plan.py` (add `import os`, `import shutil`, `import tempfile`, `from pathlib import Path`, and `from nodes.core.errors import ContainmentError`; `import pytest` is present):

```python
def _symlinks_supported() -> bool:
    """Probe once. Only a recognized unsupported-platform failure disables the symlink
    tests (an explicit skip); any other failure is a real error and propagates."""
    probe = Path(tempfile.mkdtemp(prefix="nodes-symlink-probe-"))
    try:
        (probe / "link").symlink_to(probe / "target")
        return True
    except OSError as exc:
        if os.name == "nt" and getattr(exc, "winerror", None) == 1314:
            return False
        raise
    finally:
        shutil.rmtree(probe, ignore_errors=True)


needs_symlinks = pytest.mark.skipif(not _symlinks_supported(), reason="symlinks unsupported on this platform")


@pytest.mark.parametrize("path", ["/a.md", "a//b.md", "./a.md", "a/../b.md"])
def test_validate_refuses_segment_violations(tmp_path, path):
    with pytest.raises(PlanRefusedError):
        DefaultExecutor(tmp_path).execute([CreateOp(path=path, content=b"x")])


@pytest.mark.parametrize("path", [".nodes-index/a.md", "./.nodes-index/a.md", "a/../.nodes-index/a.md"])
def test_validate_refuses_reserved_spellings(tmp_path, path):
    with pytest.raises(PlanRefusedError):
        DefaultExecutor(tmp_path).execute([CreateOp(path=path, content=b"x")])


@pytest.mark.parametrize("path", ["C:/outside/x.md", "..\\outside\\x.md", "a\\b.md", "kind/a:b.md"])
def test_validate_refuses_windows_spellings(tmp_path, path):
    with pytest.raises(PlanRefusedError):
        DefaultExecutor(tmp_path).execute([CreateOp(path=path, content=b"x")])
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize("path", ["kind/a.txt", "kind/a.md/", "corpus.yaml"])
def test_validate_refuses_non_md_targets(tmp_path, path):
    with pytest.raises(PlanRefusedError):
        DefaultExecutor(tmp_path).execute([CreateOp(path=path, content=b"x")])


def test_direct_plan_cannot_replace_protected_artifact(tmp_path):
    (tmp_path / "corpus.yaml").write_bytes(b"manifest")
    with pytest.raises(PlanRefusedError):
        DefaultExecutor(tmp_path).execute([ReplaceOp(path="corpus.yaml", content=b"x", expected_digest=sha(b"manifest"))])
    assert (tmp_path / "corpus.yaml").read_bytes() == b"manifest"


@needs_symlinks
def test_preflight_refuses_create_onto_dangling_symlink(tmp_path):
    (tmp_path / "kind").mkdir()
    outside = tmp_path.parent / f"{tmp_path.name}-outside"
    outside.mkdir()
    (tmp_path / "kind" / "a.md").symlink_to(outside / "a.md")
    with pytest.raises(ExecutionError) as info:
        DefaultExecutor(tmp_path).execute([CreateOp(path="kind/a.md", content=b"x")])
    assert (info.value.index, info.value.applied) == (0, 0)
    assert isinstance(info.value.__cause__, ContainmentError)
    assert not (outside / "a.md").exists()


@needs_symlinks
def test_preflight_refuses_replace_and_delete_onto_symlink(tmp_path):
    (tmp_path / "kind").mkdir()
    target = tmp_path / "protected.txt"
    target.write_bytes(b"keep")
    (tmp_path / "kind" / "a.md").symlink_to(target)
    ex = DefaultExecutor(tmp_path)
    with pytest.raises(ExecutionError) as info:
        ex.execute([ReplaceOp(path="kind/a.md", content=b"x", expected_digest=sha(b"keep"))])
    assert (info.value.index, info.value.applied) == (0, 0)
    with pytest.raises(ExecutionError) as info:
        ex.execute([DeleteOp(path="kind/a.md", expected_digest=sha(b"keep"))])
    assert (info.value.index, info.value.applied) == (0, 0)
    assert target.read_bytes() == b"keep"
    assert (tmp_path / "kind" / "a.md").is_symlink()


@needs_symlinks
def test_preflight_refuses_create_under_symlinked_parent(tmp_path):
    outside = tmp_path.parent / f"{tmp_path.name}-outside"
    outside.mkdir()
    (tmp_path / "kind").symlink_to(outside)
    with pytest.raises(ExecutionError) as info:
        DefaultExecutor(tmp_path).execute([CreateOp(path="kind/a.md", content=b"x")])
    assert (info.value.index, info.value.applied) == (0, 0)
    assert list(outside.iterdir()) == []


@needs_symlinks
def test_preflight_covers_whole_plan_before_any_effect(tmp_path):
    (tmp_path / "kind").mkdir()
    (tmp_path / "kind" / "b.md").symlink_to(tmp_path / "kind" / "missing.md")
    with pytest.raises(ExecutionError) as info:
        DefaultExecutor(tmp_path).execute(
            [CreateOp(path="kind/a.md", content=b"a"), CreateOp(path="kind/b.md", content=b"b")]
        )
    assert (info.value.index, info.value.applied) == (1, 0)
    assert not (tmp_path / "kind" / "a.md").exists()


@needs_symlinks
def test_execute_succeeds_through_symlinked_root(tmp_path):
    real = tmp_path / "real"
    real.mkdir()
    link = tmp_path / "link-root"
    link.symlink_to(real)
    DefaultExecutor(link).execute([CreateOp(path="kind/a.md", content=b"x")])
    assert (real / "kind" / "a.md").read_bytes() == b"x"
```

And append to `python/tests/test_snapshot_load.py`, matching its `_write` / `_snapshot_doc` pattern (this pins that the manifest validator applies the same rule as the plan):

```python
@pytest.mark.parametrize("path", ["a\\b.md", "kind/a:b.md", "a/../b.md", "./topic/a.md"])
def test_non_portable_manifest_path_returns_none(tmp_path, path):
    _write(tmp_path)
    doc = _snapshot_doc(tmp_path)
    doc["manifest"][0]["path"] = path
    write_json_atomic(tmp_path, SNAPSHOT_REL_PATH, doc)

    assert load_snapshot(tmp_path, None) is None
```

- [ ] **Step 2: Run to verify they fail**

Run: `just test-fast`
Expected: the Windows-spelling, non-`.md`, reserved-spelling (dotted forms), protected-artifact, and preflight tests FAIL; the others may already pass.

- [ ] **Step 3: Implement (Python)**

In `python/src/nodes/core/write_plan.py`, delete `_path_escapes` and rewrite `validate_plan` and `DefaultExecutor.execute`:

```python
def validate_plan(plan: WritePlan) -> None:
    """Refuse a lexically malformed plan (`PlanRefusedError`) before any effect: unknown
    operation kind, a path that is not a portable root-relative `.md` path, or a
    reserved-namespace path. Every plan path is a node document by definition."""
    for op in plan:
        if not isinstance(op, (CreateOp, ReplaceOp, DeleteOp)):
            raise PlanRefusedError(f"unknown operation kind: {op!r}")
        if not is_portable_relative_path(op.path):
            raise PlanRefusedError(f"not a portable root-relative .md path: {op.path!r}")
        if op.path.split("/", 1)[0] == RESERVED_NAMESPACE:
            raise PlanRefusedError(f"path in reserved namespace: {op.path!r}")


class DefaultExecutor:
    """Best-effort ordered writes. A whole-plan containment preflight runs before any
    effect; then each operation's existence precondition is checked when it is reached
    and execution stops at the first failure, leaving the applied prefix. Carries but
    does not enforce `expected_digest`. Provides no serialization; the deployment
    retains the single-writer obligation."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    def execute(self, plan: WritePlan) -> None:
        validate_plan(plan)
        for index, op in enumerate(plan):
            try:
                assert_contained(self.root, op.path)
            except ContainmentError as exc:
                raise ExecutionError(f"operation {index} not contained: {exc}", index=index, applied=0) from exc
        for index, op in enumerate(plan):
            target = self.root / op.path
            if isinstance(op, CreateOp):
                if target.exists():
                    raise ExecutionError(
                        f"create target already present: {op.path!r}", index=index, applied=index
                    )
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(op.content)
            elif isinstance(op, ReplaceOp):
                if not target.is_file():
                    raise ExecutionError(
                        f"replace target absent: {op.path!r}", index=index, applied=index
                    )
                target.write_bytes(op.content)
            else:
                if not target.is_file():
                    raise ExecutionError(
                        f"delete target absent: {op.path!r}", index=index, applied=index
                    )
                target.unlink()
```

Imports: `from nodes.core.errors import ContainmentError, ExecutionError, PlanRefusedError` and `from nodes.core.paths import RESERVED_NAMESPACE as RESERVED_NAMESPACE, assert_contained, is_portable_relative_path`.

In `python/src/nodes/core/snapshot.py`, rewrite `_validate_manifest_path` to the shared rule:

```python
def _validate_manifest_path(path: str) -> None:
    if not is_portable_relative_path(path) or path.split("/", 1)[0] == RESERVED_NAMESPACE:
        raise ValueError("snapshot manifest row path must be a portable root-relative .md path")
```

(add `is_portable_relative_path` to the `paths` import).

- [ ] **Step 4: Run to verify they pass**

Run: `just test-fast`
Expected: all PASS. If an existing `test_write_plan.py` test asserted that `a/../b.md` is *accepted* as `b.md`, change its expectation to `PlanRefusedError` — the rule changed deliberately (spec §2).

- [ ] **Step 5: Write the failing TypeScript tests**

Append to `ts/tests/write-plan.test.ts` (add `ContainmentError` to the errors import; add `mkdirSync, readdirSync, symlinkSync, lstatSync` to `node:fs`; the `SYMLINKS` probe below replaces any helper):

```ts
/** Probe once. Only a recognized unsupported platform disables the symlink tests (an
 * explicit skip); any other failure is a real error and propagates. */
const SYMLINKS = (() => {
  const probe = mkdtempSync(join(tmpdir(), "nodes-symlink-probe-"));
  try {
    symlinkSync(join(probe, "target"), join(probe, "link"));
    return true;
  } catch (e) {
    if (process.platform === "win32" && (e as NodeJS.ErrnoException).code === "EPERM") return false;
    throw e;
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
})();

describe("plan path rules", () => {
  it.each(["/a.md", "a//b.md", "./a.md", "a/../b.md"])("refuses segment violation %s", (path) => {
    expect(() => new DefaultExecutor(root).execute([{ op: "create", path, content: bytes("x") }])).toThrow(PlanRefusedError);
  });

  it.each([".nodes-index/a.md", "./.nodes-index/a.md", "a/../.nodes-index/a.md"])("refuses reserved spelling %s", (path) => {
    expect(() => new DefaultExecutor(root).execute([{ op: "create", path, content: bytes("x") }])).toThrow(PlanRefusedError);
  });

  it.each(["C:/outside/x.md", "..\\outside\\x.md", "a\\b.md", "kind/a:b.md"])("refuses Windows spelling %s", (path) => {
    expect(() => new DefaultExecutor(root).execute([{ op: "create", path, content: bytes("x") }])).toThrow(PlanRefusedError);
    expect(readdirSync(root)).toEqual([]);
  });

  it.each(["kind/a.txt", "kind/a.md/", "corpus.yaml"])("refuses non-.md target %s", (path) => {
    expect(() => new DefaultExecutor(root).execute([{ op: "create", path, content: bytes("x") }])).toThrow(PlanRefusedError);
  });

  it("a direct plan cannot replace a protected artifact", () => {
    writeFileSync(join(root, "corpus.yaml"), "manifest");
    const plan: WriteOp[] = [{ op: "replace", path: "corpus.yaml", content: bytes("x"), expectedDigest: sha("manifest") }];
    expect(() => new DefaultExecutor(root).execute(plan)).toThrow(PlanRefusedError);
    expect(readFileSync(join(root, "corpus.yaml"), "utf-8")).toBe("manifest");
  });
});

describe("executor preflight", () => {
  it.skipIf(!SYMLINKS)("refuses a create onto a dangling symlink before any effect", () => {
    mkdirSync(join(root, "kind"));
    const outside = mkdtempSync(join(tmpdir(), "nodes-write-plan-outside-"));
    try {
      symlinkSync(join(outside, "a.md"), join(root, "kind", "a.md"));
      let caught: unknown;
      try {
        new DefaultExecutor(root).execute([{ op: "create", path: "kind/a.md", content: bytes("x") }]);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ExecutionError);
      expect((caught as ExecutionError).index).toBe(0);
      expect((caught as ExecutionError).applied).toBe(0);
      expect((caught as ExecutionError).cause).toBeInstanceOf(ContainmentError);
      expect(existsSync(join(outside, "a.md"))).toBe(false);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it.skipIf(!SYMLINKS)("refuses replace and delete onto a symlink", () => {
    mkdirSync(join(root, "kind"));
    const target = join(root, "protected.txt");
    writeFileSync(target, "keep");
    symlinkSync(target, join(root, "kind", "a.md"));
    const ex = new DefaultExecutor(root);
    expect(() => ex.execute([{ op: "replace", path: "kind/a.md", content: bytes("x"), expectedDigest: sha("keep") }])).toThrow(ExecutionError);
    expect(() => ex.execute([{ op: "delete", path: "kind/a.md", expectedDigest: sha("keep") }])).toThrow(ExecutionError);
    expect(readFileSync(target, "utf-8")).toBe("keep");
    expect(lstatSync(join(root, "kind", "a.md")).isSymbolicLink()).toBe(true);
  });

  it.skipIf(!SYMLINKS)("refuses a create under a symlinked parent", () => {
    const outside = mkdtempSync(join(tmpdir(), "nodes-write-plan-outside-"));
    try {
      symlinkSync(outside, join(root, "kind"));
      expect(() => new DefaultExecutor(root).execute([{ op: "create", path: "kind/a.md", content: bytes("x") }])).toThrow(ExecutionError);
      expect(readdirSync(outside)).toEqual([]);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it.skipIf(!SYMLINKS)("covers the whole plan before any effect", () => {
    mkdirSync(join(root, "kind"));
    symlinkSync(join(root, "kind", "missing.md"), join(root, "kind", "b.md"));
    let caught: unknown;
    try {
      new DefaultExecutor(root).execute([
        { op: "create", path: "kind/a.md", content: bytes("a") },
        { op: "create", path: "kind/b.md", content: bytes("b") },
      ]);
    } catch (e) {
      caught = e;
    }
    expect((caught as ExecutionError).index).toBe(1);
    expect((caught as ExecutionError).applied).toBe(0);
    expect(existsSync(join(root, "kind", "a.md"))).toBe(false);
  });

  it.skipIf(!SYMLINKS)("succeeds through a symlinked root", () => {
    const real = join(root, "real");
    mkdirSync(real);
    const link = join(root, "link-root");
    symlinkSync(real, link);
    new DefaultExecutor(link).execute([{ op: "create", path: "kind/a.md", content: bytes("x") }]);
    expect(readFileSync(join(real, "kind", "a.md"), "utf-8")).toBe("x");
  });
});
```

And append inside the existing `describe` in `ts/tests/snapshot-load.test.ts`, after "returns null when a manifest path disagrees with the structural id":

```ts
  it.each(["a\\b.md", "kind/a:b.md", "a/../b.md", "./topic/a.md"])("returns null on the non-portable manifest path %s", (path) => {
    const ns = nodes();
    const manifest = manifestFor(ns);
    manifest[0] = { ...manifest[0], path };
    writeSnapshot(root, manifest, Index.build(ns), SearchIndex.build(ns), undefined);
    expect(loadSnapshot(root, null)).toBeNull();
  });
```

- [ ] **Step 6: Run to verify they fail**

Run: `just test-fast`
Expected: the same categories fail as in Python.

- [ ] **Step 7: Implement (TypeScript)**

In `ts/src/write-plan.ts`, delete `pathEscapes`, rewrite `validatePlan` and `DefaultExecutor.execute`:

```ts
/** Refuse a lexically malformed plan (`PlanRefusedError`) before any effect: unknown
 * operation kind, a path that is not a portable root-relative `.md` path, or a
 * reserved-namespace path. Every plan path is a node document by definition. */
export function validatePlan(plan: WritePlan): void {
  for (const op of plan) {
    if (op.op !== "create" && op.op !== "replace" && op.op !== "delete") {
      throw new PlanRefusedError(`unknown operation kind: ${JSON.stringify(op)}`);
    }
    if (!isPortableRelativePath(op.path)) {
      throw new PlanRefusedError(`not a portable root-relative .md path: ${JSON.stringify(op.path)}`);
    }
    if (op.path.split("/", 1)[0] === RESERVED_NAMESPACE) {
      throw new PlanRefusedError(`path in reserved namespace: ${JSON.stringify(op.path)}`);
    }
  }
}

/** Best-effort ordered writes. A whole-plan containment preflight runs before any
 * effect; then each operation's existence precondition is checked when it is reached
 * and execution stops at the first failure, leaving the applied prefix. Carries but
 * does not enforce `expectedDigest`. Provides no serialization; the deployment retains
 * the single-writer obligation. */
export class DefaultExecutor implements WritePlanExecutor {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  execute(plan: WritePlan): void {
    validatePlan(plan);
    plan.forEach((op, index) => {
      try {
        assertContained(this.root, op.path);
      } catch (e) {
        if (!(e instanceof ContainmentError)) throw e;
        throw new ExecutionError(`operation ${index} not contained: ${e.message}`, index, 0, { cause: e });
      }
    });
    for (let index = 0; index < plan.length; index++) {
      const op = plan[index];
      const target = join(this.root, op.path);
      if (op.op === "create") {
        if (existsSync(target)) {
          throw new ExecutionError(`create target already present: ${JSON.stringify(op.path)}`, index, index);
        }
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, op.content);
      } else if (op.op === "replace") {
        if (!(existsSync(target) && statSync(target).isFile())) {
          throw new ExecutionError(`replace target absent: ${JSON.stringify(op.path)}`, index, index);
        }
        writeFileSync(target, op.content);
      } else {
        if (!(existsSync(target) && statSync(target).isFile())) {
          throw new ExecutionError(`delete target absent: ${JSON.stringify(op.path)}`, index, index);
        }
        rmSync(target);
      }
    }
  }
}
```

Imports: `import { ContainmentError, ExecutionError, PlanRefusedError } from "./errors.js";` and `import { RESERVED_NAMESPACE, assertContained, isPortableRelativePath } from "./paths.js";`.

`ExecutionError` needs to accept a cause. In `ts/src/errors.ts`:

```ts
export class ExecutionError extends NodesError {
  readonly index: number | null;
  readonly applied: number | null;

  constructor(message: string, index: number | null, applied: number | null, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause !== undefined) this.cause = options.cause;
    this.index = index;
    this.applied = applied;
  }
}
```

(`Error.prototype.cause` exists on Node 20's lib target; if `tsc` objects to assigning `this.cause`, declare `cause?: unknown;` on the class.)

In `ts/src/snapshot.ts`, rewrite `validateManifestPath`:

```ts
function validateManifestPath(path: string): void {
  if (!isPortableRelativePath(path) || path.split("/", 1)[0] === RESERVED_NAMESPACE) {
    throw new Error("snapshot manifest row path must be a portable root-relative .md path");
  }
}
```

(add `isPortableRelativePath` to the `./paths.js` import).

- [ ] **Step 8: Run to verify they pass**

Run: `just test-fast`
Expected: all PASS (same note as Python about any test that asserted `a/../b.md` was accepted).

- [ ] **Step 9: Gate and close the child record**

Run: `just gate`
Expected: check green, Python and TypeScript suites green. No commit — A commits once, in Task 7.

```bash
tasks done nodes-f072a8 "validate_plan applies the portable .md path rule in both languages (manifest validator aligned); DefaultExecutor preflights the whole plan with assert_contained and refuses ExecutionError(index=i, applied=0) before any effect"
```

---

### Task 5: Store guards

**Files:**
- Modify: `python/src/nodes/core/store.py:21-41`
- Modify: `ts/src/store.ts:33-75`
- Test: `python/tests/test_store.py`, `ts/tests/store.test.ts` (append)

**Interfaces:**
- Consumes: `assert_contained` / `assertContained`; `pathForNodeId` (TS) and the inline mapping (Python).
- Produces: `Store.read_file`, `write_file`, `delete_file` (and TS forms) raising `ContainmentError` when the mapped path has a symlink component; a new `Store.rel_path(node_id) -> str` in Python (the root-relative POSIX form `path_for` derives from).

- [ ] **Step 0: Claim the child record**

Run: `tasks start nodes-b72b50`

- [ ] **Step 1: Write the failing Python tests**

Append to `python/tests/test_store.py` (add `import os`, `import shutil`, `import tempfile`, `from pathlib import Path`, and `from nodes.core.errors import ContainmentError`):

```python
def _symlinks_supported() -> bool:
    """Probe once. Only a recognized unsupported-platform failure disables the symlink
    tests (an explicit skip); any other failure is a real error and propagates."""
    probe = Path(tempfile.mkdtemp(prefix="nodes-symlink-probe-"))
    try:
        (probe / "link").symlink_to(probe / "target")
        return True
    except OSError as exc:
        if os.name == "nt" and getattr(exc, "winerror", None) == 1314:
            return False
        raise
    finally:
        shutil.rmtree(probe, ignore_errors=True)


needs_symlinks = pytest.mark.skipif(not _symlinks_supported(), reason="symlinks unsupported on this platform")


@needs_symlinks
def test_read_file_refuses_symlinked_path(tmp_path):
    store = Store(tmp_path)
    store.write_file(Node(id="topic:real", kind="topic", title="R"))
    (tmp_path / "topic" / "a.md").symlink_to(tmp_path / "topic" / "real.md")
    with pytest.raises(ContainmentError):
        store.read_file("topic:a")


@needs_symlinks
def test_write_file_refuses_symlinked_path_and_leaves_target(tmp_path):
    store = Store(tmp_path)
    (tmp_path / "topic").mkdir()
    target = tmp_path / "protected.txt"
    target.write_bytes(b"keep")
    (tmp_path / "topic" / "a.md").symlink_to(target)
    with pytest.raises(ContainmentError):
        store.write_file(Node(id="topic:a", kind="topic", title="A"))
    assert target.read_bytes() == b"keep"


@needs_symlinks
def test_delete_file_refuses_symlinked_path_and_leaves_link(tmp_path):
    store = Store(tmp_path)
    (tmp_path / "topic").mkdir()
    target = tmp_path / "protected.txt"
    target.write_bytes(b"keep")
    (tmp_path / "topic" / "a.md").symlink_to(target)
    with pytest.raises(ContainmentError):
        store.delete_file("topic:a")
    assert (tmp_path / "topic" / "a.md").is_symlink()
    assert target.read_bytes() == b"keep"


@needs_symlinks
def test_store_works_through_symlinked_root(tmp_path):
    real = tmp_path / "real"
    real.mkdir()
    link = tmp_path / "link-root"
    link.symlink_to(real)
    store = Store(link)
    store.write_file(Node(id="topic:a", kind="topic", title="A"))
    assert store.read_file("topic:a").title == "A"
    store.delete_file("topic:a")
    assert not (real / "topic" / "a.md").exists()
```

- [ ] **Step 2: Run to verify they fail**

Run: `just test-fast`
Expected: the three refusal tests FAIL (`RefError` or success instead of `ContainmentError`); the root test passes.

- [ ] **Step 3: Implement (Python)**

Rewrite the `Store` methods in `python/src/nodes/core/store.py`:

```python
    def rel_path(self, node_id: str) -> str:
        nid = NodeId.parse(node_id)
        return f"{nid.kind}/{nid.slug.replace(':', '__')}.md"

    def path_for(self, node_id: str) -> Path:
        return self.root / self.rel_path(node_id)

    def write_file(self, node: Node) -> Path:
        rel = self.rel_path(node.id)
        assert_contained(self.root, rel)
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(node_to_markdown(node), encoding="utf-8")
        return path

    def read_file(self, node_id: str) -> Node:
        rel = self.rel_path(node_id)
        assert_contained(self.root, rel)
        path = self.root / rel
        if not path.is_file():
            raise RefError(f"no node at {node_id!r}")
        return node_from_markdown(path.read_text(encoding="utf-8"))

    def delete_file(self, node_id: str) -> None:
        rel = self.rel_path(node_id)
        assert_contained(self.root, rel)
        path = self.root / rel
        if not path.is_file():
            raise RefError(f"no node at {node_id!r}")
        path.unlink()
```

Add `from nodes.core.paths import assert_contained`. `all_nodes` is unchanged: the walk contains it.

- [ ] **Step 4: Run to verify they pass**

Run: `just test-fast`
Expected: all PASS.

- [ ] **Step 5: Write the failing TypeScript tests**

Append to `ts/tests/store.test.ts` (add `ContainmentError` to the errors import; `existsSync, lstatSync` to `node:fs` — `symlinkSync`, `mkdtempSync`, `tmpdir`, and the `SYMLINKS` probe are already there from Task 3; do **not** declare `SYMLINKS` again):

```ts
describe("Store containment", () => {
  it.skipIf(!SYMLINKS)("readFile refuses a symlinked path", () => {
    store.writeFile(n("topic:real", "topic"));
    symlinkSync(join(root, "topic", "real.md"), join(root, "topic", "a.md"));
    expect(() => store.readFile("topic:a")).toThrow(ContainmentError);
  });

  it.skipIf(!SYMLINKS)("writeFile refuses a symlinked path and leaves the target", () => {
    mkdirSync(join(root, "topic"));
    const target = join(root, "protected.txt");
    writeFileSync(target, "keep");
    symlinkSync(target, join(root, "topic", "a.md"));
    expect(() => store.writeFile(n("topic:a", "topic"))).toThrow(ContainmentError);
    expect(readFileSync(target, "utf-8")).toBe("keep");
  });

  it.skipIf(!SYMLINKS)("deleteFile refuses a symlinked path and leaves the link", () => {
    mkdirSync(join(root, "topic"));
    const target = join(root, "protected.txt");
    writeFileSync(target, "keep");
    symlinkSync(target, join(root, "topic", "a.md"));
    expect(() => store.deleteFile("topic:a")).toThrow(ContainmentError);
    expect(lstatSync(join(root, "topic", "a.md")).isSymbolicLink()).toBe(true);
    expect(readFileSync(target, "utf-8")).toBe("keep");
  });

  it.skipIf(!SYMLINKS)("works through a symlinked root", () => {
    const real = join(root, "real");
    mkdirSync(real);
    const link = join(root, "link-root");
    symlinkSync(real, link);
    const linked = new Store(link);
    linked.writeFile(n("topic:a", "topic"));
    expect(linked.readFile("topic:a").title).toBe("topic:a");
    linked.deleteFile("topic:a");
    expect(existsSync(join(real, "topic", "a.md"))).toBe(false);
  });
});
```

- [ ] **Step 6: Run to verify they fail**

Run: `just test-fast`
Expected: the three refusal tests FAIL.

- [ ] **Step 7: Implement (TypeScript)**

In `ts/src/store.ts`, add `import { assertContained } from "./paths.js";` and insert `assertContained(this.root, rel);` as the first statement after `const rel = pathForNodeId(...)` in `writeFile`, `readFile`, and `deleteFile`. `allNodes` is unchanged: the walk contains it.

- [ ] **Step 8: Run to verify they pass**

Run: `just test-fast`
Expected: all PASS.

- [ ] **Step 9: Gate and close the child record**

Run: `just gate`
Expected: check green, Python and TypeScript suites green. No commit — A commits once, in Task 7.

```bash
tasks done nodes-b72b50 "Store.read_file/write_file/delete_file and the TS forms call assertContained on the mapped path"
```

---

### Task 6: The shared containment fixture and its harnesses

**Files:**
- Create: `fixtures/containment.oracle.json`
- Create: `python/tests/test_containment_parity.py`
- Create: `ts/tests/containment_parity.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–5: `Corpus`, `DefaultExecutor`, `Store`, `VectorCache`, `write_json_atomic` / `writeJsonAtomic`, `iter_corpus_files` / `iterCorpusFiles`, the error classes.
- Produces: the tier-1 oracle and one harness per language that materializes each case.

Fixture schema (documented in the file's `$comment`):

- `root`: `"direct"` or `"symlink"` (harness creates `real/` and a `link-root` → `real/` symlink; all actions use the link).
- `files`: `{ "<root-relative path>": "<utf-8 content>" }` created under the root.
- `outside`: `{ "<path>": "<content>" }` created under a sibling `outside/` directory.
- `symlinks`: `{ "<root-relative link path>": "root:<rel>" | "outside:<rel>" }`; the target may not exist (dangling).
- `setup_flush`: when `true`, the harness constructs a corpus and calls `flush_index` during setup, so a valid snapshot exists before the action (installed after `files` and before `symlinks`).
- `then_symlinks`: like `symlinks`, but installed *after* the construction phase of a `construct-then-flush` action — for cases where the symlink must not affect construction.
- `action`: one of `walk`, `construct`, `flush`, `construct-then-flush`, `execute`, `store-read`, `store-write`, `store-delete`, `vector-put`, `cache-write`. `construct-then-flush` constructs (asserted to succeed, outside the expected-error assertion), installs `then_symlinks`, then calls `flush_index` inside it.
- `plan`: for `execute`, a list of `{op, path, content?, expected_digest?}`; `expected_digest` defaults to 64 zeros (the executor carries but does not enforce it).
- `id`: for `store-*`, the node id; `store-write` builds a node with that id, its kind, and title `"T"`.
- `rel`: for `cache-write`, the relative cache path.
- `expect`: `{ "walk": [...] }`, `{ "ok": true }`, or `{ "error": <name>, "index"?: n, "applied"?: n }` with `<name>` in `ContainmentError`, `ExecutionError`, `PlanRefusedError`, `FilesystemError` (Python `OSError`; TS an error carrying a string `code`), `ProgrammingError` (Python `ValueError`; TS `TypeError`).
- `untouched`: `["root:<rel>" | "outside:<rel>"]` byte-identical to setup afterwards.
- `absent` / `present`: `["root:<rel>" | "outside:<rel>"]` (lstat-level; a symlink counts as present).

Node markdown used in `files` is the minimal valid document: `---\nid: <id>\nuid: "<32 hex>"\nkind: <kind>\ntitle: <title>\n---\n`.

- [ ] **Step 0: Claim the child record**

Run: `tasks start nodes-ceccb8`

- [ ] **Step 1: Write the fixture**

`fixtures/containment.oracle.json`:

```json
{
  "$comment": "Containment oracle (STANDARD §4.1, 2.0). Each case describes a filesystem to materialize in a temporary directory — files under the corpus root, files under a sibling outside/ directory, and symlinks whose targets are root:<rel> or outside:<rel> — then one action and its expected outcome. Symlinks are not checkout-portable, so the tree is described, not committed. Harnesses: python/tests/test_containment_parity.py, ts/tests/containment_parity.test.ts.",
  "node_a": "---\nid: kind:a\nuid: \"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"\nkind: kind\ntitle: A\n---\n",
  "node_b": "---\nid: kind:b\nuid: \"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\"\nkind: kind\ntitle: B\n---\n",
  "cases": [
    {
      "name": "directory symlink to an outside tree is not walked",
      "root": "direct",
      "files": { "kind/a.md": "$node_a" },
      "outside": { "tree/b.md": "$node_b" },
      "symlinks": { "linked": "outside:tree" },
      "action": "walk",
      "expect": { "walk": ["kind/a.md"] }
    },
    {
      "name": "file symlink to a .md inside the root is not walked",
      "root": "direct",
      "files": { "kind/a.md": "$node_a" },
      "symlinks": { "kind/b.md": "root:kind/a.md" },
      "action": "walk",
      "expect": { "walk": ["kind/a.md"] }
    },
    {
      "name": "symlinked root walks the same paths",
      "root": "symlink",
      "files": { "kind/a.md": "$node_a" },
      "action": "walk",
      "expect": { "walk": ["kind/a.md"] }
    },
    {
      "name": "symlinked root accepts an add plan",
      "root": "symlink",
      "files": { "kind/a.md": "$node_a" },
      "action": "execute",
      "plan": [{ "op": "create", "path": "kind/b.md", "content": "$node_b" }],
      "expect": { "ok": true },
      "present": ["root:kind/b.md"]
    },
    {
      "name": ".nodes-index at the root is not walked",
      "root": "direct",
      "files": { "kind/a.md": "$node_a", ".nodes-index/x.md": "not a node" },
      "action": "walk",
      "expect": { "walk": ["kind/a.md"] }
    },
    {
      "name": "nested .nodes-index is walked",
      "root": "direct",
      "files": { "kind/a.md": "$node_a", "kind/.nodes-index/b.md": "$node_b" },
      "action": "walk",
      "expect": { "walk": ["kind/.nodes-index/b.md", "kind/a.md"] }
    },
    {
      "name": "non-Markdown artifacts survive add, replace, and delete",
      "root": "direct",
      "files": { "kind/a.md": "$node_a", "corpus.yaml": "manifest: 1\n", "kind/notes.txt": "keep me\n" },
      "action": "execute",
      "plan": [
        { "op": "create", "path": "kind/b.md", "content": "$node_b" },
        { "op": "replace", "path": "kind/a.md", "content": "$node_a" },
        { "op": "delete", "path": "kind/b.md" }
      ],
      "expect": { "ok": true },
      "untouched": ["root:corpus.yaml", "root:kind/notes.txt"],
      "absent": ["root:kind/b.md"]
    },
    {
      "name": "create onto a dangling symlink is refused before any effect",
      "root": "direct",
      "files": { "kind/a.md": "$node_a" },
      "symlinks": { "kind/b.md": "outside:b.md" },
      "action": "execute",
      "plan": [{ "op": "create", "path": "kind/b.md", "content": "$node_b" }],
      "expect": { "error": "ExecutionError", "index": 0, "applied": 0 },
      "absent": ["outside:b.md"]
    },
    {
      "name": "replace onto a file symlink is refused",
      "root": "direct",
      "files": { "kind/a.md": "$node_a" },
      "outside": { "protected.txt": "keep" },
      "symlinks": { "kind/b.md": "outside:protected.txt" },
      "action": "execute",
      "plan": [{ "op": "replace", "path": "kind/b.md", "content": "$node_b" }],
      "expect": { "error": "ExecutionError", "index": 0, "applied": 0 },
      "untouched": ["outside:protected.txt"]
    },
    {
      "name": "delete onto a file symlink is refused",
      "root": "direct",
      "files": { "kind/a.md": "$node_a" },
      "outside": { "protected.txt": "keep" },
      "symlinks": { "kind/b.md": "outside:protected.txt" },
      "action": "execute",
      "plan": [{ "op": "delete", "path": "kind/b.md" }],
      "expect": { "error": "ExecutionError", "index": 0, "applied": 0 },
      "untouched": ["outside:protected.txt"],
      "present": ["root:kind/b.md"]
    },
    {
      "name": "create under a symlinked parent is refused",
      "root": "direct",
      "outside": { "tree/.keep": "" },
      "symlinks": { "kind": "outside:tree" },
      "action": "execute",
      "plan": [{ "op": "create", "path": "kind/a.md", "content": "$node_a" }],
      "expect": { "error": "ExecutionError", "index": 0, "applied": 0 },
      "absent": ["outside:tree/a.md"]
    },
    {
      "name": "two-op plan with the symlink at op 1 writes nothing",
      "root": "direct",
      "files": { "kind/.keep": "" },
      "symlinks": { "kind/b.md": "root:kind/missing.md" },
      "action": "execute",
      "plan": [
        { "op": "create", "path": "kind/a.md", "content": "$node_a" },
        { "op": "create", "path": "kind/b.md", "content": "$node_b" }
      ],
      "expect": { "error": "ExecutionError", "index": 1, "applied": 0 },
      "absent": ["root:kind/a.md"]
    },
    {
      "name": "segment rule: leading slash",
      "root": "direct",
      "action": "execute",
      "plan": [{ "op": "create", "path": "/a.md", "content": "x" }],
      "expect": { "error": "PlanRefusedError" }
    },
    {
      "name": "segment rule: empty segment",
      "root": "direct",
      "action": "execute",
      "plan": [{ "op": "create", "path": "a//b.md", "content": "x" }],
      "expect": { "error": "PlanRefusedError" }
    },
    {
      "name": "segment rule: dot segment",
      "root": "direct",
      "action": "execute",
      "plan": [{ "op": "create", "path": "./a.md", "content": "x" }],
      "expect": { "error": "PlanRefusedError" }
    },
    {
      "name": "segment rule: dot-dot segment",
      "root": "direct",
      "action": "execute",
      "plan": [{ "op": "create", "path": "a/../b.md", "content": "x" }],
      "expect": { "error": "PlanRefusedError" }
    },
    {
      "name": "reserved rule: plain",
      "root": "direct",
      "action": "execute",
      "plan": [{ "op": "create", "path": ".nodes-index/a.md", "content": "x" }],
      "expect": { "error": "PlanRefusedError" },
      "absent": ["root:.nodes-index/a.md"]
    },
    {
      "name": "reserved rule: dotted spelling",
      "root": "direct",
      "action": "execute",
      "plan": [{ "op": "create", "path": "./.nodes-index/a.md", "content": "x" }],
      "expect": { "error": "PlanRefusedError" },
      "absent": ["root:.nodes-index/a.md"]
    },
    {
      "name": "reserved rule: dot-dot spelling",
      "root": "direct",
      "action": "execute",
      "plan": [{ "op": "create", "path": "a/../.nodes-index/a.md", "content": "x" }],
      "expect": { "error": "PlanRefusedError" },
      "absent": ["root:.nodes-index/a.md"]
    },
    {
      "name": "portability rule: drive-qualified",
      "root": "direct",
      "outside": { "x.md": "$node_a" },
      "action": "execute",
      "plan": [{ "op": "create", "path": "C:/outside/x.md", "content": "x" }],
      "expect": { "error": "PlanRefusedError" },
      "untouched": ["outside:x.md"]
    },
    {
      "name": "portability rule: backslash traversal",
      "root": "direct",
      "outside": { "x.md": "$node_a" },
      "action": "execute",
      "plan": [{ "op": "create", "path": "..\\outside\\x.md", "content": "x" }],
      "expect": { "error": "PlanRefusedError" },
      "untouched": ["outside:x.md"]
    },
    {
      "name": "portability rule: backslash segment",
      "root": "direct",
      "action": "execute",
      "plan": [{ "op": "create", "path": "a\\b.md", "content": "x" }],
      "expect": { "error": "PlanRefusedError" }
    },
    {
      "name": "portability rule: colon segment",
      "root": "direct",
      "action": "execute",
      "plan": [{ "op": "create", "path": "kind/a:b.md", "content": "x" }],
      "expect": { "error": "PlanRefusedError" }
    },
    {
      "name": "suffix rule: .txt",
      "root": "direct",
      "action": "execute",
      "plan": [{ "op": "create", "path": "kind/a.txt", "content": "x" }],
      "expect": { "error": "PlanRefusedError" }
    },
    {
      "name": "suffix rule: trailing slash",
      "root": "direct",
      "action": "execute",
      "plan": [{ "op": "create", "path": "kind/a.md/", "content": "x" }],
      "expect": { "error": "PlanRefusedError" }
    },
    {
      "name": "direct plan cannot create corpus.yaml or replace notes.txt",
      "root": "direct",
      "files": { "kind/notes.txt": "keep me\n" },
      "action": "execute",
      "plan": [
        { "op": "create", "path": "corpus.yaml", "content": "x" },
        { "op": "replace", "path": "kind/notes.txt", "content": "x" }
      ],
      "expect": { "error": "PlanRefusedError" },
      "absent": ["root:corpus.yaml"],
      "untouched": ["root:kind/notes.txt"]
    },
    {
      "name": "symlinked .nodes-index refuses construction",
      "root": "direct",
      "files": { "kind/a.md": "$node_a" },
      "outside": { "cache/.keep": "" },
      "symlinks": { ".nodes-index": "outside:cache" },
      "action": "construct",
      "expect": { "error": "ContainmentError" }
    },
    {
      "name": "symlinked .nodes-index installed after construction refuses flush and writes nothing outside",
      "root": "direct",
      "files": { "kind/a.md": "$node_a" },
      "outside": { "cache/.keep": "" },
      "then_symlinks": { ".nodes-index": "outside:cache" },
      "action": "construct-then-flush",
      "expect": { "error": "ContainmentError" },
      "absent": ["outside:cache/snapshot.py.json", "outside:cache/snapshot.ts.json", "outside:cache/snapshot.py.json.tmp", "outside:cache/snapshot.ts.json.tmp"]
    },
    {
      "name": "symlinked snapshot file refuses construction and is not read",
      "root": "direct",
      "files": { "kind/a.md": "$node_a", ".nodes-index/.keep": "" },
      "outside": { "snap.json": "{\"version\": 0}" },
      "symlinks": { ".nodes-index/snapshot.py.json": "outside:snap.json", ".nodes-index/snapshot.ts.json": "outside:snap.json" },
      "action": "construct",
      "expect": { "error": "ContainmentError" },
      "untouched": ["outside:snap.json"]
    },
    {
      "name": "symlinked vectors namespace refuses a cache put",
      "root": "direct",
      "files": { ".nodes-index/vectors/.keep": "" },
      "outside": { "vec/.keep": "" },
      "symlinks": { ".nodes-index/vectors/ns": "outside:vec" },
      "action": "vector-put",
      "expect": { "error": "ContainmentError" },
      "absent": ["outside:vec/0000000000000000000000000000000000000000000000000000000000000000.json"]
    },
    {
      "name": "stray snapshot tmp symlink: construction reads the existing snapshot, flush refuses",
      "root": "direct",
      "files": { "kind/a.md": "$node_a" },
      "setup_flush": true,
      "outside": { "protected.txt": "keep" },
      "symlinks": { ".nodes-index/snapshot.py.json.tmp": "outside:protected.txt", ".nodes-index/snapshot.ts.json.tmp": "outside:protected.txt" },
      "action": "construct-then-flush",
      "expect": { "error": "ContainmentError" },
      "untouched": ["outside:protected.txt", "root:.nodes-index/snapshot.py.json", "root:.nodes-index/snapshot.ts.json"]
    },
    {
      "name": "single-segment cache path is a programming error and leaves .nodes-index.tmp alone",
      "root": "direct",
      "files": { ".nodes-index.tmp": "consumer artifact" },
      "action": "cache-write",
      "rel": ".nodes-index",
      "expect": { "error": "ProgrammingError" },
      "untouched": ["root:.nodes-index.tmp"]
    },
    {
      "name": "Store.read_file through a file symlink is refused",
      "root": "direct",
      "files": { "kind/real.md": "$node_a" },
      "symlinks": { "kind/a.md": "root:kind/real.md" },
      "action": "store-read",
      "id": "kind:a",
      "expect": { "error": "ContainmentError" }
    },
    {
      "name": "Store.write_file through a file symlink is refused and the target unchanged",
      "root": "direct",
      "files": { "kind/.keep": "" },
      "outside": { "protected.txt": "keep" },
      "symlinks": { "kind/a.md": "outside:protected.txt" },
      "action": "store-write",
      "id": "kind:a",
      "expect": { "error": "ContainmentError" },
      "untouched": ["outside:protected.txt"]
    },
    {
      "name": "Store.delete_file through a file symlink is refused and link and target intact",
      "root": "direct",
      "files": { "kind/.keep": "" },
      "outside": { "protected.txt": "keep" },
      "symlinks": { "kind/a.md": "outside:protected.txt" },
      "action": "store-delete",
      "id": "kind:a",
      "expect": { "error": "ContainmentError" },
      "untouched": ["outside:protected.txt"],
      "present": ["root:kind/a.md"]
    },
    {
      "name": "missing root fails construction rather than yielding an empty corpus",
      "root": "missing",
      "action": "construct",
      "expect": { "error": "FilesystemError" }
    }
  ]
}
```

Notes for the harness author: `"$node_a"` / `"$node_b"` in any content string are replaced by the top-level `node_a` / `node_b` values; `"root": "missing"` means the harness passes a path that does not exist and creates nothing. The `flush` action constructs then calls `flush_index` inside the error assertion (used where construction itself must refuse); `construct-then-flush` asserts construction separately so a refusal in the wrong phase fails the case. Because both language snapshot names appear in symlink maps and `untouched` lists, each harness creates every listed symlink and skips an `untouched` entry whose file does not exist (the other language's snapshot). In the stray-`.tmp` case `setup_flush` guarantees a valid snapshot exists, so a successful construction is a construction that read past the stray sibling; the per-language unit test in Task 2 pins the read tolerance directly. Two `.md` symlinks that would collide with real files are never listed in the same case.

- [ ] **Step 2: Write the Python harness**

`python/tests/test_containment_parity.py`:

```python
from __future__ import annotations

import json
import os
import shutil
import tempfile
from pathlib import Path

import pytest

from nodes.core.corpus import Corpus
from nodes.core.errors import ContainmentError, ExecutionError, PlanRefusedError
from nodes.core.node import Node
from nodes.core.paths import write_json_atomic
from nodes.core.similarity import VectorCache
from nodes.core.snapshot import iter_corpus_files
from nodes.core.store import Store
from nodes.core.write_plan import CreateOp, DefaultExecutor, DeleteOp, ReplaceOp, WriteOp

FIXTURES = Path(__file__).parent.parent.parent / "fixtures"
ORACLE = json.loads((FIXTURES / "containment.oracle.json").read_text(encoding="utf-8"))
ZERO_DIGEST = "0" * 64
ERRORS = {
    "ContainmentError": ContainmentError,
    "ExecutionError": ExecutionError,
    "PlanRefusedError": PlanRefusedError,
    "FilesystemError": OSError,
    "ProgrammingError": ValueError,
}


def _content(text: str) -> str:
    return text.replace("$node_a", ORACLE["node_a"]).replace("$node_b", ORACLE["node_b"])


def _write(base: Path, rel: str, text: str) -> None:
    path = base / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(_content(text), encoding="utf-8")


def _resolve(spec: str, real_root: Path, outside: Path) -> Path:
    kind, _, rel = spec.partition(":")
    return (real_root if kind == "root" else outside) / rel


def _symlinks_supported() -> bool:
    """Probe once. Only a recognized unsupported-platform failure disables the symlink
    cases (an explicit skip); any other failure is a real error and propagates."""
    probe = Path(tempfile.mkdtemp(prefix="nodes-symlink-probe-"))
    try:
        (probe / "link").symlink_to(probe / "target")
        return True
    except OSError as exc:
        if os.name == "nt" and getattr(exc, "winerror", None) == 1314:
            return False
        raise
    finally:
        shutil.rmtree(probe, ignore_errors=True)


SYMLINKS = _symlinks_supported()


def _needs_symlinks(case: dict) -> bool:
    return case["root"] == "symlink" or bool(case.get("symlinks")) or bool(case.get("then_symlinks"))


def _install_symlinks(links: dict[str, str], real_root: Path, outside: Path) -> None:
    for link, target in links.items():
        link_path = real_root / link
        link_path.parent.mkdir(parents=True, exist_ok=True)
        link_path.symlink_to(_resolve(target, real_root, outside))


def _materialize(case: dict, tmp_path: Path) -> tuple[Path, Path, Path]:
    """Returns (root as the action should address it, real root, outside)."""
    outside = tmp_path / "outside"
    outside.mkdir()
    if case["root"] == "missing":
        return tmp_path / "absent", tmp_path / "absent", outside
    real_root = tmp_path / "real"
    real_root.mkdir()
    for rel, text in case.get("files", {}).items():
        _write(real_root, rel, text)
    if case.get("setup_flush"):
        Corpus(real_root).flush_index()
    for rel, text in case.get("outside", {}).items():
        _write(outside, rel, text)
    _install_symlinks(case.get("symlinks", {}), real_root, outside)
    if case["root"] == "symlink":
        link_root = tmp_path / "link-root"
        link_root.symlink_to(real_root)
        return link_root, real_root, outside
    return real_root, real_root, outside


def _plan(case: dict) -> list[WriteOp]:
    ops: list[WriteOp] = []
    for raw in case["plan"]:
        content = _content(raw.get("content", "")).encode("utf-8")
        digest = raw.get("expected_digest", ZERO_DIGEST)
        if raw["op"] == "create":
            ops.append(CreateOp(path=raw["path"], content=content))
        elif raw["op"] == "replace":
            ops.append(ReplaceOp(path=raw["path"], content=content, expected_digest=digest))
        else:
            ops.append(DeleteOp(path=raw["path"], expected_digest=digest))
    return ops


def _act(case: dict, root: Path, real_root: Path, outside: Path) -> list[str] | None:
    action = case["action"]
    if action == "walk":
        return [f.path for f in iter_corpus_files(root)]
    if action == "construct":
        Corpus(root)
    elif action == "flush":
        Corpus(root).flush_index()
    elif action == "construct-then-flush":
        corpus = case["_constructed"]  # built by the test body, outside the error assertion
        _install_symlinks(case.get("then_symlinks", {}), real_root, outside)
        corpus.flush_index()
    elif action == "execute":
        DefaultExecutor(root).execute(_plan(case))
    elif action == "store-read":
        Store(root).read_file(case["id"])
    elif action == "store-write":
        kind = case["id"].split(":", 1)[0]
        Store(root).write_file(Node(id=case["id"], kind=kind, title="T"))
    elif action == "store-delete":
        Store(root).delete_file(case["id"])
    elif action == "vector-put":
        VectorCache(root).put("ns", ZERO_DIGEST, (0.5,))
    elif action == "cache-write":
        write_json_atomic(root, case["rel"], {"x": 1})
    else:
        raise AssertionError(f"unknown action {action!r}")
    return None


def _snapshot_bytes(case: dict, real_root: Path, outside: Path) -> dict[str, bytes]:
    out: dict[str, bytes] = {}
    for spec in case.get("untouched", []):
        path = _resolve(spec, real_root, outside)
        if path.exists():  # the other language's snapshot name is listed too and need not exist
            out[spec] = path.read_bytes()
    return out


@pytest.mark.parametrize("case", ORACLE["cases"], ids=[c["name"] for c in ORACLE["cases"]])
def test_containment_matches_committed_oracle(case, tmp_path):
    if _needs_symlinks(case) and not SYMLINKS:
        pytest.skip("symlinks unsupported on this platform")
    case = dict(case)
    root, real_root, outside = _materialize(case, tmp_path)
    if case["action"] == "construct-then-flush":
        case["_constructed"] = Corpus(root)  # a refusal here fails the case in the construction phase
    before = _snapshot_bytes(case, real_root, outside)
    expect = case["expect"]

    if "error" in expect:
        with pytest.raises(ERRORS[expect["error"]]) as info:
            _act(case, root, real_root, outside)
        if "index" in expect:
            assert info.value.index == expect["index"]
        if "applied" in expect:
            assert info.value.applied == expect["applied"]
    else:
        walked = _act(case, root, real_root, outside)
        if "walk" in expect:
            assert walked == expect["walk"]

    assert _snapshot_bytes(case, real_root, outside) == before
    for spec in case.get("absent", []):
        assert not os.path.lexists(_resolve(spec, real_root, outside)), spec
    for spec in case.get("present", []):
        assert os.path.lexists(_resolve(spec, real_root, outside)), spec
```

- [ ] **Step 3: Run the Python harness**

Run: `just test-fast` (the new file is the affected selection)
Expected: all cases PASS. A failing case means Tasks 1–5 missed something the oracle pins — fix the implementation, not the oracle, unless the oracle contradicts the spec.

- [ ] **Step 4: Write the TypeScript harness**

`ts/tests/containment_parity.test.ts`:

```ts
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Corpus } from "../src/corpus.js";
import { ContainmentError, ExecutionError, PlanRefusedError } from "../src/errors.js";
import { makeNode } from "../src/node.js";
import { writeJsonAtomic } from "../src/paths.js";
import { VectorCache } from "../src/similarity.js";
import { iterCorpusFiles } from "../src/snapshot.js";
import { Store } from "../src/store.js";
import { DefaultExecutor, type WriteOp } from "../src/write-plan.js";

const FIXTURES = fileURLToPath(new URL("../../fixtures", import.meta.url));
const ORACLE = JSON.parse(readFileSync(join(FIXTURES, "containment.oracle.json"), "utf-8"));
const ZERO_DIGEST = "0".repeat(64);

interface Case {
  name: string;
  root: "direct" | "symlink" | "missing";
  files?: Record<string, string>;
  setup_flush?: boolean;
  outside?: Record<string, string>;
  symlinks?: Record<string, string>;
  then_symlinks?: Record<string, string>;
  action: string;
  plan?: Array<{ op: string; path: string; content?: string; expected_digest?: string }>;
  id?: string;
  rel?: string;
  expect: { walk?: string[]; ok?: boolean; error?: string; index?: number; applied?: number };
  untouched?: string[];
  absent?: string[];
  present?: string[];
}

function content(text: string): string {
  return text.replaceAll("$node_a", ORACLE.node_a).replaceAll("$node_b", ORACLE.node_b);
}

function write(base: string, rel: string, text: string): void {
  const path = join(base, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content(text), "utf-8");
}

function lexists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/** Probe once. Only a recognized unsupported platform disables the symlink cases (an
 * explicit skip); any other failure is a real error and propagates. */
const SYMLINKS = (() => {
  const probe = mkdtempSync(join(tmpdir(), "nodes-symlink-probe-"));
  try {
    symlinkSync(join(probe, "target"), join(probe, "link"));
    return true;
  } catch (e) {
    if (process.platform === "win32" && (e as NodeJS.ErrnoException).code === "EPERM") return false;
    throw e;
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
})();

function needsSymlinks(c: Case): boolean {
  return c.root === "symlink" || Boolean(c.symlinks && Object.keys(c.symlinks).length) || Boolean(c.then_symlinks && Object.keys(c.then_symlinks).length);
}

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "nodes-containment-"));
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

function resolveSpec(spec: string, realRoot: string, outside: string): string {
  const i = spec.indexOf(":");
  const kind = spec.slice(0, i);
  const rel = spec.slice(i + 1);
  return join(kind === "root" ? realRoot : outside, rel);
}

function installSymlinks(links: Record<string, string> | undefined, realRoot: string, outside: string): void {
  for (const [link, target] of Object.entries(links ?? {})) {
    const linkPath = join(realRoot, link);
    mkdirSync(dirname(linkPath), { recursive: true });
    symlinkSync(resolveSpec(target, realRoot, outside), linkPath);
  }
}

function materialize(c: Case): { root: string; realRoot: string; outside: string } {
  const outside = join(tmp, "outside");
  mkdirSync(outside);
  if (c.root === "missing") {
    const absent = join(tmp, "absent");
    return { root: absent, realRoot: absent, outside };
  }
  const realRoot = join(tmp, "real");
  mkdirSync(realRoot);
  for (const [rel, text] of Object.entries(c.files ?? {})) write(realRoot, rel, text);
  if (c.setup_flush) new Corpus(realRoot).flushIndex();
  for (const [rel, text] of Object.entries(c.outside ?? {})) write(outside, rel, text);
  installSymlinks(c.symlinks, realRoot, outside);
  if (c.root === "symlink") {
    const linkRoot = join(tmp, "link-root");
    symlinkSync(realRoot, linkRoot);
    return { root: linkRoot, realRoot, outside };
  }
  return { root: realRoot, realRoot, outside };
}

function plan(c: Case): WriteOp[] {
  return (c.plan ?? []).map((raw) => {
    const bytes = new TextEncoder().encode(content(raw.content ?? ""));
    const digest = raw.expected_digest ?? ZERO_DIGEST;
    if (raw.op === "create") return { op: "create", path: raw.path, content: bytes };
    if (raw.op === "replace") return { op: "replace", path: raw.path, content: bytes, expectedDigest: digest };
    return { op: "delete", path: raw.path, expectedDigest: digest };
  });
}

function act(c: Case, root: string, realRoot: string, outside: string, constructed: Corpus | null): string[] | null {
  switch (c.action) {
    case "walk":
      return iterCorpusFiles(root).map((f) => f.path);
    case "construct":
      new Corpus(root);
      return null;
    case "flush":
      new Corpus(root).flushIndex();
      return null;
    case "construct-then-flush":
      installSymlinks(c.then_symlinks, realRoot, outside);
      (constructed as Corpus).flushIndex(); // constructed by the test body, outside the error assertion
      return null;
    case "execute":
      new DefaultExecutor(root).execute(plan(c));
      return null;
    case "store-read":
      new Store(root).readFile(c.id as string);
      return null;
    case "store-write": {
      const id = c.id as string;
      new Store(root).writeFile(makeNode({ id, kind: id.split(":", 1)[0], title: "T" }));
      return null;
    }
    case "store-delete":
      new Store(root).deleteFile(c.id as string);
      return null;
    case "vector-put":
      new VectorCache(root).put("ns", ZERO_DIGEST, [0.5]);
      return null;
    case "cache-write":
      writeJsonAtomic(root, c.rel as string, { x: 1 });
      return null;
    default:
      throw new Error(`unknown action ${c.action}`);
  }
}

function expectError(name: string, e: unknown): void {
  switch (name) {
    case "ContainmentError":
      expect(e).toBeInstanceOf(ContainmentError);
      break;
    case "ExecutionError":
      expect(e).toBeInstanceOf(ExecutionError);
      break;
    case "PlanRefusedError":
      expect(e).toBeInstanceOf(PlanRefusedError);
      break;
    case "FilesystemError":
      expect(typeof (e as NodeJS.ErrnoException).code).toBe("string");
      break;
    case "ProgrammingError":
      expect(e).toBeInstanceOf(TypeError);
      break;
    default:
      throw new Error(`unknown error name ${name}`);
  }
}

function snapshotBytes(c: Case, realRoot: string, outside: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const spec of c.untouched ?? []) {
    const path = resolveSpec(spec, realRoot, outside);
    if (existsSync(path)) out[spec] = readFileSync(path, "utf-8"); // the other language's snapshot name is listed too
  }
  return out;
}

describe("containment parity", () => {
  for (const c of ORACLE.cases as Case[]) {
    it.skipIf(needsSymlinks(c) && !SYMLINKS)(c.name, () => {
      const { root, realRoot, outside } = materialize(c);
      // Construction phase of construct-then-flush: a refusal here fails the case here.
      const constructed = c.action === "construct-then-flush" ? new Corpus(root) : null;
      const before = snapshotBytes(c, realRoot, outside);

      if (c.expect.error !== undefined) {
        let caught: unknown;
        try {
          act(c, root, realRoot, outside, constructed);
        } catch (e) {
          caught = e;
        }
        expect(caught, "expected an error").toBeDefined();
        expectError(c.expect.error, caught);
        if (c.expect.index !== undefined) expect((caught as ExecutionError).index).toBe(c.expect.index);
        if (c.expect.applied !== undefined) expect((caught as ExecutionError).applied).toBe(c.expect.applied);
      } else {
        const walked = act(c, root, realRoot, outside, constructed);
        if (c.expect.walk !== undefined) expect(walked).toEqual(c.expect.walk);
      }

      expect(snapshotBytes(c, realRoot, outside)).toEqual(before);
      for (const spec of c.absent ?? []) expect(lexists(resolveSpec(spec, realRoot, outside)), spec).toBe(false);
      for (const spec of c.present ?? []) expect(existsSync(resolveSpec(spec, realRoot, outside)) || lexists(resolveSpec(spec, realRoot, outside)), spec).toBe(true);
    });
  }
});
```

- [ ] **Step 5: Run the TypeScript harness**

Run: `just test-fast`
Expected: all cases PASS.

- [ ] **Step 6: Gate and close the child record**

Run: `just gate`
Expected: check green, Python and TypeScript suites green. No commit — A commits once, in Task 7.

```bash
tasks done nodes-ceccb8 "containment.oracle.json with its Python and TypeScript harnesses; every case passes on both"
```

---

### Task 7: Standard, seam amendment, spec reconcile, and task closeout

**Files:**
- Modify: `docs/STANDARD.md` §4.1 (lines 103–110), §6 error table (after the `InvariantError` row), §7 `add` bullet (line ~216), §10, §11.2
- Modify: `docs/designs/2026-08-17-nodes-write-plan-executor-seam-design.md` §3 (`DefaultExecutor` row and the "lexically escaping path" paragraph) and §8 log
- Modify: `docs/designs/2026-09-11-nodes-reserved-paths-and-containment-design.md` §4 (two sentences, per Global Constraints)
- Modify: `python/README.md` / `ts/README.md` only if they describe the walk or executor (grep first; today `ts/README.md` does not)

**Interfaces:** none — documentation and task records.

- [ ] **Step 0: Claim the child record**

Run: `tasks start nodes-c1fde3`

- [ ] **Step 1: STANDARD §4.1**

Replace the membership bullet (lines 106–110) with:

```markdown
- *(2.0)* Corpus membership (the files a corpus walk considers): regular `*.md` files
  under the root, recursively; walk order is sorted by root-relative POSIX path in
  Unicode code-point order (cf. §8.2, §9.1). The root-relative path is the literal
  filename with the platform separator mapped to `/`; no other character is rewritten.
  `.nodes-index/` is the **reserved namespace** — nodes' private cache directory, as the
  root's direct child only — and MUST be skipped; a nested `<kind>/.nodes-index/` is not
  reserved and is walked. The reserved list is exactly `[".nodes-index/"]`; changes to it
  follow §12's compatibility rules and are not automatically minor. Symlinks and
  non-regular files MUST be skipped at every depth, without being followed. A filesystem
  failure during the walk — a missing root, an unreadable directory — MUST propagate; it
  is never a finding and never absence.
- *(2.0)* **Non-Markdown content.** Nodes never reads, writes, or deletes content under
  the root other than `*.md` files, with one exception: its own reserved namespace.
  Consumers may place non-Markdown artifacts at any other path under the root with the
  guarantee they are untouched. Nodes creates kind directories and its cache directories
  on write and never removes a directory. Hard links are a precondition, not a check: a
  deployment MUST NOT hard-link a managed file — a node document, a cache entry, or a
  cache temporary — to a protected artifact, since rewriting the managed file would
  rewrite the artifact through the shared inode.
- *(2.0)* **Containment.** No path nodes yields, reads, writes, or deletes — node
  documents, snapshots, cache entries, and their temporary siblings alike — has a symlink
  component below the root; every such path is inspected with `lstat` and refused
  (`ContainmentError`) if any prefix is a symlink or cannot be inspected; an absent prefix
  is tolerated. The root itself MAY be a symlink. Checks hold for the filesystem as nodes
  observes it at the moment of the operation; substitution between inspection and
  effect, and retargeting of the root, are excluded by the single-writer rule (§7),
  which binds every actor that edits the tree, including actors outside nodes.
- *(2.0)* **Portable root-relative path.** A write-plan operation path and a snapshot
  manifest row path MUST be non-empty, have no leading `/`, split on `/` only into
  segments that are non-empty and neither `.` nor `..`, contain no `\` or `:` in any
  segment, and end in `.md`. Reserved-namespace paths are refused separately. There is
  no normalization: a spelling that would normalize to a legal path is malformed. The
  rule binds what nodes *accepts as an instruction*, not what it observes: the walk
  reports any regular `*.md` file it finds by its literal name (a POSIX filename may
  contain `\`), and cache paths follow §10's own rule.
```

- [ ] **Step 2: STANDARD §6 error table, §7, §10, §11.2**

§6: add a row after `| Shape or registry invariant violation | \`InvariantError\` |`:

```markdown
| *(2.0)* Symlink component below the root, or a path that cannot be inspected | `ContainmentError` |
```

§7 `add` bullet: after "Any failure MUST precede the disk write." append ` *(2.0)* `DefaultExecutor` preflights every operation's containment (§4.1) over the whole plan before any effect, refusing with `ExecutionError` whose `index` is the offending operation and `applied = 0`; a durable executor keeps its own pre-effect refusal contract (`ExecutionError(index=None, applied=0)` for a topology or resolution refusal, per the seam design §3). Any executor refuses a plan naming a non-portable or non-`.md` path as malformed (`PlanRefusedError`).`

§10: after the first bullet (snapshot location) add:

```markdown
- *(2.0)* Snapshot and vector-cache paths are portable root-relative paths in §4.1's
  sense with `.json` in place of `.md`, strictly beneath `.nodes-index/` (first segment
  `.nodes-index` and at least one more), and are subject to the same containment rule
  as node documents (§4.1): a read inspects the
  final path; a write inspects the final path and its `.tmp` sibling before any
  directory creation, write, or rename. A containment refusal propagates from
  construction and from `flush_index` — it is never a rebuild trigger.
```

§11.2: add a row after the `traversal.oracle.json` row:

```markdown
| `containment.oracle.json` | *(2.0)* reserved namespace, non-Markdown preservation, symlink containment across the walk, executor, store, and caches, and the portable-path rule; describes filesystems for each language's harness to materialize |
```

- [ ] **Step 3: Seam design §3 and §8**

In `docs/designs/2026-08-17-nodes-write-plan-executor-seam-design.md` §3, replace the `DefaultExecutor` table row's middle cell with:

> *(amended 2026-09-11)* Preflights every operation's containment over the whole plan before any effect, refusing with `ExecutionError(index=i, applied=0)`; then checks each operation's existence precondition when it reaches that operation and stops at the first failure, leaving the applied prefix. It carries but does not enforce `expected_digest`.

and replace the sentence "Both executor classes additionally reject, before any effect, a malformed plan containing a lexically escaping path (absolute, or containing `..` after lexical normalization), a reserved-namespace path, or an unknown operation kind." with:

> *(amended 2026-09-11)* Both executor classes additionally reject, before any effect, a malformed plan containing a path that is not a portable root-relative `.md` path (standard §4.1: no leading `/`, no empty/`.`/`..` segment, no `\` or `:`, `.md` suffix — no normalization), a reserved-namespace path, or an unknown operation kind.

Append two rows to the §8 amendments log:

```markdown
| 2026-09-11 | §3 | `DefaultExecutor` whole-plan symlink preflight refusing with `ExecutionError(index=i, applied=0)` before any effect; `validate_plan` applies the portable root-relative path rule (canonical segments, no `\` or `:`, `.md` suffix) instead of normalizing. | `nodes`-side review | Science: **pending** |
| 2026-09-11 | §8 process | Implementation proceeds on branch `nodes-2.0` before Science's sign-off on the row above — a maintainer decision departing from §1's rule. Evidence offered, not sign-off: every plan the cut-4 adapter produces today targets a canonical `.md` path and no symlink, so its observed behaviour is unchanged. The row above stays pending until Science records its response. | maintainer | n/a — process record |
```

- [ ] **Step 4: Reconcile the spec with the two implementation choices**

In `docs/designs/2026-09-11-nodes-reserved-paths-and-containment-design.md` §4:

- Replace "`snapshot_path` returns that relative path." with "`snapshot_path` keeps returning the absolute path (tests use it for filesystem assertions); a relative constant `SNAPSHOT_REL_PATH` feeds the helpers."
- Replace the `Store.read_file` / `all_nodes` paragraph's first sentence with: "**`Store.read_file` / `readFile`** — the read path `Corpus.get`, `neighbors`, and `rename` use — calls `assert_contained` before opening; `all_nodes` / `allNodes` (which `check` uses) is contained by the walk, which `lstat`s every component on the way down and follows none."

- In §5's table, replace the row "snapshot manifest row with `a\b.md` or `kind/a:b.md` | snapshot rejected as malformed (rebuild), matching the plan rule" with a sentence under the table: "The manifest-row arm of the portable-path rule is pinned per language in the snapshot-load tests, since a snapshot document is language-specific."

- In §3 (walk), after "sorted by root-relative POSIX path in code-point order", add: "(TypeScript's sort moved to `compareCodepoints` with this sub-task; sub-task C's collation item is thereby done for the walk and is struck from its scope.)"
- In §3, add a bullet: "keep the literal filename when deriving the root-relative path — TypeScript's `relPosix` splits on the platform separator only, so a POSIX filename containing `\\` is reported verbatim and later reads address exactly the path the walk inspected."

Also run `tasks note nodes-cd59f0 "A landed the code-point walk sort in TypeScript (compareCodepoints); C's collation item now covers only the STANDARD wording and Python/TS parity of any remaining sorts"` so sub-task C's record reflects it.

Update the spec's status line to `**Status:** implemented on branch \`nodes-2.0\` (2026-09-11); Science sign-off on the seam amendment pending`.

- [ ] **Step 5: Verify the standard's marker set and gate**

Run: `grep -n '(2.0)\|Pending:' docs/STANDARD.md`
Expected: the pending line plus the D markers (§7 ×3, §8.2, §11.2) plus the new A markers (§4.1 ×4, §6, §7, §10, §11.2) — no others.

Run: `just gate`
Expected: green (docs changes do not alter tests; the gate also runs `tasks check`).

- [ ] **Step 6: Close the records and make A's single commit**

Every child (Tasks 1–6) is already `done` in the working tree. Close this one and the parent, then commit everything A touched — code, tests, fixture, STANDARD, both design docs, and the task records — as one commit, so the branch never holds a commit where code and standard disagree.

```bash
tasks done nodes-c1fde3 "STANDARD §§4.1, 6, 7, 10, 11.2 marked (2.0); seam §3 amended with Science sign-off pending and the process exception in §8; spec reconciled"
tasks done nodes-01111b "Reserved-path contract, containment (walk, executor preflight, Store, caches), portable path rule, containment.oracle.json with both harnesses; STANDARD §§4.1, 6, 7, 10, 11.2 marked (2.0); seam §3 amended with Science sign-off pending and the process exception recorded in §8"
tasks check
git add -A python ts fixtures docs tasks
git status --short   # review: nothing outside python/, ts/, fixtures/, docs/, tasks/
git commit -m "feat!: reserved-path contract and containment across walk, executor, store, and caches

Nodes never touches non-Markdown content outside its root-relative
reserved namespace, and never follows a symlink below the corpus root on
any path it walks, reads, writes, or deletes. One dependency-neutral
paths module per language holds the portable root-relative path rule,
assert_contained, and root-aware cache helpers; validate_plan refuses
non-portable and non-.md targets; DefaultExecutor preflights the whole
plan before any effect; Store's direct paths and the snapshot and vector
caches run the same check. Both walks propagate filesystem failures and
sort by code point. containment.oracle.json describes each case for
both harnesses to materialize.

STANDARD §4.1 states the two guarantees, the hard-link precondition, the
closed reserved list, and the portable path rule; §6 names
ContainmentError; §7 and §10 carry the executor preflight and cache
containment; §11.2 lists the oracle. The seam design's §3 executor row
and lexical rule are amended, with Science sign-off pending and the
decision to proceed recorded in §8.

Closes nodes-01111b and its seven step tasks."
```
