# Planning review ledger

Task nodes-6fde14. Controller Codex. Approved design: cc5df734f321d9755496e344866776f6c289f11b at docs/designs/2026-10-30-test-execution-policy-design.md. Spec round 4 reviewer claude/claude-opus-5-5 accepted with Minor 2, followed by explicit user acceptance for planning. The full supplied review is spec-round-4-report.md. Earlier seven rulings remain in attached review-ledger.md and already reached the prior final report.

Ruling: spec round 4 Minor 1 accepted and settled in plan Task 1 and Global Constraints. Use one successful work-link result to classify setup; outside and external skip attr, managed-link statuses require it, and invalid/ambiguous/needs-migration output fails. Why: work-link is the location authority and this real storage worktree was observed to report external; treating only outside as nonsynced would still fail here. Cost: a classification error can block setup or sync generated files. Proposed in docs/plans/2026-10-30-test-execution-policy.md against design cc5df73; user plan review remains required.

Ruling: spec round 4 Minor 2 accepted and settled in plan Tasks 2/3. Use explicit approval for one manual Release workflow dispatch on the reviewed branch; preserve and locally test both tag-push-only publishing guards, check actual run SHA/event/ref and skipped publish jobs. No release tag is created or pushed. Why: a matching tag push can publish packages. Cost: an incorrect ref/guard can run the wrong code or expose publishing; actual tag-trigger execution remains untested and is disclosed. Proposed in docs/plans/2026-10-30-test-execution-policy.md against design cc5df73; external dispatch remains gated separately from plan review.

No minor (deferred) finding. Both are carried as concrete implementation checks, not claims of implemented behavior.

Plan self-review: spec coverage, step granularity, consistent recipe/environment names, all five Review Focus fixtures and proportion checked. Three sequential deliverables: local routes; hosted evidence/preparation; approved validation/activation. No production code or test execution in this planning phase. Fresh final whole-branch reviewer and corrective rounds remain in execution.

Frozen plan revision: ace792b31163d960319a797d9cdcd0b56509c63d at docs/plans/2026-10-30-test-execution-policy.md, SHA-256 5ed03d99aa54a922d94e1beb1c07eee26a729ff77e37a2dc187a9e24293d1262. Plan round 1 is a self-review by verified codex/gpt-6.1-sol: accept, no findings. User plan approval remains pending.
