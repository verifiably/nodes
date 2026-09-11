import { type Stats, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { RefError } from "./errors.js";
import { nodeFromMarkdown, nodeToMarkdown } from "./frontmatter.js";
import type { Node } from "./node.js";
import { assertContained } from "./paths.js";
import { hashBytes, listCorpusFileStats, pathForNodeId } from "./snapshot.js";

interface CachedFile {
  readonly mtimeMs: number;
  readonly size: number;
  readonly sha256: string;
  readonly node: Node;
}

/**
 * Pure file mechanics over a corpus directory. No cross-corpus logic.
 * Collision detection, ref resolution, and rename live in `Corpus`/`Index`.
 *
 * Reads are served through a per-path cache keyed by the file's stat fingerprint
 * (mtime + size), the same signal `readCorpusFingerprint` uses for change detection.
 * A file whose fingerprint matches is not read; one whose fingerprint changed is read
 * and hashed, and re-parsed only if its bytes changed. The store's own writes and
 * deletes update the cache, and every result is a copy, so cached nodes are never aliased.
 */
export class Store {
  readonly root: string;
  private cache = new Map<string, CachedFile>(); // posix relative path -> cached parse

  constructor(root: string) {
    this.root = root;
  }

  pathFor(nodeId: string): string {
    return join(this.root, pathForNodeId(nodeId));
  }

  writeFile(node: Node): string {
    const rel = pathForNodeId(node.id);
    assertContained(this.root, rel);
    const path = join(this.root, rel);
    mkdirSync(dirname(path), { recursive: true });
    const data = Buffer.from(nodeToMarkdown(node), "utf-8");
    writeFileSync(path, data);
    const stat = statSync(path);
    this.cache.set(rel, {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      sha256: hashBytes(data),
      node: structuredClone(node),
    });
    return path;
  }

  readFile(nodeId: string): Node {
    const rel = pathForNodeId(nodeId);
    assertContained(this.root, rel);
    const path = join(this.root, rel);
    let stat: Stats;
    try {
      stat = statSync(path);
    } catch {
      throw new RefError(`no node at ${JSON.stringify(nodeId)}`);
    }
    if (!stat.isFile()) throw new RefError(`no node at ${JSON.stringify(nodeId)}`);
    const entry = this.load(rel, stat);
    this.cache.set(rel, entry);
    return structuredClone(entry.node);
  }

  deleteFile(nodeId: string): void {
    const rel = pathForNodeId(nodeId);
    assertContained(this.root, rel);
    const path = join(this.root, rel);
    let stat: Stats;
    try {
      stat = statSync(path);
    } catch {
      throw new RefError(`no node at ${JSON.stringify(nodeId)}`);
    }
    if (!stat.isFile()) throw new RefError(`no node at ${JSON.stringify(nodeId)}`);
    rmSync(path);
    this.cache.delete(rel);
  }

  /**
   * Every node file, in path order. Files are stat'ed on each call so external edits and
   * deletes show; only files whose stat fingerprint changed are read. The cache is rebuilt
   * from the walk, so files that disappeared drop out. Each caller gets its own copy.
   */
  allNodes(): Node[] {
    const next = new Map<string, CachedFile>();
    const nodes = listCorpusFileStats(this.root).map((stat) => {
      const entry = this.load(stat.path, stat);
      next.set(stat.path, entry);
      return structuredClone(entry.node);
    });
    this.cache = next;
    return nodes;
  }

  private load(rel: string, stat: { mtimeMs: number; size: number }): CachedFile {
    const cached = this.cache.get(rel);
    if (cached !== undefined && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached;
    const data = readFileSync(join(this.root, rel));
    const sha256 = hashBytes(data);
    const node = cached?.sha256 === sha256 ? cached.node : nodeFromMarkdown(data.toString("utf-8"));
    return { mtimeMs: stat.mtimeMs, size: stat.size, sha256, node };
  }
}
