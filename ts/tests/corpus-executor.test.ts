import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Corpus } from "../src/corpus.js";
import { CollisionError, ExecutionError } from "../src/errors.js";
import { nodeToMarkdown } from "../src/frontmatter.js";
import { type Node, makeNode } from "../src/node.js";
import { relatesTo } from "../src/relations.js";
import {
  DefaultExecutor,
  type ReplaceOp,
  type WriteOp,
  type WritePlan,
  type WritePlanExecutor,
} from "../src/write-plan.js";

class RecordingExecutor implements WritePlanExecutor {
  readonly inner: DefaultExecutor;
  readonly plans: WriteOp[][] = [];

  constructor(root: string) {
    this.inner = new DefaultExecutor(root);
  }

  execute(plan: WritePlan): void {
    this.plans.push([...plan]);
    this.inner.execute(plan);
  }
}

class RefusingExecutor implements WritePlanExecutor {
  execute(_plan: WritePlan): void {
    throw new ExecutionError("refused", null, 0);
  }
}

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "nodes-corpus-executor-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function recordingCorpus(): { c: Corpus; ex: RecordingExecutor } {
  const captured: RecordingExecutor[] = [];
  const c = new Corpus(root, undefined, undefined, (r) => {
    const ex = new RecordingExecutor(r);
    captured.push(ex);
    return ex;
  });
  return { c, ex: captured[0] };
}

function docBytes(node: Node): Buffer {
  return Buffer.from(nodeToMarkdown(node), "utf-8");
}

function sha(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

describe("Corpus × WritePlanExecutor", () => {
  it("calls the factory with the corpus root", () => {
    const seen: string[] = [];
    new Corpus(root, undefined, undefined, (r) => {
      seen.push(r);
      return new DefaultExecutor(r);
    });
    expect(seen).toEqual([root]);
  });

  it("constructs DefaultExecutor(root) when the factory is omitted", () => {
    const c = new Corpus(root);
    expect(c.executor).toBeInstanceOf(DefaultExecutor);
    expect((c.executor as DefaultExecutor).root).toBe(root);
  });

  it("add of an unseen (uid,id) pair executes a single create", () => {
    const { c, ex } = recordingCorpus();
    const node = makeNode({ id: "topic:a", kind: "topic", title: "A" });
    c.add(node);
    expect(ex.plans).toHaveLength(1);
    const [op] = ex.plans[0];
    expect(op.op).toBe("create");
    expect(op.path).toBe("topic/a.md");
    expect(op).toHaveProperty("content", docBytes(node));
  });

  it("add of a matching (uid,id) pair executes a replace with the prior disk digest", () => {
    const { c, ex } = recordingCorpus();
    const node = makeNode({ id: "topic:a", kind: "topic", title: "A" });
    c.add(node);
    const prior = docBytes(node);
    node.title = "A2";
    c.add(node);
    const [op] = ex.plans[1];
    expect(op.op).toBe("replace");
    expect(op.path).toBe("topic/a.md");
    expect((op as ReplaceOp).expectedDigest).toBe(sha(prior));
    expect(c.get("topic:a").title).toBe("A2");
  });

  it("delete executes a delete with the disk digest", () => {
    const { c, ex } = recordingCorpus();
    const node = makeNode({ id: "topic:a", kind: "topic", title: "A" });
    c.add(node);
    c.delete("topic:a");
    const [op] = ex.plans[1];
    expect(op.op).toBe("delete");
    expect(op.path).toBe("topic/a.md");
    expect(op).toHaveProperty("expectedDigest", sha(docBytes(node)));
  });

  it("rename executes create → delete → referrer replaces", () => {
    const { c, ex } = recordingCorpus();
    const old = makeNode({ id: "topic:old", kind: "topic", title: "T" });
    c.add(old);
    const r = makeNode({ id: "note:r", kind: "note", title: "R", relations: [relatesTo("note:r", "topic:old")] });
    c.add(r);
    const oldBytes = docBytes(old);
    const rBytes = docBytes(r);

    c.rename("topic:old", "topic:new");

    const plan = ex.plans[2];
    expect(plan.map((op) => op.op)).toEqual(["create", "delete", "replace"]);
    expect(plan[0].path).toBe("topic/new.md");
    expect(plan[1].path).toBe("topic/old.md");
    expect(plan[1]).toHaveProperty("expectedDigest", sha(oldBytes));
    expect(plan[2].path).toBe("note/r.md");
    expect(plan[2]).toHaveProperty("expectedDigest", sha(rBytes));
  });

  it("orders referrer replaces by uid for deterministic plan positions", () => {
    const { c, ex } = recordingCorpus();
    c.add(makeNode({ id: "topic:old", kind: "topic", title: "T", uid: "9".repeat(32) }));
    c.add(
      makeNode({
        id: "note:b",
        kind: "note",
        title: "B",
        uid: "2".repeat(32),
        relations: [relatesTo("note:b", "topic:old")],
      }),
    );
    c.add(
      makeNode({
        id: "note:a",
        kind: "note",
        title: "A",
        uid: "1".repeat(32),
        relations: [relatesTo("note:a", "topic:old")],
      }),
    );
    c.rename("topic:old", "topic:new");
    const replaces = ex.plans[3].filter((op) => op.op === "replace");
    expect(replaces.map((op) => op.path)).toEqual(["note/a.md", "note/b.md"]);
  });

  it("collision refusal never reaches the executor", () => {
    const { c, ex } = recordingCorpus();
    c.add(makeNode({ id: "topic:a", kind: "topic", title: "A" }));
    expect(() => c.add(makeNode({ id: "topic:a", kind: "topic", title: "Other" }))).toThrow(CollisionError);
    expect(ex.plans).toHaveLength(1);
  });

  it("updates in-memory state only after execute returns", () => {
    const c = new Corpus(root, undefined, undefined, () => new RefusingExecutor());
    expect(() => c.add(makeNode({ id: "topic:a", kind: "topic", title: "A" }))).toThrow(ExecutionError);
    expect(c.index.resolveUid("topic:a")).toBeNull();
    expect(c.manifest.size).toBe(0);
    expect(existsSync(join(root, "topic"))).toBe(false);
  });

  it("flushIndex does not route through the executor", () => {
    const { c, ex } = recordingCorpus();
    c.add(makeNode({ id: "topic:a", kind: "topic", title: "A" }));
    const before = ex.plans.length;
    c.flushIndex();
    expect(ex.plans).toHaveLength(before);
    expect(existsSync(join(root, ".nodes-index", "snapshot.ts.json"))).toBe(true);
  });
});
