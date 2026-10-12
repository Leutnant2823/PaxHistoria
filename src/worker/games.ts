import type { Env } from "./env";
import type { GameMeta, SnapshotMeta } from "../shared/api";

// Saves are opaque to the Worker: the browser sends gzip+base64 text and reads
// it back. Metadata travels in the `x-game-meta` header as URI-encoded JSON.

interface GameRow {
  id: string;
  name: string;
  country: string;
  game_date: string;
  turn: number;
  created_at: number;
  updated_at: number;
}

const toMeta = (r: GameRow): GameMeta => ({
  id: r.id,
  name: r.name,
  country: r.country,
  gameDate: r.game_date,
  turn: r.turn,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

function readMeta(req: Request): Partial<GameMeta> {
  try {
    return JSON.parse(decodeURIComponent(req.headers.get("x-game-meta") || "{}"));
  } catch {
    return {};
  }
}

const notFound = () => Response.json({ error: "Не найдено" }, { status: 404 });

export async function handleGames(req: Request, env: Env, parts: string[]): Promise<Response> {
  // parts: ["games", id?, "snapshots"?, turn?]
  const [, id, sub, turnStr] = parts;
  const method = req.method;

  if (!id) {
    if (method !== "GET") return new Response(null, { status: 405 });
    const { results } = await env.DB.prepare(
      "SELECT id, name, country, game_date, turn, created_at, updated_at FROM games ORDER BY updated_at DESC",
    ).all<GameRow>();
    return Response.json(results.map(toMeta));
  }

  if (!sub) {
    if (method === "GET") {
      const row = await env.DB.prepare("SELECT state FROM games WHERE id = ?").bind(id).first<{ state: string }>();
      return row ? new Response(row.state, { headers: { "content-type": "text/plain" } }) : notFound();
    }
    if (method === "PUT") {
      const meta = readMeta(req);
      const state = await req.text();
      const now = Date.now();
      await env.DB.prepare(
        `INSERT INTO games (id, name, country, game_date, turn, created_at, updated_at, state)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET name = ?2, country = ?3, game_date = ?4, turn = ?5, updated_at = ?6, state = ?7`,
      )
        .bind(id, meta.name ?? "Партия", meta.country ?? "", meta.gameDate ?? "", meta.turn ?? 0, now, state)
        .run();
      return Response.json({ ok: true, updatedAt: now });
    }
    if (method === "DELETE") {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM games WHERE id = ?").bind(id),
        env.DB.prepare("DELETE FROM snapshots WHERE game_id = ?").bind(id),
      ]);
      return Response.json({ ok: true });
    }
    return new Response(null, { status: 405 });
  }

  if (sub !== "snapshots") return notFound();

  if (turnStr === undefined) {
    if (method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT turn, game_date, created_at FROM snapshots WHERE game_id = ? ORDER BY turn",
      )
        .bind(id)
        .all<{ turn: number; game_date: string; created_at: number }>();
      const list: SnapshotMeta[] = results.map((r) => ({ turn: r.turn, gameDate: r.game_date, createdAt: r.created_at }));
      return Response.json(list);
    }
    if (method === "DELETE") {
      // Drops the future after a rewind: ?after=N removes snapshots with turn > N.
      const after = Number(new URL(req.url).searchParams.get("after") ?? "-1");
      await env.DB.prepare("DELETE FROM snapshots WHERE game_id = ? AND turn > ?").bind(id, after).run();
      return Response.json({ ok: true });
    }
    return new Response(null, { status: 405 });
  }

  const turn = Number(turnStr);
  if (!Number.isInteger(turn)) return notFound();
  if (method === "GET") {
    const row = await env.DB.prepare("SELECT state FROM snapshots WHERE game_id = ? AND turn = ?")
      .bind(id, turn)
      .first<{ state: string }>();
    return row ? new Response(row.state, { headers: { "content-type": "text/plain" } }) : notFound();
  }
  if (method === "PUT") {
    const meta = readMeta(req);
    const state = await req.text();
    await env.DB.prepare(
      `INSERT INTO snapshots (game_id, turn, game_date, created_at, state) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(game_id, turn) DO UPDATE SET game_date = ?3, created_at = ?4, state = ?5`,
    )
      .bind(id, turn, meta.gameDate ?? "", Date.now(), state)
      .run();
    return Response.json({ ok: true });
  }
  return new Response(null, { status: 405 });
}
