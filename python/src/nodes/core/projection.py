from __future__ import annotations

import math
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


def _assert_json_value(value: object, active: set[int] | None = None) -> None:
    if value is None or type(value) is bool or type(value) is int:
        return
    if type(value) is str:
        value.encode("utf-8")
        return
    if type(value) is float:
        if math.isfinite(value):
            return
        raise ValueError("non-finite number")
    if active is None:
        active = set()
    if type(value) in {list, dict}:
        marker = id(value)
        if marker in active:
            raise ValueError("cyclic value")
        active.add(marker)
        if type(value) is list:
            for member in cast(list[object], value):
                _assert_json_value(member, active)
        else:
            for key, member in cast(dict[object, object], value).items():
                if type(key) is not str:
                    raise TypeError("JSON object key is not a string")
                _assert_json_value(key, active)
                _assert_json_value(member, active)
        active.remove(marker)
        return
    raise TypeError(f"{type(value).__name__} is not a JSON value")


def to_canonical_json(node: Node) -> str:
    try:
        value = to_canonical(node)
        _assert_json_value(value)
        return rfc8785.dumps(cast(Any, value)).decode("utf-8")
    except (rfc8785.CanonicalizationError, UnicodeError, TypeError, ValueError) as caught:
        raise ValidationError(f"node cannot be represented as projection.v1 canonical JSON: {caught}") from caught
