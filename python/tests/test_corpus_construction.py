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
