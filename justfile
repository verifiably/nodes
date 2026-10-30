# Front door: test-one python|ts <selector...> for focused work, test-fast for
# affected tests, test-full for deliberate full verification. Checkout-local .tt.toml
# governs broad execution; hygiene always runs. Hook timers measure hygiene only. Fresh clone:
# `git config core.hooksPath .githooks`.
# Every recipe runs through the vendored timing wrapper tools/tt (source of truth: ops
# bin/tt) so the run is recorded. Design: ops docs/specs/2026-09-04-test-ci-audit-design.md.

set quiet
set positional-arguments

tt := "python3 tools/tt"

# Two packages, so each command is written once per package and the whole-repo commands
# below are composed from them. Recipes, hooks, and CI all run these, so none of the
# three can drift from the others. Each is a subshell: `cd` must not leak to the next.
# `pytest` is bare on purpose — pyproject's addopts already carries `-q`, and a second
# `-q` is `-qq`, which drops the summary line the wrapper counts tests from.
py_fast_cmd := "(cd python && uv run --frozen pytest --testmon)"
py_test_cmd := "(cd python && uv run --frozen pytest)"
py_check_cmd := "(cd python && uv run --frozen ruff check . && uv run --frozen pyright src)"

ts_fast_cmd := "(cd ts && npm test -- --changed --passWithNoTests)"
ts_test_cmd := "(cd ts && npm test)"
ts_check_cmd := "(cd ts && npm run typecheck && npm run check)"

fast_cmd := py_fast_cmd + " && " + ts_fast_cmd
test_cmd := py_test_cmd + " && " + ts_test_cmd
check_hygiene_cmd := "python3 tools/ops-check && python3 tools/ops-docs check && tasks check"
check_code_cmd := py_check_cmd + " && " + ts_check_cmd

ci_remote := "origin"
# Coverage is declared only after approved hosted validation.
ci_suite_refs := ""

# Affected-only: the inner loop. An empty selection is a result, not a failure.
test-fast:
    {{tt}} test-fast -- sh -c '{{fast_cmd}}'

# Selectors are relative to the chosen package; argv never enters shell source.
test-one language +args:
    {{tt}} test-one -- sh -c 'case "$1" in python) shift; cd python && exec uv run --frozen pytest "$@";; ts) shift; cd ts && exec npm test -- "$@";; *) echo "test-one: expected python or ts" >&2; exit 2;; esac' test-one "$@"

setup:
    {{tt}} setup -- sh tools/setup

# The full suite, both languages.
test:
    {{tt}} test -- sh -c '{{test_cmd}}'

test-full:
    TT_FORCE=1 just test

check-hygiene:
    {{tt}} check-hygiene -- sh -c '{{check_hygiene_cmd}}'

check-code:
    {{tt}} check-code -- sh -c '{{check_code_cmd}}'

check:
    just check-hygiene
    just check-code

gate:
    just check
    just test

# Render the generated regions of README.md and AGENTS.md from identity.toml and
# tools/family.toml. The only thing that edits those regions; `check` refuses a commit
# while they are out of date.
docs:
    {{tt}} docs -- python3 tools/ops-docs write

# Hook timers cover hygiene; broad children record execution or policy skips.
hook-pre-commit:
    {{tt}} hook-pre-commit -- sh -c '{{check_hygiene_cmd}}'
    just check-code

# The full push route; uncovered policy-off pushes retain hygiene and warn.
hook-pre-push:
    {{tt}} hook-pre-push -- sh -c '{{check_hygiene_cmd}}'
    just check-code
    just test

hook-pre-push-fast:
    {{tt}} hook-pre-push-fast -- sh -c '{{check_hygiene_cmd}}'
    just check-code
    just test-fast

# CI keeps its two-job matrix (Python 3.11/3.13, Node 20/24); each job runs the recipe
# for its package, so the whole job is one recorded number. These run exactly what the
# workflow's steps ran before, in the same order. `tasks check` is not in them: the
# `tasks` binary is not installed on a runner.
ci-python:
    {{tt}} ci-python -- sh -c '{{py_test_cmd}} && {{py_check_cmd}}'

ci-typescript:
    {{tt}} ci-typescript -- sh -c '{{ts_test_cmd}} && {{ts_check_cmd}}'
