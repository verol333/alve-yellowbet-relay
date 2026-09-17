// Relais YellowBet â€” AL VE CAPITAL (Deno Deploy)
// Rejoue une sequence de requetes sur yellowbet.cg en conservant les cookies et
// le jeton de session, comme un navigateur. Protege par RELAY_SECRET.

const BASE = "https://yellowbet.cg";
// Sites autorisés : le relais ne sert que ces domaines (aucun proxy ouvert).
const ALLOWED = ["yellowbet.cg", "premierbet.com", "premierbet.cg", "premierbet.cd", "sports-api.premierbet.com", "api.premierbet.com", "id.premierbet.com"];
function baseOf(v: unknown): string {
  if (!v) return BASE;
  let u: URL;
  try { u = new URL(String(v)); } catch { return BASE; }
  const host = u.hostname.replace(/^www\./, "");
  if (!ALLOWED.includes(host)) return BASE;
  return u.origin;
}
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const YB: Record<string, string> = {
  "content-type": "application/json",
  accept: "*, application/json",
  channelid: "4",
  terminal: "yellowbet.cg",
  brandid: "122",
  language: "fr",
  origin: BASE,
  referer: BASE + "/",
  "user-agent": UA,
  "accept-language": "fr-FR,fr;q=0.9",
};

// En-têtes navigateur ordinaires : YB a son propre jeu (channelid/brandid),
// les autres sites n'attendent qu'un navigateur crédible.
const PLAIN = (base: string): Record<string, string> => ({
  accept: "application/json, text/plain, */*",
  "user-agent": UA,
  "accept-language": "fr-FR,fr;q=0.9",
  origin: base,
  referer: base + "/",
});

const get = (o: any, p: string) => { let v: any = o; for (const k of String(p).split(".")) v = v == null ? null : v[k]; return v; };

Deno.serve(async (req) => {
  if (req.method === "GET") return Response.json({ ok: true, service: "alve-relay", sites: ALLOWED });
  if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 });

  const secret = Deno.env.get("RELAY_SECRET") || "";
  if (!secret || req.headers.get("x-relay-secret") !== secret) return Response.json({ error: "bad_secret" }, { status: 401 });

  const payload = await req.json().catch(() => ({}));
  const requests: any[] = Array.isArray(payload?.requests) ? payload.requests : [];
  if (!requests.length) return Response.json({ error: "no_requests" }, { status: 400 });

  const jar = new Map<string, string>();
  let token = "";
  let prev: any = null;
  const results: Array<{ status: number; text: string }> = [];

  for (const q of requests) {
    try {
      if (q.skipIfPrevNull && get(prev, q.skipIfPrevNull) == null) { results.push({ status: 0, text: "SKIPPED" }); continue; }

      const base = baseOf(q.base ?? payload?.base);
      const isYb = base === BASE;
      const headers: Record<string, string> = { ...(isYb ? YB : PLAIN(base)), ...(q.headers || {}) };
      if (jar.size) headers.cookie = [...jar.entries()].map(([k, v]) => k + "=" + v).join("; ");
      if (q.useToken && token) { headers.authorization = "Bearer " + token; headers.token = token; }

      let body = q.body;
      if (q.tokenBodyField && token && body && typeof body === "object") body = { ...body, [q.tokenBodyField]: token };
      if (q.fromPrev && body && typeof body === "object") {
        body = { ...body };
        for (const k of Object.keys(q.fromPrev)) body[k] = get(prev, q.fromPrev[k]);
      }

      const init: RequestInit = { method: q.method || "GET", headers };
      if (body !== undefined && body !== null) init.body = JSON.stringify(body);

      let status = 0, text = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await fetch(q.path.startsWith("http") ? q.path : base + q.path, init);
        status = r.status;
        text = await r.text();
        for (const c of r.headers.getSetCookie?.() || []) {
          const pair = c.split(";")[0];
          const i = pair.indexOf("=");
          if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
        }
        if (!q.retryIfNull) break;
        let j: any = null; try { j = JSON.parse(text); } catch { /* non JSON */ }
        if (get(j, q.retryIfNull) != null) break;
        await new Promise((s) => setTimeout(s, 900));
      }

      prev = null;
      try { prev = JSON.parse(text); if (typeof prev?.token === "string" && prev.token) token = prev.token; } catch { /* non JSON */ }
      results.push({ status, text: String(text) });
    } catch (e) {
      results.push({ status: 0, text: "FETCH_ERROR: " + String(e) });
    }
  }

  return Response.json({ results });
});
