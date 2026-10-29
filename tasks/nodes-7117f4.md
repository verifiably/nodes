---
id: nodes-7117f4
title: Quote YAML-1.1-ambiguous scalars in the TypeScript node writer
status: todo
priority: 2
size: s
complexity: low
created: 2026-10-29T12:44:47Z
updated: 2026-10-29T12:44:47Z
depends: []
tags: []
agent: claude-code/claude-opus-5-5
origin: agent
---

The TypeScript writer (nodeToMarkdown) emits date-shaped strings unquoted, e.g. a refs/about entry release written as release: 2026-06-26. Python's YAML 1.1 loader reads that back as datetime.date, so a strict string schema in a facet invariant (refs' about_facet) refuses a node TypeScript wrote. nodes STANDARD section 13 documents the YAML 1.1 limitation; this asks the writer to quote any string scalar a YAML 1.1 reader would resolve to a non-string (dates, timestamps, yes/no/on/off booleans, numbers), with a cross-language round-trip fixture. Found by the refs milestone 1 whole-branch review (source task ops-227c28); refs pins the quoted form in its STANDARD section 6 meanwhile.

## Notes

- 2026-10-29T12:44:47Z (add): created
  provenance: {"harness_session":"claude-code:51cfde39-ece9-4912-b594-1b54bf216e41","harness_session_source":"CLAUDE_CODE_SESSION_ID","origin":"agent"}
