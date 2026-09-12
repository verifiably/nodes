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

## Documentation

The language-neutral format and behavior specification, both
implementations, and the shared conformance fixtures live at
<https://github.com/verifiably/nodes>.

## License

MIT
