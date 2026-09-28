---
id: nodes-f09e46
title: Use the C safe YAML loader to reduce Python corpus parsing cost
status: doing
priority: 2
size: s
complexity: mid
process: direct
owner: main
created: 2026-09-28T10:35:22Z
updated: 2026-09-28T10:49:11Z
started: 2026-09-28T10:37:13Z
depends: []
tags: [performance]
source: "lit:lit-a7b4ec"
agent: codex
---

Measured by lit-a7b4ec; evidence will be committed in lit docs/notes/2026-09-28-library-startup.md and its adjacent reproducer/results directory. On Python 3.13.12, PyYAML 6.0.3 with libyaml, 10,505 nodes: verified warm Library.open median 49.260 s, versus 10.728 s when a process-local probe replaces yaml.safe_load(stream) with yaml.load(stream, Loader=yaml.CSafeLoader). Both modes retain strict construction, registry checks, hashes and two Corpus.all passes; all node/query digests match. Baseline parser source at nodes 596a2c3; 163ad96 changes only a task record.

Outcome: make the smallest nodes-owned loader optimization while preserving the STANDARD's accepted inputs, canonical values and kernel errors. Start at python/src/nodes/core/frontmatter.py:split_frontmatter and trace its callers. Use the safe C loader only, never unsafe Loader. Confirm behavior against malformed/accepted frontmatter fixtures and typed/structural oracles, including dates, aliases/cycles, non-string keys, invalid UTF-8 and Python object tags. Add a focused regression check for the supported loader contract.

Bound: no persistent node cache, parser rewrite, new dependency or lit monkeypatch. Establish libyaml availability on supported installs; do not silently drop pure-Python support or introduce an undocumented fallback. If that needs a public support-policy change or parser semantics differ, record the finding before expanding scope. Respect this repository's test front door and gates. Verify lit against an explicit nodes worktree path without repointing shared launchers or dependency links.

Acceptance: preserved parsing/error contracts and passing nodes gates, plus lit's measured >=2x verified-open improvement and unchanged library/region/trail results. Record the nodes commit and add a finding note to lit-a7b4ec so it can finish its downstream verification. The user approved this bounded cross-project implementation in the originating session.

## Notes

- 2026-09-28T10:37:13Z (main): started
  provenance: {"harness_session":"codex:01a0e77c-52cd-7bf1-b5fc-bd082b197a78","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-28T10:37:13Z (main): User approved bounded implementation from lit-a7b4ec. Direct process: retain parsing/error contracts, measure the existing safe C loader, and make backend availability explicit; no new parser, persistent cache or dependency.
- 2026-09-28T10:40:29Z (perf/safe-yaml): Implemented safe C loader selection with explicit RuntimeWarning on pure-Python installations, preserving supported installs. Regression tests failed first for slow-parser selection and missing warning; now just test-fast passes and just gate passes (736 Python, 569 TypeScript). Read-only independent review and actual downstream measurements are running.
- 2026-09-28T10:45:04Z (perf/safe-yaml): Independent review found and controller reproduced backend input divergences: SafeLoader accepts an escaped lone surrogate in title but CSafeLoader rejects it; SafeLoader rejects a literal tab after the title colon but CSafeLoader accepts it. Held-corpus digests and full region/trail JSON match, but exact input-preservation acceptance fails. Candidate is uncommitted and held; user decision requested before changing parser semantics or scoping an alternate optimization.
- 2026-09-28T10:49:11Z (perf/safe-yaml): Candidate failed the exact input-preservation acceptance check despite passing the full suites. Restored production parser, tests and README to HEAD; the exact candidate patch and measured results are retained in lit docs/notes/2026-09-28-library-startup/. Both backends still reject Python object tags. No optimization commit or shared pointer change was made.
- 2026-09-28T10:49:11Z (perf/safe-yaml): parked (waiting on user, decision): User decide whether to permit the documented YAML edge-case changes; agent then resumes .worktrees/safe-yaml, applies the candidate patch from lit only if authorized, or scopes a parser-preserving alternative.
  provenance: {"harness_session":"codex:01a0e77c-52cd-7bf1-b5fc-bd082b197a78","harness_session_source":"CODEX_SESSION_ID"}
