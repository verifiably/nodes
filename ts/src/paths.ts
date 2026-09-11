/** Path rules shared by the walk, the write plan, the store, and the caches.
 * Imports only `ids` and `errors`, so `snapshot` and `similarity` can both depend on it. */
import { type Stats, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ContainmentError } from "./errors.js";
import { NodeId } from "./ids.js";

export const RESERVED_NAMESPACE = ".nodes-index";

export function pathForNodeId(nodeId: string): string {
  const nid = NodeId.parse(nodeId);
  return `${nid.kind}/${nid.slug.replaceAll(":", "__")}.md`;
}

export function pathCollisionKey(nodeId: string): string {
  // Valid ids are ASCII; NFC is identity and lowercase equals casefold.
  return pathForNodeId(nodeId).toLowerCase();
}

/** The lexical rule for instruction and cache paths: split on `/` only,
 * no empty/`.`/`..` segment, no segment carrying `\` or `:` (a canonical segment never
 * does — `pathForNodeId` maps `:` to `__`), and the required suffix. */
export function isPortableRelativePath(path: string, suffix: string | null = ".md"): boolean {
  if (path === "" || path.startsWith("/")) return false;
  const segments = path.split("/");
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") return false;
    if (segment.includes("\\") || segment.includes(":")) return false;
  }
  if (suffix !== null && !segments[segments.length - 1].endsWith(suffix)) return false;
  return true;
}

/** Refuse (`ContainmentError`) when any prefix of `relPath` below `root` is a symlink or
 * cannot be inspected. An absent prefix is tolerated: nothing below it exists either.
 * The root itself may be a symlink; it is not inspected. */
export function assertContained(root: string, relPath: string): void {
  if (!isPortableRelativePath(relPath, null)) {
    throw new TypeError(`not a portable root-relative path: ${JSON.stringify(relPath)}`);
  }
  let current = root;
  for (const segment of relPath.split("/")) {
    current = join(current, segment);
    let st: Stats;
    try {
      st = lstatSync(current);
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return;
      throw new ContainmentError(
        `cannot inspect ${JSON.stringify(relPath)} at ${JSON.stringify(segment)}: ${err.message}`,
      );
    }
    if (st.isSymbolicLink()) {
      throw new ContainmentError(`symlink at ${JSON.stringify(segment)} on ${JSON.stringify(relPath)}`);
    }
  }
}

export function assertCachePath(relPath: string): void {
  if (!isPortableRelativePath(relPath, ".json")) {
    throw new TypeError(`not a portable cache path: ${JSON.stringify(relPath)}`);
  }
  const segments = relPath.split("/");
  if (segments[0] !== RESERVED_NAMESPACE || segments.length < 2) {
    throw new TypeError(`cache path must be strictly beneath ${RESERVED_NAMESPACE}/: ${JSON.stringify(relPath)}`);
  }
}

export function readJson(root: string, relPath: string): unknown {
  assertCachePath(relPath);
  assertContained(root, relPath);
  let raw: string;
  try {
    raw = readFileSync(join(root, relPath), "utf-8");
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return null;
    throw err;
  }
  const doc: unknown = JSON.parse(raw);
  if (doc === null) throw new TypeError(`cache document ${JSON.stringify(relPath)} is null`);
  return doc;
}

export function writeJsonAtomic(root: string, relPath: string, obj: unknown): void {
  assertCachePath(relPath);
  assertContained(root, relPath);
  assertContained(root, `${relPath}.tmp`);
  const payload = JSON.stringify(obj, (_key, value) => {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new RangeError("cannot serialize non-finite number to JSON");
    }
    return value;
  });
  const path = join(root, relPath);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, payload, "utf-8");
  renameSync(tmp, path);
}
