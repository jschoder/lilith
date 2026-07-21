import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { listAvatarSets } from "./character/avatar-sets.js";
import { createCharacter } from "./character/create.js";
import { readCharacterDefinition } from "./character/store.js";
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
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
