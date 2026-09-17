// Relais YellowBet — AL VE CAPITAL
// Rejoue une sequence de requetes sur yellowbet.cg en conservant les cookies
// et le jeton de session, exactement comme un navigateur sur le site.
// Protege par la variable d'environnement RELAY_SECRET.

const BASE = "https://yellowbet.cg";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const YB = {
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

const get = (o, p) => { let v = o; for (const k of String(p).split(".")) { v = v == null ? null : v[k]; } return v; };

module.exports = async (req, res) => {
  if (req.method === "GET") return res.status(200).json({ ok: true, service: "yellowbet-relay" });
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const secret = process.env.RELAY_SECRET || "";
  if (!secret || req.headers["x-relay-secret"] !== secret) return res.status(401).json({ error: "bad_secret" });

  const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const requests = Array.isArray(payload.requests) ? payload.requests : [];
  if (!requests.length) return res.status(400).json({ error: "no_requests" });

  const jar = new Map();
  let token = "";
  let prev = null;
  const results = [];

  for (const q of requests) {
    try {
      if (q.skipIfPrevNull && get(prev, q.skipIfPrevNull) == null) { results.push({ status: 0, text: "SKIPPED" }); continue; }

      const headers = Object.assign({}, YB, q.headers || {});
      if (jar.size) headers.cookie = [...jar.entries()].map(([k, v]) => k + "=" + v).join("; ");
      if (q.useToken && token) { headers.authorization = "Bearer " + token; headers.token = token; }

      let body = q.body;
      if (q.tokenBodyField && token && body && typeof body === "object") { body = Object.assign({}, body); body[q.tokenBodyField] = token; }
      if (q.fromPrev && body && typeof body === "object") { body = Object.assign({}, body); for (const k in q.fromPrev) body[k] = get(prev, q.fromPrev[k]); }

      const init = { method: q.method || "GET", headers };
      if (body !== undefined && body !== null) init.body = JSON.stringify(body);

      let r, text;
      for (let attempt = 0; attempt < 3; attempt++) {
        r = await fetch(BASE + q.path, init);
        text = await r.text();
        const setCookies = typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : [];
        for (const c of setCookies) {
          const [pair] = c.split(";");
          const i = pair.indexOf("=");
          if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
        }
        if (!q.retryIfNull) break;
        let j = null; try { j = JSON.parse(text); } catch (e) {}
        if (get(j, q.retryIfNull) != null) break;
        await new Promise((s) => setTimeout(s, 900));
      }

      prev = null;
      try { prev = JSON.parse(text); if (prev && typeof prev.token === "string" && prev.token) token = prev.token; } catch (e) {}
      results.push({ status: r.status, text: String(text).slice(0, 20000) });
    } catch (e) {
      results.push({ status: 0, text: "FETCH_ERROR: " + String(e) });
    }
  }

  return res.status(200).json({ results });
};
