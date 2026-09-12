---
id: nodes-9f6f50
title: Fill in setup_cmd for the ts tree so a fresh worktree runs the suite
status: todo
priority: 2
size: xs
created: 2026-09-11T21:13:32Z
updated: 2026-09-11T21:13:32Z
depends: []
tags: [testing]
source: ops-9c7dab
---

Piece of ops-9c7dab, same shape as beliefs: setup_cmd := "(cd ts && npm ci)" and the setup recipe from ops templates/justfile, so just setup after git worktree add is enough for the gates to pass. Confirm by creating a throwaway worktree and running just setup && just check there.
