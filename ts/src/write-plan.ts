import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ContainmentError, ExecutionError, PlanRefusedError } from "./errors.js";
import { RESERVED_NAMESPACE, assertContained, isPortableRelativePath } from "./paths.js";

export { RESERVED_NAMESPACE };

/** Write `content` at an absent `path`. */
export interface CreateOp {
  readonly op: "create";
  /** root-relative POSIX */
  readonly path: string;
  readonly content: Uint8Array;
}

/** Write `content` at a present `path` whose on-disk bytes hash to `expectedDigest`. */
export interface ReplaceOp {
  readonly op: "replace";
  /** root-relative POSIX */
  readonly path: string;
  readonly content: Uint8Array;
  /** lowercase-hex SHA-256 of the bytes being replaced */
  readonly expectedDigest: string;
}

/** Remove a present `path` whose on-disk bytes hash to `expectedDigest`. */
export interface DeleteOp {
  readonly op: "delete";
  /** root-relative POSIX */
  readonly path: string;
  /** lowercase-hex SHA-256 of the bytes being deleted */
  readonly expectedDigest: string;
}

export type WriteOp = CreateOp | ReplaceOp | DeleteOp;
export type WritePlan = readonly WriteOp[];

export interface WritePlanExecutor {
  execute(plan: WritePlan): void;
}

/** Refuse a lexically malformed plan (`PlanRefusedError`) before any effect:
 * unknown operation kind, a non-portable root-relative `.md` path, or a
 * reserved-namespace path. */
export function validatePlan(plan: WritePlan): void {
  for (const op of plan) {
    if (op.op !== "create" && op.op !== "replace" && op.op !== "delete") {
      throw new PlanRefusedError(`unknown operation kind: ${JSON.stringify(op)}`);
    }
    if (!isPortableRelativePath(op.path)) {
      throw new PlanRefusedError(`not a portable root-relative .md path: ${JSON.stringify(op.path)}`);
    }
    if (op.path.split("/", 1)[0] === RESERVED_NAMESPACE) {
      throw new PlanRefusedError(`path in reserved namespace: ${JSON.stringify(op.path)}`);
    }
  }
}

/** Best-effort ordered writes. A whole-plan containment preflight runs before any
 * effect; then each operation's existence precondition is checked when it is reached
 * and execution stops at the first failure, leaving the applied prefix. Carries but
 * does not enforce `expectedDigest`. Provides no serialization; the deployment retains
 * the single-writer obligation. */
export class DefaultExecutor implements WritePlanExecutor {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  execute(plan: WritePlan): void {
    validatePlan(plan);
    plan.forEach((op, index) => {
      try {
        assertContained(this.root, op.path);
      } catch (e) {
        if (!(e instanceof ContainmentError)) throw e;
        throw new ExecutionError(`operation ${index} not contained: ${e.message}`, index, 0, { cause: e });
      }
    });
    for (let index = 0; index < plan.length; index++) {
      const op = plan[index];
      const target = join(this.root, op.path);
      if (op.op === "create") {
        if (existsSync(target)) {
          throw new ExecutionError(`create target already present: ${JSON.stringify(op.path)}`, index, index);
        }
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, op.content);
      } else if (op.op === "replace") {
        if (!(existsSync(target) && statSync(target).isFile())) {
          throw new ExecutionError(`replace target absent: ${JSON.stringify(op.path)}`, index, index);
        }
        writeFileSync(target, op.content);
      } else {
        if (!(existsSync(target) && statSync(target).isFile())) {
          throw new ExecutionError(`delete target absent: ${JSON.stringify(op.path)}`, index, index);
        }
        rmSync(target);
      }
    }
  }
}
