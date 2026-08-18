from __future__ import annotations

import dataclasses
import hashlib

import pytest

from nodes.core.errors import ExecutionError, NodesError, PlanRefusedError
from nodes.core.write_plan import CreateOp, DefaultExecutor, DeleteOp, ReplaceOp


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


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


def test_interior_dotdot_that_stays_inside_root_is_allowed(tmp_path):
    # Lexical normalization of "k/../a.md" is "a.md": no ".." survives, no escape.
    DefaultExecutor(tmp_path).execute([CreateOp(path="k/../a.md", content=b"x")])
    assert (tmp_path / "a.md").read_bytes() == b"x"
