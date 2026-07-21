function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export interface Env {
  port: number;
  ollama: {
    baseUrl: string;
    chatModel: string;
    embedModel: string;
  };
}

/** Every var here is required; a missing one crashes on boot, no fallbacks. */
export function loadEnv(): Env {
  return {
    port: Number(requireEnv("SERVER_PORT")),
    ollama: {
      baseUrl: requireEnv("OLLAMA_BASE_URL"),
      chatModel: requireEnv("OLLAMA_CHAT_MODEL"),
      embedModel: requireEnv("OLLAMA_EMBED_MODEL"),
    },
  };
}
