from __future__ import annotations

import os
import shutil
import stat
import tempfile
from pathlib import Path

import pytest

from nodes.core.errors import ContainmentError, NodesError
from nodes.core.paths import (
    RESERVED_NAMESPACE,
    assert_cache_path,
    assert_contained,
    is_portable_relative_path,
    path_collision_key,
    path_for_node_id,
    read_json,
    write_json_atomic,
)


def _symlinks_supported() -> bool:
    """Probe once. Only a recognized unsupported-platform failure disables the symlink tests (an explicit skip); any other failure is a real error and propagates."""
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


def test_cache_read_preserves_non_null_json_value(tmp_path):
    (tmp_path / ".nodes-index").mkdir()
    (tmp_path / ".nodes-index" / "a.json").write_text('["not a cache document"]', encoding="utf-8")
    assert read_json(tmp_path, ".nodes-index/a.json") == ["not a cache document"]


def test_vector_cache_null_document_is_corruption_not_a_miss(tmp_path):
    from nodes.core.similarity import VectorCache

    digest = "0" * 64
    (tmp_path / ".nodes-index" / "vectors" / "ns").mkdir(parents=True)
    (tmp_path / ".nodes-index" / "vectors" / "ns" / f"{digest}.json").write_text("null", encoding="utf-8")
    with pytest.raises(ValueError):
        VectorCache(tmp_path).get("ns", digest)


def test_vector_cache_rejects_non_document_json_value(tmp_path):
    from nodes.core.similarity import VectorCache

    digest = "0" * 64
    path = tmp_path / ".nodes-index" / "vectors" / "ns" / f"{digest}.json"
    path.parent.mkdir(parents=True)
    path.write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError):
        VectorCache(tmp_path).get("ns", digest)


def test_cache_serialization_failure_creates_no_directory(tmp_path):
    with pytest.raises(ValueError):
        write_json_atomic(tmp_path, ".nodes-index/a.json", {"x": float("nan")})
    assert not (tmp_path / ".nodes-index").exists()


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


def test_id_mapping_and_collision_key():
    assert path_for_node_id("gene:BRCA1:v2") == "gene/BRCA1__v2.md"
    assert path_collision_key("gene:BRCA1:v2") == "gene/brca1__v2.md"
    assert path_collision_key("gene:BRCA1:v2") == path_collision_key("gene:brca1__v2")
    assert path_collision_key("other:a") != path_collision_key("gene:a")
