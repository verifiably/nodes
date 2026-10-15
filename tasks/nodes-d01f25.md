---
id: nodes-d01f25
title: Parse frontmatter with libyaml's CSafeLoader
status: done
priority: 1
size: xs
complexity: low
process: direct
owner: perf/csafe-frontmatter
created: 2026-10-15T12:00:37Z
updated: 2026-10-15T13:37:09Z
started: 2026-10-15T12:00:52Z
completed: 2026-10-15T13:26:02Z
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
- 2026-10-15T12:38:50Z (perf/csafe-frontmatter): I4 remainder filed as nodes-8fa8ff; I2 resolved by bumping to 3.0 (the line-start BOM refusal rejects documents both kernels read under 2.0, so minor was not defensible); minor (deferred): M2 accepted rows prove self round-trip only, M3 libyaml guard test is a proxy, M4 Python raw-surrogate refusal is incidental to _yaml's strict encode, M5 raw RecursionError on deep nesting (pre-existing), M6 plain Error for a missing source token (unreachable)
- 2026-10-15T12:49:33Z (perf/csafe-frontmatter): review: impl round 2 — verdict: revise; findings: critical 0, important 2, minor 3; reviewer: claude-code/claude-opus-5-5
- 2026-10-15T12:53:20Z (perf/csafe-frontmatter): minor (deferred, round 2): writer surrogate walk covers dict/list only (Python tuple/set, TS Map/Set slip through); libyaml-only acceptances not listed (comment right after a block header, tab-led flow continuation)
- 2026-10-15T13:10:28Z (perf/csafe-frontmatter): review: impl round 3 — verdict: revise; findings: critical 1, important 1, minor 4; reviewer: claude-code/claude-opus-5-5
- 2026-10-15T13:11:16Z (perf/csafe-frontmatter): upstream (eemeli/yaml) searched 2026-10-15: issues for double quoted / backslash space newline / emoji / fold surrogate, v2.9.1 notes (merge-alias limits, quoted-string parsing): no report or fix for the double-quoted emitter turning a one-space line into a backslash past doubleQuotedMinMultiLineLength, nor for folding through a surrogate pair. Remedy: doubleQuotedAsJSON (a supported option, never folds); an upstream issue to be prepared for user approval
- 2026-10-15T13:13:02Z (perf/csafe-frontmatter): minor (deferred, round 3): M2 the tab-led-line quoting rule is broader than libyaml needs; M3 TS writer misplaces a break in long strings opening with a space (>2- fold; also on main, not in §13); M4 covered by the new long-value test
- 2026-10-15T13:25:36Z (perf/csafe-frontmatter): review: impl round 3 — verdict: accept; findings: critical 0, important 0, minor 3; reviewer: claude-code/claude-opus-5-5
- 2026-10-15T13:26:02Z (perf/csafe-frontmatter): done
  provenance: {"harness_session":"claude-code:68ab2ddc-9049-44b2-91f0-59dfdd878c6c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-15T13:26:02Z (perf/csafe-frontmatter): Python parses frontmatter with libyaml (CSafeLoader); spec 3.0: surrogates refused by both readers and writers, line-leading U+FEFF refused, tabs between tokens settled; TS writer double-quotes tab-led strings JSON-style. Gate: 755 py / 592 ts; fuzz 20k long values 0 failures both readers; 3 review rounds, final accept
  provenance: {"harness_session":"claude-code:68ab2ddc-9049-44b2-91f0-59dfdd878c6c","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-15T13:37:09Z (main): upstream eemeli/yaml, rechecked 2026-10-15 against 2.9.1, 3.0.0-2 and main: both emitter bugs reproduce and are unreported (closest: #692 / PR #708, block scalars with a leading space, a different path). (1) doubleQuotedString (src/stringify/stringifyString.ts:60-63 and :125-126) escapes a space that both follows a folded newline and precedes \n twice, emitting \\ ; minimal: stringify('a'.repeat(32)+'\n \nb', {defaultStringType:'QUOTE_DOUBLE'}) parses back with the space line as a backslash. (2) foldFlowLines (src/stringify/foldFlowLines.ts:145) folds between UTF-16 units, splitting a surrogate pair: stringify({k:'😀'.repeat(60)}, {defaultStringType:'QUOTE_DOUBLE'}) holds lone surrogates; parse() rejoins them in memory, but a UTF-8 round trip yields two U+FFFD. doubleQuotedAsJSON avoids both. Their CONTRIBUTING requires issue text be the reporter's own writing (no LLM), so the user writes the issues; agent repro scripts in /tmp/yaml-upstream/scripts
