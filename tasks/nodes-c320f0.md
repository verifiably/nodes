---
id: nodes-c320f0
title: Both writers strip trailing Unicode whitespace from the frontmatter's last value
status: todo
priority: 2
size: xs
complexity: low
process: direct
created: 2026-10-15T13:25:43Z
updated: 2026-10-15T13:25:43Z
depends: []
tags: [parity]
agent: claude-code/claude-opus-5-5
---

node_to_markdown's .rstrip() and nodeToMarkdown's .trimEnd() strip the emitted YAML's trailing whitespace, which reaches into the last scalar: facets {f: {x: "trail\u00a0"}} as the final field reads back as "trail" in every reader; likewise U+3000, U+2009, and a title ending in LS/PS/FEFF when it is the last field. Strip only the trailing newline. Found by the nodes-d01f25 round-3 review, 2026-10-15; on main too.
