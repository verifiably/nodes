---
id: nodes-e9683c
title: Release post-upload PyPI check races registry propagation
status: todo
priority: 2
size: s
complexity: low
process: direct
created: 2026-09-12T19:58:15Z
updated: 2026-09-24T13:52:52Z
depends: []
tags: [hygiene]
---

Run 34714105641 (v0.2.0, the first release under verifiably-nodes) published both artefacts correctly (hashes and provenance verified afterwards by hand), but the workflow went red: .github/scripts/pypi_upload_check.py post ran about one second after uv publish returned, before PyPI's JSON API listed the files (FAIL: files still missing on PyPI after upload). A new project is the worst case for read lag; the npm bootstrap the same day showed the same lag (PUT 200, then E404 for about a minute).

Fix: in post mode, poll the JSON endpoint until every local file is present or a bounded deadline passes (a few minutes, short sleeps), then run the existing checks once. pre mode must not poll: an absent version there is a real answer. Stay fail-closed on unexpected files and digest mismatches; only the absent case waits. Extend python/tests/test_pypi_upload_check.py to cover the wait, with the lag-sensitive parts (clock, sleep, fetch) injectable so tests never sleep.

Intent: the post step is a real readback, not a wait-and-hope, so reaching the deadline is a failure, not a skip.

## Notes

- 2026-09-24T13:52:52Z (main): curate: refined; named the test path python/tests/test_pypi_upload_check.py and the injectable parts (clock, sleep, fetch); process direct: the body settles outcome, approach (post-only bounded poll, fail-closed otherwise), and verification; race still present (no poll in pypi_upload_check.py, release.yml runs post straight after uv publish)
