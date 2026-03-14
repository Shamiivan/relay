# Packages

Packages hold reusable code. Keep boundaries narrow so each package does one job well.

Current package boundary worth preserving:

- `packages/model`: provider-facing model adapter logic
- `packages/contracts`: config and schema contracts
- `packages/logger`: shared logging

The model package should stay small: validate messages, build provider payloads, and parse responses.
