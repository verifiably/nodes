"""Exercise development recipes without touching host tools, config or environments."""
from __future__ import annotations

import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]
BROAD = ["test", "test-fast", "check-code", "ci-python", "ci-typescript"]

STUB = r'''
import json, os, pathlib, shutil, sys
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
root = pathlib.Path(os.environ["FIXTURE_ROOT"])
if name == "tasks" and args != ["check"]:
    print(json.dumps({"project": {"root": str(root), "prefix": "fixture", "linked": False}}))
    sys.exit(0)
with open(os.environ["EVENTS"], "a") as f:
    f.write(json.dumps([name, args, os.getcwd(), os.environ.get("GIT_DIR")]) + "\n")
if os.environ.get("FAIL_STEP") == name:
    sys.exit(7)
if name == "work-link":
    status = os.environ.get("LINK_STATUS", "outside")
    print("created\t" + str(root / "anchor") + "\tanchor")
    if status != "missing":
        print(status + "\t" + str(root / "python/.venv"))
    if status == "duplicate":
        print("outside\t" + str(root / "python/.venv"))
if name == "npm" and args == ["ci"]:
    shutil.rmtree(root / "ts/node_modules", ignore_errors=True)
    (root / "ts/node_modules").mkdir()
if name == "npm" and args == ["run", "build"]:
    (root / "ts/dist").mkdir(exist_ok=True)
if name == "ssh":
    print("serveraliveinterval " + os.environ.get("SSH_INTERVAL", "60"))
if "--return-seven" in args:
    sys.exit(7)
'''


class Checkout:
    def __init__(self, tmp: Path):
        self.root = tmp / "checkout"
        self.root.mkdir()
        for directory in ("python", "ts", "tools", ".githooks", "bin", "home", "evidence"):
            (self.root / directory).mkdir()
        for path in ("justfile", "tools/tt", ".githooks/pre-push", "tools/setup"):
            if (ROOT / path).exists():
                shutil.copy(ROOT / path, self.root / path)
        self.env = {
            "PATH": f"{self.root / 'bin'}:{Path(shutil.which('just')).parent}:/usr/bin:/bin",
            "HOME": str(self.root / "home"),
            "GIT_CONFIG_GLOBAL": str(self.root / "home/gitconfig"),
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_AUTHOR_NAME": "Fixture", "GIT_AUTHOR_EMAIL": "fixture@example.invalid",
            "GIT_COMMITTER_NAME": "Fixture", "GIT_COMMITTER_EMAIL": "fixture@example.invalid",
            "FIXTURE_ROOT": str(self.root), "EVENTS": str(self.root / "events.jsonl"),
            "TT_LOG": str(self.root / "runs.jsonl"),
            "NODES_CI_EVIDENCE_DIR": str(self.root / "evidence"),
        }
        subprocess.run(["git", "init", "-q", str(self.root)], env=self.env, check=True)
        assert self.run("git", "rev-parse", "--show-toplevel").stdout.strip() == str(self.root)
        gitdir = Path(self.run("git", "rev-parse", "--absolute-git-dir").stdout.strip())
        assert gitdir.is_relative_to(self.root)
        for name in ("uv", "npm", "tasks", "work-link", "attr", "ssh"):
            p = self.root / "bin" / name
            p.write_text(f"#!{sys.executable}\n" + STUB)
            p.chmod(0o755)
        for name in ("ops-check", "ops-docs"):
            (self.root / "tools" / name).write_text(STUB.replace('name = pathlib.Path(sys.argv[0]).name', f'name = "{name}"'))

    def run(self, *args, stdin=None, cwd=None):
        return subprocess.run(args, cwd=cwd or self.root, env=self.env, input=stdin,
                              capture_output=True, text=True, timeout=30)

    def just(self, *args):
        return self.run("just", *args)

    def policy(self, enabled=False):
        (self.root / ".tt.toml").write_text(
            f"automatic_broad = {str(enabled).lower()}\nbroad_targets = {json.dumps(BROAD)}\n")

    def events(self):
        p = self.root / "events.jsonl"
        return [json.loads(line) for line in p.read_text().splitlines()] if p.exists() else []

    def rows(self):
        p = self.root / "runs.jsonl"
        return [json.loads(line) for line in p.read_text().splitlines()] if p.exists() else []


@pytest.fixture
def checkout(tmp_path):
    return Checkout(tmp_path)


@pytest.mark.parametrize("language,runner,prefix", [("python", "uv", ["run", "--frozen", "pytest"]),
                                                    ("ts", "npm", ["test", "--"])])
def test_focused_argv(checkout, language, runner, prefix):
    args = ["tests/a space's.test", "-k", "$(touch INJECTED) $HOME *", "--return-seven"]
    result = checkout.just("test-one", language, *args)
    assert result.returncode == 7, result.stderr
    event = checkout.events()[0]
    assert event[:3] == [runner, prefix + args, str(checkout.root / ("python" if language == "python" else "ts"))]
    assert not (checkout.root / "INJECTED").exists()


