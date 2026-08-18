import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Corpus } from "../src/corpus.js";
import { nodeFromMarkdown } from "../src/frontmatter.js";
import type { WritePlan } from "../src/write-plan.js";
import { toCanonical } from "./_canonical.js";
import { RecordingExecutor } from "./_executors.js";

const FIXTURES = fileURLToPath(new URL("../../fixtures/", import.meta.url));

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "nodes-write-plan-parity-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** Plan-equality projection (design §2): op kinds, paths, and expected_digest
 * compare position-wise; content compares as its canonical JSON projection. */
function projectPlan(plan: WritePlan): unknown[] {
  return plan.map((op) => {
    const row: Record<string, unknown> = { op: op.op, path: op.path };
    if (op.op !== "delete") {
      row.content = toCanonical(nodeFromMarkdown(Buffer.from(op.content).toString("utf-8")));
    }
    if (op.op !== "create") row.expected_digest = op.expectedDigest;
    return row;
  });
}

describe("cross-language write-plan parity", () => {
  it("the TS rename plan over the fixture corpus matches the shared oracle", () => {
    cpSync(join(FIXTURES, "corpus"), root, { recursive: true });
    const captured: RecordingExecutor[] = [];
    const c = new Corpus(root, undefined, undefined, (r) => {
      const ex = new RecordingExecutor(r);
      captured.push(ex);
      return ex;
    });
    c.rename("topic:old", "topic:new");
    expect(captured[0].plans).toHaveLength(1);
    const oracle = JSON.parse(readFileSync(join(FIXTURES, "write-plan.rename.canonical.json"), "utf-8"));
    expect(projectPlan(captured[0].plans[0])).toEqual(oracle);
  });
});
