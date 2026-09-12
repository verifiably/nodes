import { CollisionError, EmbedderRequiredError, PlacementError, RefError, ValidationError } from "./errors.js";
import { nodeFromBytes, nodeToMarkdown } from "./frontmatter.js";
import { NodeId } from "./ids.js";
import type { Node } from "./node.js";
import { pathForNodeId } from "./paths.js";
import type { Registry } from "./registry.js";
import { type SearchHit, SearchIndex, compareCodepoints } from "./search.js";
import { EDGES, KEYS, MEMBERSHIP, ORDER } from "./shapes.js";
import { type Embedder, type SimilarHit, type Vector, VectorCache, VectorIndex } from "./similarity.js";
import {
  type CorpusFile,
  type ManifestEntry,
  type Snapshot,
  hashBytes,
  iterCorpusFiles,
  loadSnapshot,
  writeSnapshot,
} from "./snapshot.js";
import { Store } from "./store.js";
import { Index, type ResolvedEdge } from "./structural-index.js";
import { DefaultExecutor, type WriteOp, type WritePlanExecutor } from "./write-plan.js";

/** Rewrite every position in `node` that holds `oldId` to `newId` (in place):
 * top-level relations plus the built-in structural form facets. */
function rewriteRefs(node: Node, oldId: string, newId: string): void {
  for (const rel of node.relations) {
    if (rel.source === oldId) rel.source = newId;
    if (rel.target === oldId) rel.target = newId;
  }
  const mem = node.facets[MEMBERSHIP];
  if (mem !== null && typeof mem === "object") {
    const members = (mem as Record<string, unknown>).members;
    if (Array.isArray(members)) {
      (mem as Record<string, unknown>).members = members.map((m) => (m === oldId ? newId : m));
    }
  }
  const eg = node.facets[EDGES];
  if (eg !== null && typeof eg === "object") {
    const edges = (eg as Record<string, unknown>).edges;
    if (Array.isArray(edges)) {
      for (const edge of edges) {
        if (edge !== null && typeof edge === "object") {
          const e = edge as Record<string, unknown>;
          if (e.source === oldId) e.source = newId;
          if (e.target === oldId) e.target = newId;
        }
      }
    }
  }
  const od = node.facets[ORDER];
  if (od !== null && typeof od === "object") {
    const order = (od as Record<string, unknown>).order;
    if (Array.isArray(order)) {
      (od as Record<string, unknown>).order = order.map((m) => (m === oldId ? newId : m));
    }
  }
  const ky = node.facets[KEYS];
  if (ky !== null && typeof ky === "object") {
    const keys = (ky as Record<string, unknown>).keys;
    if (keys !== null && typeof keys === "object") {
      const km = keys as Record<string, unknown>;
      for (const k of Object.keys(km)) {
        if (km[k] === oldId) km[k] = newId;
      }
    }
  }
}

/** One corpus-check finding (reported, never thrown). */
export interface Finding {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly ref: string;
  readonly detail: string;
  readonly message: string;
}

/** Coordinator over a `Store` + an in-memory `Index`. The primary kernel API. */
export type ConstructionMode = "strict" | "collecting";

/** One parsed, well-placed file's identity claims, for admission grouping. */
interface Claimant {
  readonly path: string;
  readonly uid: string;
  readonly id: string;
  readonly deprecatedIds: readonly string[];
}
// Deduplicate: a document repeating a deprecated id never contests itself, and snapshot
// entries hold deprecated ids as a set, so cold and warm must agree.
const claimant = (path: string, node: Node): Claimant => ({
  path,
  uid: node.uid,
  id: node.id,
  deprecatedIds: [...new Set(node.deprecatedIds.filter((d) => d !== node.id))],
});

export class Corpus {
  readonly store: Store;
  readonly executor: WritePlanExecutor;
  readonly registry?: Registry;
  index!: Index;
  searchIndex!: SearchIndex;
  readonly embedder?: Embedder;
  readonly vectorCache?: VectorCache;
  vectorIndex?: VectorIndex;
  manifest: Map<string, ManifestEntry>;
  readonly mode: ConstructionMode;
  // Collecting-mode state. Strict corpora leave all four empty.
  private readonly excludedPaths = new Set<string>();
  private readonly constructionFindings: Finding[] = [];
  private readonly reservedUids = new Set<string>();
  private readonly reservedIds = new Set<string>();

