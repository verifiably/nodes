from __future__ import annotations

import json
from pathlib import Path

import pytest

from nodes.core.errors import ValidationError
from nodes.core.frontmatter import node_from_markdown, node_to_markdown
from nodes.core.node import Node, new_uid

UID_ORACLE = json.loads((Path(__file__).parents[2] / "fixtures/uid.oracle.json").read_text(encoding="utf-8"))


def test_node_minimal_defaults():
    n = Node(id="topic:polycomb", kind="topic", title="Polycomb")
    assert n.body == ""
    assert n.metadata.version == 1
    assert n.relations == [] and n.facets == {}
    assert len(n.uid) == 32  # uuid4 hex


def test_uid_is_unique_per_node():
    a = Node(id="topic:a", kind="topic", title="A")
    b = Node(id="topic:b", kind="topic", title="B")
    assert a.uid != b.uid


def test_explicit_uid_preserved():
    fixed = new_uid()
    n = Node(id="topic:a", kind="topic", title="A", uid=fixed)
    assert n.uid == fixed


def test_id_kind_mismatch_rejected():
    with pytest.raises(ValidationError):
        Node(id="topic:a", kind="note", title="Mismatch")


def test_id_must_be_wellformed():
    with pytest.raises(ValidationError):
        Node(id="nocolon", kind="nocolon", title="Bad")


@pytest.mark.parametrize("uid", UID_ORACLE["accepted"])
def test_opaque_uid(uid):
    node = Node(id="kind:a", uid=uid, kind="kind", title="A")
    assert node.uid == uid
    assert node_from_markdown(node_to_markdown(node)).uid == uid


@pytest.mark.parametrize("uid", UID_ORACLE["rejected"])
def test_empty_uid_refused(uid):
    with pytest.raises(ValidationError):
        Node(id="kind:a", uid=uid, kind="kind", title="A")
    with pytest.raises(ValidationError):
        node_from_markdown('---\nid: kind:a\nuid: ""\nkind: kind\ntitle: A\n---\n')
