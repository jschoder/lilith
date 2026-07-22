import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { listAvatarSets } from "./character/avatar-sets.js";
import { createCharacter } from "./character/create.js";
import { readCharacterDefinition, withCharacterDb } from "./character/store.js";
import { appraiseAndPersist } from "./conversation/appraise.js";
import { BackgroundJobs } from "./conversation/background-jobs.js";
import { listMessages, type StoredMessage } from "./conversation/messages.js";
import { generateAndPersistReply, persistUserMessage } from "./conversation/reply.js";
import { ConversationManager } from "./conversation/session.js";
import type { LlmPort } from "./llm/port.js";
import { publicProcedure, router } from "./trpc.js";

export interface AppDeps {
  llm: LlmPort;
  dataDir: string;
}

const createCharacterInput = z.object({
  name: z.string().optional(),
  personalityDescription: z.string().min(1),
  emotionalTendency: z.string().min(1),
  drive: z.string().min(1),
  avatarSet: z.string().min(1),
});

/** Built from `deps` rather than as a module-level singleton so tests can inject a fake LLM and a temp data dir. */
export function createAppRouter(deps: AppDeps) {
  const conversations = new ConversationManager<StoredMessage>();
  const backgroundJobs = new BackgroundJobs();

  return router({
    character: router({
      listAvatarSets: publicProcedure.query(() => listAvatarSets()),

      create: publicProcedure.input(createCharacterInput).mutation(async ({ input }) => {
        const availableSets = await listAvatarSets();
        if (!availableSets.includes(input.avatarSet)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown avatar set" });
        }
        return createCharacter(input, deps.llm, deps.dataDir);
      }),

      get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
        const definition = await readCharacterDefinition(input.id, deps.dataDir);
        if (!definition) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return definition;
      }),
    }),

    conversation: router({
      history: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
        const definition = await readCharacterDefinition(input.id, deps.dataDir);
        if (!definition) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return withCharacterDb(input.id, deps.dataDir, listMessages);
      }),

      sendMessage: publicProcedure
        .input(z.object({ id: z.string(), text: z.string().min(1) }))
        .mutation(async ({ input }) => {
          const definition = await readCharacterDefinition(input.id, deps.dataDir);
          if (!definition) {
            throw new TRPCError({ code: "NOT_FOUND" });
          }

          // The previous turn's background Appraisal must finish updating
          // persisted Emotion/Mood state before this turn starts (ADR-0008)
          // — otherwise two turns could race to read-modify-write it.
          await backgroundJobs.join(input.id);

          // Persisted immediately, independent of generation outcome (ADR-0009).
          const userMessage = await persistUserMessage(definition, deps.dataDir, input.text);

          let reply: StoredMessage;
          try {
            reply = await conversations.requestReply(input.id, (signal) =>
              generateAndPersistReply(definition, deps.dataDir, deps.llm, signal),
            );
          } catch (err) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Reply generation failed.",
              cause: err,
            });
          }

          // Fire-and-forget: Appraisal runs after the reply is returned to
          // the client, never blocking this turn (ADR-0008).
          backgroundJobs.track(
            input.id,
            appraiseAndPersist(definition, deps.dataDir, userMessage, reply, deps.llm),
          );

          return reply;
        }),
    }),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
