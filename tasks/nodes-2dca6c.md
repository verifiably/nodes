---
id: nodes-2dca6c
title: "Withdraw dangling(), descendants, and ancestors"
status: done
priority: 1
size: s
owner: nodes-2.0
created: 2026-09-11T12:33:36Z
updated: 2026-09-11T14:09:53Z
started: 2026-09-11T14:07:09Z
completed: 2026-09-11T14:09:53Z
depends: []
parent: nodes-ce28b8
tags: [redesign]
spec: docs/designs/2026-09-11-nodes-2.0-remainder-design.md
---

Sub-task D of the 2.0 remainder. Remove the three methods from both languages, delete their traversal.oracle.json rows, rewrite STANDARD §7 to declare members/containers/outbound/inbound/neighbors the complete one-hop surface, restate §8.2 without dangling(), update the §11.2 row. dangling-ref and dangling-member findings stay. Short brainstorm of its own.

## Notes

- 2026-09-11T14:09:53Z (nodes-2.0): Withdrew dangling(), descendants, ancestors and the membership closure from both kernels; oracle keeps 7 one-hop rows plus 2 new cycle rows; dangling() tests now assert over check()'s dangling-ref findings; STANDARD §§7, 8.2, 11.2 marked (2.0) with the pending line; ts/README updated
