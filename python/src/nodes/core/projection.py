from __future__ import annotations

from typing import Any, Final, cast

import rfc8785

from nodes.core.errors import ValidationError
from nodes.core.node import Node

PROJECTION_VERSION: Final[str] = "projection.v1"


def to_canonical(node: Node) -> dict[str, object]:
    return {
        "id": node.id,
        "uid": node.uid,
        "kind": node.kind,
        "title": node.title,
        "body": node.body,
        "metadata": {
            "created": node.metadata.created.isoformat() if node.metadata.created else None,
            "updated": node.metadata.updated.isoformat() if node.metadata.updated else None,
            "version": node.metadata.version,
        },
        "relations": [
            {
                "source": relation.source,
                "predicate": relation.predicate,
                "target": relation.target,
                "directed": relation.directed,
                "weight": relation.weight,
                "attrs": relation.attrs,
            }
            for relation in node.relations
        ],
        "facets": node.facets,
        "deprecated_ids": node.deprecated_ids,
    }


def to_canonical_json(node: Node) -> str:
    try:
        return rfc8785.dumps(cast(Any, to_canonical(node))).decode("utf-8")
    except (rfc8785.CanonicalizationError, UnicodeError, TypeError, ValueError) as caught:
        raise ValidationError(f"node cannot be represented as projection.v1 canonical JSON: {caught}") from caught
