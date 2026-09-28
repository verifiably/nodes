from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from nodes.core.corpus import Corpus
from nodes.core.errors import RefError, ValidationError
from nodes.core.node import Node
from nodes.core.registry import KindSpec, Registry
from nodes.core.relations import Relation
from nodes.core.shapes import MEMBERSHIP, register_builtin_shapes
from nodes.core.store import Store
from tests._fixtures_profile import SOURCE, register_fixtures_profile


def _registry() -> Registry:
    r = Registry()
    register_builtin_shapes(r)
    register_fixtures_profile(r)
    return r


def _tuples(findings) -> list[tuple[str, str, str, str]]:
    return [(f.severity, f.code, f.ref, f.detail) for f in findings]


def test_clean_corpus_no_findings(tmp_path):
    c = Corpus(tmp_path, registry=_registry())
    c.add(Node(id="topic:t", kind="topic", title="T"))
    c.add(Node(id="note:n", kind="note", title="N",
               relations=[Relation(source="note:n", predicate="about", target="topic:t")]))
    assert c.check() == []


def test_hand_edited_violations_reported(tmp_path):
    seed = Corpus(tmp_path)  # registry-free: simulates hand-edited files
    seed.add(Node(id="zzz:m", kind="zzz", title="M"))
    seed.add(Node(id="note:s", kind="note", title="S", facets={SOURCE: {"year": 2026}}))
    seed.add(Node(id="paper:b", kind="paper", title="B",
                  relations=[Relation(source="paper:b", predicate="cites", target="paper:ghost")]))
    c = Corpus(tmp_path, registry=_registry())
    assert _tuples(c.check()) == [
        ("error", "facet-unexpected", "note:s", "source"),
        ("warning", "dangling-ref", "paper:b", "paper:ghost"),
        ("error", "facet-missing", "paper:b", "source"),
        ("error", "unknown-kind", "zzz:m", "zzz"),
    ]


def test_no_registry_reports_only_dangling(tmp_path):
    seed = Corpus(tmp_path)
    seed.add(Node(id="zzz:m", kind="zzz", title="M",
                  relations=[Relation(source="zzz:m", predicate="cites", target="note:gone")]))
    c = Corpus(tmp_path)
    assert _tuples(c.check()) == [("warning", "dangling-ref", "zzz:m", "note:gone")]


def test_passed_registry_overrides_corpus_registry(tmp_path):
    c = Corpus(tmp_path, registry=_registry())
    c.add(Node(id="note:n", kind="note", title="N"))
    empty = Registry()
    assert _tuples(c.check(registry=empty)) == [("error", "unknown-kind", "note:n", "note")]


def test_details_order_by_code_point(tmp_path):
    seed = Corpus(tmp_path)  # registry-free: simulates hand-edited files
    # U+FF61 < U+1F600 by code point; UTF-16 code-unit order would reverse them.
    seed.add(Node(id="note:x", kind="note", title="X", facets={"｡": {}, "\U0001f600": {}}))
    c = Corpus(tmp_path, registry=_registry())
    assert [f.detail for f in c.check()] == ["｡", "\U0001f600"]


def test_check_does_not_mutate_corpus(tmp_path):
    seed = Corpus(tmp_path)
    seed.add(Node(id="zzz:m", kind="zzz", title="M"))
    c = Corpus(tmp_path, registry=_registry())
    c.check()
    assert c.get("zzz:m").title == "M"  # still readable, file untouched


def test_dangling_member_reported_after_delete_and_deduped(tmp_path):
    seed = Corpus(tmp_path)  # registry-free: dangling-member is registry-independent
    seed.add(Node(id="note:gone", kind="note", title="G"))
    seed.add(Node(id="set:box", kind="set", title="Box",
                  facets={MEMBERSHIP: {"members": ["note:gone", "note:gone"]}}))
    seed.delete("note:gone")
    assert _tuples(seed.check()) == [("warning", "dangling-member", "set:box", "note:gone")]


def test_dangling_member_orders_with_other_findings(tmp_path):
    seed = Corpus(tmp_path)
    seed.add(Node(id="set:box", kind="set", title="Box",
                  relations=[Relation(source="set:box", predicate="about", target="topic:gone")],
                  facets={MEMBERSHIP: {"members": ["note:ghost"]}}))
    assert _tuples(seed.check()) == [
        ("warning", "dangling-member", "set:box", "note:ghost"),
        ("warning", "dangling-ref", "set:box", "topic:gone"),
    ]


