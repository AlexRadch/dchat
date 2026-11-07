# ADR-001: Pi-Durable as the framework, TypeScript as the language

**Status**: accepted
**Date**: 2026-11-07
**Deciders**: project owner + agent

## Context

We needed a one-shot terminal chat for language models: ask → print answer → exit.
The same chat should later run unchanged in the cloud behind a REST interface,
not only on a local machine. Building conversations, tasks, and checkpoints by
hand is the bulk of the complexity and is easy to get wrong.

## Decision

Use `@earendil-works/pi-durable` as the framework core
(Harness.open + root + submit + wait). TypeScript follows from that choice:
the package is written in TypeScript, so the client is written in TypeScript too.

## Why this framework (features a replacement must provide)

- Durable execution: conversations, model turns, tool calls, and app state are
  committed to storage before anything is shown. A restarted process resumes
  from the last checkpoint instead of starting over.
- Conversations as transcripts: immutable entries; several concurrent
  conversations, each with its own model, tools, instructions, and working
  directory; forks at a point in time.
- Tasks as durable state machines: a checkpoint at every step, child tasks,
  task graph, subagents. An interrupted tool call replays only if the tool
  declares replay safe; otherwise the model gets the interruption plus stored
  partial output and decides what to do.
- Model access via pi-ai: many providers through one Models registry;
  per-conversation agent choices (model, thinking level, tools, instructions).
- Storage backends: MemoryStorage now, SQLite/JSONL for persist-and-resume
  later. The same code runs locally and at hosting providers behind REST.
- Extensions and tools: named bundles (tools, prompts, hooks, tasks) resolved
  through a registry; CodingTools (read/write/edit/bash) available when needed.
- Operations: abort, reset/handoff, compaction, watching a conversation,
  usage and cost tracking.

## References (why we believe the decision is right)

- Official announcement: https://earendil.com/posts/pi-durable/ — what Pi Durable
  is, why it exists alongside Pi 1.0, design goals (runs anywhere, survives
  failures, many humans steer the same agents). Start here to check our decision.
- Monorepo + package source: https://github.com/earendil-works/pi — `packages/durable`
  (README, 30+ examples, design docs); installed API of v1.5.0 is also vendored
  in our `node_modules/@earendil-works/pi-durable`.
- Pi 1.0 context: https://earendil.com/posts/pi-1-0/ — minimalism and malleability
  principles the framework inherits. Mario's take on those principles:
  https://mariozechner.at/posts/2025-11-30-pi-coding-agent ("What I learned
  building an opinionated and minimal coding agent" — simple predictable tools,
  full control over provider APIs, inspectable context and session format).
  This is why the framework stays small and agent-readable (~15k lines).
- Independent takes: https://www.mindstudio.ai/blog/pi-durable-long-running-agents
  (what it is and why it matters); https://redreamality.com/blog/pi-durable-agent-harness-durable-execution
  (comparison with Temporal, Durable Objects, LangGraph); Vercel's durable-harness
  guide https://vercel.com/blog/making-every-harness-durable (running it in the cloud);
  host-it guide https://exe.dev/deploy/pi-durable.

## Consequences

- Conversation state, tasks, and checkpoints come from the package instead of
  hand-rolled code.
- The same code runs locally and at hosting providers (e.g. Vercel-style);
  a REST layer on top turns the local chat into a cloud service without a rewrite.
- Trade-off: we depend on the package's API and release pace. If it changes
  direction, migration cost is ours.
- Feature specs stay technology-free (`spec.md` describes what and why);
  this decision lives here and in `plan.md`, so specs survive a future
  language or framework change.