@pytest.mark.parametrize("args", [[], ["python"], ["ts"], ["unknown", "test"]])
def test_focused_arity_rejects_missing_or_unknown_language(checkout, args):
    assert checkout.just("test-one", *args).returncode != 0
    assert checkout.events() == []


@pytest.mark.parametrize("status", ["outside", "external", "ok", "created", "relinked", "materialized", "rewritten"])
def test_setup_uses_work_link_result(checkout, status):
    checkout.env["LINK_STATUS"] = status
    synced = status not in ("outside", "external")
    if synced:
        store = checkout.root / "store"
        store.mkdir()
        (checkout.root / "python/.venv").symlink_to(store)
    else:
        (checkout.root / "bin/attr").unlink()
    for _ in range(2):
        result = checkout.just("setup")
        assert result.returncode == 0, result.stderr
    names = [e[0] for e in checkout.events()]
    assert names == (["work-link", "uv", "npm", "attr", "npm", "attr"] if synced else
                     ["work-link", "uv", "npm", "npm"]) * 2
    if synced:
        marks = [e[1] for e in checkout.events() if e[0] == "attr"]
        assert marks == [["-s", "com.dropbox.ignored", "-V", "1", "node_modules"],
                         ["-s", "com.dropbox.ignored", "-V", "1", "dist"]] * 2


@pytest.mark.parametrize("status", ["missing", "duplicate", "unexpected", "needs-migration"])
def test_setup_rejects_invalid_result(checkout, status):
    checkout.env["LINK_STATUS"] = status
    assert checkout.just("setup").returncode != 0
    assert [e[0] for e in checkout.events()] == ["work-link"]


@pytest.mark.parametrize("step", ["work-link", "attr"])
def test_setup_failure_stops_installation(checkout, step):
    checkout.env.update(LINK_STATUS="ok", FAIL_STEP=step)
    store = checkout.root / "store"
    store.mkdir()
    (checkout.root / "python/.venv").symlink_to(store)
    assert checkout.just("setup").returncode != 0
    assert [e[0] for e in checkout.events()] == (["work-link"] if step == "work-link" else
                                               ["work-link", "uv", "npm", "attr"])


def test_setup_uses_physical_git_root_through_symlink(checkout, tmp_path):
    alias = tmp_path / "alias"
    alias.symlink_to(checkout.root, target_is_directory=True)
    result = checkout.run("sh", "-c", 'cd "$1" && sh tools/setup', "fixture", str(alias))
    assert result.returncode == 0, result.stderr
    assert [e[0] for e in checkout.events()] == ["work-link", "uv", "npm", "npm"]


@pytest.mark.parametrize("recipe", ["hook-pre-commit", "hook-pre-push", "hook-pre-push-fast", "check"])
def test_hooks_keep_hygiene_and_propagate_failure(checkout, recipe):
    checkout.policy()
    result = checkout.just(recipe)
    assert result.returncode == 0, result.stderr
    assert [e[0] for e in checkout.events()] == ["ops-check", "ops-docs", "tasks"]
    skipped = [r for r in checkout.rows() if r.get("execution") == "skipped"]
    assert {r["target"] for r in skipped} == ({"check-code"} if recipe in ("hook-pre-commit", "check") else
                                              {"check-code", "test-fast" if recipe.endswith("fast") else "test"})
    assert all(all(r[k] is None for k in ("exit", "tests", "selection", "slowest")) for r in skipped)
    checkout.env["FAIL_STEP"] = "ops-check"
    before = len(checkout.events())
    assert checkout.just(recipe).returncode != 0
    assert [e[0] for e in checkout.events()[before:]] == ["ops-check"]


@pytest.mark.parametrize("enabled", [None, True])
def test_enabled_hooks_execute_broad_children(checkout, enabled):
    if enabled is not None:
        checkout.policy(enabled)
    result = checkout.just("hook-pre-push")
    assert result.returncode == 0, result.stderr
    assert any(e[0] == "uv" for e in checkout.events())
    assert any(e[0] == "npm" for e in checkout.events())


def test_test_full_forces_failure(checkout):
    checkout.policy()
    checkout.env["FAIL_STEP"] = "uv"
    assert checkout.just("test-full").returncode != 0
    rows = checkout.rows()
    assert len(rows) == 1 and rows[0]["target"] == "test" and rows[0]["exit"] == 7
    assert rows[0]["execution_reason"] == "forced"


@pytest.mark.parametrize("target", ["ci-python", "ci-typescript"])
def test_hosted_force_contract(checkout, target):
    checkout.policy()
    checkout.env["GITHUB_ACTIONS"] = "true"
    result = checkout.just(target)
    assert result.returncode != 0 and "TT_FORCE=1" in result.stderr
    assert checkout.events() == [] and checkout.rows() == []
    checkout.env.update(TT_FORCE="1", FAIL_STEP="uv" if target == "ci-python" else "npm")
    assert checkout.just(target).returncode != 0
    assert checkout.rows()[-1]["exit"] == 7


