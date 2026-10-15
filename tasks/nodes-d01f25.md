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
updated: 2026-10-15T12:35:59Z
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
- 2026-10-15T12:16:53Z (perf/csafe-frontmatter): parity today (2026-10-15): TS (yaml parseDocument) accepts both cases: 'title: "\uD800"' -> '\ud800', 'title: <TAB>bad' -> 'bad'. So Python and TS already disagree on the tab case. CSafeLoader would match TS on tabs and differ on lone surrogates. A lone surrogate cannot be encoded as UTF-8 (Python raises UnicodeEncodeError on write-back), so rejecting it in both languages is the coherent rule. The pinned test dates from aaa644e, which pinned existing acceptance, not a standard decision.
- 2026-10-15T12:20:09Z (perf/csafe-frontmatter): resumed
  provenance: {"harness_session":"claude-code:68ab2ddc-9049-44b2-91f0-59dfdd878c6c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-15T12:20:19Z (perf/csafe-frontmatter): scope grew with user approval 2026-10-15: CSafeLoader in Python, standard §4.2 rule that frontmatter strings are valid Unicode (lone surrogates malformed), TS check to match, both edge cases in fixtures; stays direct: the approach is settled
- 2026-10-15T12:35:59Z (perf/csafe-frontmatter): review: impl round 1 — verdict: revise; findings: critical 0, important 5, minor 6; reviewer: claude-code/claude-opus-5-5
