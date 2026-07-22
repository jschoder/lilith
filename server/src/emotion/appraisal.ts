import { z } from "zod";
import type { CharacterDefinition } from "../character/types.js";
import { PLUTCHIK_PRIMARIES, type PlutchikPrimary } from "../domain/plutchik.js";
import type { LlmPort } from "../llm/port.js";
import type { Stimulus } from "./dynamics.js";

const stimulusShape = Object.fromEntries(
  PLUTCHIK_PRIMARIES.map((primary) => [primary, z.number().min(0).max(1).optional()]),
) as Record<PlutchikPrimary, z.ZodOptional<z.ZodNumber>>;

const stimulusSchema = z.object(stimulusShape);

function appraisalSystemPrompt(character: CharacterDefinition): string {
  return [
    `You are appraising the emotional impact of one conversational turn on ${character.name}, an AI companion with this personality: ${character.personalityDescription}`,
    "Output an intensity in [0,1] only for the Plutchik primary emotions (joy, trust, fear, surprise, sadness, disgust, anger, anticipation) this turn actually evoked — leave every other emotion unset. Most turns evoke only 1-3 emotions.",
  ].join("\n");
}

function appraisalPrompt(character: CharacterDefinition, userText: string, replyText: string): string {
  return `User: ${userText}\n${character.name}: ${replyText}`;
}

/**
 * One sparse LLM-judged Appraisal of a turn (ADR-0001/ticket 18) — the
 * Stimulus that `advanceEmotionMood` applies to persisted Emotion/Mood
 * state. Runs as its own call in the post-reply background job (ADR-0008),
 * not piggybacked onto reply generation, which returns only `{ reply }`.
 */
export async function appraiseTurn(
  character: CharacterDefinition,
  userText: string,
  replyText: string,
  llm: LlmPort,
  signal?: AbortSignal,
): Promise<Stimulus> {
  return llm.generateStructured({
    system: appraisalSystemPrompt(character),
    prompt: appraisalPrompt(character, userText, replyText),
    schema: stimulusSchema,
    signal,
  });
}
