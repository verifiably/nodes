from __future__ import annotations

import json
import os
import shutil
import tempfile
from pathlib import Path

import pytest

from nodes.core.corpus import Corpus
from nodes.core.errors import ContainmentError, ExecutionError, PlanRefusedError
from nodes.core.node import Node
from nodes.core.paths import write_json_atomic
from nodes.core.similarity import VectorCache
from nodes.core.snapshot import iter_corpus_files
from nodes.core.store import Store
from nodes.core.write_plan import CreateOp, DefaultExecutor, DeleteOp, ReplaceOp

ORACLE = json.loads((Path(__file__).parents[2] / "fixtures/containment.oracle.json").read_text(encoding="utf-8"))
ZERO = "0" * 64
ERRORS = {"ContainmentError": ContainmentError, "ExecutionError": ExecutionError, "PlanRefusedError": PlanRefusedError, "FilesystemError": OSError, "ProgrammingError": ValueError}


def _symlinks() -> bool:
    probe = Path(tempfile.mkdtemp(prefix="nodes-symlink-probe-"))
    try:
        (probe / "link").symlink_to(probe / "target")
        return True
    except OSError as exc:
        if os.name == "nt" and getattr(exc, "winerror", None) == 1314:
            return False
        raise
    finally:
        shutil.rmtree(probe, ignore_errors=True)


SYMLINKS = _symlinks()


def _text(text: str) -> str:
    return text.replace("$node_a", ORACLE["node_a"]).replace("$node_b", ORACLE["node_b"])


def _resolve(spec: str, real: Path, outside: Path) -> Path:
    kind, _, rel = spec.partition(":")
    return (real if kind == "root" else outside) / rel


def _links(links: dict[str, str], real: Path, outside: Path) -> None:
    for link, target in links.items():
        path = real / link
        path.parent.mkdir(parents=True, exist_ok=True)
        path.symlink_to(_resolve(target, real, outside))


def _materialize(c: dict, tmp: Path) -> tuple[Path, Path, Path]:
    outside = tmp / "outside"
    outside.mkdir()
    if c["root"] == "missing":
        return tmp / "absent", tmp / "absent", outside
    real = tmp / "real"
    real.mkdir()
    for rel, text in c.get("files", {}).items():
        path = real / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(_text(text), encoding="utf-8")
    if c.get("setup_flush"):
        Corpus(real).flush_index()
    for rel, text in c.get("outside", {}).items():
        path = outside / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(_text(text), encoding="utf-8")
    _links(c.get("symlinks", {}), real, outside)
    if c["root"] == "symlink":
        root = tmp / "link-root"
        root.symlink_to(real)
        return root, real, outside
    return real, real, outside


def _act(c: dict, root: Path, real: Path, outside: Path, constructed: Corpus | None) -> list[str] | None:
    if c["action"] == "walk":
        return [f.path for f in iter_corpus_files(root)]
    if c["action"] == "construct":
        Corpus(root)
    elif c["action"] == "flush":
        Corpus(root).flush_index()
    elif c["action"] == "construct-then-flush":
        _links(c.get("then_symlinks", {}), real, outside)
        assert constructed
        constructed.flush_index()
    elif c["action"] == "execute":
        ops = []
        for raw in c["plan"]:
            content, digest = _text(raw.get("content", "")).encode(), raw.get("expected_digest", ZERO)
            ops.append(CreateOp(raw["path"], content) if raw["op"] == "create" else ReplaceOp(raw["path"], content, digest) if raw["op"] == "replace" else DeleteOp(raw["path"], digest))
        DefaultExecutor(root).execute(ops)
    elif c["action"] == "store-read":
        Store(root).read_file(c["id"])
    elif c["action"] == "store-write":
        Store(root).write_file(Node(id=c["id"], kind=c["id"].split(":", 1)[0], title="T"))
    elif c["action"] == "store-delete":
        Store(root).delete_file(c["id"])
    elif c["action"] == "vector-put":
        VectorCache(root).put("ns", ZERO, (0.5,))
    elif c["action"] == "cache-write":
        write_json_atomic(root, c["rel"], {"x": 1})
    else:
        raise AssertionError(c["action"])
    return None


@pytest.mark.parametrize("case", ORACLE["cases"], ids=lambda c: c["name"])
def test_containment_matches_committed_oracle(case: dict, tmp_path: Path) -> None:
    if (case["root"] == "symlink" or case.get("symlinks") or case.get("then_symlinks")) and not SYMLINKS:
        pytest.skip("symlinks unsupported")
    root, real, outside = _materialize(case, tmp_path)
    constructed = Corpus(root) if case["action"] == "construct-then-flush" else None
    before = {s: _resolve(s, real, outside).read_bytes() for s in case.get("untouched", []) if _resolve(s, real, outside).exists()}
    expect = case["expect"]
    if "error" in expect:
        with pytest.raises(ERRORS[expect["error"]]) as caught:
            _act(case, root, real, outside, constructed)
        for attr in ("index", "applied"):
            if attr in expect:
                assert getattr(caught.value, attr) == expect[attr]
    else:
        walked = _act(case, root, real, outside, constructed)
        if "walk" in expect:
            assert walked == expect["walk"]
    assert {s: _resolve(s, real, outside).read_bytes() for s in before} == before
    for s in case.get("absent", []):
        assert not os.path.lexists(_resolve(s, real, outside))
    for s in case.get("present", []):
        assert os.path.lexists(_resolve(s, real, outside))
    for s, text in case.get("contents", {}).items():
        assert _resolve(s, real, outside).read_bytes() == text.encode("utf-8")
