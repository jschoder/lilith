import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@lilith/server";

export const trpc = createTRPCReact<AppRouter>();
