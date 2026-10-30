"""CI evidence must outlive tt and remain available on failed runs."""
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

import pytest

from tests.test_development_routes import Checkout, ROOT
from tests.test_release_scripts import _job, _job_steps


@pytest.mark.parametrize("target", ["ci-python", "ci-typescript"])
@pytest.mark.parametrize("path", [None, "relative/path"])
def test_ci_requires_absolute_evidence_path(tmp_path, target, path):
    checkout = Checkout(tmp_path)
    if path is None:
        del checkout.env["NODES_CI_EVIDENCE_DIR"]
    else:
        checkout.env["NODES_CI_EVIDENCE_DIR"] = path
    assert checkout.just(target).returncode != 0
    assert checkout.events() == []


def test_pytest_reporter_persists_skips_and_modules(tmp_path):
    checkout = Checkout(tmp_path)
    # Only the Python installation supplies this runner; no Node tools are probed.
    uv = checkout.root / "bin/uv"
    uv.write_text(f'#!{sys.executable}\nimport os,sys\nos.execv(sys.executable, [sys.executable, "-m", "pytest", *sys.argv[4:]])\n')
    tests = checkout.root / "python/tests"
    tests.mkdir()
    (tests / "test_some.py").write_text('import pytest\ndef test_pass(): pass\n@pytest.mark.skip(reason="fixture guard")\ndef test_skip(): pass\n')
    (tests / "test_whole.py").write_text('import pytest\npytestmark=pytest.mark.skip(reason="whole module guard")\ndef test_skip(): pass\n')
    evidence = checkout.root / "evidence with spaces"
    evidence.mkdir()
    checkout.env["NODES_CI_EVIDENCE_DIR"] = str(evidence)
    result = checkout.just("--set", "py_check_cmd", "true", "ci-python")
    assert result.returncode == 0, result.stdout + result.stderr
    xml = ET.parse(evidence / "pytest.xml")
    cases = xml.findall(".//testcase")
    assert len(cases) == 3
    assert {c.attrib["classname"] for c in cases} == {"tests.test_some", "tests.test_whole"}
    assert {c.find("skipped").attrib["message"] for c in cases if c.find("skipped") is not None} == {
        "fixture guard", "whole module guard"}
    assert checkout.rows()[-1]["target"] == "ci-python"
    # Broad static failure must not erase the already-produced report.
    failed = checkout.just("--set", "py_check_cmd", "false", "ci-python")
    assert failed.returncode != 0 and (evidence / "pytest.xml").is_file()


@pytest.mark.parametrize("job,report", [("python", "pytest.xml"), ("typescript", "vitest.xml")])
def test_required_artifact_check_fails_missing_junit(tmp_path, job, report):
    workflow = ROOT / ".github/workflows/ci.yml"
    steps = _job_steps(workflow, job)
    check = next(s for s in steps if s.get("name") == "Require coverage evidence")
    upload = next(s for s in steps if str(s.get("uses", "")).startswith("actions/upload-artifact@"))
    assert check["if"] == "always()" and upload["if"] == "always()"
    assert upload["with"]["retention-days"] == 30
    assert upload["with"]["if-no-files-found"] == "error"
    assert "${{ env.NODES_CI_EVIDENCE_DIR }}" in upload["with"]["path"]
    checkout = Checkout(tmp_path)
    directory = checkout.root / "evidence"
    (directory / "module-inventory.txt").write_text("test module\n")
    result = checkout.run("sh", "-eu", "-c", check["run"])
    assert result.returncode != 0
    (directory / report).write_text('<testsuites tests="1"/>')
    assert checkout.run("sh", "-eu", "-c", check["run"]).returncode == 0


@pytest.mark.parametrize("job", ["python", "typescript"])
def test_inventory_preparation_exports_persistent_directory(tmp_path, job):
    steps = _job_steps(ROOT / ".github/workflows/ci.yml", job)
    prepare = next(s for s in steps if s.get("name") == "Prepare coverage evidence")
    checkout = Checkout(tmp_path)
    checkout.env["RUNNER_TEMP"] = str(checkout.root / "runner temp")
    checkout.env["GITHUB_ENV"] = str(checkout.root / "github-env")
    package = "python" if job == "python" else "ts"
    # A real tracked module must appear, including when its pathname has spaces.
    p = checkout.root / package / "tests/test space.py"
    p.parent.mkdir(exist_ok=True)
    p.write_text("")
    assert checkout.run("git", "add", ".").returncode == 0
    assert checkout.run("git", "commit", "-qm", "fixture").returncode == 0
    source = ROOT / package / ("pyproject.toml" if job == "python" else "package.json")
    (checkout.root / package / source.name).write_bytes(source.read_bytes())
    result = checkout.run("sh", "-eu", "-c", prepare["run"], cwd=checkout.root / package)
    assert result.returncode == 0, result.stderr
    assignment = Path(checkout.env["GITHUB_ENV"]).read_text().strip()
    assert assignment.startswith("NODES_CI_EVIDENCE_DIR=")
    directory = Path(assignment.split("=", 1)[1])
    assert directory.is_relative_to(Path(checkout.env["RUNNER_TEMP"]))
    assert "tests/test space.py" in (directory / "module-inventory.txt").read_text()
    assert _job(ROOT / ".github/workflows/ci.yml", job)["env"]["TT_FORCE"] == "1"
