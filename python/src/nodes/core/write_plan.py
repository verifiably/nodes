from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Protocol, TypeAlias

from nodes.core.errors import ContainmentError, ExecutionError, PlanRefusedError
from nodes.core.paths import RESERVED_NAMESPACE as RESERVED_NAMESPACE, assert_contained, is_portable_relative_path


@dataclass(frozen=True)
class CreateOp:
    """Write `content` at an absent `path`."""

    path: str  # root-relative POSIX
    content: bytes
    op: Literal["create"] = field(default="create", init=False)


@dataclass(frozen=True)
class ReplaceOp:
    """Write `content` at a present `path` whose on-disk bytes hash to `expected_digest`."""

    path: str  # root-relative POSIX
    content: bytes
    expected_digest: str  # lowercase-hex SHA-256 of the bytes being replaced
    op: Literal["replace"] = field(default="replace", init=False)


@dataclass(frozen=True)
class DeleteOp:
    """Remove a present `path` whose on-disk bytes hash to `expected_digest`."""

    path: str  # root-relative POSIX
    expected_digest: str  # lowercase-hex SHA-256 of the bytes being deleted
    op: Literal["delete"] = field(default="delete", init=False)


WriteOp: TypeAlias = CreateOp | ReplaceOp | DeleteOp
WritePlan: TypeAlias = Sequence[WriteOp]


class WritePlanExecutor(Protocol):
    def execute(self, plan: WritePlan) -> None: ...


def validate_plan(plan: WritePlan) -> None:
    """Refuse a lexically malformed plan (`PlanRefusedError`) before any effect:
    unknown operation kind, a non-portable root-relative path, or a
    reserved-namespace path. No suffix rule: a plan is the caller's instruction,
    and a consumer may name a non-Markdown artifact of its own."""
    for op in plan:
        if not isinstance(op, (CreateOp, ReplaceOp, DeleteOp)):
            raise PlanRefusedError(f"unknown operation kind: {op!r}")
        if not is_portable_relative_path(op.path, suffix=None):
            raise PlanRefusedError(f"not a portable root-relative path: {op.path!r}")
        if op.path.split("/", 1)[0] == RESERVED_NAMESPACE:
            raise PlanRefusedError(f"path in reserved namespace: {op.path!r}")


class DefaultExecutor:
    """Best-effort ordered writes. A whole-plan containment preflight runs before any
    effect; then each operation's existence precondition is checked when it is reached
    and execution stops at the first failure, leaving the applied prefix. Carries but
    does not enforce `expected_digest`. Provides no serialization; the deployment
    retains the single-writer obligation."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    def execute(self, plan: WritePlan) -> None:
        validate_plan(plan)
        for index, op in enumerate(plan):
            try:
                assert_contained(self.root, op.path)
            except ContainmentError as exc:
                raise ExecutionError(f"operation {index} not contained: {exc}", index=index, applied=0) from exc
        for index, op in enumerate(plan):
            target = self.root / op.path
            if isinstance(op, CreateOp):
                if target.exists():
                    raise ExecutionError(
                        f"create target already present: {op.path!r}", index=index, applied=index
                    )
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(op.content)
            elif isinstance(op, ReplaceOp):
                if not target.is_file():
                    raise ExecutionError(
                        f"replace target absent: {op.path!r}", index=index, applied=index
                    )
                target.write_bytes(op.content)
            else:
                if not target.is_file():
                    raise ExecutionError(
                        f"delete target absent: {op.path!r}", index=index, applied=index
                    )
                target.unlink()
