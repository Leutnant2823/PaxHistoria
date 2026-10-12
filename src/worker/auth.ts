import type { Env } from "./env";

const SESSION_DAYS = 30;
const MAX_FAILURES = 8;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares two strings in constant time by comparing their hashes byte by byte. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function sessionCookie(token: string, maxAge: number, secure: boolean): string {
  return `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export async function isAuthenticated(req: Request, env: Env): Promise<boolean> {
  const token = readCookie(req, "sid");
  if (!token) return false;
  const row = await env.DB.prepare("SELECT expires_at FROM sessions WHERE token_hash = ?")
    .bind(await sha256(token))
    .first<{ expires_at: number }>();
  return !!row && row.expires_at > Date.now();
}

export async function login(req: Request, env: Env): Promise<Response> {
  if (!env.AUTH_USER || !env.AUTH_PASSWORD) {
    return Response.json(
      {
        error:
          "Сервер не видит AUTH_USER и AUTH_PASSWORD. Добавьте их в Cloudflare: Workers & Pages, strategia, Settings, раздел Variables and Secrets (не Build). После сохранения подождите минуту и обновите страницу.",
      },
      { status: 500 },
    );
  }
  const ip = req.headers.get("cf-connecting-ip") || "local";
  const since = Date.now() - FAILURE_WINDOW_MS;
  const failures = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_failures WHERE ip = ? AND at > ?")
    .bind(ip, since)
    .first<{ n: number }>();
  if ((failures?.n ?? 0) >= MAX_FAILURES) {
    return Response.json({ error: "Слишком много попыток. Подождите 15 минут." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const okUser = await safeEqual(String(body.username ?? ""), env.AUTH_USER);
  const okPass = await safeEqual(String(body.password ?? ""), env.AUTH_PASSWORD);
  if (!okUser || !okPass) {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO login_failures (ip, at) VALUES (?, ?)").bind(ip, Date.now()),
      env.DB.prepare("DELETE FROM login_failures WHERE at < ?").bind(since),
    ]);
    return Response.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const maxAge = SESSION_DAYS * 24 * 3600;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)").bind(
      await sha256(token),
      Date.now() + maxAge * 1000,
    ),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(Date.now()),
  ]);
  const secure = new URL(req.url).protocol === "https:";
  return Response.json({ ok: true }, { headers: { "set-cookie": sessionCookie(token, maxAge, secure) } });
}

export async function logout(req: Request, env: Env): Promise<Response> {
  const token = readCookie(req, "sid");
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  const secure = new URL(req.url).protocol === "https:";
  return Response.json({ ok: true }, { headers: { "set-cookie": sessionCookie("", 0, secure) } });
}