@pytest.mark.parametrize("remote,ref,wanted", [("origin", "refs/heads/main", "hook-pre-push-fast"),
    ("origin", "refs/heads/feature/x", "hook-pre-push-fast"), ("origin", "refs/tags/v1", "hook-pre-push-fast"),
    ("origin", "refs/tags/other", "hook-pre-push"), ("mirror", "refs/heads/main", "hook-pre-push")])
def test_push_coverage_routing(checkout, remote, ref, wanted):
    checkout.policy()
    with (checkout.root / "justfile").open("a") as f:
        f.write('\nprobe:\n    @cat > refs.actual\n')
    # Wrap real just only at the hook boundary, retaining its own variable evaluation.
    real_just = shutil.which("just")
    wrapper = checkout.root / "bin/just"
    wrapper.write_text(f'#!/bin/sh\nif [ "$1" = "--evaluate" ]; then exec "{real_just}" "$@"; fi\n'
                       'printf "%s" "$1" > chosen\ncat > refs.actual\n')
    wrapper.chmod(0o755)
    text = (checkout.root / "justfile").read_text()
    text += '\nci_remote := "origin"\nci_suite_refs := "refs/heads/* refs/tags/v*"\n' if "ci_remote :=" not in text else ""
    text = text.replace('ci_suite_refs := ""', 'ci_suite_refs := "refs/heads/* refs/tags/v*"')
    (checkout.root / "justfile").write_text(text)
    refs = f"refs/heads/local {'1' * 40} {ref} {'2' * 40}\n"
    result = checkout.run("sh", ".githooks/pre-push", remote, "git@example.invalid:repo", stdin=refs)
    assert result.returncode == 0, result.stderr
    assert (checkout.root / "chosen").read_text() == wanted
    assert (checkout.root / "refs.actual").read_text() == refs
    assert [e[1] for e in checkout.events() if e[0] == "ssh"] == [["-G", "example.invalid"]]
    if wanted == "hook-pre-push":
        assert "coverage is not declared" in result.stderr
    checkout.env["SSH_INTERVAL"] = "0"
    (checkout.root / "chosen").unlink()
    assert checkout.run("sh", ".githooks/pre-push", remote, "git@example.invalid:repo", stdin=refs).returncode != 0
    assert not (checkout.root / "chosen").exists()


def test_nested_hosted_refuses_without_force(checkout):
    checkout.policy()
    with (checkout.root / "justfile").open("a") as f:
        f.write('\nnested:\n    {{tt}} outer -- just ci-python\n')
    checkout.env["GITHUB_ACTIONS"] = "true"
    result = checkout.just("nested")
    assert result.returncode != 0 and "TT_FORCE=1" in result.stderr
    assert checkout.events() == []
    assert all(r["execution"] == "ran" and r["exit"] != 0 for r in checkout.rows())
    checkout.env.update(TT_FORCE="1", FAIL_STEP="uv")
    assert checkout.just("nested").returncode != 0
    assert checkout.rows()[-1]["exit"] == 7


@pytest.mark.parametrize("refs,coverage,wanted", [
    ("malformed\n", "refs/heads/*", "hook-pre-push"),
    (f"local {'1' * 40} refs/heads/main {'2' * 40}\n\n", "refs/heads/*", "hook-pre-push"),
    (f"local {'0' * 40} refs/heads/gone {'2' * 40}\n", "refs/heads/*", "hook-pre-push-fast"),
    (f"local {'1' * 40} refs/heads/main {'2' * 40}\n", "", "hook-pre-push"),
    (f"local {'1' * 40} refs/heads/main {'2' * 40}\nlocal {'1' * 40} refs/tags/other {'2' * 40}\n",
     "refs/heads/*", "hook-pre-push"),
])
def test_push_validates_every_ref_and_preserves_bytes(checkout, refs, coverage, wanted):
    checkout.policy()
    p = checkout.root / "justfile"
    p.write_text(re.sub(r'^ci_suite_refs := ".*"$', f'ci_suite_refs := "{coverage}"',
                        p.read_text(), flags=re.MULTILINE))
    real_just = shutil.which("just")
    wrapper = checkout.root / "bin/just"
    wrapper.write_text(f'#!/bin/sh\nif [ "$1" = "--evaluate" ]; then exec "{real_just}" "$@"; fi\n'
                       'printf "%s" "$1" > chosen\ncat > refs.actual\n')
    wrapper.chmod(0o755)
    result = checkout.run("sh", ".githooks/pre-push", "origin", "git@example.invalid:repo", stdin=refs)
    assert result.returncode == 0, result.stderr
    assert (checkout.root / "chosen").read_text() == wanted
    assert (checkout.root / "refs.actual").read_text() == refs


def test_hook_clears_git_local_environment(checkout):
    checkout.policy()
    checkout.env["GIT_DIR"] = str(checkout.root / ".git")
    checkout.env["GIT_WORK_TREE"] = str(checkout.root)
    result = checkout.run("sh", ".githooks/pre-push", "origin", "git@example.invalid:repo", stdin="bad\n")
    assert result.returncode == 0, result.stderr
    assert checkout.events() and all(e[3] is None for e in checkout.events() if e[0] != "ssh")
