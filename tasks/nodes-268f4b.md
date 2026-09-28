---
id: nodes-268f4b
title: Add parser-preserving Corpus.read_and_check
status: done
priority: 2
size: s
complexity: mid
process: planned
owner: main
created: 2026-09-28T11:40:57Z
updated: 2026-09-28T12:17:03Z
started: 2026-09-28T12:12:56Z
completed: 2026-09-28T12:17:03Z
depends: []
tags: [performance]
source: "lit:lit-a7b4ec"
agent: codex
---

Implement the tier-3 Python Corpus.read_and_check(registry=None) -> (list[Node], list[Finding]) API defined by the reviewed lit docs/specs/2026-09-28-library-validated-read-design.md and its implementation plan. Read all() once; preserve pre-validation values with node.model_copy(deep=True) only when an effective registry exists. Reuse existing finding collection, exactly preserving check() results, errors, sorting, and its zero-read registry-free path. Preserve yaml.safe_load and fresh all/get/resolve semantics. Cover nested callback mutation, registry override, no-copy registry-free reads, malformed/deleted files, collecting findings and YAML edge cases. Document the additive API. Follow nodes STANDARD tier 3 and its just test-fast/just gate front doors. No implementation until the central lit plan is reviewed. Land this change on nodes main first, after review and gates, before lit integration; existing consumers use unchanged methods. The central spec and plan live in lit because that task owns the cross-project rollout; process is planned under nodes own rules. Research nodes-f09e46 is complete on main.

## Notes

- 2026-09-28T11:46:08Z (main): Central written spec corrections are approved by the user conditionally and incorporated. Implementation is owned here, with process planned; execution details are in lit docs/plans/2026-09-28-library-validated-read-plan.md, upstream prerequisite section. Wait for central plan review before starting; land additive API on nodes main before lit integration. Research nodes-f09e46 is already merged.
- 2026-09-28T12:12:56Z (main): started
  provenance: {"harness_session":"codex:01a0e77c-52cd-7bf1-b5fc-bd082b197a78","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-28T12:17:03Z (feat/read-and-check): Implemented opt-in read_and_check with one all() pass and registry-only model_copy(deep=True), preserving the shared finding collector and existing check behavior. RED: 9 missing-method failures; GREEN just test-fast 138 passed; just gate 743 Python and 569 TypeScript passed. Independent read-only review found no issues; downstream integration/measurements remain with lit.
- 2026-09-28T12:17:03Z (feat/read-and-check): done
  provenance: {"harness_session":"codex:01a0e77c-52cd-7bf1-b5fc-bd082b197a78","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-28T12:17:03Z (feat/read-and-check): Add parser-preserving read-and-check API with mutation isolation, fresh-read/error tests, complete finding parity and documentation; upstream review and gate clean.
  provenance: {"harness_session":"codex:01a0e77c-52cd-7bf1-b5fc-bd082b197a78","harness_session_source":"CODEX_SESSION_ID"}
