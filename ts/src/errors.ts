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

/** A write plan is lexically malformed: unknown operation kind, escaping path
 * (absolute, or containing `..` after lexical normalization), or a
 * reserved-namespace path. Refused before any effect. */
export class PlanRefusedError extends NodesError {}

/** Write-plan execution failed. `index === null` means the failure is not
 * attributable to an operation; `applied === null` means restoration is
 * unproved: the executor cannot prove disk is at its pre-plan state. */
export class ExecutionError extends NodesError {
  readonly index: number | null;
  readonly applied: number | null;

  constructor(message: string, index: number | null, applied: number | null) {
    super(message);
    this.index = index;
    this.applied = applied;
  }
}
