---
id: nodes-77c7cc
title: "Rename to verifiably-nodes and @verifiably/nodes, and retire the published names"
status: done
priority: 2
size: m
complexity: mid
owner: main
created: 2026-09-07T16:01:08Z
updated: 2026-09-12T19:19:08Z
started: 2026-09-12T16:59:27Z
completed: 2026-09-12T17:10:40Z
depends: [nodes-463301]
tags: [hygiene]
---

Adopting the stack-wide scheme decided 2026-09-07: verifiably-<layer> on PyPI, @verifiably/<layer> on npm, dropping the -core suffix. nodes is the only project where this renames something already published, so it is the only one that needs a retirement plan rather than an edit.

Published today: PyPI nodes-core 0.1.1, npm @nodes-dev/core 0.1.1 (two versions).

- npm is the easy half: the @verifiably scope is owned, and npm deprecate can point @nodes-dev/core at @verifiably/nodes so anyone who installs it is told.
- PyPI has no redirect and no deprecation flag. Either leave nodes-core where it is, or publish one final nodes-core release whose description names the successor. With a userbase of effectively one, leaving it is defensible; say which was chosen and why.

Consumers to update in the same change: beliefs/python/pyproject.toml declares nodes-core in dependencies and as a [tool.uv.sources] key, and mind6 depends on the npm package by name in packages/web/package.json and packages/mindful/package.json (both file: paths, so only the name key moves). mind6 is outside the verifiably family, so its gates should run before that lands.

.github/workflows/release.yml tags on core/v*, which stops matching the artefact's name once it is not core; decide the new tag prefix at the same time.

## Notes

- 2026-09-07T18:16:02Z (main): Scope changed by that deletion: the npm half is now trivial. There is no published @nodes-dev/core to deprecate or coordinate with, so renaming npm-side is purely local — nodes/ts/package.json plus mind6's packages/web and packages/mindful, which both name it in dependencies, then regenerate the lockfiles. The trusted publisher for @verifiably/nodes gets created fresh at its first publish. Versions 0.0.0 and 0.1.1 of the old name are burned permanently by npm policy, which costs nothing since the successor is a different name.
- 2026-09-07T18:16:02Z (main): The PyPI half is where the remaining substance is: nodes-core 0.1.1 is published and PyPI offers neither redirect nor deprecation, so the choice is still to leave it orphaned or publish one final release naming the successor. Deleting it the way npm's was is not equivalent — PyPI unpublishing is discouraged and the name would stay unusable rather than freed.
- 2026-09-12T16:43:24Z (main): complexity mid: mechanical rename with two bounded calls left (PyPI leave-vs-final-release, default stated in body; new release tag prefix) and cross-project consumer edits gated by mind6
- 2026-09-12T17:02:16Z (main): Decisions: release tag prefix becomes v* (repo is one layer now; core/ namespacing came from the nodes-dev/core monorepo option). PyPI nodes-core 0.1.1 is left in place, no farewell release; archiving it on PyPI is an optional user step. Scope finding: mind6 names @nodes-dev/core in every import (~80 src/test files, link-core.mjs, check-core-freshness.mjs, bundledDependencies), not only the package.json name keys.
- 2026-09-12T17:10:40Z (main): Renamed to verifiably-nodes (PyPI) and @verifiably/nodes (npm); release tag prefix is now v*; verify/smoke scripts, tests, READMEs and both lockfiles follow. PyPI nodes-core 0.1.1 left in place (no farewell release; archiving is optional). Consumers updated in beliefs (pyproject + uv.lock) and mind6 (both package.json, ~80 import sites, link/freshness scripts, lockfile); all three gates green. Left for the user: repoint the GitHub release environment tag policy core/v* -> v*, add a PyPI pending publisher for verifiably-nodes and remove nodes-core's, and bump the lockstep version before the first v* tag.
- 2026-09-12T19:19:08Z (main): Registry setup completed by the user 2026-09-12: release env tag policy repointed to v* (policy id 59809952); PyPI pending publisher added for verifiably-nodes and both nodes-core publishers removed; @verifiably/nodes@0.0.0 bootstrap published by hand from a clean HEAD build (PUT 200, propagation lag caused a transient 404), trusted publisher attached, publishing access set to 2FA-only. Left: bump to 0.2.0, tag v0.2.0, then npm deprecate 0.0.0.
