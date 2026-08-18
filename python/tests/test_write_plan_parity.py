from __future__ import annotations

import json
import shutil
from pathlib import Path

from nodes.core.corpus import Corpus
from nodes.core.frontmatter import node_from_markdown
from nodes.core.write_plan import CreateOp, ReplaceOp, WritePlan

from tests._canonical import to_canonical
from tests._executors import RecordingExecutor

FIXTURES = Path(__file__).parent.parent.parent / "fixtures"
ORACLE = FIXTURES / "write-plan.rename.canonical.json"


def project_plan(plan: WritePlan) -> list[dict]:
    """Plan-equality projection (design §2): op kinds, paths, and expected_digest
    compare position-wise; content compares as its canonical JSON projection."""
    rows: list[dict] = []
    for op in plan:
        row: dict = {"op": op.op, "path": op.path}
        if isinstance(op, (CreateOp, ReplaceOp)):
            row["content"] = to_canonical(node_from_markdown(op.content.decode("utf-8")))
        if not isinstance(op, CreateOp):
            row["expected_digest"] = op.expected_digest
        rows.append(row)
    return rows


def test_rename_write_plan_matches_shared_oracle(tmp_path):
    corpus_dir = tmp_path / "corpus"
    shutil.copytree(FIXTURES / "corpus", corpus_dir)
    captured: list[RecordingExecutor] = []

    def factory(root: Path) -> RecordingExecutor:
        ex = RecordingExecutor(root)
        captured.append(ex)
        return ex

    c = Corpus(corpus_dir, executor_factory=factory)
    c.rename("topic:old", "topic:new")
    (plan,) = captured[0].plans
    oracle = json.loads(ORACLE.read_text(encoding="utf-8"))
    assert project_plan(plan) == oracle
