---
id: nodes-d01f25
title: Parse frontmatter with libyaml's CSafeLoader
status: doing
priority: 1
size: xs
complexity: low
process: direct
owner: perf/csafe-frontmatter
created: 2026-10-15T12:00:37Z
updated: 2026-10-15T12:03:23Z
started: 2026-10-15T12:00:52Z
depends: []
tags: [perf]
agent: claude-code/claude-opus-5-5
---

split_frontmatter calls yaml.safe_load, PyYAML's pure-Python parser, though the installed PyYAML carries libyaml. In science's test suite a fixture world build parses ~1900 frontmatter blocks: 6.2 s of a 28 s build. Measured 2026-10-15 (science, titan): with frontmatter parsed by yaml.CSafeLoader, one heavy test 15.8 -> 13.7 s plain and 26.3 -> 20.0 s under pytest-testmon's coverage tracing; science's full suite under testmon 82-85 -> 71-72 s (16 workers). Same SafeConstructor and Resolver; only the scanner and parser are C. Parity is tier 1, so the fixtures/ oracles (frontmatter.malformed.json among them) are the check that no semantics change. Explicit over defensive: use yaml.CSafeLoader directly; a PyYAML without libyaml fails at import rather than silently falling back.

## Notes

- 2026-10-15T12:00:52Z (main): started
  provenance: {"harness_session":"claude-code:68ab2ddc-9049-44b2-91f0-59dfdd878c6c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-15T12:00:59Z (perf/csafe-frontmatter): resumed
  provenance: {"harness_session":"claude-code:68ab2ddc-9049-44b2-91f0-59dfdd878c6c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-15T12:03:16Z (perf/csafe-frontmatter): tried 2026-10-15: CSafeLoader breaks test_existing_yaml_edge_acceptance both ways: 'title: "\uD800"' SafeLoader -> '\ud800', CSafeLoader -> ScannerError; 'title: <TAB>bad' SafeLoader -> ScannerError, CSafeLoader -> 'bad'. A tier-1 acceptance change (standard + TS parity), not a drop-in; reverted, nothing committed. Options: (a) CSafeLoader plus explicit pre-checks that restore today's acceptance set (reject a tab before a plain scalar, accept lone-surrogate escapes, which C rejects outright, so (a) needs a fallback for that case), (b) change the standard's acceptance set to libyaml's in both languages, (c) keep the pure parser and leave the perf to callers (science could cache parsed nodes per content hash).
- 2026-10-15T12:03:23Z (perf/csafe-frontmatter): parked (waiting on user, decision): user decides between (a) pre-checks + fallback preserving today's acceptance, (b) a standard change adopting libyaml's acceptance in both languages, or (c) no change; agent then implements in .worktrees/csafe-frontmatter (ts deps hydrated)
  provenance: {"harness_session":"claude-code:68ab2ddc-9049-44b2-91f0-59dfdd878c6c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
