# Front door for tests. Inner loop: `just test-fast` (affected-only: pytest-testmon for
# Python, vitest --changed for TypeScript). Full suite: `just test`. Gates: `just check`
# at pre-commit, `just gate` at pre-push. The git hooks in .githooks/ call
# `hook-pre-commit` and `hook-pre-push`, which run the very same commands under their own
# target names so the report can price the hooks. Fresh clone:
# `git config core.hooksPath .githooks`.
# Every recipe runs through the vendored timing wrapper tools/tt (source of truth: ops
# bin/tt) so the run is recorded. Design: ops docs/specs/2026-09-04-test-ci-audit-design.md.

tt := "python3 tools/tt"

# Two packages, so each command is written once per package and the whole-repo commands
# below are composed from them. Recipes, hooks, and CI all run these, so none of the
# three can drift from the others. Each is a subshell: `cd` must not leak to the next.
# `pytest` is bare on purpose — pyproject's addopts already carries `-q`, and a second
# `-q` is `-qq`, which drops the summary line the wrapper counts tests from.
py_fast_cmd := "(cd python && uv run --frozen pytest --testmon)"
py_test_cmd := "(cd python && uv run --frozen pytest)"
py_check_cmd := "(cd python && uv run --frozen ruff check . && uv run --frozen pyright src)"

ts_fast_cmd := "(cd ts && npx vitest run --changed --passWithNoTests)"
ts_test_cmd := "(cd ts && npm test)"
ts_check_cmd := "(cd ts && npm run typecheck && npm run check)"

fast_cmd := py_fast_cmd + " && " + ts_fast_cmd
test_cmd := py_test_cmd + " && " + ts_test_cmd
check_cmd := py_check_cmd + " && " + ts_check_cmd + " && tasks check"

# Affected-only: the inner loop. An empty selection is a result, not a failure.
test-fast:
    {{tt}} test-fast -- sh -c '{{fast_cmd}}'

# The full suite, both languages.
test:
    {{tt}} test -- sh -c '{{test_cmd}}'

# Seconds, not minutes: lint, typecheck, and the task-record check.
check:
    {{tt}} check -- sh -c '{{check_cmd}}'

gate: check test

# What the pre-commit hook runs: `check`'s command under its own hook target.
hook-pre-commit:
    {{tt}} hook-pre-commit -- sh -c '{{check_cmd}}'

# What the pre-push hook runs: the same commands as `gate`, under one hook target.
hook-pre-push:
    {{tt}} hook-pre-push -- sh -c '{{check_cmd}} && {{test_cmd}}'

# CI keeps its two-job matrix (Python 3.11/3.13, Node 20/24); each job runs the recipe
# for its package, so the whole job is one recorded number. These run exactly what the
# workflow's steps ran before, in the same order. `tasks check` is not in them: the
# `tasks` binary is not installed on a runner.
ci-python:
    {{tt}} ci-python -- sh -c '{{py_test_cmd}} && {{py_check_cmd}}'

ci-typescript:
    {{tt}} ci-typescript -- sh -c '{{ts_test_cmd}} && {{ts_check_cmd}}'
