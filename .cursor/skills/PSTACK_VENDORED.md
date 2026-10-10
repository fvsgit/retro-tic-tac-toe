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

Searched every vendored `SKILL.md`, playbook, and reference for `poteto-mode/scripts/` and for `bootstrap.ts`, `check-plan.mjs`, `worktree-audit.sh`, `orch`, and `watch-pr`.

References found:

- `poteto-mode/playbooks/shipping.md` runs `scripts/watch-pr/watch-pr`. Shipping is one of the playbooks this repo follows, so the watcher stays.
- `poteto-mode/playbooks/babysit.md` runs the same `scripts/watch-pr/watch-pr`. It stays with the shipping watcher.
- `scripts/watch-pr/watch-pr` imports `bootstrap.ts`. `bootstrap.ts` reads `package.json` and `bun.lock` and installs `commander`. Those files stay.
- `poteto-mode/playbooks/multi-phase-plan.md` runs `node pstack/skills/poteto-mode/scripts/check-plan.mjs`. Removed. This repo does not follow that playbook for day-to-day changes.
- `poteto-mode/playbooks/orchestrate.md` runs `scripts/orch/orch.ts` and the `orch` commands. Removed for the same reason.
- `poteto-mode/playbooks/worktree-cleanup.md` runs `scripts/worktree-audit.sh`. Removed for the same reason.
- `feature`, `bug-fix`, `opening-a-pr`, `tdd`, `architect`, and `blast-radius` do not call these scripts.

Removed from `.cursor/skills/poteto-mode/scripts/`:

- `check-plan.mjs`
- `worktree-audit.sh`
- `orch/` (`orch.ts`, `orch.test.ts`, `store.ts`)
- `watch-pr` tests and typecheck-only files (`cli.test.ts`, `github.test.ts`, `policy.test.ts`, `fakes.test-helper.ts`, `types.compile.ts`, `tsconfig.json`)
- the `package.json` `test` and `typecheck` scripts, which pointed at `orch` and that tsconfig

Kept so `scripts/watch-pr/watch-pr` can still run:

- `bootstrap.ts`
- `package.json`
- `bun.lock`
- `watch-pr/watch-pr`, `cli.ts`, `github.ts`, `policy.ts`, `render.ts`, `types.ts`
