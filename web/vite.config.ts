import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SERVER_PORT = process.env.SERVER_PORT ?? "3000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/trpc": `http://localhost:${SERVER_PORT}`,
      "/avatars": `http://localhost:${SERVER_PORT}`,
    },
  },
});
