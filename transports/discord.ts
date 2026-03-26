import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
  ComponentType,
  EmbedBuilder,
  type AwaitMessagesOptions,
  type Message,
  type MessageCreateOptions,
  type Snowflake,
} from "discord.js";

/** Minimal shape required from a Discord channel — avoids PartialGroupDMChannel issues. */
type SendableChannel = {
  send(options: string | MessageCreateOptions): Promise<Message>;
  awaitMessages(options?: AwaitMessagesOptions): Promise<Collection<Snowflake, Message>>;
  sendTyping(): Promise<void>;
};
import type { ThreadEvent } from "../runtime/src/thread.ts";
import type { TransportAdapter } from "../runtime/src/transport.ts";

const CLARIFICATION_TIMEOUT_MS = 600_000; // 10 minutes
const APPROVAL_TIMEOUT_MS = 900_000;       // 15 minutes
const TYPING_INTERVAL_MS = 8_000;

/**
 * Splits a long message into chunks of at most `maxLen` characters,
 * preferring to break on newlines where possible.
 */
function chunkMessage(text: string, maxLen = 2000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    // Try to break on the last newline within the limit
    const slice = remaining.slice(0, maxLen);
    const lastNewline = slice.lastIndexOf("\n");
    const cutAt = lastNewline > 0 ? lastNewline + 1 : maxLen;
    chunks.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt);
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/**
 * Formats a ThreadEvent as a short Discord-safe line.
 * Only renders events that add useful signal in a channel.
 */
function formatEventForDiscord(event: ThreadEvent): string | null {
  switch (event.type) {
    case "executable_call":
      return `\`\`\`\n▶ ${String(event.data.args).slice(0, 500)}\n\`\`\``;
    case "executable_result": {
      const r = String(event.data.result).slice(0, 400);
      return `\`\`\`\n${r}\n\`\`\``;
    }
    case "system_note":
      return `> ${event.data.slice(0, 200)}`;
    default:
      return null; // other events are not surfaced
  }
}

/**
 * Discord transport — routes all human interactions through a Discord ThreadChannel.
 *
 * Auth: every awaitMessages / awaitMessageComponent call is filtered to `requesterId`
 * so only the person who triggered the run can answer questions or approve actions.
 *
 * Typing indicator is owned entirely by this transport and cleared in publishFinal.
 */
export function createDiscordTransport(
  channel: SendableChannel,
  requesterId: string,
): TransportAdapter {
  let typingInterval: ReturnType<typeof setInterval> | null = null;

  // Start typing indicator immediately
  channel.sendTyping().catch(() => { });
  typingInterval = setInterval(() => {
    channel.sendTyping().catch(() => { });
  }, TYPING_INTERVAL_MS);

  function stopTyping(): void {
    if (typingInterval !== null) {
      clearInterval(typingInterval);
      typingInterval = null;
    }
  }

  return {
    async promptForClarification(prompt: string): Promise<string> {
      await channel.send(prompt);
      const collected = await channel.awaitMessages({
        filter: (m) => m.author.id === requesterId && !m.author.bot,
        max: 1,
        time: CLARIFICATION_TIMEOUT_MS,
        errors: ["time"],
      }).catch(() => null);

      if (!collected || collected.size === 0) {
        await channel.send("No reply received — run timed out.");
        throw new Error("clarification_timeout");
      }
      return collected.first()!.content;
    },

    async promptForApproval(prompt: string): Promise<"approved" | "denied"> {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("approve")
          .setLabel("✅ Approve")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("deny")
          .setLabel("❌ Deny")
          .setStyle(ButtonStyle.Danger),
      );

      const embed = new EmbedBuilder()
        .setTitle("⚠️ Approval Required")
        .setDescription(prompt.slice(0, 4096))
        .addFields({ name: "Timeout", value: "15 minutes" })
        .setColor(0xf59e0b);

      const approvalMsg = await channel.send({ embeds: [embed], components: [row] });

      let interaction;
      try {
        interaction = await approvalMsg.awaitMessageComponent({
          filter: (i) => i.user.id === requesterId,
          componentType: ComponentType.Button,
          time: APPROVAL_TIMEOUT_MS,
        });
      } catch {
        // Timeout — disable buttons and treat as denied
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("approve").setLabel("✅ Approve").setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId("deny").setLabel("❌ Deny").setStyle(ButtonStyle.Secondary).setDisabled(true),
        );
        await approvalMsg.edit({ components: [disabledRow] }).catch(() => { });
        await channel.send("Approval timed out — operation denied.");
        throw new Error("approval_timeout");
      }

      const verdict = interaction.customId === "approve" ? "approved" : "denied";

      // Disable buttons and update embed to show result
      const resultColor = verdict === "approved" ? 0x22c55e : 0xef4444;
      const resultEmbed = EmbedBuilder.from(embed)
        .setTitle(verdict === "approved" ? "✅ Approved" : "❌ Denied")
        .setColor(resultColor);
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("approve").setLabel("✅ Approve").setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId("deny").setLabel("❌ Deny").setStyle(ButtonStyle.Secondary).setDisabled(true),
      );
      await interaction.update({ embeds: [resultEmbed], components: [disabledRow] });

      return verdict;
    },

    async publishEvent(event: ThreadEvent): Promise<void> {
      const text = formatEventForDiscord(event);
      if (text) {
        await channel.send(text).catch(() => { });
      }
    },

    async publishFinal(message: string): Promise<void> {
      stopTyping();
      const chunks = chunkMessage(message);
      for (const chunk of chunks) {
        await channel.send(chunk);
      }
    },
  };
}
