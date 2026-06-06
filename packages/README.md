# Packages

Packages hold reusable code. Keep boundaries narrow so each package does one job well.

Current package boundary worth preserving:

- `packages/contracts`: config and schema contracts
- `packages/env`: shared dotenv loading helpers
- `packages/logger`: shared logging

Keep packages small and boring. If code is specific to one workflow, tool, or transport, leave it in that area instead of promoting it into `packages/`.
