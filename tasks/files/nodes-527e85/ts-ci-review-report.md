What this change does: It builds TypeScript before Vitest and routes fast tests through the same entry point. Review complete for nodes-527e85: **ready to merge**; the controller owns task completion and integration.

**Strengths**

- [.worktrees/fix-ts-ci/ts/package.json](.worktrees/fix-ts-ci/ts/package.json:32) fixes the shared test entry point. `&&` prevents tests from inspecting old output after a failed build.
- [.worktrees/fix-ts-ci/justfile](.worktrees/fix-ts-ci/justfile:23) forwards `--changed --passWithNoTests` to Vitest after compilation. Full tests, hooks and CI retain the shared route.
- [.worktrees/fix-ts-ci/ts/tests/search-browser.test.ts](.worktrees/fix-ts-ci/ts/tests/search-browser.test.ts:35) still resolves the published search export and inspects its emitted dependency graph. Its assertion was preserved.
- Documentation describes the new build step. No runtime, API, parity or fixture changes appear in the frozen diff.

**Issues**

Critical: none.  
Important: none.  
Minor: none.

**Verification**

Reviewed base `110f89d5af81c7374b7b731ac76ec468358c89f0` through head `8dd401bd836531bf057e6c753f5ca08b445953db`, including CI and release callers, hooks, package scripts, compiler configuration and browser-test dependencies.

Supplied results show 592 TypeScript tests passing with typecheck and Biome on Node 26.5.0. The supplied clean-dist fast run rebuilt output and passed 755 Python tests; it selected zero TypeScript tests, so that run provides no additional browser-assertion coverage.

**Declined to judge**

- Broader browser-test detection, such as dynamic imports: unchanged and outside this orchestration fix.
- Release artifact correctness: release callers were inspected, but packaging behavior was unchanged.
- Historical documentation drift and dependency auditing: explicitly excluded from this review.

**Assessment:** Ready to merge. The change addresses the missing build at the shared entry point without weakening the existing regression test.

Reviewer identity: `codex/gpt-6.1-sol`, verified by a fresh successful `relay model` command. No files, tasks or git state changed; no processes remain from this review. The branch remains at `.worktrees/fix-ts-ci/` for controller integration.

Not checked: no tests rerun or hosted CI execution performed. Node 20/24 confirmation remains for the next CI run.
