import { z } from "zod";
import type { CharacterDefinition } from "../character/types.js";
import type { LlmPort } from "../llm/port.js";
import type { MessageSender, StoredMessage } from "./messages.js";

const replySchema = z.object({ reply: z.string().min(1) });

function speakerLabel(character: CharacterDefinition, sender: MessageSender): string {
  return sender === "character" ? character.name : "User";
}

function systemPrompt(character: CharacterDefinition): string {
  return [
    `You are ${character.name}, an AI companion chatbot. Personality: ${character.personalityDescription}`,
    `Continue the text conversation below as ${character.name}. Respond with a single natural text message replying to the most recent User message — not a narration, not multiple messages.`,
  ].join("\n");
}

function transcriptPrompt(character: CharacterDefinition, history: StoredMessage[]): string {
  return history.map((message) => `${speakerLabel(character, message.sender)}: ${message.text}`).join("\n");
}

/**
 * Generates one complete reply from the full message history — never
 * token-streamed, per ADR-0008. `signal` lets a cancel-and-restart burst
 * (ADR-0009) abort a stale in-flight call.
 */
export async function generateReply(
  character: CharacterDefinition,
  history: StoredMessage[],
  llm: LlmPort,
  signal?: AbortSignal,
): Promise<string> {
  const result = await llm.generateStructured({
    system: systemPrompt(character),
    prompt: transcriptPrompt(character, history),
    schema: replySchema,
    signal,
  });
  return result.reply;
}