  constructor(
    root: string,
    registry?: Registry,
    embedder?: Embedder,
    executorFactory?: (root: string) => WritePlanExecutor,
    options: { mode?: ConstructionMode } = {},
  ) {
    const mode = options.mode ?? "strict";
    if (mode !== "strict" && mode !== "collecting")
      throw new TypeError(`unknown construction mode ${JSON.stringify(mode)}`);
    this.mode = mode;
    this.store = new Store(root);
    // Root-taking factory, never a pre-bound executor: the corpus supplies its own root.
    this.executor = executorFactory !== undefined ? executorFactory(root) : new DefaultExecutor(root);
    this.registry = registry;
    this.embedder = embedder;
    this.vectorCache = embedder !== undefined ? new VectorCache(root) : undefined;
    this.manifest = new Map();
    const namespace = embedder !== undefined ? embedder.cacheNamespace : null;
    const snap = loadSnapshot(this.store.root, namespace);
    if (snap === null) this.fullRebuild();
    else this.reconcile(snap);
  }

  private relPath(nodeId: string): string {
    return pathForNodeId(nodeId);
  }

  private recordManifest(path: string, data: Buffer, uid: string): void {
    this.manifest.set(path, { path, sha256: hashBytes(data), uid });
  }

  private manifestDigest(path: string): string {
    const entry = this.manifest.get(path);
    if (entry === undefined) throw new RefError(`no manifest entry for ${JSON.stringify(path)}`);
    return entry.sha256;
  }

  /** Excluded files occupy their paths; excluded identity claimants reserve their uids
   * and (at the id stage) their ids. Strict corpora reserve nothing. */
  private assertNotReserved(path: string | null, uid: string | null, claims: string[]): void {
    if (path !== null && this.excludedPaths.has(path)) {
      throw new CollisionError(`path ${JSON.stringify(path)} is occupied by an excluded document`);
    }
    if (uid !== null && this.reservedUids.has(uid)) {
      throw new CollisionError(`uid ${JSON.stringify(uid)} is reserved by an excluded document`);
    }
    for (const claim of claims) {
      if (this.reservedIds.has(claim))
        throw new CollisionError(`id ${JSON.stringify(claim)} is reserved by an excluded document`);
    }
  }

  private exclude(path: string, code: string, detail: string, message: string): void {
    this.excludedPaths.add(path);
    this.constructionFindings.push({ severity: "error", code, ref: path, detail, message });
  }

  /** Admission steps 1–2. Strict throws; collecting excludes and returns undefined. */
  private parseMember(f: CorpusFile): Node | undefined {
    let node: Node;
    try {
      node = nodeFromBytes(f.data);
    } catch (e) {
      if (!(e instanceof ValidationError) || this.mode === "strict") throw e;
      this.exclude(f.path, "parse-error", "", `${f.path}: ${e.message}`);
      return undefined;
    }
    const expected = pathForNodeId(node.id);
    if (f.path !== expected) {
      const message = `${JSON.stringify(f.path)} holds ${JSON.stringify(node.id)}, whose mapped path is ${JSON.stringify(expected)}`;
      if (this.mode === "strict") throw new PlacementError(message);
      this.exclude(f.path, "path-mismatch", expected, message);
      return undefined;
    }
    return node;
  }

