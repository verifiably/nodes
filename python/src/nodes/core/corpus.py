from __future__ import annotations

from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Literal, NamedTuple

from pydantic import BaseModel

from nodes.core.errors import CollisionError, EmbedderRequiredError, PlacementError, RefError, ValidationError
from nodes.core.frontmatter import node_from_bytes, node_to_markdown
from nodes.core.ids import NodeId
from nodes.core.structural_index import Index, ResolvedEdge
from nodes.core.node import Node
from nodes.core.paths import path_for_node_id
from nodes.core.registry import Registry
from nodes.core.search import SearchHit, SearchIndex
from nodes.core.shapes import EDGES, KEYS, MEMBERSHIP, ORDER
from nodes.core.similarity import Embedder, SimilarHit, Vector, VectorCache, VectorIndex
from nodes.core.snapshot import (
    CorpusFile,
    ManifestEntry,
    Snapshot,
    hash_bytes,
    iter_corpus_files,
    load_snapshot,
    write_snapshot,
)
from nodes.core.store import Store
from nodes.core.write_plan import (
    CreateOp,
    DefaultExecutor,
    DeleteOp,
    ReplaceOp,
    WriteOp,
    WritePlanExecutor,
)


def _rewrite_refs(node: Node, old: str, new: str) -> None:
    """Rewrite every position in `node` that holds `old` to `new` (in place):
    top-level relations plus the built-in structural form facets."""
    for rel in node.relations:
        if rel.source == old:
            rel.source = new
        if rel.target == old:
            rel.target = new
    mem = node.facets.get(MEMBERSHIP)
    if isinstance(mem, dict) and isinstance(mem.get("members"), list):
        mem["members"] = [new if m == old else m for m in mem["members"]]
    eg = node.facets.get(EDGES)
    if isinstance(eg, dict):
        for edge in eg.get("edges", []) or []:
            if isinstance(edge, dict):
                if edge.get("source") == old:
                    edge["source"] = new
                if edge.get("target") == old:
                    edge["target"] = new
    od = node.facets.get(ORDER)
    if isinstance(od, dict) and isinstance(od.get("order"), list):
        od["order"] = [new if m == old else m for m in od["order"]]
    ky = node.facets.get(KEYS)
    if isinstance(ky, dict) and isinstance(ky.get("keys"), dict):
        for key, val in list(ky["keys"].items()):
            if val == old:
                ky["keys"][key] = new


class Finding(BaseModel):
    """One corpus-check finding (reported, never raised)."""

    severity: Literal["error", "warning"]
    code: str
    ref: str
    detail: str
    message: str


ConstructionMode = Literal["strict", "collecting"]


class _Claimant(NamedTuple):
    """One parsed, well-placed file's identity claims, for admission grouping."""

    path: str
    uid: str
    id: str
    deprecated_ids: tuple[str, ...]


def _claimant(path: str, node: Node) -> _Claimant:
    # Deduplicate: a document repeating a deprecated id never contests itself, and
    # snapshot entries hold deprecated ids as a set, so cold and warm must agree.
    return _Claimant(path, node.uid, node.id, tuple(dict.fromkeys(d for d in node.deprecated_ids if d != node.id)))


