---
id: nodes-f09e46
title: Determine a parser-preserving way to avoid repeated corpus parsing
status: done
priority: 2
size: s
complexity: mid
process: direct
owner: perf/safe-yaml
created: 2026-09-28T10:35:22Z
updated: 2026-09-28T11:20:28Z
started: 2026-09-28T10:37:13Z
completed: 2026-09-28T11:19:48Z
depends: []
tags: [performance]
source: "lit:lit-a7b4ec"
agent: codex
---

## Question

Can validation and Library construction reuse one parsed node list while keeping the existing SafeLoader and all current parsing, finding, ordering and file-freshness behavior?

## Where to start

python/src/nodes/core/corpus.py: Corpus.check calls all(), which rereads/parses every node. lit src/lit/corpus/__init__.py calls all() again when constructing Library. Trace store reads, registry checking, structural findings and callers before proposing a handoff. Read docs/STANDARD.md §§7–8, especially canonical files and reporting checks. Measurements and the rejected loader patch are preserved in lit docs/notes/2026-09-28-library-startup.md and its adjacent directory.

## Bound

One bounded investigation and a small disposable-fixture probe; no production API change yet. Keep yaml.safe_load unchanged. Compare parsed node values, ordering and all findings, including facet violations, dangling refs and mapped-path collisions. Check file edits between operations so reuse does not silently turn live reads into a stale cache. Do not monkeypatch production objects, copy the kernel's validation logic into lit, add a persistent cache, or build a loader compatibility layer.

## Expected result

Recommend the smallest explicit reuse mechanism, identify the exact nodes/lit changes and regression checks it needs, or record why reuse cannot preserve the contract. If a public interface or freshness contract needs design, prepare a short design for review before implementation. Do not claim an implementation or a measured speedup from this investigation.

Two warm parse passes cost about 23 s each out of a 49.26 s verified open. Eliminating one suggests approximately 26 s, an estimate, not a benchmark or a promise of 2x. Preserve correctness rather than expand scope to hit a round number.

## Work it wakes

Record the result on lit-a7b4ec and in the existing profiling note in the same commit as the investigation. The parent performance fix remains open until an accepted implementation and downstream verification land.

## Rejected approach

The C safe loader candidate reached 11.28 s median and matched the held library and walk results, but changed accepted YAML inputs (tabs after a colon and escaped lone surrogates). It was reverted. On 2026-09-28 the user explicitly chose to preserve parser behavior. Do not revive that candidate or shim its differences. The earlier proposal, tests and measurements remain in task history and the retained candidate patch.

## Notes

- 2026-09-28T10:37:13Z (main): started
  provenance: {"harness_session":"codex:01a0e77c-52cd-7bf1-b5fc-bd082b197a78","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-28T10:37:13Z (main): User approved bounded implementation from lit-a7b4ec. Direct process: retain parsing/error contracts, measure the existing safe C loader, and make backend availability explicit; no new parser, persistent cache or dependency.
- 2026-09-28T10:40:29Z (perf/safe-yaml): Implemented safe C loader selection with explicit RuntimeWarning on pure-Python installations, preserving supported installs. Regression tests failed first for slow-parser selection and missing warning; now just test-fast passes and just gate passes (736 Python, 569 TypeScript). Read-only independent review and actual downstream measurements are running.
- 2026-09-28T10:45:04Z (perf/safe-yaml): Independent review found and controller reproduced backend input divergences: SafeLoader accepts an escaped lone surrogate in title but CSafeLoader rejects it; SafeLoader rejects a literal tab after the title colon but CSafeLoader accepts it. Held-corpus digests and full region/trail JSON match, but exact input-preservation acceptance fails. Candidate is uncommitted and held; user decision requested before changing parser semantics or scoping an alternate optimization.
- 2026-09-28T10:49:11Z (perf/safe-yaml): Candidate failed the exact input-preservation acceptance check despite passing the full suites. Restored production parser, tests and README to HEAD; the exact candidate patch and measured results are retained in lit docs/notes/2026-09-28-library-startup/. Both backends still reject Python object tags. No optimization commit or shared pointer change was made.
- 2026-09-28T10:49:11Z (perf/safe-yaml): parked (waiting on user, decision): User decide whether to permit the documented YAML edge-case changes; agent then resumes .worktrees/safe-yaml, applies the candidate patch from lit only if authorized, or scopes a parser-preserving alternative.
  provenance: {"harness_session":"codex:01a0e77c-52cd-7bf1-b5fc-bd082b197a78","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-28T11:09:14Z (perf/safe-yaml): User decision: preserve parser behavior. Re-scoped this task to a bounded investigation of reusing parsed nodes across validation and library construction; loader substitution is rejected. API and file-freshness implications must be settled before implementation.
- 2026-09-28T11:09:14Z (perf/safe-yaml): parked (waiting on agent): Agent investigate a single parsed-node handoff in .worktrees/safe-yaml using a small fixture; report preserved findings/freshness behavior and the smallest API proposal to lit-a7b4ec before implementation.
  provenance: {"harness_session":"codex:01a0e77c-52cd-7bf1-b5fc-bd082b197a78","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-28T11:13:29Z (perf/safe-yaml): resumed
  provenance: {"harness_session":"codex:01a0e77c-52cd-7bf1-b5fc-bd082b197a78","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-28T11:19:48Z (perf/safe-yaml): Completed disposable-fixture investigation: stable values and all finding sources match; live rereads observe edits, retained values do not. Registry callbacks can mutate nested values, so an explicit read_and_check result must validate deep copies. No production change. Runnable probe/results and proposed design are recorded with lit-a7b4ec in docs/notes/2026-09-28-library-startup/ and docs/specs/2026-09-28-library-validated-read-design.md; user spec review precedes implementation.
- 2026-09-28T11:19:48Z (perf/safe-yaml): done
  provenance: {"harness_session":"codex:01a0e77c-52cd-7bf1-b5fc-bd082b197a78","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-28T11:19:48Z (perf/safe-yaml): Answered the reuse question: preserve parsing and existing live APIs with an explicit read-and-check handoff; a changed Library capture point and per-node validation copies require the proposed design review. No speedup claimed.
  provenance: {"harness_session":"codex:01a0e77c-52cd-7bf1-b5fc-bd082b197a78","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-28T11:20:28Z (perf/safe-yaml): Verification: disposable-fixture handoff probe passes; just gate passes with 733 Python and 569 TypeScript tests, lint/type checks clean, tasks check emits no warnings. Production source and tests remain unchanged.
