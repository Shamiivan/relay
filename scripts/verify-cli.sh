#!/usr/bin/env bash
set -e

SLICE=${1:-all}

if [[ "$SLICE" == "1" || "$SLICE" == "all" ]]; then
  echo "=== Slice 1: Schema ==="
  pnpm check
  grep -q "threadKey" convex/_generated/api.d.ts && echo "OK threadKey in generated types"
  ! grep -q "channelId" convex/_generated/api.d.ts && echo "OK channelId removed"
  echo "OK Slice 1 PASS"
fi

if [[ "$SLICE" == "1.5" || "$SLICE" == "all" ]]; then
  echo "=== Slice 1.5: Transport layer ==="
  test -f packages/transport/src/types.ts && echo "OK Transport interface exists"
  test -f packages/transport/src/discord.ts && echo "OK DiscordTransport exists"
  test -f packages/transport/src/cli.ts && echo "OK CliTransport exists"
  test -f packages/transport/src/tui.ts && echo "OK TuiTransport exists"
  grep -q "DiscordTransport" apps/bot/src/index.ts && echo "OK bot uses DiscordTransport"
  grep -q "transport" convex/runs.ts && echo "OK listDeliverable has transport filter"
  pnpm check
  echo "OK Slice 1.5 PASS"
fi

if [[ "$SLICE" == "2" || "$SLICE" == "all" ]]; then
  echo "=== Slice 2: One-shot CLI ==="
  test -f apps/cli/src/index.ts && echo "OK apps/cli/src/index.ts exists"
  test -f apps/cli/src/commands/run.ts && echo "OK run command exists"
  test -f apps/cli/package.json && echo "OK apps/cli/package.json exists"
  grep -q '"cac"' apps/cli/package.json && echo "OK cac dependency present"
  pnpm check
  tsx apps/cli/src/index.ts --help && echo "OK CLI --help exits cleanly"
  echo "OK Slice 2 PASS"
fi

if [[ "$SLICE" == "2.5" || "$SLICE" == "all" ]]; then
  echo "=== Slice 2.5: @relay/tui port ==="
  test -f packages/tui/src/tui.ts && echo "OK tui.ts ported"
  test -f packages/tui/src/terminal.ts && echo "OK terminal.ts ported"
  test -f packages/tui/src/components/input.ts && echo "OK input.ts ported"
  test -f packages/tui/src/components/markdown.ts && echo "OK markdown.ts ported"
  grep -q "@relay/tui" apps/cli/package.json && echo "OK @relay/tui dep present"
  pnpm check
  echo "OK Slice 2.5 PASS"
fi

if [[ "$SLICE" == "3" || "$SLICE" == "all" ]]; then
  echo "=== Slice 3: Interactive TUI ==="
  test -f apps/cli/src/tui/interactive.ts && echo "OK interactive.ts exists"
  test -f apps/cli/src/tui/thread.ts && echo "OK thread.ts (kind renderer) exists"
  test -f apps/cli/src/tui/components/UserMessage.ts && echo "OK UserMessage exists"
  test -f apps/cli/src/tui/components/AssistantMessage.ts && echo "OK AssistantMessage exists"
  test -f apps/cli/src/tui/components/ToolCallComponent.ts && echo "OK ToolCallComponent exists"
  test -f apps/cli/src/tui/components/HumanApprovalComponent.ts && echo "OK HumanApprovalComponent exists"
  grep -q "event.kind" apps/cli/src/tui/thread.ts && echo "OK kind-based rendering in thread.ts"
  grep -q '"tui"' apps/cli/src/cli.ts && echo "OK tui subcommand registered"
  pnpm check
  echo "OK Slice 3 PASS"
fi

if [[ "$SLICE" == "4" || "$SLICE" == "all" ]]; then
  echo "=== Slice 4: relay inspector ==="
  test -d apps/inspector && echo "OK apps/inspector exists"
  ! test -d apps/tui && echo "OK apps/tui renamed"
  test -f apps/cli/src/commands/inspector.ts && echo "OK inspector command exists"
  grep -q '"inspector"' apps/cli/src/cli.ts && echo "OK inspector subcommand registered"
  pnpm check
  echo "OK Slice 4 PASS"
fi

echo ""
echo "All checks passed for slice: $SLICE"
