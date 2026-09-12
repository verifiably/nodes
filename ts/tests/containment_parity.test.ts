import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Corpus } from "../src/corpus.js";
import { ContainmentError, ExecutionError, PlanRefusedError } from "../src/errors.js";
import { makeNode } from "../src/node.js";
import { writeJsonAtomic } from "../src/paths.js";
import { VectorCache } from "../src/similarity.js";
import { iterCorpusFiles } from "../src/snapshot.js";
import { Store } from "../src/store.js";
import { DefaultExecutor, type WriteOp } from "../src/write-plan.js";

const oracle = JSON.parse(
  readFileSync(join(fileURLToPath(new URL("../../fixtures", import.meta.url)), "containment.oracle.json"), "utf8"),
);
const ZERO = "0".repeat(64);
interface Case {
  name: string;
  root: "direct" | "symlink" | "missing";
  files?: Record<string, string>;
  setup_flush?: boolean;
  outside?: Record<string, string>;
  symlinks?: Record<string, string>;
  then_symlinks?: Record<string, string>;
  action: string;
  plan?: Array<{ op: string; path: string; content?: string; expected_digest?: string }>;
  id?: string;
  rel?: string;
  expect: { walk?: string[]; ok?: boolean; error?: string; index?: number; applied?: number };
  untouched?: string[];
  absent?: string[];
  present?: string[];
  contents?: Record<string, string>;
}
const symlinks = (() => {
  const p = mkdtempSync(join(tmpdir(), "nodes-symlink-probe-"));
  try {
    symlinkSync(join(p, "target"), join(p, "link"));
    return true;
  } catch (e) {
    if (process.platform === "win32" && (e as NodeJS.ErrnoException).code === "EPERM") return false;
    throw e;
  } finally {
    rmSync(p, { recursive: true, force: true });
  }
})();
let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "nodes-containment-"));
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));
const text = (s: string) => s.replaceAll("$node_a", oracle.node_a).replaceAll("$node_b", oracle.node_b);
const resolve = (s: string, real: string, outside: string) => {
  const i = s.indexOf(":");
  return join(s.slice(0, i) === "root" ? real : outside, s.slice(i + 1));
};
const lexists = (p: string) => {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
};
function links(xs: Record<string, string> | undefined, real: string, outside: string) {
  for (const [link, target] of Object.entries(xs ?? {})) {
    const p = join(real, link);
    mkdirSync(dirname(p), { recursive: true });
    symlinkSync(resolve(target, real, outside), p);
  }
}
function materialize(c: Case) {
  const outside = join(tmp, "outside");
  mkdirSync(outside);
  if (c.root === "missing") return { root: join(tmp, "absent"), real: join(tmp, "absent"), outside };
  const real = join(tmp, "real");
  mkdirSync(real);
  for (const [rel, value] of Object.entries(c.files ?? {})) {
    const p = join(real, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text(value as string));
  }
  if (c.setup_flush) new Corpus(real).flushIndex();
  for (const [rel, value] of Object.entries(c.outside ?? {})) {
    const p = join(outside, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text(value as string));
  }
  links(c.symlinks, real, outside);
  if (c.root === "symlink") {
    const root = join(tmp, "link-root");
    symlinkSync(real, root);
    return { root, real, outside };
  }
  return { root: real, real, outside };
}
function act(c: Case, root: string, real: string, outside: string, constructed: Corpus | null) {
  switch (c.action) {
    case "walk":
      return iterCorpusFiles(root).map((f) => f.path);
    case "construct":
      new Corpus(root);
      break;
    case "flush":
      new Corpus(root).flushIndex();
      break;
    case "construct-then-flush":
      links(c.then_symlinks, real, outside);
      if (constructed === null) throw new Error("construction phase missing");
      constructed.flushIndex();
      break;
    case "execute": {
      const plan: WriteOp[] = (c.plan ?? []).map((x) =>
        x.op === "create"
          ? { op: "create", path: x.path, content: new TextEncoder().encode(text(x.content ?? "")) }
          : x.op === "replace"
            ? {
                op: "replace",
                path: x.path,
                content: new TextEncoder().encode(text(x.content ?? "")),
                expectedDigest: x.expected_digest ?? ZERO,
              }
            : { op: "delete", path: x.path, expectedDigest: x.expected_digest ?? ZERO },
      );
      new DefaultExecutor(root).execute(plan);
      break;
    }
    case "store-read":
      new Store(root).readFile(c.id as string);
      break;
    case "store-write": {
      const id = c.id as string;
      new Store(root).writeFile(makeNode({ id, kind: id.split(":", 1)[0], title: "T" }));
      break;
    }
    case "store-delete":
      new Store(root).deleteFile(c.id as string);
      break;
    case "vector-put":
      new VectorCache(root).put("ns", ZERO, [0.5]);
      break;
    case "cache-write":
      writeJsonAtomic(root, c.rel as string, { x: 1 });
      break;
    default:
      throw new Error(c.action);
  }
  return null;
}
function checkError(name: string, e: unknown) {
  if (name === "ContainmentError") expect(e).toBeInstanceOf(ContainmentError);
  else if (name === "ExecutionError") expect(e).toBeInstanceOf(ExecutionError);
  else if (name === "PlanRefusedError") expect(e).toBeInstanceOf(PlanRefusedError);
  else if (name === "FilesystemError") expect(typeof (e as NodeJS.ErrnoException).code).toBe("string");
  else if (name === "ProgrammingError") expect(e).toBeInstanceOf(TypeError);
  else throw new Error(`unknown error name ${name}`);
}
describe("containment parity", () => {
  for (const c of oracle.cases)
    it.skipIf((c.root === "symlink" || c.symlinks || c.then_symlinks) && !symlinks)(c.name, () => {
      const { root, real, outside } = materialize(c);
      const constructed = c.action === "construct-then-flush" ? new Corpus(root) : null;
      const before = Object.fromEntries(
        (c.untouched ?? [])
          .filter((s: string) => existsSync(resolve(s, real, outside)))
          .map((s: string) => [s, readFileSync(resolve(s, real, outside))]),
      );
      if (c.expect.error) {
        let caught: unknown;
        try {
          act(c, root, real, outside, constructed);
        } catch (e) {
          caught = e;
        }
        expect(caught).toBeDefined();
        checkError(c.expect.error, caught);
        if (c.expect.index !== undefined) expect((caught as ExecutionError).index).toBe(c.expect.index);
        if (c.expect.applied !== undefined) expect((caught as ExecutionError).applied).toBe(c.expect.applied);
      } else {
        const walked = act(c, root, real, outside, constructed);
        if (c.expect.walk) expect(walked).toEqual(c.expect.walk);
      }
      expect(Object.fromEntries(Object.keys(before).map((s) => [s, readFileSync(resolve(s, real, outside))]))).toEqual(
        before,
      );
      for (const s of c.absent ?? []) expect(lexists(resolve(s, real, outside))).toBe(false);
      for (const s of c.present ?? []) expect(lexists(resolve(s, real, outside))).toBe(true);
      for (const [s, text] of Object.entries(c.contents ?? {})) {
        expect(readFileSync(resolve(s, real, outside), "utf-8")).toBe(text);
      }
    });
});
