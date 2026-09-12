"""Mapped-path collision contract, pinned by the shared oracle.

Groups are pure Index cases; mutations run against one on-disk claimant. Neither
commits a colliding file tree: the well-placed case pair is constructed in-test.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from nodes.core.corpus import Corpus
from nodes.core.errors import CollisionError
from nodes.core.node import Node
from nodes.core.registry import KindSpec, Registry
from nodes.core.snapshot import load_snapshot, snapshot_path
from nodes.core.store import Store
from nodes.core.structural_index import Index

from tests._executors import RecordingExecutor

ORACLE = json.loads((Path(__file__).parents[2] / "fixtures/path-collision.oracle.json").read_text())


def seed(raw):
    return Node(kind=raw["id"].split(":", 1)[0], title=raw["id"], **raw)


class CountingEmbedder:
    cache_namespace = "path-collision-test"

    def __init__(self):
        self.calls = []

    def embed(self, texts):
        self.calls.extend(texts)
        return [(1.0, 0.0) for _ in texts]


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
        # A cache hit could conceal premature preparation on rename: fail on entry instead.
        def forbidden_prepare(*args, **kwargs):
            raise AssertionError("prepare must not run")

        assert c.vector_index is not None
        monkeypatch.setattr(c.vector_index, "prepare", forbidden_prepare)
    before = c.index.to_dict()
    before_collisions = c.index.path_collisions()
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
        assert c.index.path_collisions() == before_collisions
        assert {p.relative_to(tmp_path): p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()} == before_files
    else:
        result = mutate()
        assert result.uid == "source"
        assert [op.op for op in ex.plans[0]] == case["result"]
        assert c.get(case["source"]).id == case["target"]
        assert Corpus(tmp_path).get(case["target"]).uid == "source"


def test_temporary_id_rename_and_occupied_destination(tmp_path):
    c = Corpus(tmp_path)
    c.add(seed({"id": "kind:A", "uid": "a"}))
    # Case-only rename is refused; two renames through a free temporary id are the way.
    c.rename("kind:A", "kind:tmp")
    c.rename("kind:tmp", "kind:a")
    assert c.get("kind:A").id == "kind:a"
    assert c.get("kind:tmp").uid == "a"
    c.add(seed({"id": "kind:x", "uid": "x"}))
    c.add(seed({"id": "kind:C", "uid": "c"}))
    # kind:c is unresolved by identity; the path check refuses another uid's folded path.
    with pytest.raises(CollisionError):
        c.rename("kind:x", "kind:c")


def require_case_pair(root):
    """Probe the volume: skip only when the second spelling is the same file."""
    folder = root / "kind"
    folder.mkdir()
    (folder / "A.md").write_bytes(b"")
    try:
        with (folder / "a.md").open("xb"):
            pass
    except FileExistsError:
        pytest.skip("volume cannot hold kind/A.md and kind/a.md separately")


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
