import { createHash } from "node:crypto";
import { type Dirent, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { ContainmentError } from "./errors.js";
import { NodeId } from "./ids.js";
import { RESERVED_NAMESPACE, isPortableRelativePath, readJson, writeJsonAtomic } from "./paths.js";
import { SearchIndex, compareCodepoints } from "./search.js";
import { VectorIndex } from "./similarity.js";
import { Index } from "./structural-index.js";

export const SNAPSHOT_SCHEMA_VERSION = 1;
export const SNAPSHOT_LANG = "ts";
export const SNAPSHOT_REL_PATH = `${RESERVED_NAMESPACE}/snapshot.ts.json`;
export { readJson, writeJsonAtomic };

const SHA256_RE = /^[0-9a-f]{64}$/;
const SNAPSHOT_KEYS = ["version", "lang", "manifest", "structural", "search", "vectors"];
const MANIFEST_ROW_KEYS = ["path", "sha256", "uid"];

export function snapshotPath(root: string): string {
  return join(root, SNAPSHOT_REL_PATH);
}

export function hashBytes(data: Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export interface CorpusFile {
  readonly path: string; // root-relative POSIX
  readonly data: Buffer;
  readonly sha256: string;
}

export interface CorpusFileStat {
  readonly path: string;
  readonly mtimeMs: number;
  readonly size: number;
}

export interface CorpusFingerprint {
  readonly files: readonly CorpusFileStat[];
}

interface WalkedCorpusPath {
  readonly path: string;
  readonly fullPath: string;
}

/** Root-relative POSIX path (forward slashes on every platform), the cross-language form. */
function relPosix(root: string, full: string): string {
  return relative(root, full).split(sep).join("/");
}

function listCorpusMarkdownPaths(root: string): WalkedCorpusPath[] {
  const files: WalkedCorpusPath[] = [];
  const walk = (dir: string, atRoot: boolean): void => {
    const entries: Dirent[] = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (atRoot && entry.name === RESERVED_NAMESPACE) continue;
        walk(full, false);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push({ path: relPosix(root, full), fullPath: full });
      }
    }
  };
  walk(root, true);
  files.sort((a, b) => compareCodepoints(a.path, b.path));
  return files;
}

/** Byte-level walk: read each .md file's bytes once and hash them. Skips the private
 * `.nodes-index` tree, symlinks, and non-files. Sorted by root-relative POSIX path so the
 * order matches Python's `sorted(root.rglob("*.md"))`. */
export function iterCorpusFiles(root: string): CorpusFile[] {
  return listCorpusMarkdownPaths(root).map(({ path, fullPath }) => {
    const data = readFileSync(fullPath);
    return { path, data, sha256: hashBytes(data) };
  });
}

/** Stat-level walk over the same corpus file set as `iterCorpusFiles`. Does not read file bodies. */
export function listCorpusFileStats(root: string): CorpusFileStat[] {
  return listCorpusMarkdownPaths(root).map(({ path, fullPath }) => {
    const stat = statSync(fullPath);
    return { path, mtimeMs: stat.mtimeMs, size: stat.size };
  });
}

/** Cheap external-change fingerprint for resident consumers. Not a content-identity hash. */
export function readCorpusFingerprint(root: string): CorpusFingerprint {
  return { files: listCorpusFileStats(root) };
}

export function sameCorpusFingerprint(a: CorpusFingerprint, b: CorpusFingerprint): boolean {
  if (a.files.length !== b.files.length) return false;
  for (let i = 0; i < a.files.length; i++) {
    const left = a.files[i];
    const right = b.files[i];
    if (left.path !== right.path || left.mtimeMs !== right.mtimeMs || left.size !== right.size) return false;
  }
  return true;
}

export interface ManifestEntry {
  readonly path: string;
  readonly sha256: string;
  readonly uid: string;
}

export interface Snapshot {
  manifest: ManifestEntry[];
  index: Index;
  searchIndex: SearchIndex;
  vectorIndex: VectorIndex | null;
}

export function pathForNodeId(nodeId: string): string {
  const nid = NodeId.parse(nodeId);
  return `${nid.kind}/${nid.slug.replace(/:/g, "__")}.md`;
}

export function writeSnapshot(
  root: string,
  manifest: ManifestEntry[],
  index: Index,
  searchIndex: SearchIndex,
  vectorIndex: VectorIndex | undefined,
): void {
  const doc = {
    version: SNAPSHOT_SCHEMA_VERSION,
    lang: SNAPSHOT_LANG,
    manifest: manifest.map((m) => ({ path: m.path, sha256: m.sha256, uid: m.uid })),
    structural: index.toDict(),
    search: searchIndex.toDict(),
    vectors: vectorIndex !== undefined ? vectorIndex.toDict() : null,
  };
  writeJsonAtomic(root, SNAPSHOT_REL_PATH, doc);
}

