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
