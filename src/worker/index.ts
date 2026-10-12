import type { Env } from "./env";
import type { ServerConfig } from "../shared/api";
import { isAuthenticated, login, logout } from "./auth";
import { handleGames } from "./games";
import { availableProviders, handleAi } from "./ai";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    const parts = url.pathname.slice("/api/".length).split("/").filter(Boolean);
    const route = parts[0];

    if (route === "login" && request.method === "POST") return login(request, env);
    if (route === "logout" && request.method === "POST") return logout(request, env);

    if (!(await isAuthenticated(request, env))) {
      return Response.json({ error: "Требуется вход" }, { status: 401 });
    }

    switch (route) {
      case "config": {
        const config: ServerConfig = { providers: availableProviders(env), user: env.AUTH_USER ?? "" };
        return Response.json(config);
      }
      case "ai":
        if (request.method !== "POST") return new Response(null, { status: 405 });
        return handleAi(request, env);
      case "games":
        return handleGames(request, env, parts);
      default:
        return Response.json({ error: "Не найдено" }, { status: 404 });
    }
  },
} satisfies ExportedHandler<Env>;
