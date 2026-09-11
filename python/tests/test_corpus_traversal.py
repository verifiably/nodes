from __future__ import annotations

import pytest

from nodes.core.corpus import Corpus
from nodes.core.errors import RefError
from nodes.core.node import Node
from nodes.core.relations import relates_to
from nodes.core.shapes import MEMBERSHIP


def _set_node(node_id: str, members: list[str]) -> Node:
    return Node(id=node_id, kind="set", title=node_id, facets={MEMBERSHIP: {"members": members}})


def _seeded(tmp_path) -> Corpus:
    """Registry-free corpus mirroring the fixture cluster: crate ⊃ box ⊃ {tidy, renamed};
    box lists renamed under its deprecated id; crate lists a dangling note:ghost."""
    c = Corpus(tmp_path)
    c.add(Node(id="note:renamed", kind="note", title="R", deprecated_ids=["note:old-name"]))
    c.add(Node(id="note:tidy", kind="note", title="T"))
    c.add(_set_node("set:box", ["note:tidy", "note:old-name"]))
    c.add(_set_node("set:crate", ["set:box", "note:ghost"]))
    return c


def test_members_skips_dangling(tmp_path):
    assert _seeded(tmp_path).members("set:crate") == ["set:box"]


def test_members_resolves_deprecated_refs_to_sorted_live_ids(tmp_path):
    assert _seeded(tmp_path).members("set:box") == ["note:renamed", "note:tidy"]


def test_members_of_facetless_node_is_empty(tmp_path):
    assert _seeded(tmp_path).members("note:tidy") == []


def test_containers_resolves_deprecated_input_ref(tmp_path):
    assert _seeded(tmp_path).containers("note:old-name") == ["set:box"]


def test_containers_reports_direct_containers_only(tmp_path):
    assert _seeded(tmp_path).containers("set:box") == ["set:crate"]


def test_containment_cycles_are_legal_one_hop(tmp_path):
    c = Corpus(tmp_path)
    c.add(_set_node("set:loop-a", ["set:loop-b"]))
    c.add(_set_node("set:loop-b", ["set:loop-a"]))
    c.add(_set_node("set:selfie", ["set:selfie"]))
    assert c.members("set:loop-a") == ["set:loop-b"]
    assert c.containers("set:loop-a") == ["set:loop-b"]
    assert c.members("set:selfie") == ["set:selfie"]
    assert c.containers("set:selfie") == ["set:selfie"]


def test_both_reject_unresolvable_input_ref(tmp_path):
    c = _seeded(tmp_path)
    for fn in (c.members, c.containers):
        with pytest.raises(RefError):
            fn("note:ghost")


def test_neighbor_uid_codepoint_order_survives_reload(tmp_path):
    # U+E000 and U+10000 sort oppositely under UTF-16 code units; code points are the contract.
    c = Corpus(tmp_path)
    for slug, uid in [("bmp", "\uE000"), ("nonbmp", "\U00010000")]:
        c.add(Node(id=f"kind:{slug}", uid=uid, kind="kind", title=slug))
    c.add(Node(id="kind:center", uid="center", kind="kind", title="Center", relations=[
        relates_to("kind:center", "kind:nonbmp"), relates_to("kind:center", "kind:bmp"),
    ]))
    assert [n.uid for n in c.neighbors("kind:center")] == ["\uE000", "\U00010000"]
    c.flush_index()
    assert [n.uid for n in Corpus(tmp_path).neighbors("kind:center")] == ["\uE000", "\U00010000"]