class Corpus:
    """Coordinator over a `Store` + an in-memory `Index`. The primary kernel API."""

    def __init__(
        self,
        root: Path,
        registry: Registry | None = None,
        embedder: Embedder | None = None,
        executor_factory: Callable[[Path], WritePlanExecutor] | None = None,
        mode: ConstructionMode = "strict",
    ) -> None:
        self.store = Store(root)
        # Root-taking factory, never a pre-bound executor: the corpus supplies its own root.
        factory = executor_factory if executor_factory is not None else DefaultExecutor
        self.executor: WritePlanExecutor = factory(self.store.root)
        self.registry = registry
        self.embedder = embedder
        self.vector_cache: VectorCache | None = VectorCache(root) if embedder is not None else None
        self.manifest: dict[str, ManifestEntry] = {}
        if mode not in ("strict", "collecting"):
            raise ValueError(f"unknown construction mode {mode!r}")
        self.mode: ConstructionMode = mode
        # Collecting-mode state. Strict corpora leave all four empty.
        self._excluded_paths: set[str] = set()
        self._construction_findings: list[Finding] = []
        self._reserved_uids: set[str] = set()
        self._reserved_ids: set[str] = set()
        namespace = embedder.cache_namespace if embedder is not None else None
        snap = load_snapshot(self.store.root, namespace)
        if snap is None:
            self._full_rebuild()
        else:
            self._reconcile(snap)

    def _rel_path(self, node_id: str) -> str:
        return self.store.path_for(node_id).relative_to(self.store.root).as_posix()

    def _record_manifest(self, path: str, data: bytes, uid: str) -> None:
        self.manifest[path] = ManifestEntry(path=path, sha256=hash_bytes(data), uid=uid)

    def _assert_not_reserved(self, path: str | None, uid: str | None, claims: tuple[str, ...]) -> None:
        """Excluded files occupy their paths; excluded identity claimants reserve their
        uids and (at the id stage) their ids. Strict corpora reserve nothing."""
        if path is not None and path in self._excluded_paths:
            raise CollisionError(f"path {path!r} is occupied by an excluded document")
        if uid is not None and uid in self._reserved_uids:
            raise CollisionError(f"uid {uid!r} is reserved by an excluded document")
        for claim in claims:
            if claim in self._reserved_ids:
                raise CollisionError(f"id {claim!r} is reserved by an excluded document")

    def _exclude(self, path: str, code: str, detail: str, message: str) -> None:
        self._excluded_paths.add(path)
        self._construction_findings.append(
            Finding(severity="error", code=code, ref=path, detail=detail, message=message)
        )

    def _parse_member(self, f: CorpusFile) -> Node | None:
        """Admission steps 1–2. Strict raises; collecting excludes and returns None."""
        try:
            node = node_from_bytes(f.data)
        except ValidationError as exc:
            if self.mode == "strict":
                raise
            self._exclude(f.path, "parse-error", "", f"{f.path}: {exc}")
            return None
        expected = path_for_node_id(node.id)
        if f.path != expected:
            message = f"{f.path!r} holds {node.id!r}, whose mapped path is {expected!r}"
            if self.mode == "strict":
                raise PlacementError(message)
            self._exclude(f.path, "path-mismatch", expected, message)
            return None
        return node

    def _admit_identities(self, kept: list[_Claimant], candidates: list[_Claimant]) -> tuple[set[str], set[str]]:
        """Admission steps 3–4 over kept + candidates, each stage grouped in full before
        any exclusion. Returns (excluded paths, evicted kept uids). Strict raises."""
        population = [*kept, *candidates]
        losers: dict[str, _Claimant] = {}
        by_uid: dict[str, list[_Claimant]] = {}
        for c in population:
            by_uid.setdefault(c.uid, []).append(c)
        for uid, group in by_uid.items():
            if len(group) < 2:
                continue
            if self.mode == "strict":
                raise CollisionError(f"duplicate uid {uid!r} in corpus")
            for c in group:
                losers[c.path] = c
                self._reserved_uids.add(c.uid)
                self._exclude(c.path, "uid-collision", uid, f"{c.path}: uid {uid!r} is claimed by another document")
        by_id: dict[str, list[_Claimant]] = {}
        for c in population:
            if c.path in losers:
                continue
            for claim in dict.fromkeys((c.id, *c.deprecated_ids)):
                by_id.setdefault(claim, []).append(c)
        for claim in sorted(by_id):
            group = by_id[claim]
            if len(group) < 2:
                continue
            if self.mode == "strict":
                raise CollisionError(f"identity claim {claim!r} is made by more than one document")
            for c in group:
                losers[c.path] = c
                self._reserved_uids.add(c.uid)
                self._reserved_ids.update((c.id, *c.deprecated_ids))
                self._exclude(c.path, "id-collision", claim, f"{c.path}: id {claim!r} is claimed by another document")
        kept_paths = {c.path for c in kept}
        return set(losers), {c.uid for p, c in losers.items() if p in kept_paths}

    def _full_rebuild(self) -> None:
        parsed: list[tuple[CorpusFile, Node]] = []
        for f in iter_corpus_files(self.store.root):
            node = self._parse_member(f)
            if node is not None:
                parsed.append((f, node))
        excluded, _ = self._admit_identities([], [_claimant(f.path, node) for f, node in parsed])
        accepted = [(f, node) for f, node in parsed if f.path not in excluded]
        nodes = [node for _, node in accepted]
        self.index = Index.build(nodes)
        self.search_index = SearchIndex.build(nodes)
        if self.embedder is not None:
            assert self.vector_cache is not None
            self.vector_index: VectorIndex | None = VectorIndex.build(nodes, self.embedder, self.vector_cache)
        else:
            self.vector_index = None
        self.manifest = {f.path: ManifestEntry(path=f.path, sha256=f.sha256, uid=node.uid) for f, node in accepted}

    def _reconcile(self, snap: Snapshot) -> None:
        self.index = snap.index
        self.search_index = snap.search_index
        self.vector_index = snap.vector_index
        old = {m.path: m for m in snap.manifest}
        new_manifest: dict[str, ManifestEntry] = {}
        changed: list[tuple[str, str, Node]] = []
        drops: list[str] = []
        current: set[str] = set()
        for f in iter_corpus_files(self.store.root):
            current.add(f.path)
            prev = old.get(f.path)
            if prev is not None and prev.sha256 == f.sha256:
                new_manifest[f.path] = prev
                continue
            if prev is not None:
                drops.append(prev.uid)
            node = self._parse_member(f)
            if node is not None:
                changed.append((f.path, f.sha256, node))
        for path, m in old.items():
            if path not in current:
                drops.append(m.uid)
        for uid in drops:
            self.index.remove(uid)
            self.search_index.remove(uid)
            if self.vector_index is not None:
                self.vector_index.remove(uid)
        # Kept = every entry still in the index (unchanged files); its path is in the old manifest.
        path_by_uid = {m.uid: m.path for m in snap.manifest}
        kept = [
            _Claimant(path_by_uid[uid], uid, e.id, tuple(sorted(e.deprecated_ids)))
            for uid, e in self.index.by_uid.items()
        ]
        excluded, evicted = self._admit_identities(kept, [_claimant(p, n) for p, _, n in changed])
        for uid in evicted:
            self.index.remove(uid)
            self.search_index.remove(uid)
            if self.vector_index is not None:
                self.vector_index.remove(uid)
            new_manifest.pop(path_by_uid[uid], None)
        for path, sha, node in changed:
            if path in excluded:
                continue
            self.index.assert_identity_claims(node)  # holds by construction; guards the invariant
            prepared = None
            if self.vector_index is not None:
                assert self.embedder is not None and self.vector_cache is not None
                prepared = self.vector_index.prepare(node, self.embedder, self.vector_cache)
            self.index.upsert(node)
            self.search_index.upsert(node)
            if self.vector_index is not None and prepared is not None:
                self.vector_index.commit(node, prepared)
            new_manifest[path] = ManifestEntry(path=path, sha256=sha, uid=node.uid)
        self.manifest = new_manifest

    def flush_index(self) -> None:
        manifest = sorted(self.manifest.values(), key=lambda m: m.path)
        write_snapshot(self.store.root, manifest, self.index, self.search_index, self.vector_index)

    def add(self, node: Node) -> Node:
        if self.registry is not None:
            self.registry.validate(node)
        self.index.assert_addable(node)
        path = self._rel_path(node.id)
        self._assert_not_reserved(path, node.uid, (node.id, *node.deprecated_ids))
        prepared = None
        if self.vector_index is not None:
            assert self.embedder is not None and self.vector_cache is not None
            prepared = self.vector_index.prepare(node, self.embedder, self.vector_cache)
        data = node_to_markdown(node).encode("utf-8")
        # assert_addable guarantees a live uid holds this same id: matching pair → replace.
        plan: list[WriteOp]
        if node.uid in self.index.by_uid:
            plan = [ReplaceOp(path=path, content=data, expected_digest=self.manifest[path].sha256)]
        else:
            plan = [CreateOp(path=path, content=data)]
        self.executor.execute(plan)
        self.index.upsert(node)
        self.search_index.upsert(node)
        if self.vector_index is not None and prepared is not None:
            self.vector_index.commit(node, prepared)
        self._record_manifest(path, data, node.uid)
        return node

    def get(self, ref: str) -> Node:
        uid = self.index.resolve_uid(ref)
        if uid is None:
            raise RefError(f"no node resolves ref {ref!r}")
        return self.store.read_file(self.index.by_uid[uid].id)

    def resolve(self, ref: str) -> Node:
        return self.get(ref)

    def delete(self, node_id: str) -> None:
        uid = self.index.id_to_uid.get(node_id)
        if uid is None:
            raise RefError(f"no live node at {node_id!r}")
        path = self._rel_path(node_id)
        self.executor.execute([DeleteOp(path=path, expected_digest=self.manifest[path].sha256)])
        self.index.remove(uid)
        self.search_index.remove(uid)
        if self.vector_index is not None:
            self.vector_index.remove(uid)
        self.manifest.pop(path, None)

    def all(self) -> list[Node]:
        """Accepted members, ordered by manifest path in Unicode code-point order."""
        entries = sorted(self.manifest.values(), key=lambda m: m.path)
        return [self.store.read_file(self.index.by_uid[m.uid].id) for m in entries]

    def _require_uid(self, ref: str) -> str:
        uid = self.index.resolve_uid(ref)
        if uid is None:
            raise RefError(f"no node resolves ref {ref!r}")
        return uid

    def outbound(self, ref: str) -> list[ResolvedEdge]:
        return self.index.outbound_edges(self._require_uid(ref))

    def inbound(self, ref: str) -> list[ResolvedEdge]:
        return self.index.inbound_edges(self._require_uid(ref))

    def neighbors(self, ref: str) -> list[Node]:
        uid = self._require_uid(ref)
        neighbor_uids: set[str] = set()
        for edge in self.index.outbound_edges(uid):
            if edge.target_uid is not None:
                neighbor_uids.add(edge.target_uid)
        for edge in self.index.inbound_edges(uid):
            if edge.source_uid is not None:
                neighbor_uids.add(edge.source_uid)
        neighbor_uids.discard(uid)
        return [self.store.read_file(self.index.by_uid[u].id) for u in sorted(neighbor_uids)]

    def _sorted_live_ids(self, uids: Iterable[str]) -> list[str]:
        return sorted(self.index.by_uid[u].id for u in uids)

    def members(self, ref: str) -> list[str]:
        return self._sorted_live_ids(self.index.members_of(self._require_uid(ref)))

    def containers(self, ref: str) -> list[str]:
        return self._sorted_live_ids(self.index.containers_of(self._require_uid(ref)))

    def search(self, query: str, limit: int | None = None) -> list[SearchHit]:
        return self.search_index.search(query, limit)

    def similar(self, ref: str, k: int | None = None) -> list[SimilarHit]:
        if self.vector_index is None:
            raise EmbedderRequiredError("similarity requires Corpus(embedder=...)")
        return self.vector_index.similar(self._require_uid(ref), k)

    def query_vector(self, vec: Vector, k: int | None = None) -> list[SimilarHit]:
        if self.vector_index is None:
            raise EmbedderRequiredError("similarity requires Corpus(embedder=...)")
        return self.vector_index.query_vector(vec, k)

    def similar_text(self, text: str, k: int | None = None) -> list[SimilarHit]:
        if self.vector_index is None:
            raise EmbedderRequiredError("similarity requires Corpus(embedder=...)")
        assert self.embedder is not None
        return self.vector_index.similar_text(text, self.embedder, k)

    def rename(self, old_id: str, new_id: str) -> Node:
        if old_id not in self.index.id_to_uid:
            raise RefError(f"rename source {old_id!r} is not a live id")
        if self.index.resolve_uid(new_id) is not None:
            raise CollisionError(f"target id {new_id!r} already in use")

        uid = self.index.id_to_uid[old_id]
        # Path admission before any preparation: a differently spelled same-key
        # destination is refused; the source's own exact mapped path is a replace.
        self.index.assert_path_available(uid, new_id)
        new_rel_path = self._rel_path(new_id)
        old_rel_path = self._rel_path(old_id)
        self._assert_not_reserved(new_rel_path if new_rel_path != old_rel_path else None, None, (new_id,))
        referrer_uids = {ir.source_uid for ir in self.index.in_refs.get(old_id, [])}

        # --- prepare: rewrite every node that will change, in memory ---
        node = self.store.read_file(old_id)
        node.id = new_id
        node.kind = NodeId.parse(new_id).kind
        if old_id not in node.deprecated_ids:
            node.deprecated_ids.append(old_id)
        _rewrite_refs(node, old_id, new_id)

        referrers: list[Node] = []
        for referrer_uid in sorted(referrer_uids):  # uid order: deterministic plan positions
            if referrer_uid == uid:
                continue
            referrer = self.store.read_file(self.index.by_uid[referrer_uid].id)
            _rewrite_refs(referrer, old_id, new_id)
            referrers.append(referrer)

        # --- validate: ALL writes, before ANY write (fail-early, no partial rename) ---
        if self.registry is not None:
            self.registry.validate(node)
            for referrer in referrers:
                self.registry.validate(referrer)

        # --- prepare similarity vector (fail before any disk write) ---
        prepared = None
        prepared_referrers = []
        if self.vector_index is not None:
            assert self.embedder is not None and self.vector_cache is not None
            prepared = self.vector_index.prepare(node, self.embedder, self.vector_cache)
            for referrer in referrers:
                prepared_referrers.append(self.vector_index.prepare(referrer, self.embedder, self.vector_cache))

        # --- plan: create new → delete old → replace referrers ---
        node_data = node_to_markdown(node).encode("utf-8")
        plan: list[WriteOp] = []
        if new_rel_path != old_rel_path:
            plan.append(CreateOp(path=new_rel_path, content=node_data))
            plan.append(DeleteOp(path=old_rel_path, expected_digest=self.manifest[old_rel_path].sha256))
        else:
            # ids differ but map to the same file: replace in place, nothing to delete
            plan.append(
                ReplaceOp(path=new_rel_path, content=node_data, expected_digest=self.manifest[old_rel_path].sha256)
            )
        referrer_writes: list[tuple[str, bytes]] = []
        for referrer in referrers:
            rpath = self._rel_path(referrer.id)
            rdata = node_to_markdown(referrer).encode("utf-8")
            plan.append(ReplaceOp(path=rpath, content=rdata, expected_digest=self.manifest[rpath].sha256))
            referrer_writes.append((rpath, rdata))

        # --- execute, then update in-memory state only after it returns ---
        self.executor.execute(plan)
        self.index.upsert(node)
        self.search_index.upsert(node)
        if self.vector_index is not None and prepared is not None:
            self.vector_index.commit(node, prepared)
        for i, referrer in enumerate(referrers):
            self.index.upsert(referrer)
            self.search_index.upsert(referrer)
            if self.vector_index is not None:
                self.vector_index.commit(referrer, prepared_referrers[i])
        if new_rel_path != old_rel_path:
            self.manifest.pop(old_rel_path, None)
        self._record_manifest(new_rel_path, node_data, node.uid)
        for i, referrer in enumerate(referrers):
            rpath, rdata = referrer_writes[i]
            self._record_manifest(rpath, rdata, referrer.uid)
        return node

    def check(self, registry: Registry | None = None) -> list[Finding]:
        """Report corpus-validity findings; never raises on content.

        Construction findings (collecting mode) come first. Registry violations (when a registry is configured or passed) are errors;
        unresolved top-level relation targets, unresolved membership member refs and
        mapped-path collisions (a portability hazard, registry or not) are warnings.
        Sorted by (ref, code, detail) — `message` is human-only.
        """
        reg = registry if registry is not None else self.registry
        findings: list[Finding] = list(self._construction_findings)
        if reg is not None:
            for node in self.all():
                for v in reg.check(node):
                    findings.append(
                        Finding(severity="error", code=v.code, ref=node.id, detail=v.detail, message=v.message)
                    )
        for edge in self.index.dangling_edges():
            rel = edge.relation
            findings.append(
                Finding(
                    severity="warning",
                    code="dangling-ref",
                    ref=rel.source,
                    detail=rel.target,
                    message=f"{rel.source}: relation {rel.predicate!r} targets unresolved {rel.target!r}",
                )
            )
        for source_uid, ref in self.index.dangling_members():
            container_id = self.index.by_uid[source_uid].id
            findings.append(
                Finding(
                    severity="warning",
                    code="dangling-member",
                    ref=container_id,
                    detail=ref,
                    message=f"{container_id}: member {ref!r} resolves to no live node",
                )
            )
        for live_id, key in self.index.path_collisions():
            findings.append(
                Finding(
                    severity="warning",
                    code="path-collision",
                    ref=live_id,
                    detail=key,
                    message=f"{live_id}: mapped path collides at {key!r}",
                )
            )
        findings.sort(key=lambda f: (f.ref, f.code, f.detail))
        return findings
