from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from nodes.core.corpus import Corpus
from nodes.core.errors import CollisionError, ExecutionError
from nodes.core.frontmatter import node_to_markdown
from nodes.core.node import Node
from nodes.core.relations import relates_to
from nodes.core.write_plan import CreateOp, DefaultExecutor, DeleteOp, ReplaceOp, WritePlan

from tests._executors import RecordingExecutor


class RefusingExecutor:
    """Raises before any effect, so disk stays pre-plan."""

    def execute(self, plan: WritePlan) -> None:
        raise ExecutionError("refused", index=None, applied=0)


def recording_corpus(tmp_path) -> tuple[Corpus, RecordingExecutor]:
    captured: list[RecordingExecutor] = []

    def factory(root: Path) -> RecordingExecutor:
        ex = RecordingExecutor(root)
        captured.append(ex)
        return ex

    c = Corpus(tmp_path, executor_factory=factory)
    return c, captured[0]


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def test_factory_is_called_with_the_corpus_root(tmp_path):
    seen: list[Path] = []

    def factory(root: Path) -> DefaultExecutor:
        seen.append(root)
        return DefaultExecutor(root)

    Corpus(tmp_path, executor_factory=factory)
    assert seen == [Path(tmp_path)]


def test_default_executor_when_factory_omitted(tmp_path):
    c = Corpus(tmp_path)
    assert isinstance(c.executor, DefaultExecutor)
    assert c.executor.root == Path(tmp_path)


def test_add_unseen_pair_executes_a_single_create(tmp_path):
    c, ex = recording_corpus(tmp_path)
    n = Node(id="topic:a", kind="topic", title="A")
    c.add(n)
    assert len(ex.plans) == 1
    (op,) = ex.plans[0]
    assert isinstance(op, CreateOp)
    assert op.path == "topic/a.md"
    assert op.content == node_to_markdown(n).encode("utf-8")


def test_add_matching_pair_executes_a_replace_with_prior_disk_digest(tmp_path):
    c, ex = recording_corpus(tmp_path)
    n = Node(id="topic:a", kind="topic", title="A")
    c.add(n)
    prior = node_to_markdown(n).encode("utf-8")
    n.title = "A2"
    c.add(n)
    (op,) = ex.plans[1]
    assert isinstance(op, ReplaceOp)
    assert op.path == "topic/a.md"
    assert op.expected_digest == sha(prior)
    assert c.get("topic:a").title == "A2"


def test_delete_executes_a_delete_with_disk_digest(tmp_path):
    c, ex = recording_corpus(tmp_path)
    n = Node(id="topic:a", kind="topic", title="A")
    c.add(n)
    c.delete("topic:a")
    (op,) = ex.plans[1]
    assert isinstance(op, DeleteOp)
    assert op.path == "topic/a.md"
    assert op.expected_digest == sha(node_to_markdown(n).encode("utf-8"))


def test_rename_executes_create_delete_then_referrer_replaces(tmp_path):
    c, ex = recording_corpus(tmp_path)
    old = Node(id="topic:old", kind="topic", title="T")
    c.add(old)
    r = Node(id="note:r", kind="note", title="R", relations=[relates_to("note:r", "topic:old")])
    c.add(r)
    old_bytes = node_to_markdown(old).encode("utf-8")
    r_bytes = node_to_markdown(r).encode("utf-8")

    c.rename("topic:old", "topic:new")

    plan = ex.plans[2]
    assert [type(op) for op in plan] == [CreateOp, DeleteOp, ReplaceOp]
    create, delete, replace = plan
    assert create.path == "topic/new.md"
    assert delete.path == "topic/old.md"
    assert delete.expected_digest == sha(old_bytes)
    assert replace.path == "note/r.md"
    assert replace.expected_digest == sha(r_bytes)


def test_rename_referrer_replaces_are_ordered_by_uid(tmp_path):
    c, ex = recording_corpus(tmp_path)
    c.add(Node(id="topic:old", kind="topic", title="T", uid="9" * 32))
    c.add(Node(id="note:b", kind="note", title="B", uid="2" * 32, relations=[relates_to("note:b", "topic:old")]))
    c.add(Node(id="note:a", kind="note", title="A", uid="1" * 32, relations=[relates_to("note:a", "topic:old")]))
    c.rename("topic:old", "topic:new")
    replaces = [op for op in ex.plans[3] if isinstance(op, ReplaceOp)]
    assert [op.path for op in replaces] == ["note/a.md", "note/b.md"]


def test_collision_refusal_never_reaches_the_executor(tmp_path):
    c, ex = recording_corpus(tmp_path)
    c.add(Node(id="topic:a", kind="topic", title="A"))
    with pytest.raises(CollisionError):
        c.add(Node(id="topic:a", kind="topic", title="Other"))
    assert len(ex.plans) == 1  # only the first add executed


def test_memory_updates_only_after_execute_returns(tmp_path):
    c = Corpus(tmp_path, executor_factory=lambda root: RefusingExecutor())
    with pytest.raises(ExecutionError):
        c.add(Node(id="topic:a", kind="topic", title="A"))
    assert c.index.resolve_uid("topic:a") is None
    assert c.manifest == {}
    assert not (tmp_path / "topic").exists()


def test_flush_index_does_not_route_through_the_executor(tmp_path):
    c, ex = recording_corpus(tmp_path)
    c.add(Node(id="topic:a", kind="topic", title="A"))
    before = len(ex.plans)
    c.flush_index()
    assert len(ex.plans) == before
    assert (tmp_path / ".nodes-index" / "snapshot.py.json").is_file()
