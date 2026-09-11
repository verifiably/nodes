from __future__ import annotations

from pathlib import Path

from nodes.core.errors import RefError
from nodes.core.frontmatter import node_from_markdown, node_to_markdown
from nodes.core.node import Node
from nodes.core.paths import assert_contained, path_for_node_id
from nodes.core.snapshot import iter_corpus_files


class Store:
    """Pure file mechanics over a corpus directory. No cross-corpus logic.

    Collision detection, ref resolution, and rename live in `Corpus`/`Index`.
    """

    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    def rel_path(self, node_id: str) -> str:
        return path_for_node_id(node_id)

    def path_for(self, node_id: str) -> Path:
        return self.root / self.rel_path(node_id)

    def write_file(self, node: Node) -> Path:
        rel = self.rel_path(node.id)
        assert_contained(self.root, rel)
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(node_to_markdown(node), encoding="utf-8")
        return path

    def read_file(self, node_id: str) -> Node:
        rel = self.rel_path(node_id)
        assert_contained(self.root, rel)
        path = self.root / rel
        if not path.is_file():
            raise RefError(f"no node at {node_id!r}")
        return node_from_markdown(path.read_text(encoding="utf-8"))

    def delete_file(self, node_id: str) -> None:
        rel = self.rel_path(node_id)
        assert_contained(self.root, rel)
        path = self.root / rel
        if not path.is_file():
            raise RefError(f"no node at {node_id!r}")
        path.unlink()

    def all_nodes(self) -> list[Node]:
        return [node_from_markdown(f.data.decode("utf-8")) for f in iter_corpus_files(self.root)]
