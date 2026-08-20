import canonicalize from "canonicalize";
import { ValidationError } from "./errors.js";
import type { Node } from "./node.js";

export const PROJECTION_VERSION = "projection.v1" as const;
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export function toCanonical(node: Node): JsonValue {
  const value: unknown = {
    id: node.id,
    uid: node.uid,
    kind: node.kind,
    title: node.title,
    body: node.body,
    metadata: {
      created: node.metadata.created,
      updated: node.metadata.updated,
      version: node.metadata.version,
    },
    relations: node.relations.map((relation) => ({
      source: relation.source,
      predicate: relation.predicate,
      target: relation.target,
      directed: relation.directed,
      weight: relation.weight,
      attrs: relation.attrs,
    })),
    facets: node.facets,
    deprecated_ids: node.deprecatedIds,
  };
  assertJsonValue(value);
  return value;
}

function assertJsonValue(value: unknown, active = new Set<object>()): asserts value is JsonValue {
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") {
    if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) {
      throw new ValidationError("node cannot be represented as projection.v1 canonical JSON: lone surrogate");
    }
    return;
  }
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new ValidationError("node cannot be represented as projection.v1 canonical JSON: non-finite number");
  }
  if (Array.isArray(value)) {
    if (active.has(value)) {
      throw new ValidationError("node cannot be represented as projection.v1 canonical JSON: cyclic value");
    }
    active.add(value);
    for (const member of value) assertJsonValue(member, active);
    active.delete(value);
    return;
  }
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    if (active.has(value)) {
      throw new ValidationError("node cannot be represented as projection.v1 canonical JSON: cyclic value");
    }
    active.add(value);
    for (const [key, member] of Object.entries(value)) {
      assertJsonValue(key, active);
      assertJsonValue(member, active);
    }
    active.delete(value);
    return;
  }
  throw new ValidationError(`node cannot be represented as projection.v1 canonical JSON: ${typeof value}`);
}

export function toCanonicalJson(node: Node): string {
  const value = toCanonical(node);
  try {
    const text = canonicalize(value);
    if (text === undefined) throw new Error("canonicalizer returned undefined");
    return text;
  } catch (caught) {
    throw new ValidationError(`node cannot be represented as projection.v1 canonical JSON: ${String(caught)}`);
  }
}
