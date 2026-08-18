from __future__ import annotations

from pathlib import Path

from nodes.core.write_plan import DefaultExecutor, WriteOp, WritePlan


class RecordingExecutor:
    """Records every executed plan, then delegates to DefaultExecutor."""

    def __init__(self, root: Path) -> None:
        self.inner = DefaultExecutor(root)
        self.plans: list[list[WriteOp]] = []

    def execute(self, plan: WritePlan) -> None:
        self.plans.append(list(plan))
        self.inner.execute(plan)
