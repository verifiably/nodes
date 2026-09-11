from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

import pytest

from nodes.core.corpus import Corpus
from nodes.core.errors import ContainmentError, RefError
from nodes.core.node import Node
from nodes.core.store import Store


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


def test_write_file_read_file_roundtrip(tmp_path):
    store = Store(tmp_path)
    n = Node(id="topic:a", kind="topic", title="A", body="hi")
    store.write_file(n)
    got = store.read_file("topic:a")
    assert got.title == "A" and got.body == "hi" and got.uid == n.uid


def test_write_file_has_no_collision_check(tmp_path):
    # Store is a dumb primitive: writing a different uid at the same id just overwrites.
    store = Store(tmp_path)
    store.write_file(Node(id="topic:a", kind="topic", title="A"))
    store.write_file(Node(id="topic:a", kind="topic", title="Other"))  # no raise
    assert store.read_file("topic:a").title == "Other"


def test_path_for_encodes_curie_slug(tmp_path):
    store = Store(tmp_path)
    path = store.path_for("gene:HGNC:PHF19")
    assert path == tmp_path / "gene" / "HGNC__PHF19.md"


def test_read_file_missing_raises(tmp_path):
    with pytest.raises(RefError):
        Store(tmp_path).read_file("topic:ghost")


def test_delete_file_removes_then_missing_raises(tmp_path):
    store = Store(tmp_path)
    store.write_file(Node(id="topic:a", kind="topic", title="A"))
    store.delete_file("topic:a")
    with pytest.raises(RefError):
        store.read_file("topic:a")
    with pytest.raises(RefError):
        store.delete_file("topic:a")


def test_all_nodes_scans_corpus_sorted(tmp_path):
    store = Store(tmp_path)
    store.write_file(Node(id="topic:b", kind="topic", title="B"))
    store.write_file(Node(id="topic:a", kind="topic", title="A"))
    ids = [n.id for n in store.all_nodes()]
    assert ids == ["topic:a", "topic:b"]


def test_all_nodes_ignores_private_nodes_index_tree(tmp_path):
    store = Store(tmp_path)
    store.write_file(Node(id="topic:a", kind="topic", title="A"))
    (tmp_path / ".nodes-index").mkdir()
    (tmp_path / ".nodes-index" / "cache.md").write_text("not a node", encoding="utf-8")

    ids = [n.id for n in store.all_nodes()]

    assert ids == ["topic:a"]


def test_corpus_construction_ignores_private_nodes_index_tree(tmp_path):
    store = Store(tmp_path)
    store.write_file(Node(id="topic:a", kind="topic", title="A"))
    (tmp_path / ".nodes-index").mkdir()
    (tmp_path / ".nodes-index" / "cache.md").write_text("not a node", encoding="utf-8")

    corpus = Corpus(tmp_path)

    assert [n.id for n in corpus.all()] == ["topic:a"]


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
