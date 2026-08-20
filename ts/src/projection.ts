import canonicalize from "canonicalize";
import { ValidationError } from "./errors.js";
import type { Node } from "./node.js";

export const PROJECTION_VERSION = "projection.v1" as const;
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export function toCanonical(node: Node): JsonValue {
  return {
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
      attrs: relation.attrs as { [key: string]: JsonValue },
    })),
    facets: node.facets as { [key: string]: JsonValue },
    deprecated_ids: node.deprecatedIds,
  };
}

function assertJsonValue(value: unknown): asserts value is JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new ValidationError("node cannot be represented as projection.v1 canonical JSON: non-finite number");
  }
  if (Array.isArray(value)) {
    for (const member of value) assertJsonValue(member);
    return;
  }
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    for (const member of Object.values(value)) assertJsonValue(member);
    return;
  }
  throw new ValidationError(`node cannot be represented as projection.v1 canonical JSON: ${typeof value}`);
}

export function toCanonicalJson(node: Node): string {
  const value = toCanonical(node);
  assertJsonValue(value);
  try {
    const text = canonicalize(value);
    if (text === undefined) throw new Error("canonicalizer returned undefined");
    return text;
  } catch (caught) {
    throw new ValidationError(`node cannot be represented as projection.v1 canonical JSON: ${String(caught)}`);
  }
}
