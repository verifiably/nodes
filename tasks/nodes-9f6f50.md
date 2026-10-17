---
id: nodes-9f6f50
title: Fill in setup_cmd for the ts tree so a fresh worktree runs the suite
status: todo
priority: 2
size: xs
complexity: low
created: 2026-09-11T21:13:32Z
updated: 2026-10-17T20:32:28Z
depends: []
tags: [testing]
source: ops-9c7dab
---

Piece of ops-9c7dab, same shape as beliefs: setup_cmd := "(cd ts && npm ci)" and the setup recipe from ops templates/justfile, so just setup after git worktree add is enough for the gates to pass. Confirm by creating a throwaway worktree and running just setup && just check there.

## Notes

- 2026-09-12T16:43:24Z (main): complexity low: mirrors beliefs' setup_cmd, one config line plus the ops template recipe, check is the throwaway-worktree run the body names
- 2026-10-17T20:32:28Z (main): scope: rescoped; premises hold against ops templates/justfile and beliefs justfile as of 2026-10-17: setup_cmd plus the setup recipe still the shape; established that the template now leads with work-link and marks node_modules Dropbox-ignored, that beliefs uses npx --no-install, and this checkout's existing links; absorbed nodes-d90d2f (duplicate, drop proposed); process direct
