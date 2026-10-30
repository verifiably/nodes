# Plan round 2 review ledger

Task: nodes-6fde14. Controller: Codex. Supplied reviewer: claude/claude-opus-5-5; verdict revise, Important 1, Minor 3. Full portable review is attached as plan-round-2-report.md; exact raw bytes are retained on the task under the existing layout fallback. Prior spec and plan rulings remain in their existing attachments and have already reached final reports.

Reviewed plan: ace792b31163d960319a797d9cdcd0b56509c63d at docs/plans/2026-10-30-test-execution-policy.md, SHA-256 5ed03d99aa54a922d94e1beb1c07eee26a729ff77e37a2dc187a9e24293d1262.
New frozen plan: 6beecc9ad558b85406c199bbae93ec6ec11edc8e at the same path, SHA-256 6fc2050edc3f5a3e7fe6aa49517754701b2648e12309c310430de66a3b6d7f6e.
Approved design cc5df734f321d9755496e344866776f6c289f11b remains unchanged.

- Ruling: I1 accepted and corrected in 6beecc9. Keep the pytest reporter pilot in python/tests/test_ci_evidence.py and put the Vitest pilot in ts/tests/ci-evidence.test.ts, with separate test-one python and test-one ts RED/GREEN commands. Node pilot discovery is isolated from its parent to avoid recursive execution; no extra package installation is introduced. Why: Python matrix setup has no TS dependencies, so Python-hosted Vitest execution would fail or add a cross-language requirement. Cost: reporter behavior in either package is still unverified until implementation and its own focused/hosted checks.
- Ruling: M2 accepted and corrected in 6beecc9. Every hook fixture puts a recording ssh stub first on PATH with explicit serveraliveinterval 0 and 60 cases, checking refusal before any gate and success afterward. Why: fixture HOME alone cannot isolate OpenSSH account configuration. Cost: an inaccurate stub could misrepresent real keepalive semantics; assert exact -G invocation and preserve the actual hook logic.
- Ruling: M3 accepted and corrected in 6beecc9. Compare work-link output against git rev-parse --show-toplevel plus /python/.venv; add a logical-PWD/symlink-entry fixture and ignore unrelated anchor rows. Why: work-link reports the physical Git root, which can differ from the logical shell path. Cost: a wrong comparison can fail setup or select an unrelated row.
- Ruling: M4 accepted and corrected in 6beecc9. After enabled integration/floor recording, bring main into the retained task branch, commit .tt.toml/coverage/guidance there, freeze and review before merging main. Why: activation code belongs in the isolated worktree and needs a concrete diff for review. Cost: wrong sequencing can activate an unreviewed policy or lose the regime-floor record.

No minor (deferred) findings. All four are corrected in the plan, not implemented or runtime-verified.

Plan round 3 self-review by verified codex/gpt-6.1-sol: accept, no findings. Checked spec coverage, focused command/package consistency, fixture isolation, all five Review Focus cases and proportion. Actual code/tests/CI remain gated on user approval of this new frozen plan; external approval is a later gate.
