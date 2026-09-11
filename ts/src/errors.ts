export class NodesError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class IdError extends NodesError {}
export class RefError extends NodesError {}
export class CollisionError extends NodesError {}
export class UnknownKindError extends NodesError {}
export class FacetError extends NodesError {}
export class InvariantError extends NodesError {}
export class ValidationError extends NodesError {}
export class EmbedderRequiredError extends NodesError {}

/** Write plan is lexically malformed: unknown operation kind, a path that is not a
 * portable root-relative `.md` path, or a reserved-namespace path. Refused before any effect. */
export class PlanRefusedError extends NodesError {}

/** A path under the corpus root has a symlink component below the root, or cannot
 * be inspected. Refused before any effect. */
export class ContainmentError extends NodesError {}

/** Write-plan execution failed. `index === null` means the failure is not
 * attributable to an operation; `applied === null` means restoration is
 * unproved: the executor cannot prove disk is at its pre-plan state. */
export class ExecutionError extends NodesError {
  readonly index: number | null;
  readonly applied: number | null;
  readonly cause?: unknown;

  constructor(message: string, index: number | null, applied: number | null, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause !== undefined) this.cause = options.cause;
    this.index = index;
    this.applied = applied;
  }
}
