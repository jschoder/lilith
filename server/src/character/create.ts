import { z } from "zod";
import type { LlmPort } from "../llm/port.js";
import { mintCharacterId } from "./id.js";
import { projectPersonality } from "./pad.js";
import { writeCharacterDirectory } from "./store.js";
import type { CharacterDefinition } from "./types.js";

export interface CreateCharacterInput {
  name?: string;
  personalityDescription: string;
  emotionalTendency: string;
  drive: string;
  avatarSet: string;
}

const nameOutputSchema = z.object({ name: z.string().min(1).max(60) });

const personalityPointSchema = z.object({
  pleasure: z.number().min(-1).max(1),
  arousal: z.number().min(-1).max(1),
  dominance: z.number().min(-1).max(1),
});

function authoredFieldsPrompt(input: CreateCharacterInput): string {
  return `Personality description: ${input.personalityDescription}\nEmotional tendency: ${input.emotionalTendency}\nDrive: ${input.drive}`;
}

async function inferName(input: CreateCharacterInput, llm: LlmPort): Promise<string> {
  const trimmed = input.name?.trim();
  if (trimmed) {
    return trimmed;
  }
  const result = await llm.generateStructured({
    system:
      "You invent a short, fitting first name for a fictional AI companion character, based on its authored personality.",
    prompt: authoredFieldsPrompt(input),
    schema: nameOutputSchema,
  });
  return result.name;
}

/**
 * Runs the full Character-creation flow (ticket 16): infers a name if
 * left blank, infers a PAD personality point, deterministically projects
 * it into a Baseline Mood and emotion constants, mints a CSPRNG Character
 * ID, and persists the result. If any step — including either LLM call —
 * fails, no Character directory is left on disk.
 */
export async function createCharacter(
  input: CreateCharacterInput,
  llm: LlmPort,
  dataDir: string,
): Promise<CharacterDefinition> {
  const name = await inferName(input, llm);

  const personalityPoint = await llm.generateStructured({
    system:
      "You infer a PAD (pleasure/arousal/dominance) personality point, each in the range [-1, 1], for a fictional character from its authored description.",
    prompt: authoredFieldsPrompt(input),
    schema: personalityPointSchema,
  });

  const { baselineMood, emotionConstants } = projectPersonality(personalityPoint);

  const definition: CharacterDefinition = {
    id: mintCharacterId(),
    name,
    personalityDescription: input.personalityDescription,
    emotionalTendency: input.emotionalTendency,
    drive: input.drive,
    avatarSet: input.avatarSet,
    personalityPoint,
    baselineMood,
    emotionConstants,
  };

  await writeCharacterDirectory(definition, dataDir);

  return definition;
}
