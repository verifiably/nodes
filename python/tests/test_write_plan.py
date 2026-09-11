from __future__ import annotations

import dataclasses
import hashlib
import os
import shutil
import tempfile
from pathlib import Path

import pytest

from nodes.core.errors import ContainmentError, ExecutionError, NodesError, PlanRefusedError
from nodes.core.write_plan import CreateOp, DefaultExecutor, DeleteOp, ReplaceOp


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _symlinks_supported() -> bool:
    """Probe once. Only a recognized unsupported-platform failure disables these tests."""
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


def test_ops_are_discriminated():
    assert CreateOp(path="a/b.md", content=b"x").op == "create"
    assert ReplaceOp(path="a/b.md", content=b"x", expected_digest=sha(b"y")).op == "replace"
    assert DeleteOp(path="a/b.md", expected_digest=sha(b"y")).op == "delete"


def test_ops_are_frozen():
    op = CreateOp(path="a.md", content=b"x")
    with pytest.raises(dataclasses.FrozenInstanceError):
        op.path = "b.md"  # type: ignore[misc]


def test_plan_errors_subclass_base():
    assert issubclass(PlanRefusedError, NodesError)
    assert issubclass(ExecutionError, NodesError)


def test_execution_error_carries_index_and_applied():
    e = ExecutionError("boom", index=2, applied=1)
    assert e.index == 2
    assert e.applied == 1
    n = ExecutionError("halt", index=None, applied=None)
    assert n.index is None
    assert n.applied is None


def test_executor_applies_ordered_plan(tmp_path):
    ex = DefaultExecutor(tmp_path)
    ex.execute(
        [
            CreateOp(path="k/a.md", content=b"one"),
            CreateOp(path="k/b.md", content=b"two"),
            ReplaceOp(path="k/a.md", content=b"three", expected_digest=sha(b"one")),
            DeleteOp(path="k/b.md", expected_digest=sha(b"two")),
        ]
    )
    assert (tmp_path / "k" / "a.md").read_bytes() == b"three"
    assert not (tmp_path / "k" / "b.md").exists()


def test_executor_accepts_empty_plan(tmp_path):
    DefaultExecutor(tmp_path).execute([])


def test_preconditions_checked_on_reach_not_upfront(tmp_path):
    # An upfront existence sweep would refuse the delete (a.md absent at plan
    # start); the best-effort contract checks each op only when it reaches it.
    DefaultExecutor(tmp_path).execute(
        [
            CreateOp(path="a.md", content=b"x"),
            DeleteOp(path="a.md", expected_digest=sha(b"x")),
        ]
    )
    assert not (tmp_path / "a.md").exists()


def test_create_on_present_path_fails_leaving_prefix(tmp_path):
    (tmp_path / "b.md").write_bytes(b"old")
    with pytest.raises(ExecutionError) as ei:
        DefaultExecutor(tmp_path).execute(
            [
                CreateOp(path="a.md", content=b"one"),
                CreateOp(path="b.md", content=b"two"),
                CreateOp(path="c.md", content=b"three"),
            ]
        )
    assert ei.value.index == 1
    assert ei.value.applied == 1
    assert (tmp_path / "a.md").read_bytes() == b"one"
    assert (tmp_path / "b.md").read_bytes() == b"old"
    assert not (tmp_path / "c.md").exists()


def test_replace_on_absent_path_fails(tmp_path):
    with pytest.raises(ExecutionError) as ei:
        DefaultExecutor(tmp_path).execute(
            [ReplaceOp(path="a.md", content=b"x", expected_digest=sha(b"y"))]
        )
    assert ei.value.index == 0
    assert ei.value.applied == 0


def test_delete_on_absent_path_fails(tmp_path):
    with pytest.raises(ExecutionError) as ei:
        DefaultExecutor(tmp_path).execute([DeleteOp(path="a.md", expected_digest=sha(b"y"))])
    assert ei.value.index == 0
    assert ei.value.applied == 0


def test_expected_digest_carried_but_not_enforced(tmp_path):
    (tmp_path / "a.md").write_bytes(b"actual")
    DefaultExecutor(tmp_path).execute(
        [
            ReplaceOp(path="a.md", content=b"new", expected_digest=sha(b"not the actual bytes")),
        ]
    )
    assert (tmp_path / "a.md").read_bytes() == b"new"


@pytest.mark.parametrize(
    "path",
    [
        "/etc/passwd",
        "../escape.md",
        "a/../../escape.md",
        ".nodes-index/snapshot.py.json",
        "",
    ],
)
def test_malformed_paths_refused_before_any_effect(tmp_path, path):
    with pytest.raises(PlanRefusedError):
        DefaultExecutor(tmp_path).execute(
            [
                CreateOp(path="fine.md", content=b"x"),
                CreateOp(path=path, content=b"y"),
            ]
        )
    assert not (tmp_path / "fine.md").exists()


def test_unknown_operation_kind_refused_before_any_effect(tmp_path):
    with pytest.raises(PlanRefusedError):
        DefaultExecutor(tmp_path).execute(
            [
                CreateOp(path="fine.md", content=b"x"),
                {"op": "move", "path": "a.md"},  # type: ignore[list-item]
            ]
        )
    assert not (tmp_path / "fine.md").exists()


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
    outside = Path(tempfile.mkdtemp(prefix="nodes-write-plan-outside-"))
    try:
        (tmp_path / "kind" / "a.md").symlink_to(outside / "a.md")
        with pytest.raises(ExecutionError) as info:
            DefaultExecutor(tmp_path).execute([CreateOp(path="kind/a.md", content=b"x")])
        assert (info.value.index, info.value.applied) == (0, 0)
        assert isinstance(info.value.__cause__, ContainmentError)
        assert not (outside / "a.md").exists()
    finally:
        shutil.rmtree(outside)


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
    outside = Path(tempfile.mkdtemp(prefix="nodes-write-plan-outside-"))
    try:
        (tmp_path / "kind").symlink_to(outside)
        with pytest.raises(ExecutionError) as info:
            DefaultExecutor(tmp_path).execute([CreateOp(path="kind/a.md", content=b"x")])
        assert (info.value.index, info.value.applied) == (0, 0)
        assert list(outside.iterdir()) == []
    finally:
        shutil.rmtree(outside)


@needs_symlinks
def test_preflight_covers_whole_plan_before_any_effect(tmp_path):
    (tmp_path / "kind").mkdir()
    (tmp_path / "kind" / "b.md").symlink_to(tmp_path / "kind" / "missing.md")
    with pytest.raises(ExecutionError) as info:
        DefaultExecutor(tmp_path).execute([CreateOp(path="kind/a.md", content=b"a"), CreateOp(path="kind/b.md", content=b"b")])
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
