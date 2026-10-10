# Vendored pstack skills

Plugin name is pstack.

Version is 0.15.15.

Copied on 2026-10-10.

Source is https://github.com/cursor/plugins commit `ccb5507cec1546dc88135c1139c811e6c59115ba`, directory `pstack/`.

Upstream is https://github.com/backnotprop/pstack. The licence is MIT, copyright 2026 Lauren Tan. The notice is in `.cursor/skills/LICENSE`.

The cache path used for this copy is `~/.cursor/plugins/cache/cursor-public/9717366/ccb5507cec1546dc88135c1139c811e6c59115ba`.

Skills copied:

- poteto-mode
- architect
- tdd
- blast-radius

`arena/SKILL.md` is included because `architect/references/rationale-template.md` links to it.

Replace these copies only in a change that means to update them.

## Deliberately omitted

Playbooks removed from this copy. They tell an agent to merge, enable auto-merge, or close a PR. Francois approves every merge.

- `poteto-mode/playbooks/shipping.md`
- `poteto-mode/playbooks/autopilot-full.md`
- `poteto-mode/playbooks/autopilot-stack.md`
- `poteto-mode/playbooks/multi-phase-plan.md`
- `poteto-mode/playbooks/orchestrate.md`

`poteto-mode/SKILL.md` no longer routes to those files. A land, ship, merge, auto-merge, or close request stops. A standing program stays with figure-it-out. Babysit stops at merge-ready.

`multi-phase-plan.md` was the only caller of `scripts/check-plan.mjs`. `orchestrate.md` was the only caller of `scripts/orch/`. Both scripts stay deleted.

`babysit.md` still runs `scripts/watch-pr/watch-pr` for GitHub status. That is why the watcher stays. `scripts/watch-pr/watch-pr` imports `bootstrap.ts`. `bootstrap.ts` reads `package.json` and `bun.lock` and installs `commander`. Those files stay.

`worktree-cleanup.md` used to run `scripts/worktree-audit.sh`. The script stays deleted. The playbook now classifies worktrees from `git worktree list`.

Removed from `.cursor/skills/poteto-mode/scripts/`:

- `check-plan.mjs`
- `worktree-audit.sh`
- `orch/` (`orch.ts`, `orch.test.ts`, `store.ts`)
- `watch-pr` tests and typecheck-only files (`cli.test.ts`, `github.test.ts`, `policy.test.ts`, `fakes.test-helper.ts`, `types.compile.ts`, `tsconfig.json`)
- the `package.json` `test` and `typecheck` scripts, which pointed at `orch` and that tsconfig

Kept so `scripts/watch-pr/watch-pr` can still run for `babysit.md`:

- `bootstrap.ts`
- `package.json`
- `bun.lock`
- `watch-pr/watch-pr`, `cli.ts`, `github.ts`, `policy.ts`, `render.ts`, `types.ts`

## Local modifications

These files differ from the vendored source so this copy does not merge, enable auto-merge, or close a PR.

- `poteto-mode/SKILL.md`. The land or ship trigger stops. Francois approves every merge. The Orchestrate route now stays with figure-it-out. Removed the Shipping, Orchestrate, Autopilot-full, Autopilot-stack, and Multi-phase bullets. The Babysit bullet stops at merge-ready.
- `poteto-mode/playbooks/babysit.md`. A request to merge, land, ship, or close stops for Francois. Removed the route to `shipping.md`, the "unless the user explicitly asked to merge" exception, and the Autopilot-full and Autopilot-stack owner exceptions. Step 6 still runs `scripts/watch-pr/watch-pr`. It does not run `origin pr merge`, `gh pr merge`, or a close command, and it does not arm merge-when-ready.
- `poteto-mode/playbooks/opening-a-pr.md`. Forge operations are create, edit, view, and watch. Do not merge, enable auto-merge, or close a PR. Removed the Autopilot-full and Autopilot-stack owner exception. A subagent that opens a PR does not merge, enable auto-merge, or close it.
- `poteto-mode/playbooks/autonomous-run.md`. The exit examples no longer include "all N PRs merged". A predicate that requires a merge or a closed PR is not one the agent can meet.
- `poteto-mode/playbooks/worktree-cleanup.md`. Step 1 no longer runs `scripts/worktree-audit.sh`.
- `blast-radius/SKILL.md`. The handback heading "Before you merge" is now "Before a merge." Francois approves every merge.

Other remaining playbooks were read. They do not tell the agent to merge, enable auto-merge, or close a PR. "Before shipping" in `SKILL.md` and `feature.md` means finish the product check. It is not a route to `shipping.md`.
