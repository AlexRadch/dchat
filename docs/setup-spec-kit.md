# Spec Kit setup (once per user)

Spec Kit is installed next to the project, once per user — not via `package.json`.

## Install

`specify-cli` is a Python tool installed via `uv`, not an npm package, so it does
not belong in `dependencies`. Official instructions:

- Install: https://github.github.com/spec-kit/installation.html
- First run: https://github.github.com/spec-kit/quickstart.html
- Adopting in an existing project: https://github.github.com/spec-kit/how-to/existing-projects.html
- Mixed-agent teams: https://github.github.com/spec-kit/integrations/index.html#working-in-a-team

Quick start:

```bash
uv tool install specify-cli
specify init --here --integration none --script py   # agent-neutral baseline
specify integration install <your-agent> --force     # your local commands only
specify integration use <your-agent>
```

## Rules for shared repos

- Commits carry integration `none` only. Switch back to `none` before committing
  so no agent-specific files leak into the repo.
- Agent skills/commands live on your machine (per-agent location), not in the repo.
- Specs live in the repo: `.specify/` (templates, scripts, constitution) and
  `specs/<feature>/` (`spec.md`, `plan.md`, `tasks.md`).