  /** Admission steps 3–4 over kept + candidates, each stage grouped in full before any
   * exclusion. Returns excluded paths and evicted kept uids. Strict throws. */
  private admitIdentities(kept: Claimant[], candidates: Claimant[]): { excluded: Set<string>; evicted: Set<string> } {
    const population = [...kept, ...candidates];
    const losers = new Map<string, Claimant>();
    const byUid = new Map<string, Claimant[]>();
    for (const c of population) byUid.set(c.uid, [...(byUid.get(c.uid) ?? []), c]);
    for (const [uid, group] of byUid) {
      if (group.length < 2) continue;
      if (this.mode === "strict") throw new CollisionError(`duplicate uid ${JSON.stringify(uid)} in corpus`);
      for (const c of group) {
        losers.set(c.path, c);
        this.reservedUids.add(c.uid);
        this.exclude(
          c.path,
          "uid-collision",
          uid,
          `${c.path}: uid ${JSON.stringify(uid)} is claimed by another document`,
        );
      }
    }
    const byId = new Map<string, Claimant[]>();
    for (const c of population) {
      if (losers.has(c.path)) continue;
      for (const claim of new Set([c.id, ...c.deprecatedIds])) byId.set(claim, [...(byId.get(claim) ?? []), c]);
    }
    for (const claim of [...byId.keys()].sort(compareCodepoints)) {
      const group = byId.get(claim) as Claimant[];
      if (group.length < 2) continue;
      if (this.mode === "strict") {
        throw new CollisionError(`identity claim ${JSON.stringify(claim)} is made by more than one document`);
      }
      for (const c of group) {
        losers.set(c.path, c);
        this.reservedUids.add(c.uid);
        this.reservedIds.add(c.id);
        for (const dep of c.deprecatedIds) this.reservedIds.add(dep);
        this.exclude(
          c.path,
          "id-collision",
          claim,
          `${c.path}: id ${JSON.stringify(claim)} is claimed by another document`,
        );
      }
    }
    const keptPaths = new Set(kept.map((c) => c.path));
    const evicted = new Set<string>();
    for (const [path, c] of losers) if (keptPaths.has(path)) evicted.add(c.uid);
    return { excluded: new Set(losers.keys()), evicted };
  }

  private fullRebuild(): void {
    const parsed: Array<{ f: CorpusFile; node: Node }> = [];
    for (const f of iterCorpusFiles(this.store.root)) {
      const node = this.parseMember(f);
      if (node !== undefined) parsed.push({ f, node });
    }
    const { excluded } = this.admitIdentities(
      [],
      parsed.map(({ f, node }) => claimant(f.path, node)),
    );
    const accepted = parsed.filter(({ f }) => !excluded.has(f.path));
    const nodes = accepted.map(({ node }) => node);
    this.index = Index.build(nodes);
    this.searchIndex = SearchIndex.build(nodes);
    this.vectorIndex =
      this.embedder !== undefined
        ? VectorIndex.build(nodes, this.embedder, this.vectorCache as VectorCache)
        : undefined;
    this.manifest = new Map(accepted.map(({ f, node }) => [f.path, { path: f.path, sha256: f.sha256, uid: node.uid }]));
  }

  private reconcile(snap: Snapshot): void {
    this.index = snap.index;
    this.searchIndex = snap.searchIndex;
    this.vectorIndex = snap.vectorIndex ?? undefined;
    const old = new Map<string, ManifestEntry>(snap.manifest.map((m) => [m.path, m]));
    const newManifest = new Map<string, ManifestEntry>();
    const changed: Array<{ path: string; sha256: string; node: Node }> = [];
    const drops: string[] = [];
    const current = new Set<string>();
    for (const f of iterCorpusFiles(this.store.root)) {
      current.add(f.path);
      const prev = old.get(f.path);
      if (prev !== undefined && prev.sha256 === f.sha256) {
        newManifest.set(f.path, prev); // unchanged: keep deserialized state, no parse
        continue;
      }
      if (prev !== undefined) drops.push(prev.uid);
      const node = this.parseMember(f);
      if (node !== undefined) changed.push({ path: f.path, sha256: f.sha256, node });
    }
    for (const [path, m] of old) {
      if (!current.has(path)) drops.push(m.uid); // deleted on disk
    }
    for (const uid of drops) {
      this.index.remove(uid);
      this.searchIndex.remove(uid);
      this.vectorIndex?.remove(uid);
    }
    // Kept = every entry still in the index (unchanged files); its path is in the old manifest.
    const pathByUid = new Map(snap.manifest.map((m) => [m.uid, m.path]));
    const kept: Claimant[] = [...this.index.byUid.entries()].map(([uid, e]) => ({
      path: pathByUid.get(uid) as string,
      uid,
      id: e.id,
      deprecatedIds: [...e.deprecatedIds].sort(compareCodepoints),
    }));
    const { excluded, evicted } = this.admitIdentities(
      kept,
      changed.map(({ path, node }) => claimant(path, node)),
    );
    for (const uid of evicted) {
      this.index.remove(uid);
      this.searchIndex.remove(uid);
      this.vectorIndex?.remove(uid);
      newManifest.delete(pathByUid.get(uid) as string);
    }
    for (const { path, sha256, node } of changed) {
      if (excluded.has(path)) continue;
      this.index.assertIdentityClaims(node); // holds by construction; guards the invariant
      const prepared =
        this.vectorIndex !== undefined
          ? this.vectorIndex.prepare(node, this.embedder as Embedder, this.vectorCache as VectorCache)
          : undefined;
      this.index.upsert(node);
      this.searchIndex.upsert(node);
      if (this.vectorIndex !== undefined && prepared !== undefined) this.vectorIndex.commit(node, prepared);
      newManifest.set(path, { path, sha256, uid: node.uid });
    }
    this.manifest = newManifest;
  }

