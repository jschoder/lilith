import "dotenv/config";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { mkdir } from "node:fs/promises";
import { loadEnv } from "./env.js";
import { OllamaLlmPort } from "./llm/ollama.js";
import { AVATARS_DIR, DATA_DIR } from "./paths.js";
import { createAppRouter } from "./router.js";

const env = loadEnv();

await mkdir(DATA_DIR, { recursive: true });

const llm = new OllamaLlmPort(env.ollama);
const appRouter = createAppRouter({ llm, dataDir: DATA_DIR });

const app = express();
app.use("/avatars", express.static(AVATARS_DIR));
app.use("/trpc", createExpressMiddleware({ router: appRouter }));

app.listen(env.port, () => {
  console.log(`lilith server listening on port ${env.port}`);
});