function validateManifestPath(path: string): void {
  if (!isPortableRelativePath(path) || path.split("/", 1)[0] === RESERVED_NAMESPACE) {
    throw new Error("snapshot manifest row path must be a portable root-relative .md path");
  }
}

function parseManifest(raw: unknown): ManifestEntry[] {
  if (!Array.isArray(raw)) throw new Error("snapshot manifest is not an array");
  const entries: ManifestEntry[] = [];
  for (const e of raw) {
    if (typeof e !== "object" || e === null) throw new Error("snapshot manifest row is not an object");
    const row = e as Record<string, unknown>;
    for (const key of MANIFEST_ROW_KEYS) {
      if (!(key in row)) throw new Error(`snapshot manifest row missing ${key}`);
    }
    const { path, sha256, uid } = row;
    if (typeof path !== "string") throw new Error("snapshot manifest row path must be a string");
    validateManifestPath(path);
    if (typeof sha256 !== "string") throw new Error("snapshot manifest row sha256 must be a string");
    if (!SHA256_RE.test(sha256)) throw new Error("snapshot manifest row sha256 must be 64 lowercase hex chars");
    if (typeof uid !== "string") throw new Error("snapshot manifest row uid must be a string");
    entries.push({ path, sha256, uid });
  }
  if (new Set(entries.map((m) => m.uid)).size !== entries.length) throw new Error("snapshot manifest: duplicate uid");
  if (new Set(entries.map((m) => m.path)).size !== entries.length) throw new Error("snapshot manifest: duplicate path");
  return entries;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

function mapsEqual(a: Map<string, string>, b: Map<string, string>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

/** Reads and validates ONLY the cache file. Returns null for any cache problem (missing file,
 * invalid JSON, version/lang mismatch, integrity failure, embedder-configured vector mismatch).
 * Never parses corpus files, so it can never raise a corpus error — any throw here is a cache
 * problem and resolves to a silent full rebuild upstream. */
export function loadSnapshot(root: string, embedderNamespace: string | null): Snapshot | null {
  try {
    const doc = readJson(root, SNAPSHOT_REL_PATH);
    if (doc === null) return null;
    if (typeof doc !== "object") return null;
    const d = doc as Record<string, unknown>;
    for (const key of SNAPSHOT_KEYS) {
      if (!(key in d)) throw new Error(`snapshot document missing ${key}`);
    }
    if (d.version !== SNAPSHOT_SCHEMA_VERSION || d.lang !== SNAPSHOT_LANG) return null;

    const manifest = parseManifest(d.manifest);
    const manifestUids = new Set(manifest.map((m) => m.uid));

    const index = Index.fromDict(d.structural);
    if (!setsEqual(new Set(index.byUid.keys()), manifestUids)) return null;
    const expectedIds = new Map<string, string>();
    for (const [uid, entry] of index.byUid) expectedIds.set(uid, entry.id);
    for (const m of manifest) {
      if (m.path !== pathForNodeId(expectedIds.get(m.uid) as string)) {
        throw new Error("snapshot manifest path does not match structural id");
      }
    }

    const searchIndex = SearchIndex.fromDict(d.search);
    if (!setsEqual(new Set(searchIndex.lengths.keys()), manifestUids)) return null;
    if (!mapsEqual(searchIndex.idByUid, expectedIds)) return null;

    let vectorIndex: VectorIndex | null = null;
    if (embedderNamespace !== null) {
      const vec = d.vectors;
      if (typeof vec !== "object" || vec === null) return null;
      if ((vec as Record<string, unknown>).namespace !== embedderNamespace) return null;
      vectorIndex = VectorIndex.fromDict(vec);
      if (!setsEqual(new Set(vectorIndex.vectors.keys()), manifestUids)) return null;
      if (!mapsEqual(vectorIndex.idByUid, expectedIds)) return null;
    }

    return { manifest, index, searchIndex, vectorIndex };
  } catch (e) {
    if (e instanceof ContainmentError) throw e;
    // loadSnapshot only ever reads the cache file, so any thrown Error is a cache problem
    // (absent/locked file, malformed JSON, failed integrity check) -> rebuild. This is the
    // closest faithful mirror of Python's `except (OSError, ValueError)`: every cache-unusable
    // signal here surfaces as an Error subclass, while JS's error taxonomy gives no class-based
    // way to separate them further. A non-Error throw is not a cache signal — rethrow it.
    if (!(e instanceof Error)) throw e;
    return null;
  }
}