  flushIndex(): void {
    const manifest = [...this.manifest.values()].sort((a, b) => compareCodepoints(a.path, b.path));
    writeSnapshot(this.store.root, manifest, this.index, this.searchIndex, this.vectorIndex);
  }

  private idFor(uid: string): string {
    const entry = this.index.byUid.get(uid);
    if (entry === undefined) throw new RefError(`uid ${JSON.stringify(uid)} not in index`);
    return entry.id;
  }

  private requireUid(ref: string): string {
    const uid = this.index.resolveUid(ref);
    if (uid === null) throw new RefError(`no node resolves ref ${JSON.stringify(ref)}`);
    return uid;
  }

  add(node: Node): Node {
    if (this.registry !== undefined) this.registry.validate(node);
    this.index.assertAddable(node);
    const path = this.relPath(node.id);
    this.assertNotReserved(path, node.uid, [node.id, ...node.deprecatedIds]);
    const prepared =
      this.vectorIndex !== undefined
        ? this.vectorIndex.prepare(node, this.embedder as Embedder, this.vectorCache as VectorCache)
        : undefined;
    const data = Buffer.from(nodeToMarkdown(node), "utf-8");
    // assertAddable guarantees a live uid holds this same id: matching pair → replace.
    const plan: WriteOp[] = this.index.byUid.has(node.uid)
      ? [{ op: "replace", path, content: data, expectedDigest: this.manifestDigest(path) }]
      : [{ op: "create", path, content: data }];
    this.executor.execute(plan);
    this.index.upsert(node);
    this.searchIndex.upsert(node);
    if (this.vectorIndex !== undefined && prepared !== undefined) {
      this.vectorIndex.commit(node, prepared);
    }
    this.recordManifest(path, data, node.uid);
    return node;
  }

  get(ref: string): Node {
    return this.store.readFile(this.idFor(this.requireUid(ref)));
  }

  resolve(ref: string): Node {
    return this.get(ref);
  }

  delete(nodeId: string): void {
    const uid = this.index.idToUid.get(nodeId);
    if (uid === undefined) throw new RefError(`no live node at ${JSON.stringify(nodeId)}`);
    const path = this.relPath(nodeId);
    this.executor.execute([{ op: "delete", path, expectedDigest: this.manifestDigest(path) }]);
    this.index.remove(uid);
    this.searchIndex.remove(uid);
    this.vectorIndex?.remove(uid);
    this.manifest.delete(path);
  }

  /** Accepted members, ordered by manifest path in Unicode code-point order. */
  all(): Node[] {
    return [...this.manifest.values()]
      .sort((a, b) => compareCodepoints(a.path, b.path))
      .map((m) => this.store.readFile(this.idFor(m.uid)));
  }

  idsByKind(kind: string): string[] {
    const ids: string[] = [];
    for (const entry of this.index.byUid.values()) {
      if (entry.kind === kind) ids.push(entry.id);
    }
    return ids.sort();
  }

  allByKind(kind: string): Node[] {
    return this.idsByKind(kind).map((id) => this.store.readFile(id));
  }

  outbound(ref: string): ResolvedEdge[] {
    return this.index.outboundEdges(this.requireUid(ref));
  }

  inbound(ref: string): ResolvedEdge[] {
    return this.index.inboundEdges(this.requireUid(ref));
  }

