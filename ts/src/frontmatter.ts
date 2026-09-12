import { parseDocument, stringify } from "yaml";
import { z } from "zod";
import { ValidationError } from "./errors.js";
import { type Node, makeNode } from "./node.js";
import { RELATES_TO, type Relation, fromSerialized, relatesTo, toSerialized } from "./relations.js";

const isString = (v: unknown): v is string => typeof v === "string";
const isMapping = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Convert the typed-key tree to plain objects, refusing any non-string mapping key at
 * any depth (Python refuses the same; object keys would otherwise stringify silently)
 * and any cyclic alias. `path` holds the containers being walked, so a container
 * reused on a sibling branch (a shared alias) is legal. Objects are built through
 * `Object.fromEntries`, which defines own properties only — an assignment would let a
 * `__proto__` key reach the prototype setter. */
function plain(value: unknown, path: Set<object> = new Set()): unknown {
  if (!(value instanceof Map) && !Array.isArray(value)) return value;
  if (path.has(value)) throw new ValidationError("malformed frontmatter: frontmatter contains a cyclic alias");
  path.add(value);
  let out: unknown;
  if (value instanceof Map) {
    const entries: Array<[string, unknown]> = [];
    for (const [key, item] of value) {
      if (typeof key !== "string") {
        throw new ValidationError(`malformed frontmatter: mapping key ${JSON.stringify(key)} must be a string`);
      }
      entries.push([key, plain(item, path)]);
    }
    out = Object.fromEntries(entries);
  } else {
    out = value.map((item) => plain(item, path));
  }
  path.delete(value);
  return out;
}

export function splitFrontmatter(text: string): [Record<string, unknown>, string] {
  let nl: string;
  if (text.startsWith("---\r\n")) nl = "\r\n";
  else if (text.startsWith("---\n")) nl = "\n";
  else return [{}, text];

  const rest = text.slice(3 + nl.length);
  const sep = `${nl}---${nl}`;
  const idx = rest.indexOf(sep);
  if (idx === -1) return [{}, text];

  const doc = parseDocument(rest.slice(0, idx));
  if (doc.errors.length > 0) {
    throw new ValidationError(`invalid frontmatter YAML: ${doc.errors[0].message}`);
  }
  let raw: unknown;
  try {
    // mapAsMap keeps key scalars typed, so a numeric key is visible; toJS also resolves
    // aliases and throws a raw ReferenceError on an undefined one — a document error.
    raw = doc.toJS({ mapAsMap: true });
  } catch (e) {
    throw new ValidationError(`invalid frontmatter YAML: ${(e as Error).message}`);
  }
  const fm = raw === null || raw === undefined ? {} : plain(raw);
  if (!isMapping(fm)) throw new ValidationError("malformed frontmatter: frontmatter must be a mapping");
  return [fm, rest.slice(idx + sep.length)];
}

export function nodeFromMarkdown(text: string): Node {
  const [fm, body] = splitFrontmatter(text);
  const missing = (["id", "uid", "kind", "title"] as const).filter((k) => !(k in fm));
  if (missing.length > 0) {
    throw new ValidationError(`frontmatter missing required field(s): ${JSON.stringify(missing)}`);
  }
  const nodeId = requireString(fm, "id");
  const relations: Relation[] = optionalList(fm, "related", isString, "strings").map((ref) => relatesTo(nodeId, ref));
  try {
    for (const row of optionalList(fm, "relations", isMapping, "mappings")) relations.push(fromSerialized(row, nodeId));
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new ValidationError(
        `malformed frontmatter: invalid relation in ${JSON.stringify(nodeId)}: ${e.issues.map((i) => i.message).join("; ")}`,
      );
    }
    throw e;
  }
  const facets = "facets" in fm ? fm.facets : {}; // absence defaults; null does not
  if (!isMapping(facets) || Object.values(facets).some((v) => !isMapping(v))) {
    throw new ValidationError("malformed frontmatter: 'facets' must be a mapping of mappings");
  }
  const metadata: Record<string, unknown> = {};
  for (const k of ["created", "updated"] as const) {
    if (!(k in fm)) continue;
    if (fm[k] === null) throw new ValidationError(`malformed frontmatter: '${k}' must be a YYYY-MM-DD date`);
    metadata[k] = fm[k];
  }
  if ("version" in fm) {
    if (typeof fm.version !== "number" || !Number.isInteger(fm.version)) {
      throw new ValidationError("malformed frontmatter: 'version' must be an integer");
    }
    metadata.version = fm.version;
  }
  return makeNode({
    id: nodeId,
    uid: requireString(fm, "uid"),
    kind: requireString(fm, "kind"),
    title: requireString(fm, "title"),
    body,
    metadata,
    relations,
    facets: facets as Record<string, Record<string, unknown>>,
    deprecatedIds: optionalList(fm, "deprecated_ids", isString, "strings"),
  });
}

function requireString(fm: Record<string, unknown>, name: string): string {
  const value = fm[name];
  if (typeof value !== "string") throw new ValidationError(`malformed frontmatter: '${name}' must be a string`);
  return value;
}

function optionalList<T>(fm: Record<string, unknown>, name: string, check: (v: unknown) => v is T, label: string): T[] {
  if (!(name in fm)) return [];
  const value = fm[name];
  if (!Array.isArray(value)) throw new ValidationError(`malformed frontmatter: '${name}' must be a list`);
  for (const item of value) {
    if (!check(item)) throw new ValidationError(`malformed frontmatter: '${name}' entries must be ${label}`);
  }
  return value as T[];
}

// Fatal on invalid UTF-8; the BOM is preserved so a BOM-prefixed document fails the
// `---`-at-byte-zero rule exactly as it does in Python.
const DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

export function nodeFromBytes(data: Uint8Array): Node {
  let text: string;
  try {
    text = DECODER.decode(data);
  } catch (e) {
    throw new ValidationError(`document is not valid UTF-8: ${(e as Error).message}`);
  }
  return nodeFromMarkdown(text);
}

function isPlainRelatesTo(rel: Relation, nodeId: string): boolean {
  return (
    rel.predicate === RELATES_TO &&
    rel.source === nodeId &&
    rel.directed === true &&
    rel.weight === null &&
    Object.keys(rel.attrs).length === 0
  );
}

export function nodeToMarkdown(node: Node): string {
  const fm: Record<string, unknown> = { id: node.id, uid: node.uid, kind: node.kind, title: node.title };
  if (node.metadata.created !== null) fm.created = node.metadata.created;
  if (node.metadata.updated !== null) fm.updated = node.metadata.updated;
  if (node.metadata.version !== 1) fm.version = node.metadata.version;

  const related = node.relations.filter((r) => isPlainRelatesTo(r, node.id)).map((r) => r.target);
  const typed = node.relations.filter((r) => !isPlainRelatesTo(r, node.id)).map((r) => toSerialized(r, node.id));
  if (related.length > 0) fm.related = related;
  if (typed.length > 0) fm.relations = typed;
  if (Object.keys(node.facets).length > 0) fm.facets = node.facets;
  if (node.deprecatedIds.length > 0) fm.deprecated_ids = node.deprecatedIds;

  const yamlText = stringify(fm, { sortMapEntries: false }).trimEnd();
  return `---\n${yamlText}\n---\n${node.body}`;
}
