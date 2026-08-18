from __future__ import annotations


class NodesError(Exception):
    """Base class for all nodes kernel errors."""


class IdError(NodesError):
    """Raised on a malformed canonical id (`kind:slug`)."""


class RefError(NodesError):
    """Raised when a reference cannot be resolved or is malformed."""


class CollisionError(NodesError):
    """Raised when an id collides with a live id or an active deprecated id."""


class UnknownKindError(NodesError):
    """Raised when a node's kind is not registered."""


class FacetError(NodesError):
    """Raised when a facet payload is malformed or a required facet is missing."""


class InvariantError(NodesError):
    """Raised when a structural-shape invariant is violated."""


class ValidationError(NodesError):
    """Raised when a node fails validation against its kind."""


class EmbedderRequiredError(NodesError):
    """Raised when a similarity API is used on a Corpus built without an embedder."""


class PlanRefusedError(NodesError):
    """Raised when a write plan is lexically malformed: an unknown operation kind,
    an escaping path (absolute, or containing `..` after lexical normalization),
    or a reserved-namespace path. Refused before any effect."""


class ExecutionError(NodesError):
    """Raised when write-plan execution fails.

    `index=None` means the failure is not attributable to an operation.
    `applied=None` means restoration is unproved: the executor cannot prove
    disk is at its pre-plan state.
    """

    def __init__(self, message: str, *, index: int | None, applied: int | None) -> None:
        super().__init__(message)
        self.index = index
        self.applied = applied
