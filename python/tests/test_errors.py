from __future__ import annotations

import pytest

from nodes.core.errors import (
    CollisionError,
    ExecutionError,
    FacetError,
    IdError,
    InvariantError,
    NodesError,
    PlanRefusedError,
    RefError,
    UnknownKindError,
    ValidationError,
)


@pytest.mark.parametrize(
    "exc",
    [
        IdError,
        RefError,
        CollisionError,
        UnknownKindError,
        FacetError,
        InvariantError,
        ValidationError,
        PlanRefusedError,
        ExecutionError,
    ],
)
def test_all_errors_subclass_base(exc):
    assert issubclass(exc, NodesError)
    assert issubclass(NodesError, Exception)
