The revised design at cc5df73 is ready for your approval. I re-reviewed it and accept it. All seven round-2 findings are resolved in substance, and I found two new Minor gaps that the implementation plan can settle without another design revision. Task nodes-6fde14 is parked for your design approval. Once you approve, the agent resumes in .worktrees/nodes-6fde14 and writes the implementation plan for review.

The frozen file at cc5df73 hashes to the stated 47d628ca…a30ea. I reviewed the diff from 13a879b and checked the new setup wording against work-link --help and the Vitest version.

How each round-2 finding landed
- I1 (setup): setup now runs work-link --ensure python/.venv before uv sync, then marks node_modules and dist with attr in synced checkouts. A failed link or attribute write fails setup. --ensure python/.venv is a valid call (a relative path ending in .venv).
- I2 (skip evidence): each CI job now keeps a JUnit file and module inventory as an artifact for 30 days. Vitest skips without a reason are traced back to their skip guard in the source and labelled as such; any that can't be traced block activation.
- I3 (cost baseline): the timings are recorded, with the right caveats, and keeping check-code broad is now stated as an explicit call for you to approve.
- M4 (concurrency): CI groups get a literal nodes-ci- prefix, which removes the case-insensitive collision with Release's group.
- M5–M7: tag coverage is declared, the ended check timing series and the package-relative selectors are documented, and the regret review is named as ops-56aab7.

New Minor findings, for the plan to settle
1. Setup doesn't say how it tells a synced checkout from one outside the synced tree. The attr step runs only in a synced checkout, and any attribute failure fails setup. Without a stated test, setup could wrongly fail in a tree outside Dropbox (task worktrees live on <work-storage>) if the builder's own test disagrees with work-link. Fix: run attr only when work-link --ensure did not report outside, so one result drives both steps.
2. "Validated" for the tag and Release coverage paths could push someone toward a real release tag. The spec says to declare refs/tags/v* only once validated, and to test the concurrency keys "for both paths", but doesn't say how. Pushing a v* tag runs the publish jobs if the version matches. Fix: validate the Release-called CI path with a manually triggered Release run on the branch. Its publish jobs need a tag push, so they skip, and the build and verify jobs make only dry-run publish calls. The tag path uses the same called workflow, so that covers it. Any such run is still an external action that needs your approval under step 6.

For the task record, this is round 4, since the builder's acceptance is already noted as round 3: review: spec round 4 — verdict: accept; findings: Minor 2; reviewer: claude/claude-opus-5-5. The agent that resumes nodes-6fde14 should add it; as the reviewer, I didn't.

keith: accepted for planning
