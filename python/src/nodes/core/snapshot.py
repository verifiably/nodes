from __future__ import annotations

import hashlib
import os
import re
from dataclasses import dataclass
from pathlib import Path

from nodes.core.paths import (
    RESERVED_NAMESPACE,
    is_portable_relative_path,
    path_for_node_id,
    read_json as read_json,
    write_json_atomic as write_json_atomic,
)
from nodes.core.structural_index import Index
from nodes.core.search import SearchIndex
from nodes.core.similarity import VectorIndex

SNAPSHOT_SCHEMA_VERSION = 3
SNAPSHOT_LANG = "py"
SNAPSHOT_REL_PATH = f"{RESERVED_NAMESPACE}/snapshot.py.json"
_SHA256_RE = re.compile(r"[0-9a-f]{64}")
_SNAPSHOT_KEYS = frozenset({"version", "lang", "manifest", "structural", "search", "vectors"})
_MANIFEST_ROW_KEYS = frozenset({"path", "sha256", "uid"})


def snapshot_path(root: Path | str) -> Path:
    return Path(root) / SNAPSHOT_REL_PATH


def hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@dataclass(frozen=True)
class CorpusFile:
    path: str  # root-relative POSIX
    data: bytes
    sha256: str


def iter_corpus_files(root: Path | str) -> list[CorpusFile]:
    """Walk regular Markdown files without following symlinks or hiding failures."""
    root = Path(root)
    files: list[CorpusFile] = []

    def walk(directory: Path, rel_parts: tuple[str, ...]) -> None:
        with os.scandir(directory) as entries:
            for entry in entries:
                if entry.is_symlink():
                    continue
                if entry.is_dir(follow_symlinks=False):
                    if not rel_parts and entry.name == RESERVED_NAMESPACE:
                        continue
                    walk(Path(entry.path), (*rel_parts, entry.name))
                elif entry.is_file(follow_symlinks=False) and entry.name.endswith(".md"):
                    data = Path(entry.path).read_bytes()
                    files.append(CorpusFile(path="/".join((*rel_parts, entry.name)), data=data, sha256=hash_bytes(data)))

    walk(root, ())
    files.sort(key=lambda f: f.path)
    return files


@dataclass(frozen=True)
class ManifestEntry:
    path: str
    sha256: str
    uid: str


@dataclass
class Snapshot:
    manifest: list[ManifestEntry]
    index: Index
    search_index: SearchIndex
    vector_index: VectorIndex | None


def write_snapshot(
    root: Path | str,
    manifest: list[ManifestEntry],
    index: Index,
    search_index: SearchIndex,
    vector_index: VectorIndex | None,
) -> None:
    doc = {
        "version": SNAPSHOT_SCHEMA_VERSION,
        "lang": SNAPSHOT_LANG,
        "manifest": [{"path": m.path, "sha256": m.sha256, "uid": m.uid} for m in manifest],
        "structural": index.to_dict(),
        "search": search_index.to_dict(),
        "vectors": vector_index.to_dict() if vector_index is not None else None,
    }
    write_json_atomic(root, SNAPSHOT_REL_PATH, doc)


def _parse_manifest(raw: object) -> list[ManifestEntry]:
    if not isinstance(raw, list):
        raise ValueError("snapshot manifest is not a list")
    entries = []
    for e in raw:
        if not isinstance(e, dict):
            raise ValueError("snapshot manifest row is not a dict")
        missing = _MANIFEST_ROW_KEYS - e.keys()
        if missing:
            raise ValueError(f"snapshot manifest row missing {sorted(missing)[0]}")
        path = e["path"]
        sha256 = e["sha256"]
        uid = e["uid"]
        if not isinstance(path, str):
            raise ValueError("snapshot manifest row path must be a string")
        _validate_manifest_path(path)
        if not isinstance(sha256, str):
            raise ValueError("snapshot manifest row sha256 must be a string")
        if _SHA256_RE.fullmatch(sha256) is None:
            raise ValueError("snapshot manifest row sha256 must be 64 lowercase hex chars")
        if not isinstance(uid, str):
            raise ValueError("snapshot manifest row uid must be a string")
        entries.append(ManifestEntry(path=path, sha256=sha256, uid=uid))
    uids = [e.uid for e in entries]
    paths = [e.path for e in entries]
    if len(set(uids)) != len(uids):
        raise ValueError("snapshot manifest: duplicate uid")
    if len(set(paths)) != len(paths):
        raise ValueError("snapshot manifest: duplicate path")
    return entries


def _validate_manifest_path(path: str) -> None:
    if not is_portable_relative_path(path) or path.split("/", 1)[0] == RESERVED_NAMESPACE:
        raise ValueError("snapshot manifest row path must be a portable root-relative .md path")


def load_snapshot(root: Path | str, embedder_namespace: str | None) -> Snapshot | None:
    try:
        doc = read_json(root, SNAPSHOT_REL_PATH)
        if doc is None:
            return None
        if not isinstance(doc, dict):
            return None
        missing = _SNAPSHOT_KEYS - doc.keys()
        if missing:
            raise ValueError(f"snapshot document missing {sorted(missing)[0]}")
        if doc.get("version") != SNAPSHOT_SCHEMA_VERSION or doc.get("lang") != SNAPSHOT_LANG:
            return None

        manifest = _parse_manifest(doc["manifest"])
        manifest_uids = {m.uid for m in manifest}

        index = Index.from_dict(doc["structural"])
        if set(index.by_uid) != manifest_uids:
            return None
        expected_ids = {uid: entry.id for uid, entry in index.by_uid.items()}
        for m in manifest:
            if m.path != path_for_node_id(expected_ids[m.uid]):
                raise ValueError("snapshot manifest path does not match structural id")

        search_index = SearchIndex.from_dict(doc["search"])
        if set(search_index.lengths) != manifest_uids:
            return None
        if search_index.id_by_uid != expected_ids:
            return None

        vector_index: VectorIndex | None = None
        if embedder_namespace is not None:
            vec = doc.get("vectors")
            if not isinstance(vec, dict):
                return None
            if vec.get("namespace") != embedder_namespace:
                return None
            vector_index = VectorIndex.from_dict(vec)
            if set(vector_index.vectors) != manifest_uids:
                return None
            if vector_index.id_by_uid != expected_ids:
                return None

        return Snapshot(
            manifest=manifest,
            index=index,
            search_index=search_index,
            vector_index=vector_index,
        )
    except (OSError, ValueError):
        return None
