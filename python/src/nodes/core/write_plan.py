from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Protocol, TypeAlias

from nodes.core.errors import ExecutionError, PlanRefusedError

RESERVED_NAMESPACE = ".nodes-index"


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


def _path_escapes(path: str) -> bool:
    if path == "" or path.startswith("/"):
        return True
    normalized: list[str] = []
    for segment in path.split("/"):
        if segment in ("", "."):
            continue
        if segment == "..":
            if not normalized:
                return True
            normalized.pop()
            continue
        normalized.append(segment)
    return not normalized


def validate_plan(plan: WritePlan) -> None:
    """Refuse a lexically malformed plan (`PlanRefusedError`) before any effect:
    unknown operation kind, escaping path, or reserved-namespace path."""
    for op in plan:
        if not isinstance(op, (CreateOp, ReplaceOp, DeleteOp)):
            raise PlanRefusedError(f"unknown operation kind: {op!r}")
        if _path_escapes(op.path):
            raise PlanRefusedError(f"path escapes the corpus root: {op.path!r}")
        if op.path.split("/", 1)[0] == RESERVED_NAMESPACE:
            raise PlanRefusedError(f"path in reserved namespace: {op.path!r}")


class DefaultExecutor:
    """Best-effort ordered writes: checks each operation's existence precondition
    when it reaches that operation and stops at the first failure, leaving the
    applied prefix. Carries but does not enforce `expected_digest`. Provides no
    serialization; the deployment retains the single-writer obligation."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    def execute(self, plan: WritePlan) -> None:
        validate_plan(plan)
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
