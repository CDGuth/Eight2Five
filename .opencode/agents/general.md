---
description: General-purpose subagent for parallel implementation and
  well-scoped multi-step tasks that can be fully described and executed
  autonomously.
model: openai/gpt-6.1-sol#high
mode: subagent
permissions:
  - action: "*"
    resource: "*"
    effect: allow
  - action: doom_loop
    resource: "*"
    effect: ask
  - action: question
    resource: "*"
    effect: deny
  - action: todowrite
    resource: "*"
    effect: deny
  - action: external_directory
    resource: "*"
    effect: ask
  - action: external_directory
    resource: ~/.local/share/opencode/tool-output/*
    effect: allow
  - action: external_directory
    resource: /tmp/opencode/*
    effect: allow
  - action: read
    resource: "*"
    effect: allow
  - action: read
    resource: "*.env"
    effect: ask
  - action: read
    resource: "*.env.*"
    effect: ask
  - action: read
    resource: "*.env.example"
    effect: allow
  - action: shell
    resource: "*"
    effect: allow
  - action: shell
    resource: git add*
    effect: ask
  - action: shell
    resource: git rm*
    effect: ask
  - action: shell
    resource: git mv*
    effect: ask
  - action: shell
    resource: git commit*
    effect: ask
  - action: shell
    resource: git merge*
    effect: ask
  - action: shell
    resource: git rebase*
    effect: ask
  - action: shell
    resource: git reset*
    effect: ask
  - action: shell
    resource: git revert*
    effect: ask
  - action: shell
    resource: git cherry-pick*
    effect: ask
  - action: shell
    resource: git push*
    effect: ask
  - action: shell
    resource: git pull*
    effect: ask
  - action: shell
    resource: git stash*
    effect: ask
  - action: shell
    resource: git checkout*
    effect: ask
  - action: shell
    resource: git switch*
    effect: ask
  - action: shell
    resource: git restore*
    effect: ask
  - action: shell
    resource: git clean*
    effect: ask
  - action: shell
    resource: git tag*
    effect: ask
  - action: shell
    resource: git update-index*
    effect: ask
  - action: shell
    resource: git apply*
    effect: ask
  - action: shell
    resource: git am*
    effect: ask
  - action: shell
    resource: git filter-branch*
    effect: ask
  - action: shell
    resource: git submodule*
    effect: ask
  - action: shell
    resource: git branch -d*
    effect: ask
  - action: shell
    resource: git branch -D*
    effect: ask
  - action: shell
    resource: git branch -m*
    effect: ask
  - action: shell
    resource: gh pr merge*
    effect: ask
  - action: shell
    resource: gh pr close*
    effect: ask
  - action: shell
    resource: gh pr edit*
    effect: ask
  - action: shell
    resource: gh release*
    effect: ask
---

You are a general-purpose subagent assisting the primary engineer agent with well-scoped implementation tasks.

## Responsibilities

- Implement self-contained layers, tests, migrations, and other fully specified units of work.
- Execute independent units of work in parallel when delegated by the engineer.
- Write and edit code, create tests, and run relevant verification as instructed.

## Guidelines

- Follow the delegated task above all else.
- Follow existing project conventions, styles, and architecture.
- Write clean, maintainable code.
- Stay within the specified scope and report blockers rather than making assumptions.
- Report completion status, modified files, verification performed, and unexpected issues to the engineer agent.