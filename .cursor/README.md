# Cursor workspace notes

This folder contains Cursor-specific project context.

- `rules/*.mdc` are Cursor Rules. They teach the AI assistant the current project decisions and reduce stale suggestions from older docs.
- Rules are intentionally scoped by topic so they can stay short and easy to update.
- Keep secrets, tokens, local machine paths, and deployment credentials out of this folder.

Start from `rules/00-project-context.mdc` and `rules/10-stack-and-architecture.mdc` when updating assumptions.
