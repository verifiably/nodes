from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

import yaml
from pydantic import ValidationError as PydanticValidationError

from nodes.core.errors import ValidationError
from nodes.core.node import Node, NodeMetadata
from nodes.core.relations import RELATES_TO, Relation, relates_to


_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _malformed(message: str) -> ValidationError:
    return ValidationError(f"malformed frontmatter: {message}")


def split_frontmatter(text: str) -> tuple[dict, str]:
    """Split a document into its frontmatter mapping and body. A document without a
    frontmatter block yields `{}`; invalid YAML or a non-mapping block is malformed."""
    if text.startswith("---\r\n"):
        nl = "\r\n"
    elif text.startswith("---\n"):
        nl = "\n"
    else:
        return {}, text
    rest = text[len("---") + len(nl):]
    sep = f"{nl}---{nl}"
    idx = rest.find(sep)
    if idx == -1:
        return {}, text
    try:
        # PyYAML's timestamp constructor raises a bare ValueError for an impossible date.
        fm = yaml.safe_load(rest[:idx])
    except (yaml.YAMLError, ValueError) as exc:
        raise ValidationError(f"invalid frontmatter YAML: {exc}") from exc
    if fm is None:
        fm = {}
    if not isinstance(fm, dict):
        raise _malformed("frontmatter must be a mapping")
    _require_string_keys(fm)
    return fm, rest[idx + len(sep):]


def _require_string_keys(value: object, path: set[int] | None = None) -> None:
    """Every mapping key at any depth is a string; YAML admits other scalars, the
    boundary does not (TypeScript's object keys would silently stringify them). A
    cyclic alias is malformed; `path` holds the ids of the containers being walked,
    so a container reused on a sibling branch (a shared alias) is legal."""
    if not isinstance(value, (dict, list)):
        return
    path = path if path is not None else set()
    if id(value) in path:
        raise _malformed("frontmatter contains a cyclic alias")
    path.add(id(value))
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise _malformed(f"mapping key {key!r} must be a string")
            _require_string_keys(item, path)
    else:
        for item in value:
            _require_string_keys(item, path)
    path.remove(id(value))


def _require_str(fm: dict, name: str) -> str:
    value = fm.get(name)
    if not isinstance(value, str):
        raise _malformed(f"{name!r} must be a string")
    return value


def _optional_list(fm: dict, name: str, element: type, label: str) -> list:
    if name not in fm:
        return []
    value = fm[name]
    if not isinstance(value, list):
        raise _malformed(f"{name!r} must be a list")
    for item in value:
        if not isinstance(item, element):
            raise _malformed(f"{name!r} entries must be {label}")
    return value


def _date_field(name: str, value: object) -> date:
    # The one conversion at the boundary: YAML's unquoted date scalar or the ISO string.
    if isinstance(value, datetime):
        raise _malformed(f"{name!r} must be a calendar date, not a timestamp")
    if isinstance(value, date):
        return value
    if isinstance(value, str) and _DATE_RE.match(value):
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise _malformed(f"{name!r} is not a real calendar date") from exc
    raise _malformed(f"{name!r} must be a YYYY-MM-DD date")


def _relation_from_row(row: dict, container_id: str) -> Relation:
    source = row.get("source", container_id)
    predicate = row.get("predicate")
    target = row.get("target")
    if not isinstance(source, str):
        raise _malformed("relation 'source' must be a string")
    if not isinstance(predicate, str):
        raise _malformed("relation 'predicate' must be a string")
    if not isinstance(target, str):
        raise _malformed("relation 'target' must be a string")
    directed = row.get("directed", True)
    if not isinstance(directed, bool):
        raise _malformed("relation 'directed' must be a boolean")
    weight = row.get("weight")
    if weight is not None and (isinstance(weight, bool) or not isinstance(weight, (int, float))):
        raise _malformed("relation 'weight' must be a number or null")
    attrs = row.get("attrs", {})
    if not isinstance(attrs, dict):
        raise _malformed("relation 'attrs' must be a mapping")
    try:
        return Relation(source=source, predicate=predicate, target=target, directed=directed, weight=weight, attrs=attrs)
    except PydanticValidationError as exc:
        raise _malformed(f"relation: {exc.errors()[0]['msg']}") from exc


def node_from_markdown(text: str) -> Node:
    """The boundary parser. Every malformed input leaves as the kernel `ValidationError`;
    types are exact — nothing is coerced."""
    fm, body = split_frontmatter(text)
    missing = [k for k in ("id", "uid", "kind", "title") if k not in fm]
    if missing:
        raise ValidationError(f"frontmatter missing required field(s): {missing}")
    node_id = _require_str(fm, "id")
    relations = [relates_to(node_id, ref) for ref in _optional_list(fm, "related", str, "strings")]
    relations += [_relation_from_row(row, node_id) for row in _optional_list(fm, "relations", dict, "mappings")]
    facets = fm["facets"] if "facets" in fm else {}  # absence defaults; null does not
    if not isinstance(facets, dict) or any(not isinstance(v, dict) for v in facets.values()):
        raise _malformed("'facets' must be a mapping of mappings")
    meta: dict[str, Any] = {}
    for name in ("created", "updated"):
        if name in fm:
            meta[name] = _date_field(name, fm[name])
    if "version" in fm:
        version = fm["version"]
        if isinstance(version, bool) or not isinstance(version, int):
            raise _malformed("'version' must be an integer")
        meta["version"] = version
    try:
        return Node(
            id=node_id,
            uid=_require_str(fm, "uid"),
            kind=_require_str(fm, "kind"),
            title=_require_str(fm, "title"),
            body=body,
            metadata=NodeMetadata(**meta),
            relations=relations,
            facets=facets,
            deprecated_ids=_optional_list(fm, "deprecated_ids", str, "strings"),
        )
    except PydanticValidationError as exc:
        raise _malformed(exc.errors()[0]["msg"]) from exc


def node_from_bytes(data: bytes) -> Node:
    """Decode fatally, BOM preserved, then parse. A document begins with `---` at byte zero."""
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValidationError(f"document is not valid UTF-8: {exc}") from exc
    return node_from_markdown(text)


def _is_plain_relatesto(rel: Relation, node_id: str) -> bool:
    return (
        rel.predicate == RELATES_TO
        and rel.source == node_id
        and rel.directed is True
        and rel.weight is None
        and not rel.attrs
    )


def node_to_markdown(node: Node) -> str:
    fm: dict[str, Any] = {"id": node.id, "uid": node.uid, "kind": node.kind, "title": node.title}
    if node.metadata.created is not None:
        fm["created"] = node.metadata.created
    if node.metadata.updated is not None:
        fm["updated"] = node.metadata.updated
    if node.metadata.version != 1:
        fm["version"] = node.metadata.version
    related = [r.target for r in node.relations if _is_plain_relatesto(r, node.id)]
    typed = [r.to_serialized(node.id) for r in node.relations if not _is_plain_relatesto(r, node.id)]
    if related:
        fm["related"] = related
    if typed:
        fm["relations"] = typed
    if node.facets:
        fm["facets"] = node.facets
    if node.deprecated_ids:
        fm["deprecated_ids"] = node.deprecated_ids
    yaml_text = yaml.safe_dump(fm, sort_keys=False, allow_unicode=True).rstrip()
    return f"---\n{yaml_text}\n---\n{node.body}"
