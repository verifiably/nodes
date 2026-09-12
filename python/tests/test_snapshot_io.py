from __future__ import annotations

import hashlib
import json
import os
import shutil
import stat
import tempfile
from dataclasses import FrozenInstanceError
from pathlib import Path

import pytest

from nodes.core.errors import ContainmentError
from nodes.core.snapshot import (
    SNAPSHOT_LANG,
    SNAPSHOT_REL_PATH,
    SNAPSHOT_SCHEMA_VERSION,
    CorpusFile,
    ManifestEntry,
    hash_bytes,
    iter_corpus_files,
    read_json,
    snapshot_path,
    write_json_atomic,
)


def _symlinks_supported() -> bool:
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


def test_constants():
    assert SNAPSHOT_SCHEMA_VERSION == 3
    assert SNAPSHOT_LANG == "py"


def test_snapshot_path(tmp_path):
    assert snapshot_path(tmp_path) == tmp_path / ".nodes-index" / "snapshot.py.json"


def test_hash_bytes_is_sha256_hex():
    assert hash_bytes(b"hello") == hashlib.sha256(b"hello").hexdigest()
    assert len(hash_bytes(b"")) == 64


def test_iter_corpus_files_sorted_relative_posix_with_hash(tmp_path):
    (tmp_path / "topic").mkdir()
    (tmp_path / "gene").mkdir()
    (tmp_path / "topic" / "b.md").write_bytes(b"BBB")
    (tmp_path / "gene" / "a.md").write_bytes(b"AAA")
    (tmp_path / "ignore.txt").write_bytes(b"nope")
    files = iter_corpus_files(tmp_path)
    assert [f.path for f in files] == ["gene/a.md", "topic/b.md"]
    assert files[0] == CorpusFile(path="gene/a.md", data=b"AAA", sha256=hash_bytes(b"AAA"))


def test_iter_corpus_files_ignores_md_directories(tmp_path):
    (tmp_path / "notes.md").mkdir()
    (tmp_path / "real.md").write_bytes(b"real")
    files = iter_corpus_files(tmp_path)
    assert files == [CorpusFile(path="real.md", data=b"real", sha256=hash_bytes(b"real"))]


def test_iter_corpus_files_ignores_private_nodes_index_tree(tmp_path):
    (tmp_path / ".nodes-index").mkdir()
    (tmp_path / ".nodes-index" / "cache.md").write_bytes(b"not a node")
    (tmp_path / "real.md").write_bytes(b"real")
    files = iter_corpus_files(tmp_path)
    assert files == [CorpusFile(path="real.md", data=b"real", sha256=hash_bytes(b"real"))]


@needs_symlinks
def test_iter_corpus_files_ignores_md_symlinks(tmp_path):
    target = tmp_path / "target.txt"
    target.write_bytes(b"target")
    link = tmp_path / "linked.md"
    link.symlink_to(target)
    assert iter_corpus_files(tmp_path) == []


def test_iter_corpus_files_missing_root_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        iter_corpus_files(tmp_path / "absent")


def test_iter_corpus_files_sorts_non_bmp_after_bmp_by_codepoint(tmp_path):
    (tmp_path / "\ue000.md").write_text("bmp", encoding="utf-8")
    (tmp_path / "\U00010000.md").write_text("non-bmp", encoding="utf-8")
    assert [f.path for f in iter_corpus_files(tmp_path)] == ["\ue000.md", "\U00010000.md"]


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


def test_write_json_atomic_round_trip_and_no_tmp_left(tmp_path):
    p = snapshot_path(tmp_path)
    write_json_atomic(tmp_path, SNAPSHOT_REL_PATH, {"version": 1, "x": [1, 2]})
    assert read_json(tmp_path, SNAPSHOT_REL_PATH) == {"version": 1, "x": [1, 2]}
    assert not (p.parent / (p.name + ".tmp")).exists()


def test_write_json_atomic_rejects_non_finite_values_without_snapshot(tmp_path):
    p = snapshot_path(tmp_path)
    with pytest.raises(ValueError):
        write_json_atomic(tmp_path, SNAPSHOT_REL_PATH, {"x": float("nan")})
    assert not p.exists()
    assert not (p.parent / (p.name + ".tmp")).exists()


def test_read_json_missing_returns_none(tmp_path):
    assert read_json(tmp_path, SNAPSHOT_REL_PATH) is None


def test_read_json_directory_raises(tmp_path):
    p = snapshot_path(tmp_path)
    p.mkdir(parents=True)
    with pytest.raises(OSError):
        read_json(tmp_path, SNAPSHOT_REL_PATH)


@needs_symlinks
def test_read_json_symlink_refused(tmp_path):
    p = snapshot_path(tmp_path)
    p.parent.mkdir(parents=True)
    p.symlink_to(p.parent / "missing-target.json")

    with pytest.raises(ContainmentError):
        read_json(tmp_path, SNAPSHOT_REL_PATH)


def test_read_json_invalid_json_raises(tmp_path):
    p = snapshot_path(tmp_path)
    p.parent.mkdir(parents=True)
    p.write_text("{", encoding="utf-8")
    with pytest.raises(json.JSONDecodeError):
        read_json(tmp_path, SNAPSHOT_REL_PATH)


@pytest.mark.parametrize("constant", ["NaN", "Infinity", "-Infinity"])
def test_read_json_rejects_non_finite_constants(tmp_path, constant):
    p = snapshot_path(tmp_path)
    p.parent.mkdir(parents=True)
    p.write_text(f'{{"x": {constant}}}', encoding="utf-8")
    with pytest.raises(ValueError, match="invalid JSON constant"):
        read_json(tmp_path, SNAPSHOT_REL_PATH)


def test_corpus_file_is_frozen():
    e = CorpusFile(path="a.md", data=b"A", sha256=hash_bytes(b"A"))
    assert (e.path, e.data, e.sha256) == ("a.md", b"A", hash_bytes(b"A"))
    with pytest.raises(FrozenInstanceError):
        setattr(e, "path", "b.md")


def test_manifest_entry_is_frozen():
    e = ManifestEntry(path="a.md", sha256="0" * 64, uid="u1")
    assert (e.path, e.sha256, e.uid) == ("a.md", "0" * 64, "u1")
    with pytest.raises(FrozenInstanceError):
        setattr(e, "path", "b.md")
