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
updated: 2026-09-28T10:37:13Z
started: 2026-09-28T10:37:13Z
depends: []
tags: [performance]
source: "lit:lit-a7b4ec"
agent: codex
---

Measured by lit-a7b4ec; evidence will be committed in lit docs/notes/2026-09-28-library-startup.md and its adjacent reproducer/results directory. On Python 3.13.12, PyYAML 6.0.3 with libyaml, 10,505 nodes: verified warm Library.open median 49.260 s, versus 10.728 s when a process-local probe replaces yaml.safe_load(stream) with yaml.load(stream, Loader=yaml.CSafeLoader). Both modes retain strict construction, registry checks, hashes and two Corpus.all passes; all node/query digests match. Baseline parser source at nodes 596a2c3; 163ad96 changes only a task record.

Outcome: make the smallest nodes-owned loader optimization while preserving the STANDARD's accepted inputs, canonical values and kernel errors. Start at python/src/nodes/core/frontmatter.py:split_frontmatter and trace its callers. Use the safe C loader only, never unsafe Loader. Confirm behavior against malformed/accepted frontmatter fixtures and typed/structural oracles, including dates, aliases/cycles, non-string keys, invalid UTF-8 and Python object tags. Add a focused regression check for the supported loader contract.

Bound: no persistent node cache, parser rewrite, new dependency or lit monkeypatch. Establish libyaml availability on supported installs; do not silently drop pure-Python support or introduce an undocumented fallback. If that needs a public support-policy change or parser semantics differ, record the finding before expanding scope. Respect this repository's test front door and gates. Verify lit against an explicit nodes worktree path without repointing shared launchers or dependency links.

Acceptance: preserved parsing/error contracts and passing nodes gates, plus lit's measured >=2x verified-open improvement and unchanged library/region/trail results. Record the nodes commit and add a finding note to lit-a7b4ec so it can finish its downstream verification. Cross-project implementation is awaiting the user's scope decision; this task is the concrete handoff.

## Notes

- 2026-09-28T10:37:13Z (main): started
  provenance: {"harness_session":"codex:01a0e77c-52cd-7bf1-b5fc-bd082b197a78","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-28T10:37:13Z (main): User approved bounded implementation from lit-a7b4ec. Direct process: retain parsing/error contracts, measure the existing safe C loader, and make backend availability explicit; no new parser, persistent cache or dependency.
