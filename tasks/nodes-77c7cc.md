---
id: nodes-77c7cc
title: "Rename to verifiably-nodes and @verifiably/nodes, and retire the published names"
status: todo
priority: 2
size: m
created: 2026-09-07T16:01:08Z
updated: 2026-09-07T18:16:02Z
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
