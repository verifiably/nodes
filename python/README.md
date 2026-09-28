# verifiably-nodes

Nodes core: a problem-agnostic knowledge substrate.

`verifiably-nodes` is the Python implementation of the Nodes kernel — a portable
corpus of plain-text nodes with typed relations, structural shapes, and
derived full-text-search and similarity indexes. A TypeScript implementation
([`@verifiably/nodes`](https://www.npmjs.com/package/@verifiably/nodes)) passes
the same cross-language conformance fixtures.

## Install

```
pip install verifiably-nodes
```

## Use

```python
import nodes.core
```

The `nodes` namespace is a PEP 420 native namespace package; `verifiably-nodes`
ships exactly the `nodes.core` subpackage.

`Corpus.read_and_check(registry=None)` returns `(nodes, findings)` from one
fresh `all()` read, in manifest-path order. Inspect the findings before using
the nodes; a nonempty findings list does not prevent returning them. Findings
match `check()` for the same file/index state and registry behavior. An explicit
registry overrides the configured one.

The returned nodes retain their original file values. With a registry, callbacks
run on `node.model_copy(deep=True)`, one copy per node; without one, no copies
are made. Later calls read afresh. Reads are sequential, not atomic, and
structural findings still use the corpus's existing indexes. Read errors and
callback programmer errors propagate. Existing `check()` is unchanged and
still reads no files when no registry is in effect.

## Documentation

The language-neutral format and behavior specification, both
implementations, and the shared conformance fixtures live at
<https://github.com/verifiably/nodes>.

## License

MIT
