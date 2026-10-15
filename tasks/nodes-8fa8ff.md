---
id: nodes-8fa8ff
title: Settle the YAML divergences between the Python and TypeScript readers beyond the parse floor
status: todo
priority: 2
size: m
complexity: mid
process: planned
created: 2026-10-15T12:38:41Z
updated: 2026-10-15T12:53:10Z
depends: []
tags: [parity]
agent: claude-code/claude-opus-5-5
---

STANDARD §13 lists YAML constructs the two readers still read differently (found by the nodes-d01f25 review, 2026-10-15, pure PyYAML / libyaml / TS yaml 2.9): raw control and non-characters (\x01, \x7f, \x80-\x9f, \x00, \ufffe, even in comments: Python rejects, TS accepts); NEL/LS/PS (title: a\u2028b Python rejects, TS accepts; title: T\x85x: 1 Python splits, TS rejects; "a\x85b" value differs); CR-only breaks (Python accepts, TS rejects); a tab after - or ? (C rejects, TS accepts); tab-only line or tab before an indented comment; anchors &a.b / &a: (Python rejects, TS accepts); local tags !foo (Python rejects, TS accepts); duplicate keys (Python last wins, TS rejects); merge << (TS keeps a literal key); YAML 1.1 scalars yes/010/1_000/timestamps/huge ints; a | block scalar ending the frontmatter (Python 'hello', TS 'hello\n': changes projection and content identity). Decide each rule, pin it in frontmatter.malformed.json with expected values, and implement in both languages.

## Notes

- 2026-10-15T12:53:10Z (perf/csafe-frontmatter): fuzz 2026-10-15 (TS writer -> both readers, facet values of up to 5 chars over tab, space, a, newline, #, :, -, "): with the facet as the last key, TS fails to read back 3275 of 37448 and Python 5755 (the trailing block scalar losing its final newline); with a key after it, 26 in each, all space-only strings that yaml emits as a |+ block both readers read as bare newlines