  neighbors(ref: string): Node[] {
    const uid = this.requireUid(ref);
    const neighborUids = new Set<string>();
    for (const edge of this.index.outboundEdges(uid)) {
      if (edge.targetUid !== null) neighborUids.add(edge.targetUid);
    }
    for (const edge of this.index.inboundEdges(uid)) {
      if (edge.sourceUid !== null) neighborUids.add(edge.sourceUid);
    }
    neighborUids.delete(uid);
    return [...neighborUids].sort(compareCodepoints).map((u) => this.store.readFile(this.idFor(u)));
  }

  private sortedLiveIds(uids: Iterable<string>): string[] {
    return [...uids].map((u) => this.idFor(u)).sort(compareCodepoints);
  }

  members(ref: string): string[] {
    return this.sortedLiveIds(this.index.membersOf(this.requireUid(ref)));
  }

  containers(ref: string): string[] {
    return this.sortedLiveIds(this.index.containersOf(this.requireUid(ref)));
  }

  rename(oldId: string, newId: string): Node {
    // 1. oldId must be a LIVE id (not unknown, not merely deprecated); then collision-check newId.
    const uid = this.index.idToUid.get(oldId);
    if (uid === undefined) throw new RefError(`rename source ${JSON.stringify(oldId)} is not a live id`);
    if (this.index.resolveUid(newId) !== null) {
      throw new CollisionError(`target id ${JSON.stringify(newId)} already in use`);
    }
    // Path admission before any preparation: a differently spelled same-key
    // destination is refused; the source's own exact mapped path is a replace.
    this.index.assertPathAvailable(uid, newId);
    const newRelPath = this.relPath(newId);
    const oldRelPath = this.relPath(oldId);
    this.assertNotReserved(newRelPath !== oldRelPath ? newRelPath : null, null, [newId]);

    // 2. Snapshot the referrer set BEFORE any index mutation (upsert rewrites inRefs).
    const referrerUids = new Set<string>();
    for (const inref of this.index.inRefs.get(oldId) ?? []) referrerUids.add(inref.sourceUid);

    // 3. Rewrite the renamed node itself (incl. its own oldId refs).
    const node = this.store.readFile(oldId);
    node.id = newId;
    node.kind = NodeId.parse(newId).kind;
    if (!node.deprecatedIds.includes(oldId)) node.deprecatedIds.push(oldId);
    rewriteRefs(node, oldId, newId);

    // 4. Rewrite every OTHER referrer in memory, in uid order (deterministic plan positions).
    const referrers: Node[] = [];
    for (const referrerUid of [...referrerUids].sort(compareCodepoints)) {
      if (referrerUid === uid) continue;
      const referrer = this.store.readFile(this.idFor(referrerUid));
      rewriteRefs(referrer, oldId, newId);
      referrers.push(referrer);
    }

    // 5. Validate ALL writes before ANY write (fail-early, no partial rename).
    if (this.registry !== undefined) {
      this.registry.validate(node);
      for (const referrer of referrers) this.registry.validate(referrer);
    }

    // 5b. Prepare the renamed node's + referrers' vectors (fail before any disk write).
    const prepared =
      this.vectorIndex !== undefined
        ? this.vectorIndex.prepare(node, this.embedder as Embedder, this.vectorCache as VectorCache)
        : undefined;
    const preparedReferrers =
      this.vectorIndex !== undefined
        ? referrers.map((r) =>
            (this.vectorIndex as VectorIndex).prepare(r, this.embedder as Embedder, this.vectorCache as VectorCache),
          )
        : [];

    // 6. Plan: create new → delete old → replace referrers.
    const nodeData = Buffer.from(nodeToMarkdown(node), "utf-8");
    const plan: WriteOp[] = [];
    if (newRelPath !== oldRelPath) {
      plan.push({ op: "create", path: newRelPath, content: nodeData });
      plan.push({ op: "delete", path: oldRelPath, expectedDigest: this.manifestDigest(oldRelPath) });
    } else {
      // ids differ but map to the same file: replace in place, nothing to delete
      plan.push({
        op: "replace",
        path: newRelPath,
        content: nodeData,
        expectedDigest: this.manifestDigest(oldRelPath),
      });
    }
    const referrerWrites: Array<{ path: string; data: Buffer }> = [];
    for (const referrer of referrers) {
      const rpath = this.relPath(referrer.id);
      const rdata = Buffer.from(nodeToMarkdown(referrer), "utf-8");
      plan.push({ op: "replace", path: rpath, content: rdata, expectedDigest: this.manifestDigest(rpath) });
      referrerWrites.push({ path: rpath, data: rdata });
    }

    // 7. Execute, then update in-memory state only after it returns.
    this.executor.execute(plan);
    this.index.upsert(node);
    this.searchIndex.upsert(node);
    if (this.vectorIndex !== undefined && prepared !== undefined) {
      this.vectorIndex.commit(node, prepared);
    }
    for (let i = 0; i < referrers.length; i++) {
      const referrer = referrers[i];
      this.index.upsert(referrer);
      this.searchIndex.upsert(referrer);
      if (this.vectorIndex !== undefined) this.vectorIndex.commit(referrer, preparedReferrers[i]);
    }
    if (newRelPath !== oldRelPath) this.manifest.delete(oldRelPath);
    this.recordManifest(newRelPath, nodeData, node.uid);
    for (let i = 0; i < referrers.length; i++) {
      this.recordManifest(referrerWrites[i].path, referrerWrites[i].data, referrers[i].uid);
    }
    return node;
  }

