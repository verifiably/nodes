---
id: nodes-e9683c
title: Release post-upload PyPI check races registry propagation
status: todo
priority: 2
size: s
complexity: low
created: 2026-09-12T19:58:15Z
updated: 2026-09-12T19:58:15Z
depends: []
tags: [hygiene]
---

Run 34714105641 (v0.2.0, the first release under verifiably-nodes) published both artefacts correctly — hashes and provenance verified afterwards by hand — but the workflow went red because .github/scripts/pypi_upload_check.py post ran about one second after uv publish returned and PyPI's JSON API had not yet listed the files (FAIL: files still missing on PyPI after upload). A new project is the worst case for read lag; the npm bootstrap the same day showed the same lag (PUT 200, then E404 for about a minute).

Fix: in post mode, poll the JSON endpoint until every local file is present or a bounded deadline passes (a few minutes, short sleeps), then run the existing checks once. pre mode must not poll: an absent version there is a real answer. Keep fail-closed on unexpected files and digest mismatches; only the absent case waits. Extend test_pypi_upload_check.py to cover the wait, and keep the lag-sensitive parts injectable rather than sleeping in tests.

Recording the intent: the workflow's post step must be a real readback, not a wait-and-hope, so the deadline is a failure, not a skip.
