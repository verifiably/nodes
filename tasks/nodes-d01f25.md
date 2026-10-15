---
id: nodes-d01f25
title: Parse frontmatter with libyaml's CSafeLoader
status: doing
priority: 1
size: xs
complexity: low
process: direct
owner: main
created: 2026-10-15T12:00:37Z
updated: 2026-10-15T12:00:52Z
started: 2026-10-15T12:00:52Z
depends: []
tags: [perf]
agent: claude-code/claude-opus-5-5
---

split_frontmatter calls yaml.safe_load, PyYAML's pure-Python parser, though the installed PyYAML carries libyaml. In science's test suite a fixture world build parses ~1900 frontmatter blocks: 6.2 s of a 28 s build. Measured 2026-10-15 (science, titan): with frontmatter parsed by yaml.CSafeLoader, one heavy test 15.8 -> 13.7 s plain and 26.3 -> 20.0 s under pytest-testmon's coverage tracing; science's full suite under testmon 82-85 -> 71-72 s (16 workers). Same SafeConstructor and Resolver; only the scanner and parser are C. Parity is tier 1, so the fixtures/ oracles (frontmatter.malformed.json among them) are the check that no semantics change. Explicit over defensive: use yaml.CSafeLoader directly; a PyYAML without libyaml fails at import rather than silently falling back.

## Notes

- 2026-10-15T12:00:52Z (main): started
  provenance: {"harness_session":"claude-code:68ab2ddc-9049-44b2-91f0-59dfdd878c6c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
