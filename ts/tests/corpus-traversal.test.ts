import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Corpus } from "../src/corpus.js";
import { RefError } from "../src/errors.js";
import { makeNode } from "../src/node.js";
import { relatesTo } from "../src/relations.js";
import { MEMBERSHIP } from "../src/shapes.js";

function tmpRoot(): string {
  return mkdtempSync(join(tmpdir(), "nodes-traversal-"));
}

function setNode(id: string, members: string[]) {
  return makeNode({ id, kind: "set", title: id, facets: { [MEMBERSHIP]: { members } } });
}

/** Registry-free corpus mirroring the fixture cluster: crate ⊃ box ⊃ {tidy, renamed};
 * box lists renamed under its deprecated id; crate lists a dangling note:ghost. */
function seeded(): Corpus {
  const c = new Corpus(tmpRoot());
  c.add(makeNode({ id: "note:renamed", kind: "note", title: "R", deprecatedIds: ["note:old-name"] }));
  c.add(makeNode({ id: "note:tidy", kind: "note", title: "T" }));
  c.add(setNode("set:box", ["note:tidy", "note:old-name"]));
  c.add(setNode("set:crate", ["set:box", "note:ghost"]));
  return c;
}

describe("Corpus — membership traversal", () => {
  it("members skips dangling refs", () => {
    expect(seeded().members("set:crate")).toEqual(["set:box"]);
  });

  it("members resolves deprecated member refs to sorted live ids", () => {
    expect(seeded().members("set:box")).toEqual(["note:renamed", "note:tidy"]);
  });

  it("members of a facet-less node is empty", () => {
    expect(seeded().members("note:tidy")).toEqual([]);
  });

  it("containers resolves a deprecated input ref", () => {
    expect(seeded().containers("note:old-name")).toEqual(["set:box"]);
  });

  it("containers reports direct containers only", () => {
    expect(seeded().containers("set:box")).toEqual(["set:crate"]);
  });

  it("containment cycles are legal one hop", () => {
    const c = new Corpus(tmpRoot());
    c.add(setNode("set:loop-a", ["set:loop-b"]));
    c.add(setNode("set:loop-b", ["set:loop-a"]));
    c.add(setNode("set:selfie", ["set:selfie"]));
    expect(c.members("set:loop-a")).toEqual(["set:loop-b"]);
    expect(c.containers("set:loop-a")).toEqual(["set:loop-b"]);
    expect(c.members("set:selfie")).toEqual(["set:selfie"]);
    expect(c.containers("set:selfie")).toEqual(["set:selfie"]);
  });

  it("both methods reject an unresolvable input ref", () => {
    const c = seeded();
    for (const fn of ["members", "containers"] as const) {
      expect(() => c[fn]("note:ghost")).toThrow(RefError);
    }
  });
});

it("orders neighbor nodes by uid code points before and after reload", () => {
  // U+E000 and U+10000 sort oppositely under UTF-16 code units; code points are the contract.
  const root = mkdtempSync(join(tmpdir(), "nodes-neighbors-"));
  const c = new Corpus(root);
  for (const [slug, uid] of [
    ["bmp", "\uE000"],
    ["nonbmp", "\u{10000}"],
  ]) {
    c.add(makeNode({ id: `kind:${slug}`, uid, kind: "kind", title: slug }));
  }
  c.add(
    makeNode({
      id: "kind:center",
      uid: "center",
      kind: "kind",
      title: "Center",
      relations: [relatesTo("kind:center", "kind:nonbmp"), relatesTo("kind:center", "kind:bmp")],
    }),
  );
  expect(c.neighbors("kind:center").map((n) => n.uid)).toEqual(["\uE000", "\u{10000}"]);
  c.flushIndex();
  expect(new Corpus(root).neighbors("kind:center").map((n) => n.uid)).toEqual(["\uE000", "\u{10000}"]);
});
