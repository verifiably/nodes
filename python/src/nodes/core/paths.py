"""Path rules shared by the walk, the write plan, the store, and the caches.

Imports only `errors`, so `snapshot` and `similarity` can both depend on it.
"""

from __future__ import annotations

import json
import os
import stat
from pathlib import Path

from nodes.core.errors import ContainmentError

RESERVED_NAMESPACE = ".nodes-index"


def is_portable_relative_path(path: str, *, suffix: str | None = ".md") -> bool:
    """The lexical rule for instruction and cache paths: split on `/`
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
        except (OSError, ValueError) as exc:
            raise ContainmentError(f"cannot inspect {rel_path!r} at {segment!r}: {exc}") from exc
        if stat.S_ISLNK(st.st_mode):
            raise ContainmentError(f"symlink at {segment!r} on {rel_path!r}")


def assert_cache_path(rel_path: str) -> None:
    """Refuse cache paths outside a `.nodes-index` descendant ending in `.json`."""
    if not is_portable_relative_path(rel_path, suffix=".json"):
        raise ValueError(f"not a portable cache path: {rel_path!r}")
    segments = rel_path.split("/")
    if segments[0] != RESERVED_NAMESPACE or len(segments) < 2:
        raise ValueError(f"cache path must be strictly beneath {RESERVED_NAMESPACE}/: {rel_path!r}")


def _reject_json_constant(value: str) -> None:
    raise ValueError(f"invalid JSON constant {value}")


def read_json(root: Path | str, rel_path: str) -> object | None:
    """Read a contained cache document; only a missing file returns `None`."""
    assert_cache_path(rel_path)
    assert_contained(root, rel_path)
    try:
        doc = json.loads((Path(root) / rel_path).read_text(encoding="utf-8"), parse_constant=_reject_json_constant)
    except FileNotFoundError:
        return None
    if doc is None:
        raise ValueError(f"cache document {rel_path!r} is null")
    return doc


def write_json_atomic(root: Path | str, rel_path: str, obj: dict) -> None:
    """Write a contained cache document through its checked `.tmp` sibling."""
    assert_cache_path(rel_path)
    assert_contained(root, rel_path)
    assert_contained(root, f"{rel_path}.tmp")
    payload = json.dumps(obj, allow_nan=False)
    path = Path(root) / rel_path
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.parent / f"{path.name}.tmp"
    tmp.write_text(payload, encoding="utf-8")
    os.replace(tmp, path)
