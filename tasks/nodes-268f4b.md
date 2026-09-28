---
id: nodes-268f4b
title: Add parser-preserving Corpus.read_and_check
status: todo
priority: 2
size: s
complexity: mid
process: planned
created: 2026-09-28T11:40:57Z
updated: 2026-09-28T11:46:08Z
depends: []
tags: [performance]
source: "lit:lit-a7b4ec"
agent: codex
---

Implement the tier-3 Python Corpus.read_and_check(registry=None) -> (list[Node], list[Finding]) API defined by the reviewed lit docs/specs/2026-09-28-library-validated-read-design.md and its implementation plan. Read all() once; preserve pre-validation values with node.model_copy(deep=True) only when an effective registry exists. Reuse existing finding collection, exactly preserving check() results, errors, sorting, and its zero-read registry-free path. Preserve yaml.safe_load and fresh all/get/resolve semantics. Cover nested callback mutation, registry override, no-copy registry-free reads, malformed/deleted files, collecting findings and YAML edge cases. Document the additive API. Follow nodes STANDARD tier 3 and its just test-fast/just gate front doors. No implementation until the central lit plan is reviewed. Land this change on nodes main first, after review and gates, before lit integration; existing consumers use unchanged methods. The central spec and plan live in lit because that task owns the cross-project rollout; process is planned under nodes own rules. Research nodes-f09e46 is complete on main.

## Notes

- 2026-09-28T11:46:08Z (main): Central written spec corrections are approved by the user conditionally and incorporated. Implementation is owned here, with process planned; execution details are in lit docs/plans/2026-09-28-library-validated-read-plan.md, upstream prerequisite section. Wait for central plan review before starting; land additive API on nodes main before lit integration. Research nodes-f09e46 is already merged.
