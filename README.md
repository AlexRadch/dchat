# dchat

One-shot terminal chat for language models on Pi Durable.

Run a command — get an answer — exit.

## Status

Stub: project created, dependencies installed. No harness yet.

## Dependencies

- `@earendil-works/pi-durable` — core: conversations, tasks, checkpoints (rest pulls itself in);
- `tsx` — run `.ts` without compiling.

## Development language

Repository language is English: code, comments, docs, specs, tests, commits.
A developer may talk to the agent in any language; the agent writes all repo artifacts in English by default. Exception: dedicated i18n tests may use other languages for the strings under test. User-facing strings default to English; other locales arrive only via i18n, never as hardcoded non-English text.
