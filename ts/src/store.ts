import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { RefError } from "./errors.js";
import { nodeFromMarkdown, nodeToMarkdown } from "./frontmatter.js";
import { NodeId } from "./ids.js";
import type { Node } from "./node.js";
import { iterCorpusFiles } from "./snapshot.js";

/**
 * Pure file mechanics over a corpus directory. No cross-corpus logic.
 * Collision detection, ref resolution, and rename live in `Corpus`/`Index`.
 */
export class Store {
  readonly root: string;
  private parsed = new Map<string, Node>(); // sha256 -> node, rebuilt by every allNodes()

  constructor(root: string) {
    this.root = root;
  }

  pathFor(nodeId: string): string {
    const nid = NodeId.parse(nodeId);
    return join(this.root, nid.kind, `${nid.slug.replace(/:/g, "__")}.md`);
  }

  writeFile(node: Node): string {
    const path = this.pathFor(node.id);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, nodeToMarkdown(node), "utf-8");
    return path;
  }

  readFile(nodeId: string): Node {
    const path = this.pathFor(nodeId);
    if (!(existsSync(path) && statSync(path).isFile())) {
      throw new RefError(`no node at ${JSON.stringify(nodeId)}`);
    }
    return nodeFromMarkdown(readFileSync(path, "utf-8"));
  }

  deleteFile(nodeId: string): void {
    const path = this.pathFor(nodeId);
    if (!(existsSync(path) && statSync(path).isFile())) {
      throw new RefError(`no node at ${JSON.stringify(nodeId)}`);
    }
    rmSync(path);
  }

  /**
   * Every node file, read and hashed on each call so files stay the source of truth.
   * Parsing is skipped for content whose sha256 was parsed by the previous call; each
   * caller gets its own copy, so the memo is never aliased.
   */
  allNodes(): Node[] {
    const parsed = new Map<string, Node>();
    const nodes = iterCorpusFiles(this.root).map((f) => {
      const node = this.parsed.get(f.sha256) ?? nodeFromMarkdown(f.data.toString("utf-8"));
      parsed.set(f.sha256, node);
      return structuredClone(node);
    });
    this.parsed = parsed;
    return nodes;
  }
}
