from __future__ import annotations

import json
from pathlib import Path

import pytest

from nodes.core.errors import ValidationError
from nodes.core.frontmatter import node_from_markdown, node_to_markdown
from nodes.core.projection import PROJECTION_VERSION, to_canonical, to_canonical_json

FIXTURES = Path(__file__).parent.parent.parent / "fixtures"
SOURCE = FIXTURES / "gene_phf19.md"
ORACLE = FIXTURES / "gene_phf19.canonical.json"
CANONICAL_TEXT = FIXTURES / "projection.v1.canonical.json"
PY_EMIT = FIXTURES / "gene_phf19.py-emit.md"


def _node():
    return node_from_markdown(SOURCE.read_text(encoding="utf-8"))


def test_projection_version_and_text_are_public():
    assert PROJECTION_VERSION == "projection.v1"
    assert to_canonical_json(_node()) + "\n" == CANONICAL_TEXT.read_text(encoding="utf-8")


def test_projection_text_pins_number_spelling():
    node = _node().model_copy(deep=True)
    node.relations[0].weight = 1e16
    node.facets["numeric"] = {"small": 1e-7}
    text = to_canonical_json(node)
    assert '"weight":10000000000000000' in text
    assert '"small":1e-7' in text


def test_projection_text_rejects_non_finite_numbers():
    node = _node().model_copy(deep=True)
    node.relations[0].weight = float("inf")
    with pytest.raises(ValidationError, match="canonical JSON"):
        to_canonical_json(node)


def test_projection_text_rejects_tuple_values():
    node = _node().model_copy(deep=True)
    node.facets["invalid"] = {"tuple": (1, 2)}

    with pytest.raises(ValidationError, match="canonical JSON"):
        to_canonical_json(node)


def test_python_parse_matches_oracle():
    assert to_canonical(_node()) == json.loads(ORACLE.read_text(encoding="utf-8"))


def test_py_emit_fixture_is_current():
    # Regenerate-and-diff currency guard: the committed py-emit fixture must equal
    # what the CURRENT emitter produces. On drift this fails — regenerate the file.
    assert PY_EMIT.read_text(encoding="utf-8") == node_to_markdown(_node())


def test_py_emit_round_trips_to_oracle():
    assert to_canonical(node_from_markdown(PY_EMIT.read_text(encoding="utf-8"))) == json.loads(
        ORACLE.read_text(encoding="utf-8")
    )


TS_EMIT = FIXTURES / "gene_phf19.ts-emit.md"


def test_python_parses_ts_emit_to_oracle():
    # Check 3: TS-emitted markdown, parsed by Python, equals the oracle.
    assert to_canonical(node_from_markdown(TS_EMIT.read_text(encoding="utf-8"))) == json.loads(
        ORACLE.read_text(encoding="utf-8")
    )


GENE_AXIS_SOURCE = FIXTURES / "gene-axis.md"
GENE_AXIS_ORACLE = FIXTURES / "gene-axis.canonical.json"


def test_namespaced_facet_key_projects_identically():
    # `biology/gene-axis` is one facet name, distinct from `biology`: the slash is not a
    # path separator. The oracle is RFC 8785 text, so it pins both projections at once.
    node = node_from_markdown(GENE_AXIS_SOURCE.read_text(encoding="utf-8"))
    text = GENE_AXIS_ORACLE.read_text(encoding="utf-8")
    assert set(node.facets) == {"biology", "biology/gene-axis"}
    assert to_canonical_json(node) + "\n" == text
    assert to_canonical(node) == json.loads(text)
    assert to_canonical(node_from_markdown(node_to_markdown(node))) == json.loads(text)