def test_read_and_check_keeps_file_values_and_reads_afresh(tmp_path):
    seen = []

    def mutate(node):
        node.title = "callback"
        node.facets["payload"]["items"].append("callback")
        seen.append(node)

    def observe(node):
        assert node is seen[-1]
        assert node.title == "callback"

    reg = Registry()
    reg.register(KindSpec(name="note", optional_facets={"payload"}, invariants=[mutate, observe]))
    store = Store(tmp_path)
    original = Node(id="note:x", kind="note", title="file", facets={"payload": {"items": []}})
    store.write_file(original)
    c = Corpus(tmp_path, registry=reg)
    expected = c.all()[0].model_dump()
    nodes, findings = c.read_and_check()
    assert findings == []
    assert nodes[0].model_dump() == expected
    seen[0].facets["payload"]["items"].append("retained callback")
    assert nodes[0].facets["payload"]["items"] == []
    store.write_file(original.model_copy(update={"title": "edited"}))
    assert c.get("note:x").title == c.all()[0].title == "edited"
    assert c.read_and_check()[0][0].title == "edited"
    assert nodes[0].title == "file"


@pytest.mark.parametrize("fixture,mode", [("check-corpus", "strict"), ("damaged-corpus", "collecting")])
def test_read_and_check_preserves_all_findings_and_order(tmp_path, fixture, mode, monkeypatch):
    root = tmp_path / "corpus"
    shutil.copytree(Path(__file__).parents[2] / "fixtures" / fixture, root)
    store = Store(root)
    for slug in ("case", "CASE"):
        store.write_file(Node(id=f"note:{slug}", kind="note", title=slug))
    store.write_file(Node(id="set:box", kind="set", title="Box", facets={
        MEMBERSHIP: {"members": ["note:missing"]}}))
    c = Corpus(root, registry=_registry(), mode=mode)
    expected_nodes = c.all()
    expected_findings = c.check()
    assert {"path-collision", "dangling-member"} <= {f.code for f in expected_findings}
    original_all = c.all
    calls = []

    def counted_all():
        calls.append(True)
        return original_all()

    monkeypatch.setattr(c, "all", counted_all)
    nodes, findings = c.read_and_check()
    assert calls == [True]
    assert [n.model_dump() for n in nodes] == [n.model_dump() for n in expected_nodes]
    assert [f.model_dump() for f in findings] == [f.model_dump() for f in expected_findings]


def test_read_and_check_without_registry_reads_but_never_copies(tmp_path, monkeypatch):
    c = Corpus(tmp_path)
    c.add(Node(id="note:x", kind="note", title="X", relations=[
        Relation(source="note:x", predicate="about", target="note:missing")]))
    expected = c.check()

    def forbidden(*args, **kwargs):
        raise AssertionError("unexpected copy or read")

    monkeypatch.setattr(Node, "model_copy", forbidden)
    nodes, findings = c.read_and_check()
    assert [n.id for n in nodes] == ["note:x"]
    assert findings == expected
    monkeypatch.setattr(c, "all", forbidden)
    assert c.check() == expected


def test_read_and_check_explicit_registry_overrides_configured(tmp_path):
    c = Corpus(tmp_path, registry=_registry())
    c.add(Node(id="note:x", kind="note", title="X"))
    empty = Registry()
    assert c.read_and_check()[1] == []
    assert c.read_and_check(empty)[1] == c.check(empty)
    assert [f.code for f in c.read_and_check(empty)[1]] == ["unknown-kind"]


@pytest.mark.parametrize("damage,error", [("delete", RefError), ("malformed", ValidationError)])
def test_read_and_check_fresh_read_failures(tmp_path, damage, error):
    c = Corpus(tmp_path, registry=_registry())
    c.add(Node(id="note:x", kind="note", title="X"))
    nodes, _ = c.read_and_check()
    path = c.store.path_for("note:x")
    if damage == "delete":
        path.unlink()
    else:
        path.write_text("---\ntitle: [\n---\n")
    for read in (c.all, c.check, c.read_and_check):
        with pytest.raises(error):
            read()
    assert nodes[0].title == "X"


def test_read_and_check_propagates_callback_bugs(tmp_path):
    def broken(node):
        raise RuntimeError("callback bug")

    reg = Registry()
    reg.register(KindSpec(name="note", invariants=[broken]))
    Store(tmp_path).write_file(Node(id="note:x", kind="note", title="X"))
    c = Corpus(tmp_path, registry=reg)
    for check in (c.check, c.read_and_check):
        with pytest.raises(RuntimeError, match="callback bug"):
            check()