  /** Report corpus-validity findings; never throws on content. Construction findings
   * (collecting mode) come first. Registry violations
   * (configured or passed) are errors; unresolved top-level relation targets,
   * unresolved membership member refs and mapped-path collisions (a portability
   * hazard, registry or not) are warnings. Sorted by (ref, code, detail) —
   * `message` is human-only. */
  check(registry?: Registry): Finding[] {
    const reg = registry ?? this.registry;
    const findings: Finding[] = [...this.constructionFindings];
    if (reg !== undefined) {
      for (const node of this.all()) {
        for (const v of reg.check(node)) {
          findings.push({ severity: "error", code: v.code, ref: node.id, detail: v.detail, message: v.message });
        }
      }
    }
    for (const edge of this.index.danglingEdges()) {
      const rel = edge.relation;
      findings.push({
        severity: "warning",
        code: "dangling-ref",
        ref: rel.source,
        detail: rel.target,
        message:
          `${rel.source}: relation ${JSON.stringify(rel.predicate)} ` +
          `targets unresolved ${JSON.stringify(rel.target)}`,
      });
    }
    for (const { sourceUid, ref } of this.index.danglingMembers()) {
      const containerId = this.idFor(sourceUid);
      findings.push({
        severity: "warning",
        code: "dangling-member",
        ref: containerId,
        detail: ref,
        message: `${containerId}: member ${JSON.stringify(ref)} resolves to no live node`,
      });
    }
    for (const [liveId, key] of this.index.pathCollisions()) {
      findings.push({
        severity: "warning",
        code: "path-collision",
        ref: liveId,
        detail: key,
        message: `${liveId}: mapped path collides at ${JSON.stringify(key)}`,
      });
    }
    findings.sort(
      (a, b) =>
        compareCodepoints(a.ref, b.ref) || compareCodepoints(a.code, b.code) || compareCodepoints(a.detail, b.detail),
    );
    return findings;
  }

  search(query: string, limit?: number): SearchHit[] {
    return this.searchIndex.search(query, limit);
  }

  similar(ref: string, k?: number): SimilarHit[] {
    if (this.vectorIndex === undefined) {
      throw new EmbedderRequiredError("similarity requires Corpus(root, registry?, embedder)");
    }
    return this.vectorIndex.similar(this.requireUid(ref), k);
  }

  queryVector(vec: Vector, k?: number): SimilarHit[] {
    if (this.vectorIndex === undefined) {
      throw new EmbedderRequiredError("similarity requires Corpus(root, registry?, embedder)");
    }
    return this.vectorIndex.queryVector(vec, k);
  }

  similarText(text: string, k?: number): SimilarHit[] {
    if (this.vectorIndex === undefined) {
      throw new EmbedderRequiredError("similarity requires Corpus(root, registry?, embedder)");
    }
    return this.vectorIndex.similarText(text, this.embedder as Embedder, k);
  }
}
