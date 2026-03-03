var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// cloudflare_worker.js
function brand(env) {
  return {
    name: env.BRAND_NAME || "Syntoniqa FSM",
    shortName: env.BRAND_SHORT || "Syntoniqa",
    email: env.BRAND_EMAIL || "noreply@syntoniqa.app",
    emailFrom: env.BRAND_EMAIL_FROM || `Syntoniqa <${env.BRAND_EMAIL || "noreply@syntoniqa.app"}>`,
    adminUrl: env.BRAND_ADMIN_URL || "",
    techUrl: env.BRAND_TECH_URL || "",
    color: env.BRAND_COLOR || "#1E40AF"
  };
}
__name(brand, "brand");
var ALLOWED_ORIGINS = [
  "https://fieldforcemrser2026.github.io",
  "https://app.syntoniqa.app"
];
var DEV_ORIGINS = ["http://localhost:3000", "http://localhost:8787"];
var corsHeaders = {
  "Access-Control-Allow-Origin": "https://app.syntoniqa.app",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Token"
};
function setCorsForRequest(request, env) {
  const origin = request?.headers?.get("Origin") || "";
  const extras = (env?.CORS_EXTRA || "").split(",").filter(Boolean);
  const isDev = !env?.SUPABASE_URL || env.SUPABASE_URL.includes("localhost");
  const allOrigins = [...ALLOWED_ORIGINS, ...extras, ...isDev ? DEV_ORIGINS : []];
  const allowed = allOrigins.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  corsHeaders = {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Token"
  };
}
__name(setCorsForRequest, "setCorsForRequest");
var VALID_PIANO_TRANSITIONS = {
  pianificato: ["in_corso", "annullato"],
  in_corso: ["completato", "pianificato", "annullato"],
  completato: [],
  // terminale
  annullato: ["pianificato"]
  // può essere ripianificato
};
var VALID_URGENZA_TRANSITIONS = {
  aperta: ["assegnata", "chiusa"],
  assegnata: ["schedulata", "in_corso", "aperta", "chiusa"],
  schedulata: ["in_corso", "assegnata", "chiusa"],
  in_corso: ["risolta", "chiusa"],
  risolta: ["chiusa", "in_corso"],
  // riapertura se serve
  chiusa: []
  // terminale
};
function validateTransition(validMap, currentStato, newStato, entityType) {
  if (!newStato || newStato === currentStato) return null;
  const allowed = validMap[currentStato];
  if (!allowed) return `Stato corrente '${currentStato}' non valido per ${entityType}`;
  if (!allowed.includes(newStato)) return `Transizione ${entityType} non valida: ${currentStato} \u2192 ${newStato}. Consentite: ${allowed.join(", ")}`;
  return null;
}
__name(validateTransition, "validateTransition");
async function requireAdmin(env, body) {
  if (body._isJWT) {
    if (body._authRole === "admin") return null;
    return "Solo admin pu\xF2 eseguire questa azione";
  }
  if (body._authRole === "system") return null;
  const uid = body.operatoreId || body.userId;
  if (!uid) return "operatoreId richiesto";
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(uid)) return "operatoreId formato non valido";
  const caller = await sb(env, "utenti", "GET", null, `?id=eq.${encodeURIComponent(uid)}&select=ruolo`).catch(() => []);
  if (!caller?.[0]) return "Utente non trovato";
  if (caller[0].ruolo !== "admin") return "Solo admin pu\xF2 eseguire questa azione";
  return null;
}
__name(requireAdmin, "requireAdmin");
function validateNumeric(value, field, min = 0) {
  if (value === null || value === void 0 || value === "") return null;
  const num = Number(value);
  if (isNaN(num)) return `${field} deve essere numerico`;
  if (num < min) return `${field} deve essere >= ${min}`;
  return null;
}
__name(validateNumeric, "validateNumeric");
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}
__name(json, "json");
function err(msg, status = 400) {
  return json({ success: false, error: msg }, status);
}
__name(err, "err");
function ok(data = {}) {
  return json({ success: true, data });
}
__name(ok, "ok");
function secureId(prefix) {
  const ts = Date.now().toString(36);
  const rnd = toHex(crypto.getRandomValues(new Uint8Array(4)));
  return `${prefix}_${ts}${rnd}`;
}
__name(secureId, "secureId");
function sanitizePgFilter(input) {
  if (!input || typeof input !== "string") return "";
  return input.replace(/[*.,=|:()&!<>;\[\]{}\\/"'`%]/g, "").trim().slice(0, 100);
}
__name(sanitizePgFilter, "sanitizePgFilter");
function toPascal(key) {
  if (key === "id") return "ID";
  return key.split("_").map((part) => {
    if (part === "id") return "ID";
    if (part === "ids") return "IDs";
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join("");
}
__name(toPascal, "toPascal");
function toSnake(key) {
  if (key === "ID") return "id";
  return key.replace(/IDs$/g, "_ids").replace(/ID$/g, "_id").replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "").replace(/__+/g, "_");
}
__name(toSnake, "toSnake");
function pascalizeRecord(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toPascal(k), v]));
}
__name(pascalizeRecord, "pascalizeRecord");
function pascalizeArrays(data) {
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      result[key] = value.map((item) => item && typeof item === "object" ? pascalizeRecord(item) : item);
    } else {
      result[key] = value;
    }
  }
  return result;
}
__name(pascalizeArrays, "pascalizeArrays");
var INTERNAL_KEYS = /* @__PURE__ */ new Set(["action", "userId", "operatoreId", "token", "method", "_authRole", "_authUserId", "_isJWT", "_clientIP", "_isSuperToken"]);
function getFields(body) {
  const source = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : body;
  const result = {};
  for (const [k, v] of Object.entries(source)) {
    if (INTERNAL_KEYS.has(k) || k.startsWith("_auth") || k.startsWith("_client") || k.startsWith("_is")) continue;
    if (v === void 0) continue;
    result[toSnake(k)] = v;
  }
  return result;
}
__name(getFields, "getFields");
function normalizeBody(raw) {
  const isDataWrapper = raw.data && typeof raw.data === "object" && !Array.isArray(raw.data);
  const dataObj = isDataWrapper ? raw.data : {};
  const converted = {};
  for (const [k, v] of Object.entries(dataObj)) {
    converted[toSnake(k)] = v;
  }
  const { action, token, data, method, ...rest } = raw;
  const result = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k === "userId" || k === "operatoreId") {
      result[k] = v;
    } else {
      result[toSnake(k)] = v;
    }
  }
  if (data !== void 0 && !isDataWrapper) {
    result.data = data;
  }
  Object.assign(result, converted);
  return result;
}
__name(normalizeBody, "normalizeBody");
async function sb(env, table, method = "GET", body = null, params = "", extraHeaders = {}) {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const cleaned = {};
    for (const [k, v] of Object.entries(body)) {
      if (k.startsWith("_") || INTERNAL_KEYS.has(k)) continue;
      cleaned[k] = v;
    }
    body = cleaned;
  }
  const url = `${env.SUPABASE_URL}/rest/v1/${table}${params || ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      "apikey": env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" || method === "PATCH" ? "return=representation" : "return=minimal",
      ...extraHeaders
    },
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) {
    const text2 = await res.text();
    throw new Error(`Supabase ${method} ${table}: ${res.status} ${text2}`);
  }
  const text = await res.text();
  if (!text) return method === "GET" ? [] : null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
__name(sb, "sb");
var PW_ITERATIONS = 1e5;
var PW_SALT_LEN = 16;
var PW_HASH_LEN = 32;
async function hashPasswordPBKDF2(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PW_ITERATIONS, hash: "SHA-256" }, keyMaterial, PW_HASH_LEN * 8);
  return new Uint8Array(bits);
}
__name(hashPasswordPBKDF2, "hashPasswordPBKDF2");
function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(toHex, "toHex");
function fromHex(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
}
__name(fromHex, "fromHex");
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(PW_SALT_LEN));
  const hash = await hashPasswordPBKDF2(password, salt);
  return `pbkdf2:${toHex(salt)}:${toHex(hash)}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, stored) {
  if (!stored) return false;
  if (stored.startsWith("pbkdf2:")) {
    const parts = stored.split(":");
    if (parts.length !== 3) return false;
    const salt = fromHex(parts[1]);
    const expectedHash = parts[2];
    const actualHash = toHex(await hashPasswordPBKDF2(password, salt));
    return actualHash === expectedHash;
  }
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", enc.encode(password));
  const sha256 = toHex(hashBuffer);
  return stored === sha256;
}
__name(verifyPassword, "verifyPassword");
function isLegacyHash(stored) {
  return stored && !stored.startsWith("pbkdf2:");
}
__name(isLegacyHash, "isLegacyHash");
function checkToken(request, env, bodyToken) {
  const token = request.headers.get("X-Token") || new URL(request.url).searchParams.get("token") || bodyToken || "";
  return token === env.SQ_TOKEN;
}
__name(checkToken, "checkToken");
function normalizeSerial(s) {
  if (!s) return "";
  const num = (s + "").trim().replace(/[^0-9]/g, "");
  if (!num) return (s + "").trim();
  return String(parseInt(num, 10));
}
__name(normalizeSerial, "normalizeSerial");
function padSerial10(s) {
  const num = (s + "").trim().replace(/[^0-9]/g, "");
  return num ? num.padStart(10, "0") : (s + "").trim();
}
__name(padSerial10, "padSerial10");
function b64UrlEncode(buf) {
  const str = typeof buf === "string" ? buf : String.fromCharCode(...buf);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(b64UrlEncode, "b64UrlEncode");
function b64UrlDecode(str) {
  const padded = str + "=".repeat((4 - str.length % 4) % 4);
  const bin = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
}
__name(b64UrlDecode, "b64UrlDecode");
async function signJWT(payload, env) {
  const header = b64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64UrlEncode(JSON.stringify(payload));
  const msg = `${header}.${body}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(env.JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
  return `${msg}.${b64UrlEncode(sig)}`;
}
__name(signJWT, "signJWT");
async function verifyJWT(token, env) {
  if (!env.JWT_SECRET) return null;
  const parts = (token || "").split(".");
  if (parts.length !== 3) return null;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(env.JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, b64UrlDecode(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64UrlDecode(parts[1])));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) return null;
    return payload;
  } catch {
    return null;
  }
}
__name(verifyJWT, "verifyJWT");
async function authenticateRequest(request, env, bodyToken) {
  const authHeader = request.headers.get("Authorization") || "";
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearer) {
    const payload = await verifyJWT(bearer[1], env);
    if (payload) return { ok: true, sub: payload.sub, role: payload.role, jwt: true };
    if (bearer[1] === env.SQ_TOKEN) return { ok: true, sub: "system", role: "system", jwt: false };
    return { ok: false };
  }
  if (checkToken(request, env, bodyToken)) {
    return { ok: true, sub: "system", role: "system", jwt: false };
  }
  return { ok: false };
}
__name(authenticateRequest, "authenticateRequest");
var RATE_LIMITS = {
  default: { max: 120, windowSec: 60 },
  // 120 req/min per IP
  login: { max: 5, windowSec: 60 },
  // 5 login/min
  ai: { max: 10, windowSec: 60 },
  // 10 AI calls/min
  telegram: { max: 100, windowSec: 60 }
  // 100 webhook/min (anti-spam)
};
var _rateStore = /* @__PURE__ */ new Map();
function rateLimit(identifier, bucket = "default") {
  const cfg = RATE_LIMITS[bucket] || RATE_LIMITS.default;
  const key = `${identifier}:${bucket}`;
  const now = Date.now();
  const windowMs = cfg.windowSec * 1e3;
  let hits = _rateStore.get(key) || [];
  hits = hits.filter((t) => t > now - windowMs);
  if (hits.length >= cfg.max) {
    const retryAfter = hits.length > 0 ? Math.ceil((hits[0] + windowMs - now) / 1e3) : Math.ceil(windowMs / 1e3);
    return { limited: true, retryAfter };
  }
  hits.push(now);
  _rateStore.set(key, hits);
  if (Math.random() < 1e-3) {
    for (const [k, v] of _rateStore) {
      if (!v.length || v[v.length - 1] < now - windowMs * 2) _rateStore.delete(k);
    }
  }
  return { limited: false, remaining: cfg.max - hits.length };
}
__name(rateLimit, "rateLimit");
var cloudflare_worker_default = {
  async fetch(request, env) {
    setCorsForRequest(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || url.pathname.split("/").pop();
    const clientIP = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
    if (action === "telegramWebhook") {
      if (!env.TELEGRAM_WEBHOOK_SECRET) {
        console.error("TELEGRAM_WEBHOOK_SECRET non configurato! Webhook disabilitato.");
        return new Response("Webhook not configured", { status: 503 });
      }
      const webhookSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
      if (webhookSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }
      const rlTg = rateLimit(clientIP, "telegram");
      if (rlTg.limited) return new Response("Too Many Requests", { status: 429 });
      const body = await request.json().catch(() => ({}));
      return await handlePost(action, body, env);
    }
    const bucket = action === "login" ? "login" : action === "generateAIPlan" || action === "analyzeImage" || action === "previewAIPlan" ? "ai" : "default";
    const rl = rateLimit(clientIP, bucket);
    if (rl.limited) {
      return new Response(JSON.stringify({
        success: false,
        error: `Troppe richieste. Riprova tra ${rl.retryAfter} secondi.`
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryAfter) }
      });
    }
    try {
      if (request.method === "GET") {
        const auth = await authenticateRequest(request, env);
        if (!auth.ok) return err("Non autorizzato", 401);
        return await handleGet(action, url, env, auth);
      } else if (request.method === "POST") {
        const rawBody = await request.json().catch(() => ({}));
        const postAction = action || rawBody.action || "";
        if (postAction === "login") {
          const body2 = normalizeBody(rawBody);
          body2._clientIP = clientIP;
          return await handlePost("login", body2, env);
        }
        const auth = await authenticateRequest(request, env, rawBody.token);
        if (!auth.ok) return err("Non autorizzato", 401);
        const body = normalizeBody(rawBody);
        body._clientIP = clientIP;
        body._authUserId = auth.sub;
        body._authRole = auth.role;
        body._isJWT = auth.jwt;
        return await handlePost(postAction, body, env);
      }
      return err("Metodo non supportato", 405);
    } catch (e) {
      console.error("Worker error:", e);
      return err(`Errore interno: ${e.message}`, 500);
    }
  },
  // ============ CRON: notifiche automatiche interventi ============
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([
      checkInterventoReminders(env),
      checkSLAUrgenze(env),
      checkPMExpiry(env)
    ]));
  }
};
async function handleGet(action, url, env, auth = {}) {
  switch (action) {
    case "getAll": {
      const reqUserId = auth.jwt ? auth.sub : url.searchParams.get("userId") || "";
      let userRole = auth.jwt ? auth.role : "admin";
      if (!auth.jwt && reqUserId) {
        const reqUser = await sb(env, "utenti", "GET", null, `?id=eq.${reqUserId}&select=ruolo`).catch(() => []);
        userRole = reqUser?.[0]?.ruolo || "tecnico";
      }
      const isTecnico = userRole === "tecnico";
      const tecFilter = isTecnico ? `&tecnico_id=eq.${reqUserId}` : "";
      const tecFilterUrg = isTecnico ? `&or=(tecnico_assegnato.eq.${reqUserId},segnalato_da.eq.${reqUserId})` : "";
      const [
        utenti,
        clienti,
        macchine,
        piano,
        urgenze,
        ordini,
        reperibilita,
        trasferte,
        notifiche,
        richieste,
        installazioni,
        pagellini,
        automezzi,
        tipi_intervento,
        priorita,
        squadre,
        tagliandi,
        fasi_installazione,
        sla_config,
        checklist_template,
        documenti,
        config
      ] = await Promise.all([
        sb(env, "utenti", "GET", null, "?select=*&obsoleto=eq.false&order=cognome"),
        sb(env, "clienti", "GET", null, "?select=*&obsoleto=eq.false&order=nome"),
        sb(env, "macchine", "GET", null, "?select=*&obsoleto=eq.false&limit=1000"),
        sb(env, "piano", "GET", null, `?select=*&obsoleto=eq.false&order=data.desc&limit=500${tecFilter}`),
        sb(env, "urgenze", "GET", null, `?select=*&obsoleto=eq.false&order=data_segnalazione.desc&limit=200${tecFilterUrg}`),
        sb(env, "ordini", "GET", null, `?select=*&obsoleto=eq.false&order=data_richiesta.desc&limit=300${tecFilter}`),
        sb(env, "reperibilita", "GET", null, `?select=*&obsoleto=eq.false&order=data_inizio.desc&limit=200${tecFilter}`),
        sb(env, "trasferte", "GET", null, `?select=*&obsoleto=eq.false&order=data_inizio.desc&limit=100${tecFilter}`),
        sb(env, "notifiche", "GET", null, isTecnico ? `?select=*&obsoleto=eq.false&destinatario_id=eq.${reqUserId}&order=data_invio.desc&limit=100` : "?select=*&obsoleto=eq.false&order=data_invio.desc&limit=200"),
        sb(env, "richieste", "GET", null, `?select=*&obsoleto=eq.false&tenant_id=eq.${env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045"}&order=data_richiesta.desc&limit=500`),
        sb(env, "installazioni", "GET", null, `?select=*&obsoleto=eq.false&tenant_id=eq.${env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045"}`),
        sb(env, "pagellini", "GET", null, isTecnico ? `?select=*&obsoleto=eq.false&tecnico_id=eq.${reqUserId}&order=data_creazione.desc` : "?select=*&obsoleto=eq.false&order=data_creazione.desc"),
        sb(env, "automezzi", "GET", null, "?select=*&obsoleto=eq.false"),
        sb(env, "tipi_intervento", "GET", null, "?select=*&attivo=eq.true"),
        sb(env, "priorita", "GET", null, "?select=*&attivo=eq.true&order=livello"),
        sb(env, "squadre", "GET", null, "?select=*&attivo=eq.true"),
        sb(env, "tagliandi", "GET", null, "?select=*&attivo=eq.true"),
        sb(env, "fasi_installazione", "GET", null, "?select=*&attivo=eq.true&order=ordine"),
        sb(env, "sla_config", "GET", null, "?select=*&attivo=eq.true"),
        sb(env, "checklist_template", "GET", null, "?select=*&attivo=eq.true"),
        sb(env, "documenti", "GET", null, "?select=*&obsoleto=eq.false&order=data_caricamento.desc"),
        sb(env, "config", "GET", null, "?select=chiave,valore")
      ]);
      const lvConfig = config.find((c) => c.chiave === "utenti_livello");
      const lvMap = lvConfig?.valore ? (() => {
        try {
          return JSON.parse(lvConfig.valore);
        } catch {
          return {};
        }
      })() : {};
      const utentiSafe = utenti.map((u) => {
        const { password_hash, ...rest } = u;
        if (lvMap[u.id]) rest.livello = lvMap[u.id];
        return rest;
      });
      return ok(pascalizeArrays({
        utenti: utentiSafe,
        clienti,
        macchine,
        piano,
        urgenze,
        ordini,
        reperibilita,
        trasferte,
        notifiche,
        richieste,
        installazioni,
        pagellini,
        automezzi,
        tipiIntervento: tipi_intervento,
        priorita,
        squadre,
        tagliandi,
        fasiInstallazione: fasi_installazione,
        slaConfig: sla_config,
        checklistTemplate: checklist_template,
        documenti,
        config: Object.fromEntries(config.map((c) => [c.chiave, c.valore])),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }));
    }
    case "getKPI": {
      const tecnicoId = url.searchParams.get("tecnicoId") || "";
      const periodo = url.searchParams.get("periodo") || "mese";
      let dateFilter = "";
      const now = /* @__PURE__ */ new Date();
      if (periodo === "settimana") {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        dateFilter = `&data=gte.${d.toISOString().split("T")[0]}`;
      } else if (periodo === "mese") {
        dateFilter = `&data=gte.${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      } else if (periodo === "anno") {
        dateFilter = `&data=gte.${now.getFullYear()}-01-01`;
      }
      const tecnicoFilter = tecnicoId ? `&tecnico_id=eq.${tecnicoId}` : "";
      const kpi = await sb(env, "kpi_log", "GET", null, `?select=*${dateFilter}${tecnicoFilter}`);
      return ok({ kpi, periodo, tecnicoId });
    }
    case "getKPITecnici": {
      const mese = url.searchParams.get("mese") || (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
      const interventi = await sb(
        env,
        "piano",
        "GET",
        null,
        `?select=tecnico_id,stato,ore_lavorate,km_percorsi&data=gte.${mese}-01&data=lte.${mese}-31&obsoleto=eq.false`
      );
      const byTecnico = {};
      interventi.forEach((i) => {
        if (!i.tecnico_id) return;
        if (!byTecnico[i.tecnico_id]) byTecnico[i.tecnico_id] = { total: 0, completati: 0, ore: 0, km: 0 };
        byTecnico[i.tecnico_id].total++;
        if (i.stato === "completato" || i.stato === "chiuso") byTecnico[i.tecnico_id].completati++;
        byTecnico[i.tecnico_id].ore += parseFloat(i.ore_lavorate || 0);
        byTecnico[i.tecnico_id].km += parseInt(i.km_percorsi || 0);
      });
      return ok({ kpiTecnici: byTecnico, mese });
    }
    case "getBackupHistory": {
      const backups = await sb(
        env,
        "kpi_snapshot",
        "GET",
        null,
        "?tipo_snapshot=eq.backup&order=data.desc&limit=30"
      );
      return ok({ backups });
    }
    case "getAuditLog": {
      const entityType = url.searchParams.get("entityType") || "";
      const userId = url.searchParams.get("userId") || "";
      const limit = url.searchParams.get("limit") || "100";
      let params = `?order=timestamp_at.desc&limit=${limit}`;
      if (entityType) params += `&entity_type=eq.${entityType}`;
      if (userId) params += `&user_id=eq.${userId}`;
      const logs = await sb(env, "workflow_log", "GET", null, params);
      return ok({ logs });
    }
    case "getChecklistTemplates": {
      const templates = await sb(env, "checklist_template", "GET", null, "?attivo=eq.true");
      return ok({ templates });
    }
    case "getPagellini": {
      const tecnicoId = url.searchParams.get("tecnicoId") || "";
      const params = tecnicoId ? `?tecnico_id=eq.${tecnicoId}&obsoleto=eq.false` : "?obsoleto=eq.false";
      const [pagellini, voci] = await Promise.all([
        sb(env, "pagellini", "GET", null, params),
        sb(env, "pagellini_voci", "GET", null, "?select=*")
      ]);
      return ok({ pagellini, voci });
    }
    case "exportPowerBI": {
      const pbiUser = url.searchParams.get("userId") || "";
      if (pbiUser) {
        const pbiCaller = await sb(env, "utenti", "GET", null, `?id=eq.${pbiUser}&select=ruolo`).catch(() => []);
        if (pbiCaller?.[0]?.ruolo !== "admin") return err("Solo admin pu\xF2 esportare PowerBI", 403);
      }
      const [piano, urgenze, utenti, clienti, macchine, kpiLog] = await Promise.all([
        sb(env, "piano", "GET", null, "?select=*&obsoleto=eq.false&order=data.desc&limit=5000"),
        sb(env, "urgenze", "GET", null, "?select=*&obsoleto=eq.false&order=data_segnalazione.desc&limit=2000"),
        sb(env, "utenti", "GET", null, "?select=id,nome,cognome,ruolo,squadra_id&obsoleto=eq.false"),
        sb(env, "clienti", "GET", null, "?select=id,nome,citta,prov&obsoleto=eq.false"),
        sb(env, "macchine", "GET", null, "?select=id,cliente_id,tipo,modello&obsoleto=eq.false"),
        sb(env, "kpi_log", "GET", null, "?order=data.desc&limit=1000&obsoleto=eq.false")
      ]);
      return ok({ fact_interventi: piano, fact_urgenze: urgenze, fact_kpi: kpiLog, dim_tecnici: utenti, dim_clienti: clienti, dim_macchine: macchine });
    }
    default:
      return err(`Azione GET non trovata: ${action}`, 404);
  }
}
__name(handleGet, "handleGet");
async function handlePost(action, body, env) {
  const TENANT = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
  async function wlog(entityType, entityId, action2, userId, note = "") {
    await sb(env, "workflow_log", "POST", {
      id: secureId("WL"),
      entity_type: entityType,
      entity_id: entityId,
      action: action2,
      user_id: userId,
      note,
      tenant_id: TENANT,
      timestamp_at: (/* @__PURE__ */ new Date()).toISOString()
    }).catch(() => {
    });
  }
  __name(wlog, "wlog");
  switch (action) {
    // -------- AUTH --------
    case "login": {
      const { username, password } = body;
      if (!username || !password) return err("Username e password richiesti");
      const utenti = await sb(
        env,
        "utenti",
        "GET",
        null,
        `?username=eq.${encodeURIComponent(username)}&attivo=eq.true&obsoleto=eq.false`
      );
      if (!utenti.length) return err("Credenziali non valide", 401);
      const utente = utenti[0];
      const valid = await verifyPassword(password, utente.password_hash);
      if (!valid) {
        await wlog("auth", utente.id, "login_failed", utente.id, `IP: ${body._clientIP || "unknown"}`);
        return err("Credenziali non valide", 401);
      }
      if (isLegacyHash(utente.password_hash)) {
        const upgraded = await hashPassword(password);
        await sb(env, `utenti?id=eq.${utente.id}`, "PATCH", { password_hash: upgraded });
      }
      const { password_hash, ...utenteSafe } = utente;
      await wlog("auth", utente.id, "login", utente.id);
      let token = null, expiresIn = null;
      if (env.JWT_SECRET) {
        const rememberMe = body.remember_me || body.rememberMe;
        expiresIn = rememberMe ? parseInt(env.JWT_REMEMBER_ME_SECONDS || "2592000", 10) : parseInt(env.JWT_EXPIRY_SECONDS || "28800", 10);
        const now = Math.floor(Date.now() / 1e3);
        token = await signJWT({
          sub: utente.id,
          role: utente.ruolo || "tecnico",
          nome: `${utente.nome || ""} ${utente.cognome || ""}`.trim(),
          tenant_id: utente.tenant_id || env.TENANT_ID,
          iat: now,
          exp: now + expiresIn
        }, env);
      }
      return ok({ token, expiresIn, user: pascalizeRecord(utenteSafe) });
    }
    case "resetPassword": {
      const uid = body.userId || body.user_id;
      const newPwd = body.new_password || body.newPassword;
      if (!uid || !newPwd) return err("userId e newPassword richiesti");
      const hashed = await hashPassword(newPwd);
      await sb(env, `utenti?id=eq.${uid}`, "PATCH", { password_hash: hashed, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      await wlog("utente", uid, "reset_password", body.operatoreId || body.operatore_id || "system");
      return ok();
    }
    case "changePassword": {
      const uid = body.userId || body.user_id;
      const { old_password, new_password } = body;
      if (!uid || !old_password || !new_password) return err("userId, old_password e new_password richiesti");
      if (new_password.length < 6) return err("La nuova password deve avere almeno 6 caratteri");
      if (new_password.length > 128) return err("Password troppo lunga (max 128 caratteri)");
      const users = await sb(env, "utenti", "GET", null, `?id=eq.${uid}&select=id,password_hash`);
      if (!users?.length) return err("Utente non trovato");
      const oldValid = await verifyPassword(old_password, users[0].password_hash);
      if (!oldValid) return err("Password attuale non corretta");
      const newHash = await hashPassword(new_password);
      await sb(env, `utenti?id=eq.${uid}`, "PATCH", { password_hash: newHash, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      await wlog("utente", uid, "change_password", uid);
      return ok({ message: "Password aggiornata con successo" });
    }
    case "requestPasswordReset": {
      const { username } = body;
      if (!username) return err("Username richiesto");
      const users = await sb(env, "utenti", "GET", null, `?username=eq.${username}&select=id,nome,cognome,username,email`);
      if (!users?.length) return err("Username non trovato nel sistema");
      const u = users[0];
      const admins = await sb(env, "utenti", "GET", null, "?ruolo=eq.admin&attivo=eq.true&select=id,tenant_id&limit=1").catch(() => []);
      const adminId = admins?.[0]?.id || "USR001";
      const tenantId = admins?.[0]?.tenant_id || u.tenant_id || null;
      const notifId = secureId("NOT_RST");
      await sb(env, "notifiche", "POST", {
        id: notifId,
        tipo: "reset_password",
        oggetto: "\u{1F511} Richiesta Reset Password",
        testo: `L'utente ${u.nome} ${u.cognome} (${u.username}) ha richiesto il reset della password. Vai su Gestione Utenti per resettarla.`,
        destinatario_id: adminId,
        stato: "inviata",
        priorita: "alta",
        tenant_id: tenantId
      });
      try {
        const msgId = secureId("MSG_RST");
        await sb(env, "chat_messaggi", "POST", {
          id: msgId,
          canale_id: "CH_ADMIN",
          mittente_id: "TELEGRAM",
          testo: `\u{1F511} RICHIESTA RESET PASSWORD
\u{1F464} ${u.nome} ${u.cognome} (${u.username})
\u{1F4E7} ${u.email || "nessuna email"}

\u2192 Vai su Gestione Utenti > Modifica > Reset Password`,
          tipo: "testo",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (e) {
      }
      try {
        const cfgRows = await sb(env, "config", "GET", null, "?chiave=in.(telegram_bot_token,telegram_group_generale)&select=chiave,valore");
        const cfg = {};
        (cfgRows || []).forEach((c) => {
          cfg[c.chiave] = c.valore;
        });
        if (cfg.telegram_bot_token && cfg.telegram_group_generale) {
          await fetch(`https://api.telegram.org/bot${cfg.telegram_bot_token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: cfg.telegram_group_generale, text: `\u{1F511} <b>RESET PASSWORD</b>
\u{1F464} ${u.nome} ${u.cognome} (${u.username}) ha chiesto il reset password.
Admin: vai su Gestione Utenti per resettarla.`, parse_mode: "HTML" })
          }).catch((e) => console.error("[SYNC]", e.message));
        }
      } catch (e) {
      }
      return ok({ message: "Richiesta inviata. L'admin ricever\xE0 una notifica per resettare la tua password." });
    }
    // -------- PIANO (INTERVENTI) --------
    case "createPiano": {
      const id = secureId("INT");
      const fields = getFields(body);
      if (!fields.data) return err("Campo data obbligatorio per createPiano");
      if (!fields.cliente_id) return err("Campo cliente_id obbligatorio per createPiano");
      const row = {
        id,
        tenant_id: fields.tenant_id || env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045",
        tecnico_id: fields.tecnico_id || null,
        cliente_id: fields.cliente_id || null,
        automezzo_id: fields.automezzo_id || null,
        tipo_intervento_id: fields.tipo_intervento_id || null,
        data: fields.data || null,
        ora_inizio: fields.ora_inizio || null,
        ora_fine: fields.ora_fine || null,
        stato: fields.stato || "pianificato",
        note: fields.note || null,
        data_fine: fields.data_fine || null
      };
      const result = await sb(env, "piano", "POST", row);
      await wlog("piano", id, "created", body.operatoreId || body.userId);
      await sendTelegramNotification(env, "nuovo_intervento", row);
      return ok({ intervento: pascalizeRecord(result[0]) });
    }
    case "updatePiano": {
      const id = body.id;
      if (!id) return err("id piano richiesto");
      const allFields = getFields(body);
      const pianoWritable = ["tecnico_id", "cliente_id", "macchina_id", "automezzo_id", "tipo_intervento_id", "priorita_id", "data", "ora_inizio", "ora_fine", "durata_ore", "stato", "note", "data_fine", "obsoleto"];
      const updates = {};
      for (const k of pianoWritable) {
        if (allFields[k] !== void 0) updates[k] = allFields[k];
      }
      for (const [field, min] of [["durata_ore", 0], ["ore_lavorate", 0], ["km_percorsi", 0]]) {
        const numErr = validateNumeric(updates[field], field, min);
        if (numErr) return err(numErr);
      }
      if (updates.stato) {
        const current = await sb(env, "piano", "GET", null, `?id=eq.${id}&select=stato`).catch(() => []);
        if (current?.[0]?.stato) {
          const transErr = validateTransition(VALID_PIANO_TRANSITIONS, current[0].stato, updates.stato, "piano");
          if (transErr) return err(transErr);
        }
      }
      updates.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      await sb(env, `piano?id=eq.${id}`, "PATCH", updates);
      await wlog("piano", id, `updated_stato_${updates.stato || "fields"}`, body.operatoreId || body.userId);
      if (updates.stato === "completato") {
        await triggerKPISnapshot(env, id, updates.tecnico_id);
        try {
          const linkedUrg = await sb(env, "urgenze", "GET", null, `?intervento_id=eq.${id}&stato=in.(assegnata,schedulata,in_corso)&select=id`).catch(() => []);
          for (const u of linkedUrg || []) {
            await sb(env, `urgenze?id=eq.${u.id}`, "PATCH", { stato: "risolta", data_risoluzione: (/* @__PURE__ */ new Date()).toISOString(), updated_at: (/* @__PURE__ */ new Date()).toISOString() });
            await wlog("urgenza", u.id, "auto_resolved_from_piano", body.operatoreId || body.userId, `piano ${id} completato`);
          }
        } catch (e) {
          console.error("Auto-resolve urgenza error:", e.message);
        }
      }
      if (updates.stato === "in_corso") {
        try {
          const linkedUrg2 = await sb(env, "urgenze", "GET", null, `?intervento_id=eq.${id}&stato=eq.assegnata&select=id`).catch(() => []);
          for (const u of linkedUrg2 || []) {
            await sb(env, `urgenze?id=eq.${u.id}`, "PATCH", { stato: "in_corso", data_inizio: (/* @__PURE__ */ new Date()).toISOString(), updated_at: (/* @__PURE__ */ new Date()).toISOString() });
            await wlog("urgenza", u.id, "auto_started_from_piano", body.operatoreId || body.userId);
          }
        } catch (e) {
          console.error("Auto-start urgenza error:", e.message);
        }
      }
      if (updates.stato === "annullato") {
        try {
          const linkedUrgAnn = await sb(env, "urgenze", "GET", null, `?intervento_id=eq.${id}&stato=in.(assegnata,schedulata,in_corso)&select=id`).catch(() => []);
          for (const u of linkedUrgAnn || []) {
            await sb(env, `urgenze?id=eq.${u.id}`, "PATCH", { stato: "aperta", intervento_id: null, tecnico_assegnato: null, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
            await wlog("urgenza", u.id, "reopened_from_piano_annullato", body.operatoreId || body.userId, `piano ${id} annullato`);
          }
        } catch (e) {
          console.error("Reopen urgenza from annullato error:", e.message);
        }
      }
      return ok();
    }
    // -------- URGENZE --------
    case "createUrgenza": {
      const id = secureId("URG");
      const fields = getFields(body);
      let slaScadenza = null;
      const pId = fields.priorita_id;
      if (pId) {
        const sla = await sb(env, "sla_config", "GET", null, `?priorita_id=eq.${pId}&attivo=eq.true`);
        if (sla.length && sla[0].tempo_risoluzione_ore) {
          const d = /* @__PURE__ */ new Date();
          d.setHours(d.getHours() + sla[0].tempo_risoluzione_ore);
          slaScadenza = d.toISOString();
        }
      }
      const urgWritable = ["tenant_id", "cliente_id", "macchina_id", "problema", "priorita_id", "stato", "tecnico_assegnato", "tecnici_ids", "automezzo_id", "data_segnalazione", "data_assegnazione", "data_prevista", "ora_prevista", "data_inizio", "data_risoluzione", "intervento_id", "note", "allegati_ids", "sla_scadenza", "sla_status"];
      const row = { id };
      for (const k of urgWritable) {
        if (fields[k] !== void 0) row[k] = fields[k];
      }
      row.tenant_id = row.tenant_id || env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
      row.stato = row.stato || "aperta";
      row.sla_scadenza = slaScadenza;
      row.sla_status = "ok";
      row.data_segnalazione = row.data_segnalazione || (/* @__PURE__ */ new Date()).toISOString();
      const result = await sb(env, "urgenze", "POST", row);
      await wlog("urgenza", id, "created", body.operatoreId || body.userId);
      await sendTelegramNotification(env, "nuova_urgenza", row);
      let smartSuggestion = null;
      try {
        const itFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
        const oggi = itFmt.format(/* @__PURE__ */ new Date());
        const pianoOggi = await sb(
          env,
          "piano",
          "GET",
          null,
          `?data=eq.${oggi}&stato=eq.pianificato&obsoleto=eq.false&select=id,tecnico_id,note,tipo_intervento_id`
        ).catch(() => []);
        const disponibili = pianoOggi.filter((p) => {
          const nota = ((p.note || "") + " " + (p.tipo_intervento_id || "")).toLowerCase();
          return nota.includes("varie") || nota.includes("disponibil") || nota.includes("urgenz") || nota.includes("backup");
        });
        if (disponibili.length) {
          const tecIds = [...new Set(disponibili.map((d) => d.tecnico_id).filter(Boolean))];
          const tecnici = tecIds.length ? await sb(
            env,
            "utenti",
            "GET",
            null,
            `?id=in.(${tecIds.join(",")})&select=id,nome,cognome,base,telegram_chat_id`
          ).catch(() => []) : [];
          const tecMap = Object.fromEntries(tecnici.map((t) => [t.id, t]));
          const candidates = disponibili.map((d) => {
            const t = tecMap[d.tecnico_id] || {};
            return { tecnicoId: d.tecnico_id, nome: `${t.nome || ""} ${t.cognome || ""}`.trim(), base: t.base, chatId: t.telegram_chat_id, pianoId: d.id };
          }).filter((c) => c.nome);
          if (candidates.length) {
            smartSuggestion = { tecnici_disponibili: candidates, urgenza_id: id };
            const sugTxt = candidates.map((c) => `\u2022 ${c.nome}${c.base ? " (da " + c.base + ")" : ""}`).join("\n");
            const configRes2 = await sb(env, "config", "GET", null, "?chiave=eq.telegram_group_generale").catch(() => []);
            const groupId = configRes2?.[0]?.valore;
            if (groupId) {
              await sendTelegram(
                env,
                groupId,
                `\u{1F4A1} <b>SMART DISPATCH</b>
Urgenza ${id}: ${(row.problema || "").substring(0, 60)}

Tecnici con slot VARIE oggi:
${sugTxt}

Usa <code>/assegna ${id} [tecnico]</code> per assegnare`
              );
            }
          }
        }
      } catch (e) {
        console.error("Smart dispatch error:", e.message);
      }
      const cliNomeUrg = await getEntityName(env, "clienti", row.cliente_id).catch(() => "");
      emailAdmins(
        env,
        `\u{1F6A8} Nuova Urgenza ${id}`,
        `<h3 style="color:#DC2626">\u{1F6A8} Nuova Urgenza</h3>
        <p><strong>ID:</strong> ${id}</p>
        <p><strong>Cliente:</strong> ${cliNomeUrg}</p>
        <p><strong>Problema:</strong> ${(row.problema || "").substring(0, 200)}</p>
        <p><strong>SLA:</strong> ${slaScadenza ? slaScadenza.substring(0, 16).replace("T", " ") : "N/D"}</p>
        ${smartSuggestion ? "<p><strong>\u{1F4A1} Tecnici disponibili oggi:</strong> " + smartSuggestion.tecnici_disponibili.map((t) => t.nome).join(", ") + "</p>" : ""}
        <p style="margin-top:16px"><a href="${brand(env).adminUrl}" style="background:${brand(env).color};color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Vai alla Dashboard</a></p>`
      ).catch((e) => console.error("[SYNC]", e.message));
      return ok({ urgenza: pascalizeRecord(result[0]), smartDispatch: smartSuggestion });
    }
    case "assignUrgenza": {
      const { id, operatoreId, userId } = body;
      const tecId = body.tecnicoAssegnato || body.tecnico_assegnato || body.TecnicoID;
      const tecIds = body.tecniciIds || body.tecnici_ids || body.TecniciIDs;
      const autoId = body.automezzoId || body.automezzo_id || body.AutomezzoID || null;
      const dataPrev = body.dataPrevista || body.data_prevista || null;
      const oraPrev = body.oraPrevista || body.ora_prevista || null;
      const patch = {
        tecnico_assegnato: tecId,
        tecnici_ids: tecIds,
        automezzo_id: autoId,
        stato: "assegnata",
        data_assegnazione: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (dataPrev) patch.data_prevista = dataPrev;
      if (oraPrev) patch.ora_prevista = oraPrev;
      await sb(env, `urgenze?id=eq.${id}`, "PATCH", patch);
      await wlog("urgenza", id, "assigned", operatoreId || userId, `a ${tecId}`);
      await sendTelegramNotification(env, "urgenza_assegnata", { id, tecnicoAssegnato: tecId });
      if (tecId) {
        const urgDet = await sb(env, "urgenze", "GET", null, `?id=eq.${id}&select=problema,cliente_id`).catch(() => []);
        const prob = urgDet?.[0]?.problema || "";
        const cliId = urgDet?.[0]?.cliente_id || "";
        const cliName = cliId ? await getEntityName(env, "clienti", cliId).catch(() => "") : "";
        await sb(env, "notifiche", "POST", {
          id: secureId("NOT_ASS"),
          tipo: "urgenza",
          oggetto: "\u{1F6A8} Urgenza assegnata a te",
          testo: `Urgenza ${id}: ${prob.substring(0, 80)}${cliName ? " \xB7 " + cliName : ""}`,
          destinatario_id: tecId,
          stato: "inviata",
          priorita: "alta",
          riferimento_id: id,
          riferimento_tipo: "urgenza",
          tenant_id: env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045"
        }).catch((e) => console.error("[SYNC]", e.message));
        await notifyTecnicoTG(env, tecId, `\u{1F6A8} <b>URGENZA ASSEGNATA A TE</b>
\u{1F4CB} ${prob.substring(0, 100)}
\u{1F3E2} ${cliName || "\u2014"}
\u{1F4C5} ${dataPrev || "ASAP"} ${oraPrev || ""}

<i>Apri l'app per iniziare</i>`);
      }
      return ok();
    }
    case "rejectUrgenza": {
      const { id } = body;
      if (!id) return err("id urgenza richiesto");
      const motivo = body.motivo || body.note || "Nessun motivo specificato";
      const userId = body.operatoreId || body.userId;
      const urgCheck = await sb(env, "urgenze", "GET", null, `?id=eq.${id}&select=stato,tecnico_assegnato,problema,cliente_id`).catch(() => []);
      if (!urgCheck?.[0]) return err("Urgenza non trovata");
      if (urgCheck[0].stato !== "assegnata" && urgCheck[0].stato !== "schedulata") return err("Solo urgenze assegnate/schedulate possono essere rifiutate");
      await sb(env, `urgenze?id=eq.${id}`, "PATCH", {
        stato: "aperta",
        tecnico_assegnato: null,
        tecnici_ids: null,
        automezzo_id: null,
        note: `[RIFIUTATA da ${userId}] ${motivo}
${urgCheck[0].note || ""}`.trim(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      await wlog("urgenza", id, "rejected", userId, motivo);
      const admins = await sb(env, "utenti", "GET", null, "?ruolo=eq.admin&attivo=eq.true&select=id,nome,cognome").catch(() => []);
      const tecName = userId ? await getEntityName(env, "utenti", userId).catch(() => userId) : userId;
      for (const a of admins || []) {
        await sb(env, "notifiche", "POST", {
          id: secureId("NOT_REJ"),
          tipo: "urgenza",
          oggetto: "\u26A0\uFE0F Urgenza RIFIUTATA",
          testo: `${tecName} ha rifiutato urgenza ${id}: ${motivo}`,
          destinatario_id: a.id,
          stato: "inviata",
          priorita: "alta",
          riferimento_id: id,
          riferimento_tipo: "urgenza",
          tenant_id: env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045"
        }).catch((e) => console.error("[SYNC]", e.message));
      }
      try {
        const msgId = secureId("MSG_URG_REJ");
        await sb(env, "chat_messaggi", "POST", {
          id: msgId,
          canale_id: "CH_URGENZE",
          mittente_id: userId || "SYSTEM",
          testo: `\u26A0\uFE0F Urgenza ${id} RIFIUTATA da ${tecName}
\u{1F4DD} Motivo: ${motivo}`,
          tipo: "testo",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (e) {
      }
      await emailAdmins(
        env,
        `\u26A0\uFE0F Urgenza ${id} rifiutata`,
        `<h3>\u26A0\uFE0F Urgenza Rifiutata</h3><p><strong>${tecName}</strong> ha rifiutato l'urgenza <strong>${id}</strong></p><p><strong>Motivo:</strong> ${motivo}</p><p><strong>Problema:</strong> ${urgCheck[0].problema || "\u2014"}</p><p style="color:#DC2626"><strong>Azione richiesta:</strong> Riassegnare l'urgenza a un altro tecnico</p>`
      ).catch((e) => console.error("[EMAIL]", e.message));
      return ok();
    }
    case "startUrgenza": {
      const { id } = body;
      if (!id) return err("id urgenza richiesto");
      await sb(env, `urgenze?id=eq.${id}`, "PATCH", {
        stato: "in_corso",
        data_inizio: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      await wlog("urgenza", id, "started", body.operatoreId || body.userId);
      const urg = await sb(env, "urgenze", "GET", null, `?id=eq.${id}&select=intervento_id`).catch(() => []);
      if (urg?.[0]?.intervento_id) {
        await sb(env, `piano?id=eq.${urg[0].intervento_id}`, "PATCH", { stato: "in_corso", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).catch((e) => console.error("[SYNC]", e.message));
      }
      try {
        const msgId = secureId("MSG_URG_START");
        await sb(env, "chat_messaggi", "POST", {
          id: msgId,
          canale_id: "CH_URGENZE",
          mittente_id: body.operatoreId || body.userId || "SYSTEM",
          testo: `\u26A1 Urgenza ${id} INIZIATA`,
          tipo: "testo",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (e) {
      }
      return ok();
    }
    case "resolveUrgenza": {
      const { id } = body;
      if (!id) return err("id urgenza richiesto");
      const urgCurrent = await sb(env, "urgenze", "GET", null, `?id=eq.${id}&select=stato`).catch(() => []);
      if (!urgCurrent?.[0]) return err("Urgenza non trovata", 404);
      const stateErr = validateTransition(VALID_URGENZA_TRANSITIONS, urgCurrent[0].stato, "risolta", "urgenza");
      if (stateErr) return err(stateErr);
      const noteRisoluzione = body.noteRisoluzione || body.note_risoluzione || body.note || "";
      await sb(env, `urgenze?id=eq.${id}`, "PATCH", {
        stato: "risolta",
        data_risoluzione: (/* @__PURE__ */ new Date()).toISOString(),
        note: noteRisoluzione ? noteRisoluzione : void 0,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      await wlog("urgenza", id, "resolved", body.operatoreId || body.userId);
      const urg2 = await sb(env, "urgenze", "GET", null, `?id=eq.${id}&select=intervento_id,tecnico_assegnato`).catch(() => []);
      if (urg2?.[0]?.intervento_id) {
        await sb(env, `piano?id=eq.${urg2[0].intervento_id}`, "PATCH", { stato: "completato", data_fine: (/* @__PURE__ */ new Date()).toISOString(), updated_at: (/* @__PURE__ */ new Date()).toISOString() }).catch((e) => console.error("[SYNC]", e.message));
      }
      try {
        const msgId = secureId("MSG_URG_RESOL");
        await sb(env, "chat_messaggi", "POST", {
          id: msgId,
          canale_id: "CH_URGENZE",
          mittente_id: body.operatoreId || body.userId || "SYSTEM",
          testo: `\u2705 Urgenza ${id} RISOLTA` + (noteRisoluzione ? `
\u{1F4DD} ${noteRisoluzione}` : ""),
          tipo: "testo",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (e) {
      }
      try {
        const admins = await sb(env, "utenti", "GET", null, "?ruolo=eq.admin&attivo=eq.true&select=id&limit=3").catch(() => []);
        for (const a of admins || []) {
          await sb(env, "notifiche", "POST", {
            id: secureId("NOT"),
            tipo: "urgenza",
            oggetto: "\u2705 Urgenza risolta",
            testo: `Urgenza ${id} \xE8 stata risolta dal tecnico`,
            destinatario_id: a.id,
            stato: "inviata",
            priorita: "normale",
            riferimento_id: id,
            riferimento_tipo: "urgenza",
            tenant_id: env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045"
          }).catch((e) => console.error("[SYNC]", e.message));
        }
      } catch (e) {
      }
      return ok();
    }
    case "updateUrgenza": {
      const id = body.id;
      if (!id) return err("id urgenza richiesto");
      const allFields = getFields(body);
      const urgWritable = ["cliente_id", "macchina_id", "problema", "priorita_id", "stato", "tecnico_assegnato", "tecnici_ids", "automezzo_id", "data_prevista", "ora_prevista", "data_inizio", "data_risoluzione", "intervento_id", "note", "allegati_ids", "sla_scadenza", "sla_status", "obsoleto"];
      const updates = {};
      for (const k of urgWritable) {
        if (allFields[k] !== void 0) updates[k] = allFields[k];
      }
      if (updates.stato) {
        const current = await sb(env, "urgenze", "GET", null, `?id=eq.${id}&select=stato`).catch(() => []);
        if (current?.[0]?.stato) {
          const transErr = validateTransition(VALID_URGENZA_TRANSITIONS, current[0].stato, updates.stato, "urgenza");
          if (transErr) return err(transErr);
        }
      }
      updates.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      await sb(env, `urgenze?id=eq.${id}`, "PATCH", updates);
      await wlog("urgenza", id, "updated", body.operatoreId || body.userId);
      return ok();
    }
    // -------- ORDINI --------
    case "createOrdine": {
      const id = secureId("ORD");
      const fields = getFields(body);
      const qty = fields.quantita || fields.qty;
      if (qty !== void 0 && qty !== null && (isNaN(qty) || Number(qty) <= 0)) {
        return err("Quantit\xE0 non valida: deve essere un numero maggiore di 0");
      }
      const row = {
        id,
        tenant_id: fields.tenant_id || env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045",
        cliente_id: fields.cliente_id || null,
        codice: fields.codice || null,
        descrizione: fields.descrizione || fields.note || fields.codice || "Ordine ricambio",
        stato: fields.stato || "richiesto",
        quantita: qty ? Number(qty) : null,
        data_ordine: fields.data_ordine || null,
        data_richiesta: (/* @__PURE__ */ new Date()).toISOString(),
        note: fields.note || null,
        tecnico_id: fields.tecnico_id || null
      };
      const result = await sb(env, "ordini", "POST", row);
      await wlog("ordine", id, "created", body.operatoreId || body.userId);
      return ok({ ordine: pascalizeRecord(result[0]) });
    }
    case "updateOrdineStato": {
      const { id, stato, operatoreId, userId: _u2 } = body;
      const datePatch = {};
      if (stato === "preso_in_carico") datePatch.data_presa_carico = (/* @__PURE__ */ new Date()).toISOString();
      if (stato === "ordinato") datePatch.data_ordine = (/* @__PURE__ */ new Date()).toISOString();
      if (stato === "arrivato") datePatch.data_arrivo = (/* @__PURE__ */ new Date()).toISOString();
      const ordPatch = { stato, ...datePatch, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
      if (body.note !== void 0) ordPatch.note = body.note;
      if (body.fornitore !== void 0) ordPatch.fornitore = body.fornitore;
      if (body.numero_ordine !== void 0) ordPatch.numero_ordine = body.numero_ordine;
      await sb(env, `ordini?id=eq.${id}`, "PATCH", ordPatch);
      await wlog("ordine", id, `stato_${stato}`, operatoreId);
      try {
        const ord = await sb(env, "ordini", "GET", null, `?id=eq.${id}&select=tecnico_id,codice,descrizione`).catch(() => []);
        if (ord?.[0]?.tecnico_id) {
          const labels = { preso_in_carico: "\u{1F44B} Preso in carico", ordinato: "\u{1F4E6} Ordinato al fornitore", in_arrivo: "\u{1F69A} In arrivo", arrivato: "\u2705 Arrivato in magazzino" };
          await sb(env, "notifiche", "POST", {
            id: secureId("NOT_ORD"),
            tipo: "ordine",
            oggetto: labels[stato] || `Ordine ${stato}`,
            testo: `Il tuo ordine ${ord[0].codice || id} (${(ord[0].descrizione || "").substring(0, 50)}) \xE8 stato aggiornato: ${labels[stato] || stato}`,
            destinatario_id: ord[0].tecnico_id,
            stato: "inviata",
            priorita: "normale",
            riferimento_id: id,
            riferimento_tipo: "ordine",
            tenant_id: env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045"
          }).catch((e) => console.error("[SYNC]", e.message));
        }
      } catch (e) {
      }
      return ok();
    }
    case "updateOrdine": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { id, userId: _u, operatoreId: _op, tenant_id: _t, action: _a, ...updates } = body;
      if (!id) return err("ID ordine mancante");
      if (updates.quantita !== void 0) {
        const qty = Number(updates.quantita);
        if (isNaN(qty) || qty <= 0) return err("Quantit\xE0 non valida");
        updates.quantita = qty;
      }
      updates.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      await sb(env, `ordini?id=eq.${id}`, "PATCH", updates);
      await wlog("ordine", id, "updated", body.operatoreId || body.userId);
      return ok();
    }
    case "deleteOrdine": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = body.id || body.ID;
      if (!id) return err("ID ordine mancante");
      await sb(env, `ordini?id=eq.${id}`, "PATCH", { obsoleto: true, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      await wlog("ordine", id, "deleted", body.operatoreId || body.userId);
      return ok({ deleted: true });
    }
    // -------- UTENTI --------
    case "createUtente": {
      const callerId = body.operatoreId || body.userId;
      if (callerId) {
        const caller = await sb(env, "utenti", "GET", null, `?id=eq.${callerId}&select=ruolo`).catch(() => []);
        if (caller?.[0] && caller[0].ruolo !== "admin") return err("Solo admin pu\xF2 creare utenti", 403);
      }
      const pwd = body.password;
      if (!pwd || pwd.length < 8) return err("Password richiesta (min 8 caratteri)");
      const id = secureId("TEC");
      const hashed = await hashPassword(pwd);
      const row = { id, ...getFields(body), password_hash: hashed, created_at: (/* @__PURE__ */ new Date()).toISOString(), updated_at: (/* @__PURE__ */ new Date()).toISOString() };
      delete row.password;
      const _livello = row.livello;
      delete row.livello;
      const result = await sb(env, "utenti", "POST", row);
      if (_livello) {
        const lvRows = await sb(env, "config", "GET", null, `?chiave=eq.utenti_livello&limit=1`).catch(() => []);
        const lvMap = lvRows?.[0]?.valore ? JSON.parse(lvRows[0].valore) : {};
        lvMap[id] = _livello;
        const lvVal = JSON.stringify(lvMap);
        try {
          await sb(env, "config", "POST", { chiave: "utenti_livello", valore: lvVal, tenant_id: TENANT }, "");
        } catch {
          await sb(env, `config?chiave=eq.utenti_livello`, "PATCH", { valore: lvVal }, "").catch(() => {
          });
        }
      }
      if (row.automezzo_id) {
        await sb(env, `automezzi?id=eq.${row.automezzo_id}`, "PATCH", { assegnatario_id: id }).catch(() => {
        });
      }
      await wlog("utente", id, "created", body.operatoreId);
      const { password_hash, ...safe } = result[0];
      return ok({ utente: safe });
    }
    case "updateUtente": {
      const { id, password, userId: _u3, operatoreId: _op3, tenant_id: _t, ...updates } = body;
      const callerId3 = body.operatoreId || body.userId;
      if (callerId3 && callerId3 !== id) {
        const adminErr3 = await requireAdmin(env, body);
        if (adminErr3) return err("Solo admin pu\xF2 modificare altri utenti", 403);
      }
      if (password) updates.password_hash = await hashPassword(password);
      updates.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      for (const k of Object.keys(updates)) {
        if (updates[k] === null && (k.endsWith("_id") || k === "squadra_id" || k === "automezzo_id")) delete updates[k];
      }
      const newAutoId = updates.automezzo_id;
      if (newAutoId) {
        const oldUserArr = await sb(env, "utenti", "GET", null, `?id=eq.${id}&select=automezzo_id`).catch(() => []);
        const oldAutoId = oldUserArr?.[0]?.automezzo_id;
        if (oldAutoId && oldAutoId !== newAutoId) {
          await sb(env, `automezzi?id=eq.${oldAutoId}`, "PATCH", { assegnatario_id: null }).catch(() => {
          });
        }
        await sb(env, `automezzi?id=eq.${newAutoId}`, "PATCH", { assegnatario_id: id }).catch(() => {
        });
        const otherUsers = await sb(env, "utenti", "GET", null, `?automezzo_id=eq.${newAutoId}&id=neq.${id}&select=id`);
        for (const ou of otherUsers || []) {
          await sb(env, `utenti?id=eq.${ou.id}`, "PATCH", { automezzo_id: null, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).catch(() => {
          });
        }
      }
      const _livello2 = updates.livello;
      delete updates.livello;
      await sb(env, `utenti?id=eq.${id}`, "PATCH", updates);
      if (_livello2 !== void 0) {
        const lvRows2 = await sb(env, "config", "GET", null, `?chiave=eq.utenti_livello&limit=1`).catch(() => []);
        const lvMap2 = lvRows2?.[0]?.valore ? JSON.parse(lvRows2[0].valore) : {};
        if (_livello2) lvMap2[id] = _livello2;
        else delete lvMap2[id];
        const lvVal2 = JSON.stringify(lvMap2);
        try {
          await sb(env, "config", "POST", { chiave: "utenti_livello", valore: lvVal2, tenant_id: TENANT }, "");
        } catch {
          await sb(env, `config?chiave=eq.utenti_livello`, "PATCH", { valore: lvVal2 }, "").catch(() => {
          });
        }
      }
      await wlog("utente", id, "updated", body.operatoreId);
      return ok({ synced: !!newAutoId });
    }
    // -------- CLIENTI --------
    case "createCliente": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = secureId("CLI");
      const row = { id, ...getFields(body), created_at: (/* @__PURE__ */ new Date()).toISOString(), updated_at: (/* @__PURE__ */ new Date()).toISOString() };
      const result = await sb(env, "clienti", "POST", row);
      await wlog("cliente", id, "created", body.operatoreId);
      return ok({ cliente: pascalizeRecord(result[0]) });
    }
    case "updateCliente": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { id, userId: _u, operatoreId: _op, tenant_id: _t, ...updates } = body;
      updates.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      for (const k of Object.keys(updates)) {
        if (updates[k] === null && k.endsWith("_id")) delete updates[k];
      }
      await sb(env, `clienti?id=eq.${id}`, "PATCH", updates);
      await wlog("cliente", id, "updated", body.operatoreId);
      return ok();
    }
    case "deleteCliente": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = body.id || body.ID;
      if (!id) return err("ID cliente mancante");
      await sb(env, `clienti?id=eq.${id}`, "PATCH", { obsoleto: true, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      await wlog("cliente", id, "deleted", body.operatoreId || body.userId);
      return ok({ deleted: true });
    }
    // -------- MACCHINE --------
    case "createMacchina": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = secureId("MAC");
      const result = await sb(env, "macchine", "POST", { id, ...getFields(body), created_at: (/* @__PURE__ */ new Date()).toISOString() });
      await wlog("macchina", id, "created", body.operatoreId);
      return ok({ macchina: pascalizeRecord(result[0]) });
    }
    case "updateMacchina": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { id, userId: _u, operatoreId: _op, tenant_id: _t, ...updates } = body;
      for (const k of Object.keys(updates)) {
        if (updates[k] === null && k.endsWith("_id")) delete updates[k];
      }
      await sb(env, `macchine?id=eq.${id}`, "PATCH", updates);
      await wlog("macchina", id, "updated", body.operatoreId);
      return ok();
    }
    case "deleteMacchina": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = body.id || body.ID;
      if (!id) return err("ID macchina mancante");
      await sb(env, `macchine?id=eq.${id}`, "PATCH", { obsoleto: true });
      await wlog("macchina", id, "deleted", body.operatoreId || body.userId);
      return ok({ deleted: true });
    }
    // -------- AUTOMEZZI --------
    case "createAutomezzo": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = secureId("AUT");
      const fields = getFields(body);
      const result = await sb(env, "automezzi", "POST", { id, ...fields });
      if (fields.assegnatario_id) {
        await sb(env, `utenti?id=eq.${fields.assegnatario_id}`, "PATCH", { automezzo_id: id, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).catch(() => {
        });
      }
      await wlog("automezzo", id, "created", body.operatoreId);
      return ok({ automezzo: pascalizeRecord(result[0]) });
    }
    case "updateAutomezzo": {
      const adminErr2 = await requireAdmin(env, body);
      if (adminErr2) return err(adminErr2, 403);
      const { id, userId: _u, operatoreId: _op, tenant_id: _t, ...updates } = body;
      for (const k of Object.keys(updates)) {
        if (updates[k] === null && k.endsWith("_id")) delete updates[k];
      }
      const newAssId = updates.assegnatario_id;
      if (newAssId) {
        const oldAutoArr = await sb(env, "automezzi", "GET", null, `?id=eq.${id}&select=assegnatario_id`).catch(() => []);
        const oldAssId = oldAutoArr?.[0]?.assegnatario_id;
        if (oldAssId && oldAssId !== newAssId) {
          await sb(env, `utenti?id=eq.${oldAssId}`, "PATCH", { automezzo_id: null, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).catch(() => {
          });
        }
        await sb(env, `utenti?id=eq.${newAssId}`, "PATCH", { automezzo_id: id, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).catch(() => {
        });
        const otherUsers = await sb(env, "utenti", "GET", null, `?automezzo_id=eq.${id}&id=neq.${newAssId}&select=id`);
        for (const ou of otherUsers || []) {
          await sb(env, `utenti?id=eq.${ou.id}`, "PATCH", { automezzo_id: null, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).catch(() => {
          });
        }
      }
      await sb(env, `automezzi?id=eq.${id}`, "PATCH", updates);
      await wlog("automezzo", id, "updated", body.operatoreId);
      return ok({ synced: !!newAssId });
    }
    case "deleteAutomezzo": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = body.id || body.ID;
      if (!id) return err("ID automezzo mancante");
      const autoArr = await sb(env, "automezzi", "GET", null, `?id=eq.${id}&select=assegnatario_id`).catch(() => []);
      if (autoArr?.[0]?.assegnatario_id) {
        await sb(env, `utenti?id=eq.${autoArr[0].assegnatario_id}`, "PATCH", { automezzo_id: null, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).catch(() => {
        });
      }
      await sb(env, `automezzi?id=eq.${id}`, "PATCH", { obsoleto: true, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      await wlog("automezzo", id, "deleted", body.operatoreId || body.userId);
      return ok({ deleted: true });
    }
    case "deleteUtente": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = body.id || body.ID;
      if (!id) return err("ID utente mancante");
      await sb(env, `automezzi?assegnatario_id=eq.${id}`, "PATCH", { assegnatario_id: null, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).catch(() => {
      });
      await sb(env, `utenti?id=eq.${id}`, "PATCH", { obsoleto: true, attivo: false, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      await wlog("utenti", id, "deleted", body.operatoreId || body.userId);
      return ok({ deleted: true });
    }
    // -------- INSTALLAZIONI --------
    case "createInstallazione": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = secureId("INS");
      const fields = getFields(body);
      const row = {
        id,
        tenant_id: fields.tenant_id || env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045",
        cliente_id: fields.cliente_id || null,
        macchina_id: fields.macchina_id || null,
        stato: "pianificata",
        data_inizio: fields.data_inizio || fields.data_prevista || null,
        note: fields.note || null,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const result = await sb(env, "installazioni", "POST", row);
      await wlog("installazione", id, "created", body.operatoreId);
      return ok({ installazione: pascalizeRecord(result[0]) });
    }
    case "updateInstallazione": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { id, userId: _u, operatoreId: _op, ...updates } = body;
      updates.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      await sb(env, `installazioni?id=eq.${id}`, "PATCH", updates);
      await wlog("installazione", id, "updated", body.operatoreId);
      return ok();
    }
    case "deleteInstallazione": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = body.id || body.ID;
      if (!id) return err("ID installazione mancante");
      await sb(env, `installazioni?id=eq.${id}`, "PATCH", { obsoleto: true, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      await wlog("installazione", id, "deleted", body.operatoreId || body.userId);
      return ok({ deleted: true });
    }
    // -------- REPERIBILITA --------
    case "createReperibilita": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = secureId("REP");
      const fields_rep = getFields(body);
      delete fields_rep.created_at;
      delete fields_rep.updated_at;
      const result = await sb(env, "reperibilita", "POST", { id, ...fields_rep });
      await wlog("reperibilita", id, "created", body.operatoreId);
      return ok({ reperibilita: pascalizeRecord(result[0]) });
    }
    case "updateReperibilita": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = body.id || body.ID;
      if (!id) return err("ID reperibilita mancante");
      const fields = getFields(body);
      delete fields.id;
      delete fields.created_at;
      delete fields.updated_at;
      const result = await sb(env, "reperibilita", "PATCH", fields, `?id=eq.${id}&select=*`);
      await wlog("reperibilita", id, "updated", body.operatoreId);
      return ok({ reperibilita: pascalizeRecord(result[0]) });
    }
    case "deleteReperibilita": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = body.id || body.ID;
      if (!id) return err("ID reperibilita mancante");
      await sb(env, "reperibilita", "PATCH", { obsoleto: true }, `?id=eq.${id}`);
      await wlog("reperibilita", id, "deleted", body.operatoreId);
      return ok({ deleted: true });
    }
    // -------- TRASFERTE --------
    case "createTrasferta": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = secureId("TRA");
      const fields = getFields(body);
      const row = {
        id,
        tenant_id: fields.tenant_id || env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045",
        cliente_id: fields.cliente_id || null,
        tecnico_id: fields.tecnico_id || fields.tecnici_ids?.[0] || null,
        automezzo_id: fields.automezzo_id || null,
        motivo: fields.motivo || fields.note || "",
        stato: fields.stato || "pianificata",
        data_inizio: fields.data_inizio || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        data_fine: fields.data_fine || null,
        note: fields.note || null,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const result = await sb(env, "trasferte", "POST", row);
      await wlog("trasferta", id, "created", body.operatoreId);
      return ok({ trasferta: pascalizeRecord(result[0]) });
    }
    case "updateTrasferta": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = body.id || body.ID;
      if (!id) return err("ID trasferta mancante");
      const fields = getFields(body);
      delete fields.id;
      delete fields.created_at;
      const result = await sb(env, "trasferte", "PATCH", fields, `?id=eq.${id}&select=*`);
      await wlog("trasferta", id, "updated", body.operatoreId);
      return ok({ trasferta: pascalizeRecord(result[0]) });
    }
    case "deleteTrasferta": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = body.id || body.ID;
      if (!id) return err("ID trasferta mancante");
      await sb(env, "trasferte", "PATCH", { obsoleto: true }, `?id=eq.${id}`);
      await wlog("trasferta", id, "deleted", body.operatoreId);
      return ok({ deleted: true });
    }
    // -------- NOTIFICHE --------
    case "createNotifica": {
      const id = secureId("NOT");
      const fields = getFields(body);
      const testo = fields.messaggio || fields.testo || fields.contenuto || "";
      const oggetto = fields.oggetto || fields.titolo || null;
      const priorita = fields.priorita || "normale";
      const row = { id, tenant_id: fields.tenant_id || env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045", tipo: fields.tipo || "info", oggetto, testo, priorita, stato: fields.stato || "inviata", mittente_id: fields.mittente_id || null, destinatario_id: fields.destinatario_id || null, destinatari_ids: fields.destinatari_ids || null, riferimento_id: fields.riferimento_id || null, riferimento_tipo: fields.riferimento_tipo || null, data_invio: (/* @__PURE__ */ new Date()).toISOString() };
      const result = await sb(env, "notifiche", "POST", row);
      return ok({ notifica: result?.[0] ? pascalizeRecord(result[0]) : { id } });
    }
    case "markNotifica": {
      const { id } = body;
      await sb(env, `notifiche?id=eq.${id}`, "PATCH", { stato: "letta", data_lettura: (/* @__PURE__ */ new Date()).toISOString() });
      return ok();
    }
    case "markAllRead": {
      const { userId } = body;
      await sb(
        env,
        `notifiche?destinatario_id=eq.${userId}&stato=eq.inviata`,
        "PATCH",
        { stato: "letta", data_lettura: (/* @__PURE__ */ new Date()).toISOString() }
      );
      return ok();
    }
    case "deleteNotifica": {
      const { id } = body;
      if (!id) return err("id notifica richiesto");
      await sb(env, `notifiche?id=eq.${id}`, "PATCH", { obsoleto: true });
      return ok();
    }
    case "deleteAllNotifiche": {
      const { userId } = body;
      if (!userId) return err("userId richiesto");
      await sb(
        env,
        `notifiche?destinatario_id=eq.${userId}&stato=eq.letta`,
        "PATCH",
        { obsoleto: true, updated_at: (/* @__PURE__ */ new Date()).toISOString() }
      );
      return ok();
    }
    // -------- RICHIESTE --------
    case "createRichiesta": {
      const id = secureId("RIC");
      const fields = getFields(body);
      const row = {
        id,
        tenant_id: fields.tenant_id || env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045",
        tipo: fields.tipo || "generico",
        stato: "in_attesa",
        motivo: fields.motivo || fields.testo || fields.messaggio || fields.descrizione || "",
        tecnico_id: fields.tecnico_id || null,
        data_inizio: fields.data_inizio || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        data_fine: fields.data_fine || fields.data_inizio || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        data_richiesta: (/* @__PURE__ */ new Date()).toISOString()
      };
      const result = await sb(env, "richieste", "POST", row);
      const tecnico = fields.tecnico_id ? (await sb(env, "utenti", "GET", null, `?id=eq.${fields.tecnico_id}&select=nome,cognome`).catch(() => []))[0] : null;
      const tecNome = tecnico ? `${tecnico.nome} ${tecnico.cognome}` : "Tecnico";
      const tipoLabel = { ferie: "Ferie", permesso: "Permesso", malattia: "Malattia", cambio_turno: "Cambio Turno", generico: "Generico" }[row.tipo] || row.tipo;
      try {
        const admins = await sb(env, "utenti", "GET", null, `?ruolo=eq.admin&obsoleto=eq.false&select=id`).catch(() => []);
        for (const adm of admins) {
          const notId = secureId("NOT");
          await sb(env, "notifiche", "POST", {
            id: notId,
            tenant_id: row.tenant_id,
            tipo: "richiesta_nuova",
            oggetto: `\u{1F4DD} Nuova richiesta ${tipoLabel} \u2014 ${tecNome}`,
            testo: `${tecNome} ha richiesto ${tipoLabel} dal ${row.data_inizio} al ${row.data_fine}. Motivo: ${row.motivo || "\u2014"}`,
            destinatario_id: adm.id,
            priorita: "media",
            data_invio: (/* @__PURE__ */ new Date()).toISOString()
          }).catch(() => {
          });
        }
        await sendTelegramNotification(env, "richiesta_nuova", { id, tecnico: tecNome, tipo: tipoLabel, data_inizio: row.data_inizio, data_fine: row.data_fine, motivo: row.motivo });
      } catch (e) {
        console.error("[createRichiesta] notifica errore:", e.message);
      }
      return ok({ richiesta: pascalizeRecord(result[0]) });
    }
    case "updateRichiesta": {
      const { id, userId: _u, operatoreId: _op, action: _a, ...updates } = body;
      if (updates.stato && updates.stato !== "in_attesa") updates.data_risposta = (/* @__PURE__ */ new Date()).toISOString();
      delete updates.updated_at;
      delete updates.created_at;
      delete updates.tenant_id;
      await sb(env, `richieste?id=eq.${id}`, "PATCH", updates);
      if (updates.stato && updates.stato !== "in_attesa") {
        try {
          const ric = (await sb(env, "richieste", "GET", null, `?id=eq.${id}&select=tecnico_id,tipo,data_inizio,data_fine`).catch(() => []))[0];
          if (ric?.tecnico_id) {
            const esito = updates.stato === "approvata" ? "\u2705 Approvata" : "\u274C Rifiutata";
            const tipoLabel = { ferie: "Ferie", permesso: "Permesso", malattia: "Malattia", cambio_turno: "Cambio Turno", generico: "Generico" }[ric.tipo] || ric.tipo;
            const notId = secureId("NOT");
            await sb(env, "notifiche", "POST", {
              id: notId,
              tenant_id: env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045",
              tipo: "richiesta_risposta",
              oggetto: `${esito}: ${tipoLabel} dal ${ric.data_inizio || "?"} al ${ric.data_fine || "?"}`,
              testo: `La tua richiesta di ${tipoLabel} \xE8 stata ${updates.stato}. ${updates.note_admin ? "Note: " + updates.note_admin : ""}`,
              destinatario_id: ric.tecnico_id,
              priorita: "alta",
              data_invio: (/* @__PURE__ */ new Date()).toISOString()
            }).catch(() => {
            });
          }
        } catch (e) {
          console.error("[updateRichiesta] notifica errore:", e.message);
        }
      }
      await sendTelegramNotification(env, "richiesta_risposta", { id, stato: updates.stato });
      return ok();
    }
    // -------- PAGELLINI --------
    case "createPagellino": {
      const id = secureId("PAG");
      const result = await sb(env, "pagellini", "POST", { id, ...getFields(body), stato: "bozza", data_creazione: (/* @__PURE__ */ new Date()).toISOString() });
      return ok({ pagellino: pascalizeRecord(result[0]) });
    }
    case "approvaPagellino": {
      const { id } = body;
      await sb(env, `pagellini?id=eq.${id}`, "PATCH", { stato: "approvato", data_approvazione: (/* @__PURE__ */ new Date()).toISOString() });
      return ok();
    }
    // -------- CHECKLIST --------
    case "createChecklistTemplate": {
      const id = secureId("CHK");
      const result = await sb(env, "checklist_template", "POST", { id, ...getFields(body), created_at: (/* @__PURE__ */ new Date()).toISOString() });
      return ok({ template: result[0] });
    }
    case "updateChecklistTemplate": {
      const { id, userId: _u, operatoreId: _op, ...updates } = body;
      await sb(env, `checklist_template?id=eq.${id}`, "PATCH", updates);
      return ok();
    }
    case "deleteChecklistTemplate": {
      const { id } = body;
      await sb(env, `checklist_template?id=eq.${id}`, "PATCH", { attivo: false });
      return ok();
    }
    case "compileChecklist": {
      const id = secureId("CKC");
      const result = await sb(env, "checklist_compilata", "POST", { id, ...getFields(body), data_compilazione: (/* @__PURE__ */ new Date()).toISOString() });
      if (body.intervento_id) {
        await sb(env, `piano?id=eq.${body.intervento_id}`, "PATCH", { checklist_id: id });
      }
      return ok({ checklist: pascalizeRecord(result[0]) });
    }
    // -------- DOCUMENTI & ALLEGATI --------
    case "createDocumento": {
      const id = secureId("DOC");
      const result = await sb(env, "documenti", "POST", { id, ...getFields(body), data_caricamento: (/* @__PURE__ */ new Date()).toISOString() });
      return ok({ documento: pascalizeRecord(result[0]) });
    }
    case "updateDocumento": {
      const { id, userId: _u, operatoreId: _op, tenant_id: _t, action: _a, ...updates } = body;
      if (!id) return err("ID documento mancante");
      await sb(env, `documenti?id=eq.${id}`, "PATCH", updates);
      return ok();
    }
    case "deleteDocumento": {
      const { id } = body;
      await sb(env, `documenti?id=eq.${id}`, "PATCH", { obsoleto: true });
      return ok();
    }
    case "createAllegato": {
      const id = secureId("ALL");
      const result = await sb(env, "allegati", "POST", { id, ...getFields(body), data_upload: (/* @__PURE__ */ new Date()).toISOString() });
      return ok({ allegato: pascalizeRecord(result[0]) });
    }
    case "deleteAllegato": {
      const { id } = body;
      await sb(env, `allegati?id=eq.${id}`, "PATCH", { obsoleto: true });
      return ok();
    }
    case "uploadFile": {
      const fileName = body.file_name || body.fileName || "file";
      const base64Data = body.base64_data || body.base64Data;
      const mimeType = body.mime_type || body.mimeType || "application/octet-stream";
      const riferimentoTipo = body.riferimento_tipo || body.riferimentoTipo || "generico";
      const riferimentoId = body.riferimento_id || body.riferimentoId || "na";
      const uploaderId = body.uploader_id || body.uploaderId || null;
      if (!base64Data) return err("base64Data richiesto");
      const bucket = "syntoniqa-allegati";
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${riferimentoTipo}/${riferimentoId}/${Date.now()}_${safeName}`;
      const fileData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const uploadRes = await fetch(
        `${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            "Content-Type": mimeType
          },
          body: fileData
        }
      );
      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => "");
        throw new Error("Upload storage fallito: " + uploadRes.status + " " + errText);
      }
      const fileUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
      const id = secureId("ALL");
      await sb(env, "allegati", "POST", {
        id,
        nome: fileName,
        file_url: fileUrl,
        mime_type: mimeType,
        uploader_id: uploaderId,
        riferimento_tipo: riferimentoTipo,
        riferimento_id: riferimentoId,
        data_upload: (/* @__PURE__ */ new Date()).toISOString()
      }).catch(() => {
      });
      return ok({ url: fileUrl, id, nome: fileName });
    }
    case "uploadFotoProfilo": {
      const { userId, base64Data, mimeType } = body;
      const bucket = "syntoniqa-profili";
      const path = `profili/${userId}.jpg`;
      const fileData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`, "Content-Type": mimeType },
        body: fileData
      });
      const url = `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
      await sb(env, `utenti?id=eq.${userId}`, "PATCH", { foto_url: url });
      return ok({ url });
    }
    // -------- NOTIFICHE ESTERNE --------
    case "sendEmail": {
      const { to, subject, html, text } = body;
      if (!env.RESEND_API_KEY) return err("Email non configurata");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: brand(env).emailFrom, to, subject, html, text })
      });
      const result = await res.json();
      return ok({ result });
    }
    case "testEmail": {
      const toAddr = body.email || body.destinatario || body.to;
      if (!toAddr) return err("Campo email/destinatario mancante");
      return handlePost("sendEmail", { to: toAddr, subject: "Test Syntoniqa", html: "<h1>\u2705 Test Email Syntoniqa \u2014 OK</h1><p>Connessione email funzionante.</p>" }, env);
    }
    case "sendTelegramMsg": {
      const { chatId, text } = body;
      const res = await sendTelegram(env, chatId, text);
      return ok({ result: res });
    }
    case "testTelegram": {
      const chatId = body.chat_id || body.chatId;
      if (!chatId) return err("Chat ID mancante");
      const msg = body.message || body.messaggio || "\u{1F916} Syntoniqa v2.0 \u2013 Telegram OK!";
      let token = env.TELEGRAM_BOT_TOKEN || "";
      if (!token) {
        try {
          const cfgRows = await sb(env, "config", "GET", null, "?chiave=eq.telegram_bot_token&select=valore");
          if (cfgRows && cfgRows[0]) token = cfgRows[0].valore || "";
        } catch (e) {
        }
      }
      if (!token) return ok({ sent: false, reason: "Bot token non configurato" });
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" })
        });
        const tgJson = await tgRes.json();
        return ok({ sent: !!tgJson.ok, reason: tgJson.ok ? "" : tgJson.description || "Errore Telegram" });
      } catch (e) {
        return ok({ sent: false, reason: e.message });
      }
    }
    // -------- PUSH NOTIFICATIONS (FIX F-30) --------
    case "getVapidPublicKey": {
      if (!env.VAPID_PUBLIC_KEY) return err("VAPID non configurato");
      return ok({ vapidPublicKey: env.VAPID_PUBLIC_KEY });
    }
    case "savePushSubscription": {
      const userId = body.userId || body.operatoreId;
      const sub = body.subscription || body;
      if (!sub.endpoint) return err("Subscription endpoint richiesto");
      const keys = sub.keys || {};
      const id = secureId("PUSH");
      await sb(env, `push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&endpoint=eq.${encodeURIComponent(sub.endpoint)}`, "DELETE");
      await sb(env, "push_subscriptions", "POST", {
        id,
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: keys.p256dh || "",
        auth: keys.auth || "",
        user_agent: body.userAgent || "",
        active: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      await wlog("push", id, "subscription_saved", userId);
      return ok({ id });
    }
    case "removePushSubscription": {
      const userId = body.userId || body.operatoreId;
      const endpoint = body.endpoint;
      if (endpoint) {
        await sb(env, `push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&endpoint=eq.${encodeURIComponent(endpoint)}`, "DELETE");
      } else {
        await sb(env, `push_subscriptions?user_id=eq.${encodeURIComponent(userId)}`, "PATCH", { active: false, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      }
      return ok();
    }
    case "sendPush": {
      const { targetUserIds, title, body: pushBody, url, tag, actions } = body;
      if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return err("VAPID keys non configurate");
      if (!targetUserIds || !targetUserIds.length) return err("targetUserIds richiesti");
      const subs = await sb(
        env,
        "push_subscriptions",
        "GET",
        null,
        `?user_id=in.(${targetUserIds.map((id) => encodeURIComponent(id)).join(",")})&active=eq.true`
      );
      const payload = JSON.stringify({
        title: title || "Syntoniqa",
        body: pushBody || "",
        url: url || "./",
        tag: tag || "syntoniqa-" + Date.now(),
        actions: actions || []
      });
      let sent = 0, failed = 0;
      for (const sub of subs) {
        try {
          const res = await sendWebPush(env, {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          }, payload);
          if (res.ok) {
            sent++;
          } else if (res.status === 410 || res.status === 404) {
            await sb(env, `push_subscriptions?id=eq.${sub.id}`, "DELETE");
            failed++;
          } else {
            failed++;
          }
        } catch (e) {
          failed++;
        }
      }
      return ok({ sent, failed, total: subs.length });
    }
    // -------- INTELLIGENCE --------
    case "testAI": {
      const results = {};
      const testPrompt = 'Rispondi SOLO con questo JSON: {"test":"ok","engine":"nome"}';
      if (env.GEMINI_KEY) {
        try {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ parts: [{ text: testPrompt }] }], generationConfig: { maxOutputTokens: 100, temperature: 0 } })
            }
          );
          results.gemini = { status: r.status, ok: r.ok };
          if (r.ok) {
            const d = await r.json();
            results.gemini.response = d.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 100);
          } else {
            results.gemini.body = (await r.text().catch(() => "")).substring(0, 200);
          }
        } catch (e) {
          results.gemini = { error: e.message };
        }
      } else {
        results.gemini = { configured: false };
      }
      if (env.CEREBRAS_KEY) {
        try {
          const r = await fetch(
            "https://api.cerebras.ai/v1/chat/completions",
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.CEREBRAS_KEY}` },
              body: JSON.stringify({ model: "llama-3.3-70b", messages: [{ role: "user", content: testPrompt }], max_tokens: 100, temperature: 0 })
            }
          );
          results.cerebras = { status: r.status, ok: r.ok };
          if (r.ok) {
            const d = await r.json();
            results.cerebras.response = d.choices?.[0]?.message?.content?.substring(0, 100);
          } else {
            results.cerebras.body = (await r.text().catch(() => "")).substring(0, 200);
          }
        } catch (e) {
          results.cerebras = { error: e.message };
        }
      } else {
        results.cerebras = { configured: false };
      }
      if (env.GROQ_KEY) {
        try {
          const r = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.GROQ_KEY}` },
              body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: testPrompt }], max_tokens: 100, temperature: 0 })
            }
          );
          results.groq = { status: r.status, ok: r.ok };
          if (r.ok) {
            const d = await r.json();
            results.groq.response = d.choices?.[0]?.message?.content?.substring(0, 100);
          } else {
            results.groq.body = (await r.text().catch(() => "")).substring(0, 200);
          }
        } catch (e) {
          results.groq = { error: e.message };
        }
      } else {
        results.groq = { configured: false };
      }
      if (env.MISTRAL_KEY) {
        try {
          const r = await fetch(
            "https://api.mistral.ai/v1/chat/completions",
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.MISTRAL_KEY}` },
              body: JSON.stringify({ model: "mistral-small-latest", messages: [{ role: "user", content: testPrompt }], max_tokens: 100, temperature: 0 })
            }
          );
          results.mistral = { status: r.status, ok: r.ok };
          if (r.ok) {
            const d = await r.json();
            results.mistral.response = d.choices?.[0]?.message?.content?.substring(0, 100);
          } else {
            results.mistral.body = (await r.text().catch(() => "")).substring(0, 200);
          }
        } catch (e) {
          results.mistral = { error: e.message };
        }
      } else {
        results.mistral = { configured: false };
      }
      if (env.DEEPSEEK_KEY) {
        try {
          const r = await fetch(
            "https://api.deepseek.com/chat/completions",
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_KEY}` },
              body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: testPrompt }], max_tokens: 100, temperature: 0 })
            }
          );
          results.deepseek = { status: r.status, ok: r.ok };
          if (r.ok) {
            const d = await r.json();
            results.deepseek.response = d.choices?.[0]?.message?.content?.substring(0, 100);
          } else {
            results.deepseek.body = (await r.text().catch(() => "")).substring(0, 200);
          }
        } catch (e) {
          results.deepseek = { error: e.message };
        }
      } else {
        results.deepseek = { configured: false };
      }
      if (env.AI) {
        try {
          const aiP = env.AI.run(
            "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
            { messages: [{ role: "user", content: testPrompt }], max_tokens: 100 }
          );
          const tmout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 10s")), 1e4));
          const res = await Promise.race([aiP, tmout]);
          results.workersAI = { ok: true, response: res?.response?.substring(0, 100) };
        } catch (e) {
          results.workersAI = { error: e.message };
        }
      } else {
        results.workersAI = { configured: false };
      }
      return ok(results);
    }
    // ═══════════════════════════════════════════════════════════════════
    // DETERMINISTIC SCHEDULER — genera piano mensile senza AI
    // Algoritmo: constraint satisfaction + round-robin + clustering zone
    // ═══════════════════════════════════════════════════════════════════
    case "generatePlanSmart": {
      let getWorkDaysSmart = function(startDate, endDate) {
        const days = [];
        const d = new Date(startDate);
        while (d <= endDate) {
          if (d.getDay() >= 1 && d.getDay() <= 5) days.push(d.toISOString().split("T")[0]);
          d.setDate(d.getDate() + 1);
        }
        return days;
      }, getNextService = function(preferredCity) {
        if (preferredCity) {
          for (let i = backlogIdx; i < Math.min(backlogIdx + 20, serviceBacklog.length); i++) {
            if (serviceBacklog[i].citta && serviceBacklog[i].citta.toLowerCase().includes(preferredCity.toLowerCase())) {
              return serviceBacklog.splice(i, 1)[0];
            }
          }
        }
        if (backlogIdx < serviceBacklog.length) return serviceBacklog[backlogIdx++];
        if (clientPool.length) {
          const c = clientPool[clientPoolIdx % clientPool.length];
          clientPoolIdx++;
          return { tipo: "tagliando", macchina: "service", clienteId: c.clienteId, clienteNome: c.clienteNome, citta: c.citta };
        }
        return null;
      }, getFurgone = function(tec) {
        return tec.automezzo_id || "";
      };
      __name(getWorkDaysSmart, "getWorkDaysSmart");
      __name(getNextService, "getNextService");
      __name(getFurgone, "getFurgone");
      const vincoli = body.vincoli || {};
      const meseTarget = vincoli.mese_target || "";
      const modalita = vincoli.modalita || "mese";
      const settimanaNum = parseInt(vincoli.settimana || "1", 10);
      if (!meseTarget) return err("mese_target obbligatorio (formato YYYY-MM)");
      const [yy, mm] = meseTarget.split("-").map(Number);
      const repFilter = `&data_inizio=lte.${meseTarget}-31&data_fine=gte.${meseTarget}-01`;
      const [allTecnici, allUrgenze, allClienti, vincoliCfg, allRep, allAutomezzi, allMacchine, allAssets, pianoExist] = await Promise.all([
        sb(env, "utenti", "GET", null, "?attivo=eq.true&obsoleto=eq.false&select=id,nome,cognome,base,ruolo,automezzo_id").catch(() => []),
        sb(env, "urgenze", "GET", null, "?stato=in.(aperta,assegnata,schedulata)&order=priorita_id.asc&limit=20&select=id,problema,cliente_id,priorita_id,tecnico_id").catch(() => []),
        sb(env, "anagrafica_clienti", "GET", null, "?select=codice_m3,nome_account,nome_interno,citta_fatturazione&limit=200").catch(() => []),
        sb(env, "config", "GET", null, "?chiave=eq.vincoli_categories&limit=1").catch(() => []),
        sb(env, "reperibilita", "GET", null, `?obsoleto=eq.false${repFilter}&select=id,tecnico_id,data_inizio,data_fine,turno,tipo&order=data_inizio.asc&limit=100`).catch(() => []),
        sb(env, "automezzi", "GET", null, "?obsoleto=eq.false&select=id,targa,modello,stato&limit=20").catch(() => []),
        sb(env, "macchine", "GET", null, "?obsoleto=eq.false&prossimo_tagliando=not.is.null&select=id,seriale,note,modello,tipo,cliente_id,prossimo_tagliando&order=prossimo_tagliando.asc&limit=80").catch(() => []),
        sb(env, "anagrafica_assets", "GET", null, "?prossimo_controllo=not.is.null&select=id,nome_asset,modello,gruppo_attrezzatura,codice_m3,nome_account,prossimo_controllo&order=prossimo_controllo.asc&limit=80").catch(() => []),
        sb(env, "piano", "GET", null, `?data=gte.${meseTarget}-01&data=lte.${meseTarget}-31&stato=in.(pianificato,in_corso)&obsoleto=eq.false&select=id,data,tecnico_id,cliente_id&limit=500`).catch(() => [])
      ]);
      const vincoliRules = { assenti: /* @__PURE__ */ new Set(), affiancamenti: [], reperibilita: {}, custom: [] };
      if (vincoliCfg.length) {
        try {
          const vc = JSON.parse(vincoliCfg[0].valore);
          const oggiISO = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Rome" }).format(/* @__PURE__ */ new Date());
          for (const cat of (vc.categories || []).filter((c) => c.attiva !== false)) {
            for (const r of cat.regole || []) {
              if (!r.testo) continue;
              const attiva = r.permanente || !(r.data_fine && r.data_fine < oggiISO);
              if (!attiva) continue;
              const txt = (r.testo || "").toLowerCase();
              if (txt.match(/assent|non disponibil|ferie|malattia|indisponibil/)) {
                for (const id of r.soggetti || []) vincoliRules.assenti.add(id);
              }
              if (txt.match(/affianc|accompagn|coppia|deve lavorare con|junior.*senior/)) {
                vincoliRules.affiancamenti.push({ junior: r.soggetti || [], senior: r.riferimenti || [] });
              }
              vincoliRules.custom.push({ testo: r.testo, soggetti: r.soggetti || [], priorita: r.priorita });
            }
          }
        } catch {
        }
      }
      for (const rep of allRep) {
        const start = new Date(rep.data_inizio);
        const end = new Date(rep.data_fine);
        const d = new Date(start);
        while (d <= end) {
          const iso = d.toISOString().split("T")[0];
          if (!vincoliRules.reperibilita[iso]) vincoliRules.reperibilita[iso] = [];
          vincoliRules.reperibilita[iso].push({ tecnicoId: rep.tecnico_id, turno: rep.turno, tipo: rep.tipo });
          d.setDate(d.getDate() + 1);
        }
      }
      const tecnici = allTecnici.filter((t) => (t.ruolo || "").toLowerCase() !== "admin" && !vincoliRules.assenti.has(t.id));
      const pairRules = vincoliRules.affiancamenti.filter((a) => a.junior?.length && a.senior?.length);
      const clientMap = {};
      allClienti.forEach((c) => {
        clientMap[c.codice_m3] = c;
      });
      const pmCycleRows = await sb(env, "config", "GET", null, "?chiave=eq.pm_cycle_state&limit=1").catch(() => []);
      const pmCycleState = pmCycleRows?.[0]?.valore ? JSON.parse(pmCycleRows[0].valore) : {};
      const pmDefRows = await sb(env, "config", "GET", null, "?chiave=eq.pm_cycle_definitions&limit=1").catch(() => []);
      const pmDefs = pmDefRows?.[0]?.valore ? JSON.parse(pmDefRows[0].valore) : getDefaultCycleDefs();
      const serviceBacklog = [];
      const oggiDate = /* @__PURE__ */ new Date();
      for (const m of allMacchine) {
        if (!m.prossimo_tagliando) continue;
        const ggDiff = Math.round((new Date(m.prossimo_tagliando) - oggiDate) / 864e5);
        const cli = allClienti.find((c) => c.codice_m3 === m.cliente_id);
        const cycleInfo = pmCycleState[m.id] || {};
        const modKey = (m.modello || m.tipo || "").toUpperCase();
        const cycleDef = findCycleDef(pmDefs, modKey);
        const seq = cycleDef ? cycleDef.sequenza : ["A1", "B2", "A3", "C4", "A5", "B6", "A7", "D8"];
        const pos = cycleInfo.posizione || 0;
        const cicloTipo = seq[pos % seq.length] || "A1";
        serviceBacklog.push({
          tipo: "tagliando",
          macchina: m.modello || m.tipo || m.seriale || "?",
          macchinaId: m.id,
          clienteId: m.cliente_id,
          clienteNome: cli?.nome_interno || cli?.nome_account || m.cliente_id || "?",
          citta: cli?.citta_fatturazione || "",
          dataScadenza: m.prossimo_tagliando,
          giorniDiff: ggDiff,
          cicloTipo,
          priorita: ggDiff < 0 ? 0 : ggDiff <= 7 ? 1 : ggDiff <= 30 ? 2 : 3
        });
      }
      for (const a of allAssets) {
        if (!a.prossimo_controllo) continue;
        const ggDiff = Math.round((new Date(a.prossimo_controllo) - oggiDate) / 864e5);
        serviceBacklog.push({
          tipo: "controllo",
          macchina: a.modello || a.nome_asset || a.gruppo_attrezzatura || "?",
          macchinaId: a.id,
          clienteId: a.codice_m3,
          clienteNome: a.nome_account || a.codice_m3 || "?",
          citta: "",
          dataScadenza: a.prossimo_controllo,
          giorniDiff: ggDiff,
          priorita: ggDiff < 0 ? 0 : ggDiff <= 7 ? 1 : ggDiff <= 30 ? 2 : 3
        });
      }
      serviceBacklog.sort((a, b) => a.priorita - b.priorita || a.giorniDiff - b.giorniDiff);
      const clientPool = allClienti.filter((c) => c.codice_m3).map((c) => ({
        clienteId: c.codice_m3,
        clienteNome: c.nome_interno || c.nome_account || "?",
        citta: c.citta_fatturazione || ""
      }));
      const giorniNome = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
      let workDays = [];
      if (modalita === "settimana") {
        const startOffset = (settimanaNum - 1) * 7;
        const ws = new Date(yy, mm - 1, 1 + startOffset);
        const we = new Date(ws);
        we.setDate(we.getDate() + 6);
        const lastD = new Date(yy, mm, 0);
        if (we > lastD) we.setTime(lastD.getTime());
        workDays = getWorkDaysSmart(ws, we);
      } else {
        workDays = getWorkDaysSmart(new Date(yy, mm - 1, 1), new Date(yy, mm, 0));
      }
      if (modalita === "vuoti" && pianoExist.length) {
        const existingDays = new Set(pianoExist.map((p) => p.data));
        workDays = workDays.filter((d) => !existingDays.has(d));
      }
      if (!workDays.length) return ok({ summary: "Nessun giorno lavorativo nel periodo", piano: [], warnings: [] });
      const piano = [];
      const warnings = [];
      let backlogIdx = 0;
      let clientPoolIdx = 0;
      const seniorRotation = {};
      const tecAssignments = {};
      for (const day of workDays) {
        tecAssignments[day] = /* @__PURE__ */ new Set();
        const repToday = vincoliRules.reperibilita[day] || [];
        const onCallIds = new Set(repToday.map((r) => r.tecnicoId));
        const dayIdx = workDays.indexOf(day);
        if (dayIdx < 3 && allUrgenze.length) {
          const urgPerDay = Math.ceil(allUrgenze.length / 3);
          const urgSlice = allUrgenze.slice(dayIdx * urgPerDay, (dayIdx + 1) * urgPerDay);
          for (const urg of urgSlice) {
            let tecId = urg.tecnico_id;
            if (!tecId || vincoliRules.assenti.has(tecId)) {
              const available = tecnici.find((t) => !tecAssignments[day].has(t.id) && !onCallIds.has(t.id));
              if (available) tecId = available.id;
            }
            if (tecId) {
              const tec = tecnici.find((t) => t.id === tecId);
              if (tec) {
                const cli = allClienti.find((c) => c.codice_m3 === urg.cliente_id);
                piano.push({
                  data: day,
                  tecnico: `${tec.nome} ${tec.cognome}`,
                  tecnicoId: tec.id,
                  cliente: cli?.nome_interno || cli?.nome_account || urg.cliente_id || "?",
                  clienteId: urg.cliente_id || "",
                  tipo: "urgenza",
                  oraInizio: "08:00",
                  durataOre: 2,
                  furgone: getFurgone(tec),
                  note: `URG: ${(urg.problema || "").substring(0, 50)}`
                });
                tecAssignments[day].add(tec.id);
              }
            }
          }
        }
        for (const pair of pairRules) {
          for (const jId of pair.junior) {
            if (tecAssignments[day].has(jId) || onCallIds.has(jId)) continue;
            const junior = tecnici.find((t) => t.id === jId);
            if (!junior) continue;
            let partner = null;
            for (const sId of pair.senior) {
              if (!tecAssignments[day].has(sId) && !onCallIds.has(sId)) {
                partner = tecnici.find((t) => t.id === sId);
                if (partner) break;
              }
            }
            if (!partner) {
              partner = tecnici.find((t) => t.id !== jId && !tecAssignments[day].has(t.id) && !onCallIds.has(t.id) && pair.senior.includes(t.id));
            }
            if (partner) {
              const service = getNextService(junior.base || partner.base);
              if (!service) continue;
              const svcNote = service.cicloTipo ? `[${service.cicloTipo}] ${service.macchina || ""}` : service.macchina || "";
              piano.push({
                data: day,
                tecnico: `${partner.nome} ${partner.cognome}`,
                tecnicoId: partner.id,
                cliente: service.clienteNome,
                clienteId: service.clienteId,
                tipo: service.tipo || "tagliando",
                oraInizio: "08:00",
                durataOre: 6,
                furgone: getFurgone(partner),
                note: svcNote,
                macchina_id: service.macchinaId || null
              });
              piano.push({
                data: day,
                tecnico: `${junior.nome} ${junior.cognome}`,
                tecnicoId: junior.id,
                cliente: service.clienteNome,
                clienteId: service.clienteId,
                tipo: service.tipo || "tagliando",
                oraInizio: "08:00",
                durataOre: 6,
                furgone: getFurgone(partner),
                note: `Affiancamento con ${partner.nome} \u2014 ${svcNote}`,
                macchina_id: service.macchinaId || null
              });
              tecAssignments[day].add(partner.id);
              tecAssignments[day].add(junior.id);
            }
          }
        }
        for (const tec of tecnici) {
          if (tecAssignments[day].has(tec.id)) continue;
          if (onCallIds.has(tec.id)) continue;
          const service = getNextService(tec.base);
          if (!service) continue;
          const svcNote2 = service.cicloTipo ? `[${service.cicloTipo}] ${service.macchina || ""}` : service.macchina || "";
          piano.push({
            data: day,
            tecnico: `${tec.nome} ${tec.cognome}`,
            tecnicoId: tec.id,
            cliente: service.clienteNome,
            clienteId: service.clienteId,
            tipo: service.tipo || "tagliando",
            oraInizio: "08:00",
            durataOre: 7,
            furgone: getFurgone(tec),
            note: svcNote2,
            macchina_id: service.macchinaId || null
          });
          tecAssignments[day].add(tec.id);
        }
        for (const rep of repToday) {
          const tec = tecnici.find((t) => t.id === rep.tecnicoId);
          if (tec && !tecAssignments[day].has(tec.id)) {
            piano.push({
              data: day,
              tecnico: `${tec.nome} ${tec.cognome}`,
              tecnicoId: tec.id,
              cliente: "REPERIBILITA",
              clienteId: "",
              tipo: "reperibilita",
              oraInizio: rep.turno === "18-08" ? "18:00" : "00:00",
              durataOre: rep.turno === "24h" ? 24 : 14,
              furgone: getFurgone(tec),
              note: `${rep.tipo || "REP"} ${rep.turno || "24h"}`
            });
          }
        }
      }
      const giorni = [...new Set(piano.map((p) => p.data))].sort();
      const nTec = [...new Set(piano.map((p) => p.tecnicoId))].length;
      const nUrg = piano.filter((p) => p.tipo === "urgenza").length;
      const nTag = piano.filter((p) => p.tipo === "tagliando" || p.tipo === "controllo").length;
      const nRep = piano.filter((p) => p.tipo === "reperibilita").length;
      if (vincoliRules.assenti.size) {
        warnings.push(`Tecnici esclusi (assenti): ${[...vincoliRules.assenti].join(", ")}`);
      }
      const ruoliDettaglio = tecnici.map((t) => `${t.nome}=${t.ruolo || "?"}`).join(", ");
      warnings.push(`Team: ${tecnici.length} tecnici attivi [${ruoliDettaglio}] | Coppie vincoli: ${pairRules.length}`);
      return ok({
        summary: `Piano ${meseTarget}: ${piano.length} interventi su ${giorni.length} giorni, ${nTec} tecnici \u2014 ${nUrg} urgenze, ${nTag} tagliandi, ${nRep} reperibilit\xE0`,
        piano,
        warnings,
        engine: "deterministic",
        stats: { giorni: giorni.length, tecnici: nTec, urgenze: nUrg, tagliandi: nTag, reperibilita: nRep }
      });
    }
    case "previewAIPlan": {
      const pvMese = body.mese_target || "";
      if (!pvMese) return err("mese_target richiesto");
      const pvStart = `${pvMese}-01`, pvEnd = `${pvMese}-31`;
      const tid = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
      const [pvTecnici, pvRichieste, pvRep, pvTrasf, pvInst, pvPiano, pvUrg, pvMacchine, pvClienti, pvVincoliCfg] = await Promise.all([
        sb(env, "utenti", "GET", null, "?attivo=eq.true&obsoleto=eq.false&select=id,nome,cognome,base,ruolo,automezzo_id").catch(() => []),
        sb(env, "richieste", "GET", null, `?stato=eq.approvata&obsoleto=eq.false&data_inizio=lte.${pvEnd}&data_fine=gte.${pvStart}&select=id,tecnico_id,tipo,data_inizio,data_fine,motivo&limit=100`).catch(() => []),
        sb(env, "reperibilita", "GET", null, `?obsoleto=eq.false&data_inizio=lte.${pvEnd}&data_fine=gte.${pvStart}&select=id,tecnico_id,data_inizio,data_fine,turno,tipo&limit=100`).catch(() => []),
        sb(env, "trasferte", "GET", null, `?obsoleto=eq.false&data_inizio=lte.${pvEnd}&data_fine=gte.${pvStart}&select=id,tecnico_id,tecnici_ids,cliente_id,data_inizio,data_fine&limit=50`).catch(() => []),
        sb(env, "installazioni", "GET", null, `?obsoleto=eq.false&stato=in.(pianificato,in_corso,pianificata)&data_inizio=lte.${pvEnd}&select=id,tecnici_ids,cliente_id,data_inizio,data_fine_prevista,stato&limit=50`).catch(() => []),
        sb(env, "piano", "GET", null, `?obsoleto=eq.false&stato=neq.annullato&data=gte.${pvStart}&data=lte.${pvEnd}&select=id,tecnico_id,data,stato,cliente_id,tipo_intervento_id&limit=500`).catch(() => []),
        sb(env, "urgenze", "GET", null, "?stato=in.(aperta,assegnata,schedulata)&select=id,problema,cliente_id,priorita_id&limit=20").catch(() => []),
        sb(env, "macchine", "GET", null, "?obsoleto=eq.false&prossimo_tagliando=not.is.null&select=id,tipo,modello,cliente_id,prossimo_tagliando&order=prossimo_tagliando.asc&limit=50").catch(() => []),
        sb(env, "anagrafica_clienti", "GET", null, "?select=codice_m3,nome_account,nome_interno,citta_fatturazione&limit=150").catch(() => []),
        sb(env, "config", "GET", null, "?chiave=eq.vincoli_categories&limit=1").catch(() => [])
      ]);
      const pvGetName = /* @__PURE__ */ __name((id) => {
        const u = pvTecnici.find((t) => t.id === id);
        return u ? `${u.nome} ${u.cognome}` : id;
      }, "pvGetName");
      const vincAuto = [];
      for (const r of pvRichieste) {
        vincAuto.push({ tipo: "assenza", testo: `${pvGetName(r.tecnico_id)}: ${r.tipo} dal ${r.data_inizio} al ${r.data_fine || r.data_inizio}${r.motivo ? " (" + r.motivo + ")" : ""}`, soggetti: [pvGetName(r.tecnico_id)], soggetti_ids: [r.tecnico_id], periodo: `${r.data_inizio} \u2192 ${r.data_fine || r.data_inizio}`, data_inizio: r.data_inizio, data_fine: r.data_fine || r.data_inizio, id: "rich_" + r.id, fonte_tabella: "richieste", fonte_record_id: r.id });
      }
      for (const r of pvRep) {
        vincAuto.push({ tipo: "reperibilita", testo: `${pvGetName(r.tecnico_id)}: Reperibilit\xE0 ${r.turno || "24h"} (${r.tipo || "rep"})`, soggetti: [pvGetName(r.tecnico_id)], soggetti_ids: [r.tecnico_id], periodo: `${r.data_inizio} \u2192 ${r.data_fine}`, id: "rep_" + r.id, fonte_tabella: "reperibilita", fonte_record_id: r.id });
      }
      for (const t of pvTrasf) {
        const ids = (t.tecnici_ids || t.tecnico_id || "").split(",").filter(Boolean);
        ids.forEach((id) => {
          vincAuto.push({ tipo: "trasferta", testo: `${pvGetName(id)}: Trasferta dal ${t.data_inizio} al ${t.data_fine || t.data_inizio}`, soggetti: [pvGetName(id)], soggetti_ids: [id], periodo: `${t.data_inizio} \u2192 ${t.data_fine || t.data_inizio}`, id: "trasf_" + t.id + "_" + id, fonte_tabella: "trasferte", fonte_record_id: t.id });
        });
      }
      for (const inst of pvInst) {
        const ids = (inst.tecnici_ids || "").split(",").filter(Boolean);
        ids.forEach((id) => {
          vincAuto.push({ tipo: "installazione", testo: `${pvGetName(id)}: Installazione dal ${inst.data_inizio} al ${inst.data_fine_prevista || inst.data_inizio}`, soggetti: [pvGetName(id)], soggetti_ids: [id], periodo: `${inst.data_inizio} \u2192 ${inst.data_fine_prevista || inst.data_inizio}`, id: "inst_" + inst.id + "_" + id, fonte_tabella: "installazioni", fonte_record_id: inst.id });
        });
      }
      let manualRules = [];
      if (pvVincoliCfg.length) {
        try {
          const vc = JSON.parse(pvVincoliCfg[0].valore);
          manualRules = vc.manual_rules || [];
          if (!manualRules.length && vc.categories?.length) {
            vc.categories.forEach((cat) => (cat.regole || []).forEach((r) => {
              if (r.testo) manualRules.push({ ...r, titolo: (cat.icona || "") + " " + (cat.nome || "") });
            }));
          }
        } catch {
        }
      }
      const tecVincolati = /* @__PURE__ */ new Set();
      vincAuto.forEach((v) => (v.soggetti_ids || []).forEach((id) => tecVincolati.add(id)));
      const totTec = pvTecnici.filter((u) => u.ruolo !== "admin").length;
      const pvOggi = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Rome" }).format(/* @__PURE__ */ new Date());
      const taglScad = pvMacchine.filter((m) => m.prossimo_tagliando && m.prossimo_tagliando <= pvEnd).length;
      return json({
        success: true,
        mese: pvMese,
        vincoli_auto: vincAuto,
        regole_manuali: manualRules,
        summary: {
          tecnici_totali: totTec,
          tecnici_disponibili: totTec - tecVincolati.size,
          tecnici_vincolati: tecVincolati.size,
          vincoli_auto: vincAuto.length,
          regole_manuali: manualRules.length,
          piano_esistente: pvPiano.length,
          urgenze_aperte: pvUrg.length,
          tagliandi_scadenza: taglScad
        }
      });
    }
    case "generateAIPlan": {
      let anonEncode = function(text) {
        if (!text) return text;
        let result = text;
        const sorted = Object.entries(anonMap.encode).sort((a, b) => b[0].length - a[0].length);
        for (const [name, code] of sorted) {
          if (name.length < 3) continue;
          result = result.split(name).join(code);
        }
        return result;
      }, anonDecode = function(text) {
        if (!text) return text;
        let result = text;
        const sorted = Object.entries(anonMap.decode).sort((a, b) => b[0].length - a[0].length);
        for (const [code, name] of sorted) {
          result = result.split(code).join(name);
        }
        return result;
      }, getWorkDays = function(startDate, endDate) {
        const days = [];
        const d = new Date(startDate);
        while (d <= endDate) {
          const dow = d.getDay();
          const iso = d.toISOString().split("T")[0];
          if (dow >= 1 && dow <= 5) days.push(iso + "(" + giorniNome[dow] + ")");
          d.setDate(d.getDate() + 1);
        }
        return days;
      }, buildCompactPrompt = function() {
        const cTec = allTecnici.filter((t) => t.ruolo !== "admin").map((t) => {
          const f = t.automezzo_id ? allAutomezzi.find((a) => a.id === t.automezzo_id) : null;
          const baseCode = t.base ? cittaMap[t.base] || t.base : "?";
          return `${t.id}(${t.ruolo},zona:${baseCode},furgone:${f ? f.id : t.automezzo_id || "?"})`;
        }).join("; ");
        const cUrg = ctx.urgenze ? allUrgenze.slice(0, 8).map((u) => `${u.id}:${anonEncode((u.problema || "").substring(0, 25))}|${u.cliente_id}`).join("; ") : "";
        const cCli = allClienti.slice(0, 40).map((c) => `${c.codice_m3}(${cittaMap[c.citta_fatturazione] || "?"})`).join(", ");
        return `PIANO FSM ${meseTarget || ""}
##### VINCOLI (INVIOLABILI) #####
${vincoliText || "(Nessuno)"}
${testo ? "UTENTE: " + testo : ""}
#####
TECNICI: ${cTec}
${cUrg ? "URGENZE: " + cUrg : ""}
CLIENTI: ${cCli}
${tagliandiContext ? tagliandiContext.substring(0, 500) : ""}

${periodoIstruzione || "Genera piano mese intero"}
- SOLO lun-ven. Sab/Dom: solo reperibilita urgenze, no tagliandi.
- TUTTI i tecnici attivi: almeno 1 intervento AL GIORNO.
- Tagliando=4-8h (anche giornata intera). Urgenza=1-3h.
- Affiancamento junior+senior = DUE righe: stesso cliente/data/ora/furgone.
- Tecnici assenti da vincoli: NON inserirli.
- note = modello macchina (es: Astronaut A5, Vector 70).
- Usa furgone indicato nel tecnico.
- Usa SOLO codici dalla lista. NON inventare nomi.

JSON: {"summary":"...","piano":[{"data":"YYYY-MM-DD","tecnicoId":"TEC_xxx","clienteId":"codice_m3","tipo":"tagliando|urgenza","oraInizio":"HH:MM","durataOre":N,"furgone":"FURG_x","note":"codice macchina"}],"warnings":[]}`;
      }, parseAIResponse = function(rawText) {
        if (!rawText) return null;
        let clean = rawText.replace(/```json\n?|\n?```/g, "").trim();
        const js = clean.indexOf("{"), je = clean.lastIndexOf("}");
        if (js >= 0 && je > js) {
          try {
            return JSON.parse(clean.substring(js, je + 1));
          } catch {
          }
        }
        if (js >= 0) {
          let attempt = clean.substring(js);
          const lastBrace = attempt.lastIndexOf("}");
          if (lastBrace > 0) attempt = attempt.substring(0, lastBrace + 1);
          let ob = 0, cb = 0, os = 0, cs = 0;
          for (const c of attempt) {
            if (c === "{") ob++;
            if (c === "}") cb++;
            if (c === "[") os++;
            if (c === "]") cs++;
          }
          const lastComma = attempt.lastIndexOf(",");
          if (ob > cb && lastComma > 0) attempt = attempt.substring(0, lastComma);
          for (let i = 0; i < os - cs; i++) attempt += "]";
          for (let i = 0; i < ob - cb; i++) attempt += "}";
          try {
            const parsed = JSON.parse(attempt);
            if (!parsed.warnings) parsed.warnings = [];
            parsed.warnings.push("Piano parziale (risposta AI troncata) \u2014 riprova per risultato completo");
            return parsed;
          } catch {
          }
        }
        const pm = rawText.match(/"piano"\s*:\s*\[/);
        if (pm) {
          const start = pm.index + pm[0].length - 1;
          let arrStr = rawText.substring(start);
          const lastObj = arrStr.lastIndexOf("}");
          if (lastObj > 0) {
            arrStr = arrStr.substring(0, lastObj + 1) + "]";
            try {
              const piano = JSON.parse(arrStr);
              return { summary: "Piano parziale estratto", piano, warnings: ["Estratti " + piano.length + " interventi da risposta troncata"] };
            } catch {
            }
          }
        }
        return null;
      }, decodePiano = function(piano) {
        return (piano || []).map((p) => {
          if (p.tecnicoId) {
            const tec = allTecnici.find((t) => t.id === p.tecnicoId);
            if (tec) p.tecnico = `${tec.nome} ${tec.cognome}`.trim();
          }
          if (p.clienteId) {
            const cli = allClienti.find((c) => c.codice_m3 === p.clienteId);
            if (cli) p.cliente = cli.nome_interno || cli.nome_account || p.clienteId;
          }
          if (p.note) p.note = anonDecode(p.note);
          return p;
        });
      }, postProcess = function(piano) {
        return (piano || []).map((p) => {
          if (p.tecnicoId && !validIds.has(p.tecnicoId)) {
            const searchName = (p.tecnico || "").toLowerCase();
            const match = allTecnici.find(
              (t) => searchName.includes(t.nome.toLowerCase()) || t.cognome && searchName.includes(t.cognome.toLowerCase()) || `${t.nome} ${t.cognome}`.toLowerCase() === searchName
            );
            if (match) {
              p.tecnicoId = match.id;
              p.tecnico = match.nome + " " + match.cognome;
            }
          }
          if (p.tecnicoId) {
            const tec = allTecnici.find((t) => t.id === p.tecnicoId);
            if (tec && tec.automezzo_id) {
              p.furgone = tec.automezzo_id;
            } else if (tec) {
              p.furgone = "";
            }
          }
          return p;
        }).filter((p) => {
          if (!p.tecnicoId || !validIds.has(p.tecnicoId)) return false;
          if (vincoliRules.assenti.has(p.tecnicoId)) return false;
          try {
            const d = new Date(p.data);
            const dow = d.getDay();
            if ((dow === 0 || dow === 6) && p.tipo !== "urgenza") return false;
          } catch {
          }
          const pData = (p.data || "").substring(0, 10);
          if (!pData) return true;
          const conflictRich = allRichieste.find(
            (r) => r.tecnico_id === p.tecnicoId && r.data_inizio <= pData && (r.data_fine || r.data_inizio) >= pData
          );
          if (conflictRich) {
            const tName = p.tecnico || p.tecnicoId;
            postProcessWarnings.push(`${tName} in ${conflictRich.tipo} il ${pData} \u2014 rimosso`);
            return false;
          }
          const conflictTrasf = allTrasferte.find((t) => {
            const tecIds = (t.tecnici_ids || t.tecnico_id || "").split(",").filter(Boolean);
            return tecIds.includes(p.tecnicoId) && t.data_inizio <= pData && (t.data_fine || t.data_inizio) >= pData;
          });
          if (conflictTrasf) {
            const tName = p.tecnico || p.tecnicoId;
            postProcessWarnings.push(`${tName} in trasferta il ${pData} \u2014 rimosso`);
            return false;
          }
          const conflictInst = allInstallazioni.find((i) => {
            const tecIds = (i.tecnici_ids || "").split(",").filter(Boolean);
            return tecIds.includes(p.tecnicoId) && i.data_inizio <= pData && (i.data_fine_prevista || i.data_inizio) >= pData;
          });
          if (conflictInst) {
            const tName = p.tecnico || p.tecnicoId;
            postProcessWarnings.push(`${tName} in installazione il ${pData} \u2014 rimosso`);
            return false;
          }
          return true;
        });
      };
      __name(anonEncode, "anonEncode");
      __name(anonDecode, "anonDecode");
      __name(getWorkDays, "getWorkDays");
      __name(buildCompactPrompt, "buildCompactPrompt");
      __name(parseAIResponse, "parseAIResponse");
      __name(decodePiano, "decodePiano");
      __name(postProcess, "postProcess");
      if (!env.AI) return err('Workers AI non configurato. Aggiungi [ai] binding = "AI" in wrangler.toml e rideploya.');
      const vincoli = body.vincoli || {};
      const testo = vincoli.testo || "";
      const files = vincoli.files || [];
      const ctx = vincoli.ctx || { vincoli: true, reperibilita: true, piano: true, urgenze: true, tagliandi: true };
      const modalita = vincoli.modalita || "mese";
      const settimanaNum = parseInt(vincoli.settimana || "1", 10);
      const meseTarget = vincoli.mese_target || "";
      const repFilter = meseTarget ? `&data_inizio=lte.${meseTarget}-31&data_fine=gte.${meseTarget}-01` : "";
      const meseStart = meseTarget ? `${meseTarget}-01` : "";
      const meseEnd = meseTarget ? `${meseTarget}-31` : "";
      const [allTecnici, allUrgenze, allClienti, vincoliCfg, allRep, allAutomezzi, allMacchine, allAssets, allRichieste, allTrasferte, allInstallazioni, allPianoDb] = await Promise.all([
        sb(env, "utenti", "GET", null, "?attivo=eq.true&obsoleto=eq.false&select=id,nome,cognome,base,ruolo,automezzo_id").catch(() => []),
        sb(env, "urgenze", "GET", null, "?stato=in.(aperta,assegnata,schedulata)&order=data_segnalazione.desc&limit=20&select=id,problema,cliente_id,priorita_id").catch(() => []),
        sb(env, "anagrafica_clienti", "GET", null, "?select=codice_m3,nome_account,nome_interno,citta_fatturazione&limit=150").catch(() => []),
        sb(env, "config", "GET", null, "?chiave=eq.vincoli_categories&limit=1").catch(() => []),
        sb(env, "reperibilita", "GET", null, `?obsoleto=eq.false${repFilter}&select=id,tecnico_id,data_inizio,data_fine,turno,tipo&order=data_inizio.asc&limit=100`).catch(() => []),
        sb(env, "automezzi", "GET", null, "?obsoleto=eq.false&select=id,targa,modello,stato&limit=20").catch(() => []),
        sb(env, "macchine", "GET", null, "?obsoleto=eq.false&prossimo_tagliando=not.is.null&select=id,seriale,note,modello,tipo,cliente_id,prossimo_tagliando,ultimo_tagliando,ore_lavoro&order=prossimo_tagliando.asc&limit=50").catch(() => []),
        sb(env, "anagrafica_assets", "GET", null, "?prossimo_controllo=not.is.null&select=id,nome_asset,numero_serie,modello,gruppo_attrezzatura,codice_m3,nome_account,prossimo_controllo&order=prossimo_controllo.asc&limit=50").catch(() => []),
        // NUOVI: richieste approvate, trasferte, installazioni, piano da DB
        meseTarget ? sb(env, "richieste", "GET", null, `?stato=eq.approvata&obsoleto=eq.false&data_inizio=lte.${meseEnd}&data_fine=gte.${meseStart}&select=id,tecnico_id,tipo,data_inizio,data_fine,motivo&limit=100`).catch(() => []) : Promise.resolve([]),
        meseTarget ? sb(env, "trasferte", "GET", null, `?obsoleto=eq.false&data_inizio=lte.${meseEnd}&data_fine=gte.${meseStart}&select=id,tecnico_id,tecnici_ids,cliente_id,data_inizio,data_fine&limit=50`).catch(() => []) : Promise.resolve([]),
        meseTarget ? sb(env, "installazioni", "GET", null, `?obsoleto=eq.false&stato=in.(pianificato,in_corso,pianificata)&data_inizio=lte.${meseEnd}&select=id,tecnici_ids,cliente_id,data_inizio,data_fine_prevista,stato&limit=50`).catch(() => []) : Promise.resolve([]),
        meseTarget ? sb(env, "piano", "GET", null, `?obsoleto=eq.false&stato=neq.annullato&data=gte.${meseStart}&data=lte.${meseEnd}&select=id,tecnico_id,tecnici_ids,cliente_id,data,ora_inizio,tipo_intervento_id,note,stato&limit=500`).catch(() => []) : Promise.resolve([])
      ]);
      let vincoliText = "";
      if (ctx.vincoli && vincoliCfg.length) {
        try {
          const vc = JSON.parse(vincoliCfg[0].valore);
          const oggi2 = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Rome" }).format(/* @__PURE__ */ new Date());
          const getName = /* @__PURE__ */ __name((id) => {
            const u = allTecnici.find((t) => t.id === id);
            return u ? `${u.nome} ${u.cognome}` : id;
          }, "getName");
          const manualRules = vc.manual_rules || [];
          if (manualRules.length) {
            vincoliText += "\n=== REGOLE MANUALI (configurate dall'admin) ===\n";
            manualRules.filter((r) => {
              if (!r.testo) return false;
              if (r.permanente !== false) return true;
              if (r.data_fine && r.data_fine < oggi2) return false;
              if (r.data_inizio && r.data_inizio > oggi2) return false;
              return true;
            }).forEach((r) => {
              let line = `- ${r.testo}`;
              if (r.soggetti?.length) line += ` (Soggetti: ${r.soggetti.map(getName).join(", ")})`;
              if (!r.permanente && (r.data_inizio || r.data_fine)) line += ` (${r.data_inizio ? "Dal " + r.data_inizio : ""}${r.data_fine ? " Al " + r.data_fine : ""})`;
              line += r.tipo_regola === "vincolo" ? " [VINCOLO OBBLIGATORIO]" : r.tipo_regola === "preferenza" ? " [PREFERENZA]" : " [NOTA]";
              if (r.priorita === "alta") line += " \u26A0\uFE0FPRIORITA ALTA";
              vincoliText += line + "\n";
            });
          }
          const cats = (vc.categories || []).filter((c) => c.attiva !== false);
          if (cats.length && !manualRules.length) {
            cats.forEach((cat) => {
              const regole = (cat.regole || []).filter((r) => {
                if (!r.testo) return false;
                if (r.permanente) return true;
                if (r.data_fine && r.data_fine < oggi2) return false;
                return true;
              });
              if (!regole.length) return;
              vincoliText += `
[${cat.icona || ""} ${cat.nome}]
`;
              regole.forEach((r) => {
                let line = `- ${r.testo}`;
                if (r.soggetti?.length) line += ` (Soggetti: ${r.soggetti.map(getName).join(", ")})`;
                if (r.riferimenti?.length) line += ` (Con: ${r.riferimenti.map(getName).join(", ")})`;
                if (!r.permanente && (r.data_inizio || r.data_fine)) line += ` (${r.data_inizio ? "Dal " + r.data_inizio : ""}${r.data_fine ? " Al " + r.data_fine : ""})`;
                line += r.priorita === "alta" ? " [PRIORITA ALTA]" : "";
                vincoliText += line + "\n";
              });
            });
          }
        } catch {
        }
      }
      if (vincoli.vincoli_override) {
        vincoliText = vincoli.vincoli_override;
      }
      const anonMap = { encode: {}, decode: {} };
      for (const t of allTecnici) {
        const fullName = `${t.nome || ""} ${t.cognome || ""}`.trim();
        if (fullName && t.id) {
          anonMap.encode[fullName] = t.id;
          anonMap.decode[t.id] = fullName;
          if (t.nome) {
            anonMap.encode[t.nome] = t.id;
          }
          if (t.cognome) {
            anonMap.encode[t.cognome] = t.id;
          }
        }
      }
      for (const c of allClienti) {
        const names = [c.nome_interno, c.nome_account, c.ragione_sociale].filter(Boolean);
        for (const n of names) {
          if (n && c.codice_m3) {
            anonMap.encode[n] = c.codice_m3;
            anonMap.decode[c.codice_m3] = c.nome_interno || c.nome_account || c.codice_m3;
          }
        }
      }
      for (const m of allMacchine) {
        const label = m.modello || m.tipo || m.seriale || "";
        if (label && m.id) {
          anonMap.encode[label] = m.id;
          anonMap.decode[m.id] = label;
        }
      }
      const cittaSet = /* @__PURE__ */ new Set();
      for (const c of allClienti) {
        if (c.citta_fatturazione) cittaSet.add(c.citta_fatturazione);
      }
      for (const t of allTecnici) {
        if (t.base) cittaSet.add(t.base);
      }
      const cittaArr = [...cittaSet].sort();
      const cittaMap = {};
      cittaArr.forEach((city, i) => {
        const code = `Z${String(i + 1).padStart(2, "0")}`;
        cittaMap[city] = code;
        anonMap.encode[city] = code;
        anonMap.decode[code] = city;
      });
      let repContext = "";
      if (ctx.reperibilita && allRep.length) {
        repContext = "\nREPERIBILITA ATTIVE:\n" + allRep.map((r) => {
          return `- ${r.tecnico_id}: ${r.turno || "24h"} (${r.tipo || "rep"}) dal ${r.data_inizio} al ${r.data_fine}`;
        }).join("\n");
      }
      let pianoEsistente = "";
      if (ctx.piano) {
        const pianoSrc = allPianoDb.length ? allPianoDb : vincoli.piano_esistente || [];
        if (pianoSrc.length) {
          pianoEsistente = "\nPIANO GIA ESISTENTE (non duplicare, complementa):\n" + pianoSrc.slice(0, 40).map((p) => {
            const d = p.data || p.Data || "";
            const tec = p.tecnico_id || p.TecnicoID || "?";
            const cli = p.cliente_id || p.ClienteID || "?";
            return `- ${d} ${tec}: ${cli} (${anonEncode(p.note || p.Note || "")})`;
          }).join("\n");
        }
      }
      let indispContext = "";
      {
        const lines = [];
        for (const r of allRichieste) {
          lines.push(`- ${r.tecnico_id}: ${r.tipo} dal ${r.data_inizio} al ${r.data_fine || r.data_inizio} [NON SCHEDULARE]`);
        }
        for (const t of allTrasferte) {
          const tecIds = (t.tecnici_ids || t.tecnico_id || "").split(",").filter(Boolean);
          tecIds.forEach((id) => {
            lines.push(`- ${id}: TRASFERTA dal ${t.data_inizio} al ${t.data_fine || t.data_inizio} (${t.cliente_id || "?"}) [NON SCHEDULARE]`);
          });
        }
        for (const inst of allInstallazioni) {
          const tecIds = (inst.tecnici_ids || "").split(",").filter(Boolean);
          if (!tecIds.length) continue;
          tecIds.forEach((id) => {
            lines.push(`- ${id}: INSTALLAZIONE dal ${inst.data_inizio} al ${inst.data_fine_prevista || inst.data_inizio} (${inst.cliente_id || "?"}) [NON SCHEDULARE]`);
          });
        }
        if (lines.length) {
          indispContext = "\nTECNICI NON DISPONIBILI (NON schedulare in queste date):\n" + lines.join("\n");
        }
      }
      const autoList = allAutomezzi.map((a) => `${a.id}(${a.targa || ""},${a.stato || "attivo"})`).join("; ");
      let tagliandiContext = "";
      const oggi = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Rome" }).format(/* @__PURE__ */ new Date());
      const tagItems = [];
      if (ctx.tagliandi) {
        for (const m of allMacchine) {
          if (!m.prossimo_tagliando) continue;
          const cli = allClienti.find((c) => c.codice_m3 === m.cliente_id) || {};
          const ggDiff = Math.round((new Date(m.prossimo_tagliando) - new Date(oggi)) / 864e5);
          tagItems.push({
            tipo: "tagliando",
            macchina: m.id,
            macchinaLabel: `${m.modello || m.tipo || m.seriale || "?"}`,
            cliente: m.cliente_id || "?",
            clienteId: m.cliente_id || "",
            data: m.prossimo_tagliando,
            giorniScadenza: ggDiff,
            urgenza: ggDiff < 0 ? "SCADUTO" : ggDiff <= 7 ? "URGENTE" : ggDiff <= 30 ? "PROSSIMO" : "PROGRAMMATO",
            oreLavoro: m.ore_lavoro || null
          });
        }
        for (const a of allAssets) {
          if (!a.prossimo_controllo) continue;
          const ggDiff = Math.round((new Date(a.prossimo_controllo) - new Date(oggi)) / 864e5);
          tagItems.push({
            tipo: "controllo",
            macchina: a.id || `ASSET_${a.numero_serie || "?"}`,
            macchinaLabel: `${a.nome_asset || a.modello || a.gruppo_attrezzatura || "?"}`,
            cliente: a.codice_m3 || "?",
            clienteId: a.codice_m3 || "",
            data: a.prossimo_controllo,
            giorniScadenza: ggDiff,
            urgenza: ggDiff < 0 ? "SCADUTO" : ggDiff <= 7 ? "URGENTE" : ggDiff <= 30 ? "PROSSIMO" : "PROGRAMMATO"
          });
        }
        tagItems.sort((a, b) => a.giorniScadenza - b.giorniScadenza);
        if (tagItems.length) {
          const scaduti = tagItems.filter((t) => t.giorniScadenza < 0);
          const urgenti = tagItems.filter((t) => t.giorniScadenza >= 0 && t.giorniScadenza <= 7);
          const prossimi = tagItems.filter((t) => t.giorniScadenza > 7 && t.giorniScadenza <= 30);
          const programmati = tagItems.filter((t) => t.giorniScadenza > 30);
          const fmtItem = /* @__PURE__ */ __name((t) => `${t.tipo}|${t.macchina}@${t.clienteId}|${t.data}|${t.giorniScadenza}gg`, "fmtItem");
          tagliandiContext = "\nTAGLIANDI/SERVICE SCADENZA (pianifica PRIMA i piu urgenti):";
          if (scaduti.length) tagliandiContext += "\nSCADUTI:" + scaduti.slice(0, 10).map(fmtItem).join(";");
          if (urgenti.length) tagliandiContext += "\nURGENTI(<7gg):" + urgenti.slice(0, 8).map(fmtItem).join(";");
          if (prossimi.length) tagliandiContext += "\nPROSSIMI(<30gg):" + prossimi.slice(0, 6).map(fmtItem).join(";");
          if (programmati.length) tagliandiContext += "\nPROGRAMMATI:" + programmati.slice(0, 3).map(fmtItem).join(";");
        }
      }
      let periodoIstruzione = "";
      const giorniNome = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
      if (meseTarget) {
        const [yy, mm] = meseTarget.split("-").map(Number);
        if (modalita === "settimana") {
          const startOffset = (settimanaNum - 1) * 7;
          const weekStart = new Date(yy, mm - 1, 1 + startOffset);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          const lastOfMonth = new Date(yy, mm, 0);
          if (weekEnd > lastOfMonth) weekEnd.setTime(lastOfMonth.getTime());
          const wd = getWorkDays(weekStart, weekEnd);
          periodoIstruzione = `GENERA PIANO SOLO per questi ${wd.length} GIORNI LAVORATIVI: ${wd.join(", ")}. Genera interventi per OGNUNO di questi giorni.`;
        } else if (modalita === "vuoti") {
          periodoIstruzione = `GENERA PIANO SOLO per i giorni SENZA interventi nel piano esistente. Non duplicare giorni gia coperti.`;
        } else {
          const monthStart = new Date(yy, mm - 1, 1);
          const monthEnd = new Date(yy, mm, 0);
          const wd = getWorkDays(monthStart, monthEnd);
          periodoIstruzione = `GENERA PIANO per questi ${wd.length} GIORNI LAVORATIVI del mese: ${wd.join(", ")}. Sab/Dom solo reperibilita urgenze.`;
        }
      }
      let fileContext = "";
      for (const f of files) {
        const content = typeof f.content === "string" ? f.content : "";
        if (content.length > 10 && !content.match(/^[A-Za-z0-9+/=]{50,}$/)) {
          fileContext += `
[${f.name}]:
${content.substring(0, 4e3)}
`;
        }
      }
      const isoOggi = oggi;
      const oggiIt = new Intl.DateTimeFormat("it-IT", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Rome" }).format(/* @__PURE__ */ new Date());
      const tecList = allTecnici.filter((t) => t.ruolo !== "admin").map((t) => {
        const furg = t.automezzo_id ? allAutomezzi.find((a) => a.id === t.automezzo_id) : null;
        const furgLabel = furg ? furg.id : t.automezzo_id || "nessuno";
        const baseCode = t.base ? cittaMap[t.base] || t.base : "?";
        return `${t.id}(${t.ruolo},zona:${baseCode},furgone:${furgLabel})`;
      }).join("; ");
      const urgList = ctx.urgenze ? allUrgenze.slice(0, 20).map((u) => `${u.id}:${anonEncode((u.problema || "").substring(0, 40))}|${u.cliente_id}|pri:${u.priorita_id}`).join("; ") : "";
      const cliList = allClienti.slice(0, 100).map((c) => `${c.codice_m3}(${cittaMap[c.citta_fatturazione] || c.citta_fatturazione || "?"})`).join(", ");
      const nTecAttivi = allTecnici.filter((t) => t.ruolo !== "admin").length;
      const prompt = `PLANNER FSM \u2014 ${meseTarget || "Piano interventi"}
OGGI: ${oggiIt} (${isoOggi})

########## VINCOLI CONFIGURATI (INVIOLABILI \u2014 rispetta OGNI regola senza eccezioni) ##########
${anonEncode(vincoliText || "(Nessun vincolo)")}
${testo ? "ISTRUZIONI AGGIUNTIVE UTENTE: " + anonEncode(testo) : ""}
##########

TECNICI DISPONIBILI (${nTecAttivi}): ${tecList}
AUTOMEZZI: ${autoList || "Nessuno"}
${urgList ? "URGENZE APERTE: " + urgList : ""}
CLIENTI: ${cliList}
${repContext}
${indispContext}
${pianoEsistente}
${tagliandiContext}
${fileContext ? "\nFILE ALLEGATI:\n" + fileContext : ""}

ISTRUZIONI GENERAZIONE:
${periodoIstruzione || "Genera piano per OGNI giorno lavorativo (lun-ven)"}
- Tagliandi/interventi SOLO lun-ven. SABATO e DOMENICA: niente tagliandi \u2014 solo il tecnico REPERIBILE per eventuali urgenze (se previsto dalla reperibilita).
- Lun-ven: TUTTI i ${nTecAttivi} tecnici attivi devono avere interventi OGNI giorno (08:00-17:00) = MINIMO ${nTecAttivi} righe/giorno.
- Durata: un tagliando puo richiedere 4-8 ore (anche giornata intera). Urgenze 1-3h. Se tagliando=giornata intera, 1 solo intervento per quel tecnico.
- "tagliando" e "service" sono sinonimi = manutenzione macchina. Nelle note scrivi il MODELLO macchina (es: "Astronaut A5", "Vector 70").
- Affiancamento junior: se vincolo dice "affianca senior", genera DUE righe separate (una senior + una junior) con STESSO cliente/data/ora/furgone.
- Tecnici assenti da vincoli o in ferie/malattia/trasferta/installazione: NON inserirli in quei giorni.
- Usa il FURGONE indicato tra parentesi nel tecnico (es: "furgone:FURG_1"). Junior affiancato usa furgone del senior.
- Raggruppa per zona (stessa citta per stesso tecnico nello stesso giorno).
- Urgenze \u2192 primi giorni. Tagliandi scaduti \u2192 massima priorita.
- Usa SOLO codici dalla lista (clienteId, tecnicoId). NON inventare nomi.

JSON: {"summary":"...","piano":[{"data":"YYYY-MM-DD","tecnicoId":"TEC_xxx","clienteId":"codice_m3","tipo":"tagliando|urgenza","oraInizio":"HH:MM","durataOre":N,"furgone":"FURG_x","note":"codice macchina"}],"warnings":["..."]}`;
      const validIds = new Set(allTecnici.map((t) => t.id));
      const sysPrompt = `Sei un pianificatore FSM (manutenzione robot). Rispondi SOLO JSON valido. Usa SOLO i codici ID forniti (TEC_xxx, codice_m3, MAC_xxx, FURG_x). NON usare nomi propri. Formato: {"summary":"...","piano":[{"data":"YYYY-MM-DD","tecnicoId":"TEC_xxx","clienteId":"codice_m3","tipo":"tagliando|urgenza","oraInizio":"HH:MM","durataOre":N,"furgone":"FURG_x","note":"codice macchina"}],"warnings":["..."]}`;
      const engines = {
        gemini: { envKey: "GEMINI_KEY", tryFn: null, disabled: false },
        cerebras: { envKey: "CEREBRAS_KEY", tryFn: null, disabled: false },
        groq: { envKey: "GROQ_KEY", tryFn: null, disabled: false },
        mistral: { envKey: "MISTRAL_KEY", tryFn: null, disabled: false },
        deepseek: { envKey: "DEEPSEEK_KEY", tryFn: null, disabled: false },
        workersai: { envKey: "AI", tryFn: null, disabled: false }
      };
      engines.gemini.tryFn = tryGemini;
      engines.cerebras.tryFn = tryCerebras;
      engines.groq.tryFn = tryGroq;
      engines.mistral.tryFn = tryMistral;
      engines.deepseek.tryFn = tryDeepSeek;
      const defaultRanking = ["gemini", "cerebras", "groq", "mistral", "deepseek", "workersai"];
      let engineRanking = defaultRanking;
      try {
        const cfgRank = await sb(
          env,
          "config",
          "GET",
          null,
          `?chiave=eq.ai_engine_ranking&tenant_id=eq.${env.TENANT_ID}&select=valore`
        );
        if (cfgRank?.[0]?.valore) {
          const parsed = cfgRank[0].valore.split(",").map((s) => s.trim().toLowerCase()).filter((s) => engines[s]);
          if (parsed.length) engineRanking = parsed;
        }
      } catch {
      }
      try {
        const cfgDis = await sb(
          env,
          "config",
          "GET",
          null,
          `?chiave=eq.ai_engine_disabled&tenant_id=eq.${env.TENANT_ID}&select=valore`
        );
        if (cfgDis?.[0]?.valore) {
          cfgDis[0].valore.split(",").map((s) => s.trim().toLowerCase()).forEach((s) => {
            if (engines[s]) engines[s].disabled = true;
          });
        }
      } catch {
      }
      let lastWorking = null;
      async function callAI(promptText) {
        let lastError = "";
        if (lastWorking && engines[lastWorking] && !engines[lastWorking].disabled && env[engines[lastWorking].envKey]) {
          const r = lastWorking === "workersai" ? await tryWorkersAI(promptText) : await engines[lastWorking].tryFn(promptText);
          if (r) return r;
        }
        for (const name of engineRanking) {
          const eng = engines[name];
          if (!eng || eng.disabled || !env[eng.envKey]) continue;
          if (name === lastWorking) continue;
          const r = name === "workersai" ? await tryWorkersAI(promptText) : await eng.tryFn(promptText);
          if (r) {
            lastWorking = name;
            return r;
          }
        }
        throw new Error(`AI non disponibile (${lastError}). Configura almeno una chiave API: GEMINI_KEY, GROQ_KEY, CEREBRAS_KEY, MISTRAL_KEY, DEEPSEEK_KEY.`);
      }
      __name(callAI, "callAI");
      async function tryWorkersAI(promptText) {
        if (!env.AI) return null;
        const compactPrompt = buildCompactPrompt ? buildCompactPrompt() : promptText;
        try {
          const aiPromise = env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
            messages: [{ role: "system", content: sysPrompt }, { role: "user", content: compactPrompt }],
            max_tokens: 4096
          });
          const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout_ai")), 3e4));
          const res = await Promise.race([aiPromise, timeout]);
          if (res?.response) return res.response;
        } catch {
        }
        return null;
      }
      __name(tryWorkersAI, "tryWorkersAI");
      async function tryGemini(promptText) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: sysPrompt }] },
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { maxOutputTokens: 16384, temperature: 0.3, responseMimeType: "application/json" }
              })
            }
          );
          if (res.status === 429) {
            engines.gemini.disabled = true;
            return null;
          }
          if (!res.ok) {
            engines.gemini.disabled = true;
            return null;
          }
          const gd = await res.json();
          return gd.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch {
          engines.gemini.disabled = true;
          return null;
        }
      }
      __name(tryGemini, "tryGemini");
      async function tryCerebras(promptText) {
        try {
          const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.CEREBRAS_KEY}` },
            body: JSON.stringify({
              model: "llama-3.3-70b",
              messages: [{ role: "system", content: sysPrompt }, { role: "user", content: promptText }],
              max_tokens: 16384,
              temperature: 0.3,
              response_format: { type: "json_object" }
            })
          });
          if (!res.ok) {
            if (res.status === 429) engines.cerebras.disabled = true;
            return null;
          }
          const cd = await res.json();
          return cd.choices?.[0]?.message?.content || null;
        } catch {
          return null;
        }
      }
      __name(tryCerebras, "tryCerebras");
      async function tryGroq(promptText) {
        try {
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.GROQ_KEY}` },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [{ role: "system", content: sysPrompt }, { role: "user", content: promptText }],
              max_tokens: 16384,
              temperature: 0.3,
              response_format: { type: "json_object" }
            })
          });
          if (!res.ok) {
            if (res.status === 429) engines.groq.disabled = true;
            return null;
          }
          const gd = await res.json();
          return gd.choices?.[0]?.message?.content || null;
        } catch {
          return null;
        }
      }
      __name(tryGroq, "tryGroq");
      async function tryMistral(promptText) {
        try {
          const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.MISTRAL_KEY}` },
            body: JSON.stringify({
              model: "mistral-small-latest",
              messages: [{ role: "system", content: sysPrompt }, { role: "user", content: promptText }],
              max_tokens: 16384,
              temperature: 0.3,
              response_format: { type: "json_object" }
            })
          });
          if (!res.ok) {
            if (res.status === 429) engines.mistral.disabled = true;
            return null;
          }
          const d = await res.json();
          return d.choices?.[0]?.message?.content || null;
        } catch {
          engines.mistral.disabled = true;
          return null;
        }
      }
      __name(tryMistral, "tryMistral");
      async function tryDeepSeek(promptText) {
        try {
          const res = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_KEY}` },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [{ role: "system", content: sysPrompt }, { role: "user", content: promptText }],
              max_tokens: 16384,
              temperature: 0.3,
              response_format: { type: "json_object" }
            })
          });
          if (!res.ok) {
            if (res.status === 429) engines.deepseek.disabled = true;
            return null;
          }
          const d = await res.json();
          return d.choices?.[0]?.message?.content || null;
        } catch {
          engines.deepseek.disabled = true;
          return null;
        }
      }
      __name(tryDeepSeek, "tryDeepSeek");
      const vincoliRules = { assenti: /* @__PURE__ */ new Set(), affiancamenti: [] };
      if (vincoliCfg.length) {
        try {
          const vc = JSON.parse(vincoliCfg[0].valore);
          const oggi2 = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Rome" }).format(/* @__PURE__ */ new Date());
          for (const cat of (vc.categories || []).filter((c) => c.attiva !== false)) {
            for (const r of cat.regole || []) {
              if (!r.testo) continue;
              const attiva = r.permanente || !(r.data_fine && r.data_fine < oggi2);
              if (!attiva) continue;
              const txt = (r.testo || "").toLowerCase();
              if (txt.match(/assent|non disponibil|ferie|malattia|indisponibil/)) {
                for (const id of r.soggetti || []) vincoliRules.assenti.add(id);
              }
              if (txt.match(/affianc|accompagn|coppia|deve lavorare con|junior.*senior/)) {
                vincoliRules.affiancamenti.push({
                  junior: r.soggetti || [],
                  senior: r.riferimenti || [],
                  testo: r.testo
                });
              }
            }
          }
        } catch {
        }
      }
      const postProcessWarnings = [];
      try {
        const baseContext = `PLANNER FSM \u2014 ${meseTarget || "Piano interventi"}
OGGI: ${oggiIt} (${isoOggi})

########## VINCOLI CONFIGURATI (INVIOLABILI \u2014 rispetta OGNI regola senza eccezioni) ##########
${anonEncode(vincoliText || "(Nessun vincolo)")}
${testo ? "ISTRUZIONI AGGIUNTIVE UTENTE: " + anonEncode(testo) : ""}
##########

TECNICI DISPONIBILI (${nTecAttivi}): ${tecList}
AUTOMEZZI: ${autoList || "Nessuno"}
${urgList ? "URGENZE APERTE: " + urgList : ""}
CLIENTI: ${cliList}
${repContext}
${indispContext}
${pianoEsistente}
${tagliandiContext}
${fileContext ? "\nFILE ALLEGATI:\n" + fileContext : ""}`;
        const instructions = `ISTRUZIONI GENERAZIONE:
- Tagliandi/interventi SOLO lun-ven. SABATO e DOMENICA: NIENTE.
- Lun-ven: TUTTI i ${nTecAttivi} tecnici attivi devono avere interventi OGNI giorno (08:00-17:00) = MINIMO ${nTecAttivi} righe/giorno.
- Durata: un tagliando puo richiedere 4-8 ore (anche giornata intera). Urgenze 1-3h.
- "tagliando" e "service" = sinonimi. Nelle note scrivi il CODICE macchina (MAC_xxx).
- Affiancamento junior+senior: genera DUE righe (una per senior, una per junior) con STESSO clienteId/data/ora/furgone.
- Tecnici assenti da vincoli o in ferie/malattia/trasferta/installazione: NON inserirli in quei giorni.
- Usa il FURGONE indicato tra parentesi nel tecnico.
- Raggruppa per zona (stessa zona per stesso tecnico nello stesso giorno).
- Urgenze \u2192 primi giorni. Tagliandi scaduti \u2192 massima priorita.
- Usa SOLO codici dalla lista (tecnicoId, clienteId). NON inventare nomi.

JSON: {"summary":"...","piano":[{"data":"YYYY-MM-DD","tecnicoId":"TEC_xxx","clienteId":"codice_m3","tipo":"tagliando|urgenza","oraInizio":"HH:MM","durataOre":N,"furgone":"FURG_x","note":"codice macchina"}],"warnings":["..."]}`;
        if (meseTarget) {
          const [yy, mm] = meseTarget.split("-").map(Number);
          const chunks = [];
          if (modalita === "settimana") {
            const startOffset = (settimanaNum - 1) * 7;
            const weekStart = new Date(yy, mm - 1, 1 + startOffset);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const lastOfMonth = new Date(yy, mm, 0);
            if (weekEnd > lastOfMonth) weekEnd.setTime(lastOfMonth.getTime());
            const wd = getWorkDays(weekStart, weekEnd);
            if (wd.length) chunks.push({ workDays: wd, label: "Sett " + settimanaNum });
          } else {
            const monthStart = new Date(yy, mm - 1, 1);
            const monthEnd = new Date(yy, mm, 0);
            let cursor = new Date(monthStart);
            let weekNum = 1;
            while (cursor <= monthEnd) {
              const weekStart = new Date(cursor);
              const weekEnd = new Date(weekStart);
              const daysToFri = 5 - weekStart.getDay();
              if (weekStart.getDay() === 0) weekEnd.setDate(weekStart.getDate() + 5);
              else if (weekStart.getDay() === 6) weekEnd.setDate(weekStart.getDate() + 6);
              else if (daysToFri > 0) weekEnd.setDate(weekStart.getDate() + daysToFri);
              else weekEnd.setDate(weekStart.getDate());
              if (weekEnd > monthEnd) weekEnd.setTime(monthEnd.getTime());
              const wd = getWorkDays(weekStart, weekEnd);
              if (wd.length) chunks.push({ workDays: wd, label: "Sett " + weekNum });
              weekNum++;
              cursor = new Date(weekEnd);
              cursor.setDate(cursor.getDate() + 1);
              while (cursor.getDay() !== 1 && cursor <= monthEnd) cursor.setDate(cursor.getDate() + 1);
            }
          }
          const existingDays = /* @__PURE__ */ new Set();
          if (modalita === "vuoti" && vincoli.piano_esistente?.length) {
            vincoli.piano_esistente.forEach((p) => {
              if (p.data) existingDays.add(p.data);
            });
          }
          const allPiano = [];
          const allWarnings = /* @__PURE__ */ new Set();
          let chunksDone = 0;
          const chunkFileCtx = fileContext ? fileContext.substring(0, 1e3) : "";
          const cliListShort = cliList.length > 1500 ? cliList.substring(0, 1500) + "..." : cliList;
          async function processChunk(chunk, weekLabel) {
            let targetDays = chunk.workDays;
            if (modalita === "vuoti" && existingDays.size > 0) {
              targetDays = chunk.workDays.filter((wd) => {
                const dateOnly = wd.split("(")[0];
                return !existingDays.has(dateOnly);
              });
              if (!targetDays.length) return { piano: [], warnings: [], ok: true };
            }
            const chunkPrompt = `PLANNER FSM \u2014 ${meseTarget} \u2014 ${weekLabel}
VINCOLI: ${vincoliText || "(Nessuno)"}
${testo ? "UTENTE: " + testo : ""}
TECNICI (${nTecAttivi}): ${tecList}
${urgList ? "URGENZE: " + urgList : ""}
CLIENTI: ${cliListShort}
${repContext ? repContext.substring(0, 500) : ""}
${indispContext ? indispContext.substring(0, 800) : ""}
${chunkFileCtx ? "FILE: " + chunkFileCtx : ""}

GENERA PIANO per ${targetDays.length} GIORNI: ${targetDays.join(", ")}
${modalita === "vuoti" ? "Giorni VUOTI \u2014 riempili tutti." : ""}
Servono ${targetDays.length * nTecAttivi} righe (${nTecAttivi} tecnici x ${targetDays.length} giorni).

${instructions}`;
            try {
              const rawText = await callAI(chunkPrompt);
              if (!rawText) return { piano: [], warnings: [`${weekLabel}: risposta vuota`], ok: false };
              const parsed = parseAIResponse(rawText);
              if (parsed?.piano?.length) {
                return { piano: parsed.piano, warnings: parsed.warnings || [], ok: true };
              }
              return { piano: [], warnings: [`${weekLabel}: piano vuoto`], ok: false };
            } catch (e) {
              return { piano: [], warnings: [`${weekLabel}: ${e.message}`], ok: false };
            }
          }
          __name(processChunk, "processChunk");
          const fastEngines = env.GEMINI_KEY || env.CEREBRAS_KEY || env.MISTRAL_KEY || env.DEEPSEEK_KEY;
          const chunkDelay = fastEngines ? 2e3 : 65e3;
          for (let ci = 0; ci < chunks.length; ci++) {
            if (ci > 0) await new Promise((r) => setTimeout(r, chunkDelay));
            const res = await processChunk(chunks[ci], chunks[ci].label);
            if (res.piano.length) {
              allPiano.push(...res.piano);
              chunksDone++;
            }
            res.warnings.forEach((w) => allWarnings.add(w));
          }
          if (!allPiano.length) return err("AI non ha generato nessun intervento. Verifica le API key nei Worker secrets.");
          const processed = postProcess(allPiano);
          const decoded = decodePiano(processed);
          const allWarnArr = [...allWarnings, ...postProcessWarnings].map((w) => anonDecode(w));
          return ok({
            summary: anonDecode(`Piano ${meseTarget}: ${decoded.length} interventi su ${[...new Set(decoded.map((p) => p.data))].length} giorni (${chunksDone}/${chunks.length} parti)${postProcessWarnings.length ? ` \u2014 ${postProcessWarnings.length} conflitti rimossi` : ""}`),
            piano: decoded,
            warnings: allWarnArr,
            chunks: chunksDone
          });
        } else {
          const singlePrompt = `${baseContext}

Genera piano per OGNI giorno lavorativo (lun-ven) della prossima settimana.
Genera almeno ${nTecAttivi} interventi per OGNI giorno lavorativo.

${instructions}`;
          const rawText = await callAI(singlePrompt);
          if (!rawText) return err("AI non ha generato risposta. Verifica le API key nei Worker secrets.");
          const result = parseAIResponse(rawText);
          if (!result) return ok({ summary: "Errore formato risposta", piano: [], warnings: ["Risposta AI non parsabile. Riprova."], raw: rawText.substring(0, 1500) });
          result.piano = decodePiano(postProcess(result.piano));
          result.summary = anonDecode(result.summary || "");
          result.warnings = (result.warnings || []).map((w) => anonDecode(w));
          if (postProcessWarnings.length) {
            result.warnings = [...result.warnings, ...postProcessWarnings.map((w) => anonDecode(w))];
            result.summary += ` \u2014 ${postProcessWarnings.length} conflitti rimossi`;
          }
          return ok(result);
        }
      } catch (e) {
        return err(`Errore AI: ${e.message || "sconosciuto"}`);
      }
    }
    case "analyzeImage": {
      if (!env.AI) return err("Workers AI non configurato. Aggiungi [ai] binding in wrangler.toml.");
      const { image_base64, urgenza_id, contesto } = body;
      if (!image_base64) return err("Immagine mancante (campo image_base64 richiesto)");
      let partiContext = "";
      try {
        let partsFilter = "?select=codice,nome,descrizione,gruppo,modello_macchina&attivo=eq.true&limit=50";
        const machHint = (contesto || "").match(/astronaut|vector|juno|discovery|calm|grazeway|cosmix/i)?.[0];
        if (machHint) partsFilter += `&modello_macchina=ilike.*${sanitizePgFilter(machHint.toUpperCase())}*`;
        const parti = await sb(env, "tagliandi", "GET", null, partsFilter).catch(() => []);
        if (parti.length) {
          partiContext = "\n\nCATALOGO RICAMBI LELY DISPONIBILI (suggerisci il codice se riconosci il pezzo):";
          for (const p of parti.slice(0, 40)) {
            partiContext += `
\u2022 ${p.codice || "?"} \u2014 ${(p.nome || p.descrizione || "").substring(0, 60)}`;
          }
        }
      } catch {
      }
      let visionRes;
      try {
        visionRes = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", {
          image: [...Uint8Array.from(atob(image_base64), (c) => c.charCodeAt(0))],
          prompt: `Sei un tecnico esperto di macchine agricole ${brand(env).shortName} (robot mungitura Astronaut, alimentatori Vector, spingivacca Juno, Discovery).
Analizza questa foto di un guasto. Contesto macchina: ${contesto || "non specificato"}
${partiContext}

Rispondi SOLO con JSON valido:
{
  "diagnosi": "descrizione del problema identificato",
  "gravita": "alta|media|bassa",
  "ricambio_suggerito": "nome del pezzo di ricambio necessario",
  "codice_ricambio": "codice dal catalogo sopra se riconoscibile, altrimenti null",
  "componente_identificato": "nome componente visibile nella foto",
  "danno_visibile": "tipo di danno: usura, rottura, corrosione, etc",
  "azione_consigliata": "cosa fare subito",
  "urgenza_intervento": true,
  "confidence": 0.0
}`,
          max_tokens: 768
        });
      } catch (e) {
        return err(`Errore Vision AI: ${e.message}`);
      }
      let analisi;
      try {
        const raw = visionRes.description || visionRes.response || "";
        analisi = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
      } catch (e) {
        analisi = {
          diagnosi: visionRes.description || visionRes.response || "Analisi non disponibile",
          gravita: "media",
          ricambio_suggerito: null,
          codice_ricambio: null,
          componente_identificato: null,
          danno_visibile: null,
          azione_consigliata: "Verificare manualmente",
          urgenza_intervento: false,
          confidence: 0.3
        };
      }
      if (analisi.codice_ricambio || analisi.ricambio_suggerito) {
        const searchTerm = analisi.codice_ricambio || analisi.ricambio_suggerito;
        const codeMatch = (searchTerm || "").match(/\d+\.\d{4}\.\d{4}\.\d+/);
        let catalogMatch = null;
        if (codeMatch) {
          const exact = await sb(env, "tagliandi", "GET", null, `?codice=eq.${codeMatch[0]}&attivo=eq.true&limit=1`).catch(() => []);
          if (exact.length) catalogMatch = exact[0];
        }
        if (!catalogMatch && analisi.ricambio_suggerito) {
          const terms = analisi.ricambio_suggerito.toLowerCase().split(/[\s,;]+/).filter((t) => t.length > 3);
          for (const term of terms.slice(0, 2)) {
            const safeTerm = sanitizePgFilter(term);
            if (!safeTerm) continue;
            const found = await sb(env, "tagliandi", "GET", null, `?or=(nome.ilike.*${safeTerm}*,descrizione.ilike.*${safeTerm}*)&attivo=eq.true&limit=1`).catch(() => []);
            if (found.length) {
              catalogMatch = found[0];
              break;
            }
          }
        }
        if (catalogMatch) {
          analisi.codice_ricambio_verificato = catalogMatch.codice;
          analisi.ricambio_nome_catalogo = catalogMatch.nome || catalogMatch.descrizione;
          analisi.ricambio_gruppo = catalogMatch.gruppo;
        }
      }
      if (urgenza_id) {
        const nota = `[AI Vision] ${analisi.diagnosi} | Gravit\xE0: ${analisi.gravita} | Componente: ${analisi.componente_identificato || "N/A"} | Ricambio: ${analisi.codice_ricambio_verificato || analisi.ricambio_suggerito || "N/A"} | Danno: ${analisi.danno_visibile || "N/A"}`;
        await sb(env, `urgenze?id=eq.${urgenza_id}`, "PATCH", {
          note_ai: nota,
          ai_confidence: analisi.confidence
        }).catch((e) => console.error("Errore aggiornamento urgenza:", e));
      }
      return ok(analisi);
    }
    case "applyAIPlan": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      let pianoAI = [];
      if (body.piano) {
        if (Array.isArray(body.piano)) {
          pianoAI = body.piano;
        } else if (body.piano.piano && Array.isArray(body.piano.piano)) {
          pianoAI = body.piano.piano;
        } else if (typeof body.piano === "object") {
          pianoAI = body.piano.piano || [];
        }
      }
      const forceOverwrite = body.force_overwrite === true;
      const operatoreId = body.operatore_id || body.userId || "admin";
      if (!Array.isArray(pianoAI) || !pianoAI.length) {
        return err(`Piano vuoto (${typeof body.piano}, keys: ${body.piano ? Object.keys(body.piano).join(",") : "null"}). Genera prima un piano.`);
      }
      const dates = [...new Set(pianoAI.map((p) => p.data || p.Data).filter(Boolean))];
      const tecIds = [...new Set(pianoAI.map((p) => p.tecnicoId || p.tecnico_id || p.TecnicoID).filter(Boolean))];
      let existing = [];
      if (dates.length && tecIds.length) {
        const dateMin = dates.sort()[0];
        const dateMax = dates.sort().reverse()[0];
        existing = await sb(
          env,
          "piano",
          "GET",
          null,
          `?data=gte.${dateMin}&data=lte.${dateMax}&stato=neq.annullato&obsoleto=eq.false&select=id,tecnico_id,data,cliente_id,note&limit=500`
        ).catch(() => []);
      }
      const conflictMap = {};
      for (const ex of existing) {
        const key = `${ex.tecnico_id}|${ex.data}`;
        if (!conflictMap[key]) conflictMap[key] = [];
        conflictMap[key].push(ex);
      }
      const conflicts = [];
      const toCreate = [];
      for (const item of pianoAI) {
        const tid = item.tecnicoId || item.tecnico_id || item.TecnicoID;
        const key = `${tid}|${item.data || item.Data}`;
        if (conflictMap[key] && conflictMap[key].length > 0) {
          conflicts.push({
            nuovo: { data: item.data, tecnico: item.tecnico, cliente: item.cliente, tipo: item.tipo },
            esistenti: conflictMap[key].map((e) => ({ id: e.id, cliente_id: e.cliente_id, note: (e.note || "").substring(0, 50) }))
          });
          if (!forceOverwrite) continue;
          for (const e of conflictMap[key]) {
            await sb(env, `piano?id=eq.${e.id}`, "PATCH", {
              stato: "annullato",
              note: (e.note || "") + " [Sovrascritto da AI]",
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }).catch(() => {
            });
          }
        }
        toCreate.push(item);
      }
      if (conflicts.length && !forceOverwrite) {
        return ok({
          has_conflicts: true,
          conflicts_count: conflicts.length,
          conflicts: conflicts.slice(0, 20),
          skipped: conflicts.length,
          message: `${conflicts.length} conflitti trovati (stesso tecnico+data). Invia force_overwrite:true per sovrascrivere.`
        });
      }
      const created = [], applyErrors = [];
      const now = (/* @__PURE__ */ new Date()).toISOString();
      for (const item of toCreate) {
        try {
          const id = secureId("INT_AI");
          const tid = item.tecnicoId || item.tecnico_id || item.TecnicoID;
          const cid = item.clienteId || item.cliente_id || item.ClienteID || null;
          const itemData = item.data || item.Data;
          if (!tid) {
            applyErrors.push({ item: `${itemData} ${item.tecnico || "?"}`, err: "tecnico_id mancante" });
            continue;
          }
          if (!itemData) {
            applyErrors.push({ item: `${item.tecnico || tid}`, err: "data mancante" });
            continue;
          }
          const durata = item.durataOre || item.durata_ore || "";
          const noteParts = [item.tipo || "", item.note || "", durata ? durata + "h" : ""].filter(Boolean);
          await sb(env, "piano", "POST", {
            id,
            tecnico_id: tid,
            cliente_id: cid,
            data: itemData,
            ora_inizio: item.oraInizio || item.ora_inizio || null,
            automezzo_id: item.furgone || item.automezzo_id || null,
            stato: "pianificato",
            origine: "ai",
            note: noteParts.join(" \u2014 "),
            obsoleto: false,
            tenant_id: env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045",
            created_at: now,
            updated_at: now
          });
          created.push(id);
          await wlog("piano", id, "ai_plan_applied", operatoreId, `${item.tecnico || tid} @ ${item.cliente || cid}`).catch(() => {
          });
        } catch (e) {
          applyErrors.push({ item: `${item.data} ${item.tecnico}`, err: e.message });
        }
      }
      return ok({
        created: created.length,
        overwritten: forceOverwrite ? conflicts.length : 0,
        errors: applyErrors.length ? applyErrors : void 0,
        ids: created,
        total_received: pianoAI.length
      });
    }
    case "importExcelPlan": {
      const { rows, operatoreId } = body;
      if (!rows || !rows.length) return err("rows richiesto");
      if (rows.length > 500) return err("Massimo 500 righe per importazione. Dividi il file in pi\xF9 parti.");
      const tecnici = await sb(env, "utenti", "GET", null, "?attivo=eq.true&select=id,nome,cognome");
      const tecMap = {};
      tecnici.forEach((t) => {
        const nome = (t.nome || "").toLowerCase();
        const full = ((t.nome || "") + " " + (t.cognome || "")).toLowerCase().trim();
        tecMap[nome] = t.id;
        tecMap[full] = t.id;
      });
      const created = [], errors = [];
      for (const row of rows) {
        try {
          const tecId = tecMap[(row.tecnico_nome || "").toLowerCase()] || null;
          const id = secureId("INT_XLS");
          const noteParts = [row.cliente, row.service_detail, row.reperibilita ? "REP: " + row.reperibilita : ""].filter(Boolean);
          await sb(env, "piano", "POST", {
            id,
            tecnico_id: tecId,
            data: row.data,
            stato: "pianificato",
            origine: "excel_import",
            note: noteParts.join(" | ") || row.note_complete || "",
            automezzo_id: row.furgone ? "FURG_" + row.furgone : null,
            obsoleto: false,
            tenant_id: env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045",
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          });
          created.push(id);
        } catch (e) {
          errors.push({ row: row.data + " " + row.tecnico_nome, err: e.message });
        }
      }
      return ok({ created: created.length, errors });
    }
    // ============ IMPORT/EXPORT ERP ============
    case "importErpClienti": {
      const { rows } = body;
      if (!rows || !rows.length) return err("rows richiesto (array di oggetti)");
      if (rows.length > 500) return err("Massimo 500 righe");
      const tid = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const mapCol = /* @__PURE__ */ __name((row, ...keys) => {
        for (const k of keys) {
          const val = Object.entries(row).find(([rk]) => rk.toLowerCase().replace(/[_\s]+/g, "") === k.toLowerCase().replace(/[_\s]+/g, ""));
          if (val && val[1]) return String(val[1]).trim();
        }
        return null;
      }, "mapCol");
      const created = [], updated = [], errors = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const codice_m3 = mapCol(row, "M3CustomerNumber", "M3 Customer Number", "codice_m3", "CustomerNumber");
          const nome_account = mapCol(row, "AccountName", "Account Name", "nome_account", "Name");
          if (!codice_m3 && !nome_account) {
            errors.push({ riga: i + 1, err: "Nessun identificativo (M3 o Nome)" });
            continue;
          }
          const record = {
            codice_m3: codice_m3 || null,
            nome_account: nome_account || null,
            area_servizio: mapCol(row, "ServiceArea", "Service Area", "area_servizio") || null,
            citta_fatturazione: mapCol(row, "BillingCity", "Billing City", "citta_fatturazione", "City") || null,
            indirizzo: mapCol(row, "BillingAddress", "Billing Address", "Billing Street", "indirizzo") || null,
            email: mapCol(row, "InvoiceEmail", "Invoice Email", "Email", "email") || null,
            stato_account: mapCol(row, "AccountStatus", "Account Status", "stato_account") || "active",
            piva: mapCol(row, "VATNumber", "VAT Number", "piva", "PIva") || null,
            telefono: mapCol(row, "Phone", "Telefono", "telefono") || null,
            tenant_id: tid,
            updated_at: now
          };
          if (codice_m3) {
            const existing = await sb(env, "anagrafica_clienti", "GET", null, `?codice_m3=eq.${codice_m3}&limit=1`).catch(() => []);
            if (existing.length) {
              await sb(env, `anagrafica_clienti?codice_m3=eq.${codice_m3}`, "PATCH", record);
              updated.push(codice_m3);
            } else {
              record.created_at = now;
              await sb(env, "anagrafica_clienti", "POST", record);
              created.push(codice_m3);
            }
          } else {
            record.codice_m3 = secureId("CLI_IMP");
            record.created_at = now;
            await sb(env, "anagrafica_clienti", "POST", record);
            created.push(record.codice_m3);
          }
        } catch (e) {
          errors.push({ riga: i + 1, err: e.message });
        }
      }
      return ok({ created: created.length, updated: updated.length, errors, total: rows.length });
    }
    case "importErpAssets": {
      const { rows } = body;
      if (!rows || !rows.length) return err("rows richiesto");
      if (rows.length > 2e3) return err("Massimo 2000 righe");
      const tid = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const mapCol = /* @__PURE__ */ __name((row, ...keys) => {
        for (const k of keys) {
          const val = Object.entries(row).find(([rk]) => rk.toLowerCase().replace(/[_\s]+/g, "") === k.toLowerCase().replace(/[_\s]+/g, ""));
          if (val && val[1]) return String(val[1]).trim();
        }
        return null;
      }, "mapCol");
      const created = [], updated = [], errors = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const numero_serie = mapCol(row, "DeviceSerialNumber", "Device Serial Number", "SerialNumber", "numero_serie", "Serial");
          const tipo = mapCol(row, "DeviceType", "Device Type", "tipo_macchina", "Type");
          if (!numero_serie) {
            errors.push({ riga: i + 1, err: "Nessun numero di serie" });
            continue;
          }
          const record = {
            numero_serie,
            tipo_macchina: tipo || null,
            codice_m3: mapCol(row, "CustomerNumber", "Customer Number", "codice_m3", "M3Customer") || null,
            nome_account: mapCol(row, "CustomerName", "Customer Name", "nome_account") || null,
            modello: mapCol(row, "ModelCode", "Model code", "Model", "modello") || null,
            gruppo_attrezzatura: mapCol(row, "EquipmentGroup", "Equipment Group", "gruppo_attrezzatura") || null,
            nome_asset: mapCol(row, "DeviceName", "Device Name", "nome_asset") || tipo || null,
            data_installazione: mapCol(row, "InstallationDate", "Installation date", "data_installazione") || null,
            stato: mapCol(row, "Status", "stato") || "attivo",
            tenant_id: tid,
            updated_at: now
          };
          const existing = await sb(env, "anagrafica_assets", "GET", null, `?numero_serie=eq.${encodeURIComponent(numero_serie)}&limit=1`).catch(() => []);
          if (existing.length) {
            await sb(env, `anagrafica_assets?numero_serie=eq.${encodeURIComponent(numero_serie)}`, "PATCH", record);
            updated.push(numero_serie);
          } else {
            record.id = secureId("AST");
            record.created_at = now;
            await sb(env, "anagrafica_assets", "POST", record);
            created.push(numero_serie);
          }
        } catch (e) {
          errors.push({ riga: i + 1, err: e.message });
        }
      }
      return ok({ created: created.length, updated: updated.length, errors, total: rows.length });
    }
    case "exportErpTemplate": {
      const templateType = body.template_type || "clienti";
      if (!["clienti", "assets", "piano"].includes(templateType))
        return err("template_type non valido. Opzioni: clienti, assets, piano");
      if (body.export_data) {
        let data = [];
        if (templateType === "clienti") {
          data = await sb(env, "anagrafica_clienti", "GET", null, "?select=*&order=nome_account.asc&limit=500");
        } else if (templateType === "assets") {
          data = await sb(env, "anagrafica_assets", "GET", null, "?select=*&order=gruppo_attrezzatura.asc,nome_asset.asc&limit=1000");
        } else if (templateType === "piano") {
          data = await sb(env, "piano", "GET", null, "?select=*&obsoleto=eq.false&order=data.desc&limit=500");
        }
        const excludeKeys = /* @__PURE__ */ new Set(["tenant_id", "obsoleto", "created_at", "updated_at", "id"]);
        const cleanData = data.map((row) => {
          const clean = {};
          for (const [k, v] of Object.entries(row)) {
            if (!excludeKeys.has(k) && v !== null && v !== void 0 && v !== "") clean[k] = v;
          }
          return clean;
        });
        const allCols = [...new Set(cleanData.flatMap((r) => Object.keys(r)))];
        return ok({ template: { name: templateType, columns: allCols.map((c) => ({ header: c, db_field: c })) }, data: cleanData });
      }
      return ok({ template: { name: templateType } });
    }
    // -------- WORKFLOW APPROVATIVO → spostato sotto dopo getVincoliCategories --------
    case "geocodeAll": {
      const batchSize = Math.min(parseInt(body?.limit) || 20, 50);
      const clientiSenzaGeo = await sb(
        env,
        "clienti",
        "GET",
        null,
        "?latitudine=is.null&obsoleto=eq.false&select=id,indirizzo,citta,prov,cap"
      );
      const cfgArr = await sb(env, "config", "GET", null, "?tenant_id=eq." + (env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045") + "&chiave=eq.email_mittente");
      const contactEmail = cfgArr?.[0]?.valore || "admin@syntoniqa.app";
      const geocodeOne = /* @__PURE__ */ __name(async (c, attempt = 0) => {
        const query = [c.indirizzo, c.citta, c.prov, "Italia"].filter(Boolean).join(", ");
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=0`;
        try {
          const res = await fetch(url, {
            headers: {
              "User-Agent": `Syntoniqa/2.0 (${contactEmail})`,
              "Accept-Language": "it"
            }
          });
          if (res.status === 429) {
            if (attempt >= 3) return { ok: false, reason: "rate_limit_exceeded" };
            await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1500));
            return geocodeOne(c, attempt + 1);
          }
          if (!res.ok) return { ok: false, reason: `http_${res.status}` };
          const data = await res.json();
          if (!data.length) return { ok: false, reason: "no_results" };
          return { ok: true, lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        } catch (e) {
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 2e3));
            return geocodeOne(c, attempt + 1);
          }
          return { ok: false, reason: e.message };
        }
      }, "geocodeOne");
      let updated = 0;
      const errors = [];
      const batch = clientiSenzaGeo.slice(0, batchSize);
      for (let i = 0; i < batch.length; i++) {
        const c = batch[i];
        const result = await geocodeOne(c);
        if (result.ok) {
          await sb(env, `clienti?id=eq.${c.id}`, "PATCH", {
            latitudine: result.lat,
            longitudine: result.lon
          });
          updated++;
        } else {
          errors.push({ id: c.id, citta: c.citta, reason: result.reason });
          await wlog("clienti", c.id, "geocode_failed", "system", result.reason).catch(() => {
          });
        }
        if (i < batch.length - 1) {
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
      return ok({
        updated,
        failed: errors.length,
        skipped: Math.max(0, clientiSenzaGeo.length - batchSize),
        total_senza_geo: clientiSenzaGeo.length,
        errors: errors.slice(0, 10),
        // max 10 errori nel response
        message: errors.length ? `${updated} geocodificati, ${errors.length} falliti. Controlla audit log per dettagli.` : `${updated} clienti geocodificati con successo.`
      });
    }
    case "generateReport": {
      const filtri = body.filtri || {};
      const tipo = body.tipo || "kpi_mensile";
      const dateFrom = filtri.data_inizio || filtri.dataInizio || body.date_from || "";
      const dateTo = filtri.data_fine || filtri.dataFine || body.date_to || "";
      const tecnicoId = filtri.tecnico_id || filtri.tecnicoId || body.tecnico_id || "";
      if (!dateFrom) return err("Data inizio richiesta");
      const dtTo = dateTo || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      let pFilter = `?data=gte.${dateFrom}&data=lte.${dtTo}&obsoleto=eq.false`;
      if (tecnicoId) pFilter += `&tecnico_id=eq.${tecnicoId}`;
      const [piano, urgenze, utenti, clienti] = await Promise.all([
        sb(env, "piano", "GET", null, pFilter + "&order=data.asc&limit=1000"),
        sb(env, "urgenze", "GET", null, `?data_segnalazione=gte.${dateFrom}&data_segnalazione=lte.${dtTo}T23:59:59&obsoleto=eq.false&limit=1000`),
        sb(env, "utenti", "GET", null, "?attivo=eq.true&select=id,nome,cognome,ruolo"),
        sb(env, "clienti", "GET", null, "?obsoleto=eq.false&select=id,nome&limit=500")
      ]);
      const getName = /* @__PURE__ */ __name((list, id, field = "nome") => {
        const f = list.find((x) => x.id === id);
        return f ? f[field] || f.nome || id : id;
      }, "getName");
      const tecName = /* @__PURE__ */ __name((id) => {
        const u = utenti.find((x) => x.id === id);
        return u ? `${u.nome || ""} ${u.cognome || ""}`.trim() : id || "\u2014";
      }, "tecName");
      const now = (/* @__PURE__ */ new Date()).toISOString().substring(0, 19).replace("T", " ");
      let result = { titolo: "", colonne: [], righe: [], generato: now };
      switch (tipo) {
        case "interventi_tecnico": {
          result.titolo = `Interventi per Tecnico (${dateFrom} \u2014 ${dtTo})`;
          result.colonne = ["Tecnico", "Totale", "Completati", "In Corso", "Pianificati", "Ore", "Km"];
          const byTec = {};
          piano.forEach((p) => {
            const t = p.tecnico_id || "\u2014";
            if (!byTec[t]) byTec[t] = { tot: 0, comp: 0, inCorso: 0, pian: 0, ore: 0, km: 0 };
            byTec[t].tot++;
            if (p.stato === "completato") byTec[t].comp++;
            else if (p.stato === "in_corso") byTec[t].inCorso++;
            else byTec[t].pian++;
            byTec[t].ore += parseFloat(p.ore_lavorate || 0);
            byTec[t].km += parseInt(p.km_percorsi || 0);
          });
          result.righe = Object.entries(byTec).map(([id, v]) => [tecName(id), v.tot, v.comp, v.inCorso, v.pian, v.ore.toFixed(1), v.km]);
          break;
        }
        case "urgenze_summary": {
          result.titolo = `Riepilogo Urgenze (${dateFrom} \u2014 ${dtTo})`;
          result.colonne = ["ID", "Data", "Cliente", "Problema", "Priorit\xE0", "Stato", "Tecnico", "SLA"];
          result.righe = urgenze.map((u) => [u.id, (u.data_segnalazione || "").substring(0, 10), getName(clienti, u.cliente_id), (u.problema || "").substring(0, 60), u.priorita_id || "\u2014", u.stato, tecName(u.tecnico_assegnato), u.sla_status || "\u2014"]);
          break;
        }
        case "kpi_mensile": {
          result.titolo = `KPI Mensile (${dateFrom} \u2014 ${dtTo})`;
          result.colonne = ["Metrica", "Valore"];
          const comp = piano.filter((p) => p.stato === "completato");
          const ore = comp.reduce((s, p) => s + parseFloat(p.ore_lavorate || 0), 0);
          const km = comp.reduce((s, p) => s + parseInt(p.km_percorsi || 0), 0);
          const urgRisolte = urgenze.filter((u) => u.stato === "risolta" || u.stato === "chiusa");
          const urgSlaOk = urgenze.filter((u) => u.sla_status === "ok" || u.sla_status === "warning");
          const slaPerc = urgenze.length ? Math.round(urgSlaOk.length / urgenze.length * 100) : 100;
          result.righe = [
            ["Interventi totali", piano.length],
            ["Interventi completati", comp.length],
            ["% Completamento", piano.length ? Math.round(comp.length / piano.length * 100) + "%" : "\u2014"],
            ["Ore lavorate totali", ore.toFixed(1)],
            ["Km percorsi totali", km],
            ["Urgenze totali", urgenze.length],
            ["Urgenze risolte", urgRisolte.length],
            ["SLA Compliance", slaPerc + "%"],
            ["Tecnici attivi", new Set(piano.map((p) => p.tecnico_id).filter(Boolean)).size],
            ["Clienti serviti", new Set(piano.map((p) => p.cliente_id).filter(Boolean)).size]
          ];
          break;
        }
        case "performance_squadra": {
          result.titolo = `Performance per Squadra (${dateFrom} \u2014 ${dtTo})`;
          result.colonne = ["Tecnico", "Ruolo", "Interventi", "Completati", "%", "Urgenze", "Ore", "Km"];
          const tecIds = [...new Set([...piano.map((p) => p.tecnico_id), ...urgenze.map((u) => u.tecnico_assegnato)].filter(Boolean))];
          result.righe = tecIds.map((tid) => {
            const pTec = piano.filter((p) => p.tecnico_id === tid);
            const uTec = urgenze.filter((u2) => u2.tecnico_assegnato === tid);
            const comp = pTec.filter((p) => p.stato === "completato");
            const u = utenti.find((x) => x.id === tid);
            return [tecName(tid), u?.ruolo || "\u2014", pTec.length, comp.length, pTec.length ? Math.round(comp.length / pTec.length * 100) + "%" : "\u2014", uTec.filter((u2) => u2.stato === "risolta" || u2.stato === "chiusa").length, comp.reduce((s, p) => s + parseFloat(p.ore_lavorate || 0), 0).toFixed(1), comp.reduce((s, p) => s + parseInt(p.km_percorsi || 0), 0)];
          });
          break;
        }
        case "clienti_inattivi": {
          result.titolo = `Clienti Inattivi (>90 giorni senza interventi)`;
          result.colonne = ["Cliente", "Ultimo Intervento", "Giorni Inattivo"];
          const d90 = /* @__PURE__ */ new Date();
          d90.setDate(d90.getDate() - 90);
          const allPiano = await sb(env, "piano", "GET", null, "?obsoleto=eq.false&order=data.desc&limit=1000");
          const lastByClient = {};
          allPiano.forEach((p) => {
            if (p.cliente_id && !lastByClient[p.cliente_id]) lastByClient[p.cliente_id] = p.data;
          });
          result.righe = clienti.filter((c) => {
            const last = lastByClient[c.id];
            return !last || new Date(last) < d90;
          }).map((c) => {
            const last = lastByClient[c.id];
            const days = last ? Math.round((/* @__PURE__ */ new Date() - new Date(last)) / 864e5) : "\u2014";
            return [c.nome || c.id, last || "Mai", days];
          }).sort((a, b) => (typeof b[2] === "number" ? b[2] : 9999) - (typeof a[2] === "number" ? a[2] : 9999));
          break;
        }
        case "daily_team": {
          const giorno = dateFrom;
          result.titolo = `Report Team \u2014 ${giorno}`;
          result.colonne = ["Tecnico", "Ruolo", "Interventi", "Completati", "Urgenze", "Ordini", "Rep.", "Score"];
          const allTecPiano = piano.filter((p) => p.data === giorno);
          const allTecUrg = urgenze.filter((u) => (u.data_segnalazione || "").startsWith(giorno));
          const ordini = await sb(env, "ordini", "GET", null, `?data_richiesta=gte.${giorno}T00:00:00&data_richiesta=lte.${giorno}T23:59:59&obsoleto=eq.false`).catch(() => []);
          const allRep = await sb(env, "reperibilita", "GET", null, `?data_inizio=lte.${giorno}&data_fine=gte.${giorno}&obsoleto=eq.false`).catch(() => []);
          const repMap = Object.fromEntries(allRep.map((r) => [r.tecnico_id, r.tipo || "\u2713"]));
          const tecActiveTday = [...new Set([
            ...allTecPiano.map((p) => p.tecnico_id),
            ...allTecUrg.map((u) => u.tecnico_assegnato)
          ].filter(Boolean))];
          const allActiveTec = utenti.filter((u) => u.ruolo && u.ruolo !== "admin");
          const finalTecIds = [.../* @__PURE__ */ new Set([...tecActiveTday, ...allActiveTec.map((u) => u.id)])];
          result.righe = finalTecIds.map((tid) => {
            const pTec = allTecPiano.filter((p) => p.tecnico_id === tid);
            const uTec = allTecUrg.filter((u2) => u2.tecnico_assegnato === tid);
            const oTec = ordini.filter((o) => o.tecnico_id === tid);
            const compTec = pTec.filter((p) => p.stato === "completato").length;
            const compRate = pTec.length > 0 ? Math.round(compTec / pTec.length * 100) : 0;
            const urgDone = uTec.filter((u2) => u2.stato === "risolta" || u2.stato === "chiusa").length;
            const score = pTec.length > 0 ? Math.round(compRate * 0.6 + (uTec.length > 0 ? urgDone / uTec.length * 100 * 0.4 : 40)) : 0;
            const u = utenti.find((x) => x.id === tid);
            return [
              tecName(tid),
              u?.ruolo || "\u2014",
              pTec.length,
              compTec,
              uTec.length,
              oTec.length,
              repMap[tid] || "\u2014",
              score
            ];
          }).sort((a, b) => b[7] - a[7]);
          const totI = result.righe.reduce((s, r) => s + r[2], 0);
          const totC = result.righe.reduce((s, r) => s + r[3], 0);
          const totU = result.righe.reduce((s, r) => s + r[4], 0);
          const totO = result.righe.reduce((s, r) => s + r[5], 0);
          const avgScore = result.righe.length > 0 ? Math.round(result.righe.reduce((s, r) => s + r[7], 0) / result.righe.length) : 0;
          result.summary = { totale_interventi: totI, completati: totC, urgenze: totU, ordini: totO, score_medio: avgScore };
          break;
        }
        case "tagliandi_scadenza": {
          result.titolo = `Tagliandi/Service in Scadenza`;
          result.colonne = ["Macchina", "Modello", "Cliente", "Prossimo Tagliando", "Giorni", "Urgenza"];
          const macchine = await sb(env, "macchine", "GET", null, "?prossimo_tagliando=not.is.null&obsoleto=eq.false&order=prossimo_tagliando.asc&limit=50").catch(() => []);
          const assets = await sb(env, "anagrafica_assets", "GET", null, "?prossimo_controllo=not.is.null&order=prossimo_controllo.asc&limit=50").catch(() => []);
          const todayTag = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          const items = [
            ...macchine.map((m) => ({ nome: m.modello || m.seriale || m.id, modello: m.modello || m.tipo || "\u2014", cliente: getName(clienti, m.cliente_id), data: m.prossimo_tagliando })),
            ...assets.map((a) => ({ nome: a.nome_asset || a.id, modello: a.modello || a.gruppo_attrezzatura || "\u2014", cliente: a.nome_account || a.codice_m3 || "\u2014", data: a.prossimo_controllo }))
          ].sort((a, b) => (a.data || "9999").localeCompare(b.data || "9999"));
          result.righe = items.map((it) => {
            const days = Math.round((new Date(it.data) - new Date(todayTag)) / 864e5);
            const urgLvl = days < 0 ? "\u{1F534} SCADUTO" : days <= 7 ? "\u{1F7E0} URGENTE" : days <= 30 ? "\u{1F7E1} PROSSIMO" : "\u{1F7E2} OK";
            return [it.nome, it.modello, it.cliente, it.data, days, urgLvl];
          });
          break;
        }
        default:
          return err("Tipo report non supportato: " + tipo);
      }
      return ok(result);
    }
    case "logKPISnapshot": {
      const id = secureId("KSN");
      await sb(env, "kpi_snapshot", "POST", { id, ...getFields(body), data: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], ora: (/* @__PURE__ */ new Date()).toTimeString().split(" ")[0] });
      return ok({ id });
    }
    case "updateSLAStatus": {
      const urgenze = await sb(env, "urgenze", "GET", null, "?stato=in.(aperta,assegnata,in_corso)&sla_scadenza=not.is.null");
      const now = /* @__PURE__ */ new Date();
      let updated = 0;
      for (const u of urgenze) {
        const scadenza = new Date(u.sla_scadenza);
        const diffOre = (scadenza - now) / 36e5;
        let newStatus = "ok";
        if (diffOre < 0) newStatus = "scaduto";
        else if (diffOre < 2) newStatus = "critical";
        else if (diffOre < 6) newStatus = "warning";
        if (newStatus !== u.sla_status) {
          await sb(env, `urgenze?id=eq.${u.id}`, "PATCH", { sla_status: newStatus });
          updated++;
        }
      }
      return ok({ updated, total: urgenze.length });
    }
    case "saveConfig":
    case "updateConfig": {
      const config = body.config || body.data;
      if (!config || typeof config !== "object") return err("config richiesto (oggetto chiave/valore)");
      for (const [chiave, valore] of Object.entries(config)) {
        await sb(env, "config", "POST", { chiave, valore }).catch(async () => {
          await sb(env, `config?chiave=eq.${chiave}`, "PATCH", { valore });
        });
      }
      return ok();
    }
    // ─── VINCOLI PIANIFICAZIONE (dinamici, white-label) ───────────────
    case "saveVincoliCategories": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const payload = body.vincoli || body.data;
      if (!payload) return err("vincoli richiesti");
      const valStr = typeof payload === "string" ? payload : JSON.stringify(payload);
      await sb(env, "config", "POST", {
        chiave: "vincoli_categories",
        valore: valStr,
        tenant_id: env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045"
      }).catch(async () => {
        await sb(env, `config?chiave=eq.vincoli_categories`, "PATCH", { valore: valStr });
      });
      await wlog("config", "vincoli_categories", "vincoli_saved", body.operatore_id || body.userId || "system");
      return ok({ saved: true, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    }
    case "getVincoliCategories": {
      const rows = await sb(
        env,
        "config",
        "GET",
        null,
        `?chiave=eq.vincoli_categories&limit=1`
      );
      if (!rows || !rows.length) return ok({ categories: [], meta: {} });
      try {
        const parsed = JSON.parse(rows[0].valore);
        return ok(parsed);
      } catch {
        return ok({ categories: [], meta: {}, raw: rows[0].valore });
      }
    }
    // ──────── VINCOLI AUTO-DERIVATI (da dati esistenti) ─────────────
    case "getVincoliAutoDerived": {
      const vdMese = body.mese_target;
      if (!vdMese) return err("mese_target richiesto (YYYY-MM)");
      const vdStart = vdMese + "-01";
      const vdLastDay = new Date(parseInt(vdMese.split("-")[0]), parseInt(vdMese.split("-")[1]), 0).getDate();
      const vdEnd = vdMese + "-" + String(vdLastDay).padStart(2, "0");
      const [vdTecnici, vdRich, vdRep, vdTras, vdInst, vdManual] = await Promise.all([
        sb(env, "utenti", "GET", null, "?attivo=eq.true&obsoleto=eq.false&select=id,nome,cognome,ruolo,base,automezzo_id").catch(() => []),
        sb(env, "richieste", "GET", null, `?stato=eq.approvata&obsoleto=eq.false&data_inizio=lte.${vdEnd}&data_fine=gte.${vdStart}&select=id,tecnico_id,tipo,data_inizio,data_fine,motivo`).catch(() => []),
        sb(env, "reperibilita", "GET", null, `?obsoleto=eq.false&data_inizio=lte.${vdEnd}&data_fine=gte.${vdStart}&select=id,tecnico_id,data_inizio,data_fine,turno,tipo`).catch(() => []),
        sb(env, "trasferte", "GET", null, `?obsoleto=eq.false&data_inizio=lte.${vdEnd}&data_fine=gte.${vdStart}&select=id,tecnico_id,tecnici_ids,data_inizio,data_fine,cliente_id,motivo`).catch(() => []),
        sb(env, "installazioni", "GET", null, `?obsoleto=eq.false&stato=in.(pianificato,in_corso)&data_inizio=lte.${vdEnd}&select=id,tecnico_id,tecnici_ids,data_inizio,data_fine,cliente_id,stato`).catch(() => []),
        sb(env, "config", "GET", null, "?chiave=eq.vincoli_categories&limit=1").catch(() => [])
      ]);
      const tecMap = {};
      vdTecnici.forEach((t) => {
        tecMap[t.id] = `${t.nome || ""} ${t.cognome || ""}`.trim();
      });
      const tn = /* @__PURE__ */ __name((id) => tecMap[id] || id, "tn");
      const fd = /* @__PURE__ */ __name((d) => d ? d.split("-").reverse().join("/") : "", "fd");
      const auto_derived = [];
      for (const r of vdRich) {
        const icona = r.tipo === "ferie" ? "\u{1F3D6}\uFE0F" : r.tipo === "malattia" ? "\u{1F912}" : "\u{1F4CB}";
        const tipoLabel = (r.tipo || "permesso").charAt(0).toUpperCase() + (r.tipo || "permesso").slice(1);
        auto_derived.push({
          tipo: "auto_derived",
          categoria: "Assenze",
          icona,
          nome: `${tipoLabel} ${tn(r.tecnico_id)}`,
          fonte_tabella: "richieste",
          fonte_record_id: r.id,
          testo: `${tn(r.tecnico_id)} NON DISPONIBILE per ${r.tipo}${r.motivo ? " (" + r.motivo + ")" : ""} dal ${fd(r.data_inizio)} al ${fd(r.data_fine || r.data_inizio)}`,
          soggetti: [r.tecnico_id],
          data_inizio: r.data_inizio,
          data_fine: r.data_fine || r.data_inizio,
          priorita: "alta",
          impatto: "NON schedulare"
        });
      }
      for (const r of vdRep) {
        auto_derived.push({
          tipo: "auto_derived",
          categoria: "Reperibilita",
          icona: "\u{1F4DE}",
          nome: `Reperibilit\xE0 ${tn(r.tecnico_id)}`,
          fonte_tabella: "reperibilita",
          fonte_record_id: r.id,
          testo: `${tn(r.tecnico_id)} reperibile ${r.turno ? "(" + r.turno + ")" : ""} dal ${fd(r.data_inizio)} al ${fd(r.data_fine)}`,
          soggetti: [r.tecnico_id],
          data_inizio: r.data_inizio,
          data_fine: r.data_fine,
          priorita: "media",
          impatto: "Disponibile ma reperibile"
        });
      }
      for (const t of vdTras) {
        const tecIds = [t.tecnico_id, ...(t.tecnici_ids || "").split(",").filter(Boolean)].filter(Boolean);
        auto_derived.push({
          tipo: "auto_derived",
          categoria: "Trasferte",
          icona: "\u{1F9F3}",
          nome: `Trasferta ${tecIds.map(tn).join(", ")}`,
          fonte_tabella: "trasferte",
          fonte_record_id: t.id,
          testo: `${tecIds.map(tn).join(", ")} in trasferta${t.motivo ? " (" + t.motivo + ")" : ""} dal ${fd(t.data_inizio)} al ${fd(t.data_fine || t.data_inizio)}`,
          soggetti: tecIds,
          data_inizio: t.data_inizio,
          data_fine: t.data_fine || t.data_inizio,
          priorita: "alta",
          impatto: "NON schedulare"
        });
      }
      for (const i of vdInst) {
        const tecIds = [i.tecnico_id, ...(i.tecnici_ids || "").split(",").filter(Boolean)].filter(Boolean);
        auto_derived.push({
          tipo: "auto_derived",
          categoria: "Installazioni",
          icona: "\u{1F3D7}\uFE0F",
          nome: `Installazione ${i.id}`,
          fonte_tabella: "installazioni",
          fonte_record_id: i.id,
          testo: `${tecIds.map(tn).join(", ")} impegnati in installazione ${i.id} dal ${fd(i.data_inizio)}${i.data_fine ? " al " + fd(i.data_fine) : ""}`,
          soggetti: tecIds,
          data_inizio: i.data_inizio,
          data_fine: i.data_fine || i.data_inizio,
          priorita: "alta",
          impatto: "NON schedulare"
        });
      }
      let manual_rules = [];
      try {
        if (vdManual?.[0]?.valore) {
          const vc = JSON.parse(vdManual[0].valore);
          const cats = (vc.categories || []).filter((c) => c.attiva !== false);
          for (const cat of cats) {
            for (const r of cat.regole || []) {
              if (!r.testo) continue;
              if (!r.permanente && r.data_fine && r.data_fine < vdStart) continue;
              manual_rules.push({
                tipo: "manual_rule",
                categoria: cat.nome,
                icona: cat.icona || "\u{1F4CB}",
                nome: r.testo.substring(0, 60),
                testo: r.testo,
                soggetti: r.soggetti || [],
                riferimenti: r.riferimenti || [],
                priorita: r.priorita || "media",
                regola_tipo: r.tipo_regola || "vincolo",
                permanente: r.permanente !== false,
                data_inizio: r.data_inizio,
                data_fine: r.data_fine
              });
            }
          }
        }
      } catch {
      }
      const assentiIds = /* @__PURE__ */ new Set();
      auto_derived.filter((v) => v.impatto === "NON schedulare").forEach((v) => (v.soggetti || []).forEach((s) => assentiIds.add(s)));
      const tecniciNonAdmin = vdTecnici.filter((t) => t.ruolo !== "admin");
      return ok({
        mese: vdMese,
        auto_derived,
        manual_rules,
        summary: {
          tecnici_totali: tecniciNonAdmin.length,
          tecnici_disponibili: tecniciNonAdmin.length - assentiIds.size,
          tecnici_assenti: [...assentiIds].map((id) => ({ id, nome: tn(id) })),
          vincoli_auto: auto_derived.length,
          regole_manuali: manual_rules.length,
          per_categoria: {
            assenze: auto_derived.filter((v) => v.categoria === "Assenze").length,
            reperibilita: auto_derived.filter((v) => v.categoria === "Reperibilita").length,
            trasferte: auto_derived.filter((v) => v.categoria === "Trasferte").length,
            installazioni: auto_derived.filter((v) => v.categoria === "Installazioni").length
          }
        }
      });
    }
    // ──────── AVAILABILITY MAP (mappa disponibilità tecnici) ─────────
    case "getAvailabilityMap": {
      const { mese_target: avMese } = body;
      if (!avMese) return err("mese_target richiesto (YYYY-MM)");
      const avStart = avMese + "-01";
      const avLastDay = new Date(parseInt(avMese.split("-")[0]), parseInt(avMese.split("-")[1]), 0).getDate();
      const avEnd = avMese + "-" + avLastDay;
      const [avTecnici, avPiano, avRep, avRich, avTras, avInst, avUrg, avMacch, avVincoli] = await Promise.all([
        sb(env, "utenti", "GET", null, "?attivo=eq.true&obsoleto=eq.false&ruolo=neq.admin&select=id,nome,cognome,ruolo,base,automezzo_id").catch(() => []),
        sb(env, "piano", "GET", null, `?obsoleto=eq.false&stato=neq.annullato&data=gte.${avStart}&data=lte.${avEnd}&select=id,data,tecnico_id,tecnici_ids,cliente_id,tipo_intervento_id,stato,note&order=data.asc&limit=500`).catch(() => []),
        sb(env, "reperibilita", "GET", null, `?obsoleto=eq.false&data_inizio=lte.${avEnd}&data_fine=gte.${avStart}&select=id,tecnico_id,data_inizio,data_fine,turno,tipo`).catch(() => []),
        sb(env, "richieste", "GET", null, `?stato=eq.approvata&obsoleto=eq.false&data_inizio=lte.${avEnd}&data_fine=gte.${avStart}&select=id,tecnico_id,tipo,data_inizio,data_fine,motivo`).catch(() => []),
        sb(env, "trasferte", "GET", null, `?obsoleto=eq.false&data_inizio=lte.${avEnd}&data_fine=gte.${avStart}&select=id,tecnico_id,tecnici_ids,data_inizio,data_fine,cliente_id,motivo`).catch(() => []),
        sb(env, "installazioni", "GET", null, `?obsoleto=eq.false&stato=in.(pianificato,in_corso)&data_inizio=lte.${avEnd}&select=id,tecnico_id,tecnici_ids,data_inizio,data_fine,cliente_id,stato`).catch(() => []),
        sb(env, "urgenze", "GET", null, "?stato=in.(aperta,assegnata,schedulata)&obsoleto=eq.false&select=id,problema,priorita_id,tecnico_assegnato,cliente_id&order=data_segnalazione.desc&limit=30").catch(() => []),
        sb(env, "macchine", "GET", null, `?obsoleto=eq.false&prossimo_tagliando=not.is.null&prossimo_tagliando=lte.${addDays(avEnd, 60)}&select=id,seriale,modello,prossimo_tagliando,cliente_id,ore_lavoro&order=prossimo_tagliando.asc&limit=200`).catch(() => []),
        sb(env, "config", "GET", null, "?chiave=eq.vincoli_categories&limit=1").catch(() => [])
      ]);
      const giorni = [];
      for (let d = 1; d <= avLastDay; d++) {
        const dt = new Date(parseInt(avMese.split("-")[0]), parseInt(avMese.split("-")[1]) - 1, d);
        if (dt.getDay() !== 0) {
          giorni.push(avMese + "-" + String(d).padStart(2, "0"));
        }
      }
      const tecnici = avTecnici.map((t) => {
        const gg = {};
        for (const ds of giorni) {
          const isSab = new Date(ds).getDay() === 6;
          const entry = { stato: isSab ? "sabato" : "disponibile", eventi: [] };
          const pianoDay = avPiano.filter((p) => p.data === ds && (p.tecnico_id === t.id || (p.tecnici_ids || "").includes(t.id)));
          if (pianoDay.length) {
            entry.eventi.push(...pianoDay.map((p) => ({ tipo: "piano", id: p.id, tipoInt: p.tipo_intervento_id })));
          }
          const repDay = avRep.find((r) => r.tecnico_id === t.id && r.data_inizio <= ds && r.data_fine >= ds);
          if (repDay) {
            entry.eventi.push({ tipo: "reperibilita", id: repDay.id });
          }
          const richDay = avRich.find((r) => r.tecnico_id === t.id && r.data_inizio <= ds && (r.data_fine || r.data_inizio) >= ds);
          if (richDay) {
            entry.stato = richDay.tipo === "malattia" ? "malattia" : richDay.tipo === "ferie" ? "ferie" : "permesso";
            entry.eventi.push({ tipo: "richiesta", id: richDay.id, sottotipo: richDay.tipo });
          }
          const trasDay = avTras.find((tr) => (tr.tecnico_id === t.id || (tr.tecnici_ids || "").includes(t.id)) && tr.data_inizio <= ds && (tr.data_fine || tr.data_inizio) >= ds);
          if (trasDay) {
            entry.stato = "trasferta";
            entry.eventi.push({ tipo: "trasferta", id: trasDay.id, cliente_id: trasDay.cliente_id });
          }
          const instDay = avInst.find((i) => (i.tecnico_id === t.id || (i.tecnici_ids || "").includes(t.id)) && i.data_inizio <= ds && (i.data_fine || i.data_inizio) >= ds);
          if (instDay) {
            entry.stato = "installazione";
            entry.eventi.push({ tipo: "installazione", id: instDay.id, cliente_id: instDay.cliente_id });
          }
          gg[ds] = entry;
        }
        return { id: t.id, nome: `${t.nome} ${t.cognome || ""}`.trim(), ruolo: t.ruolo, base: t.base, automezzo_id: t.automezzo_id, giorni: gg };
      });
      const today4 = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const tagliandiPendenti = avMacch.map((m) => {
        const ggDiff = Math.round((new Date(m.prossimo_tagliando) - new Date(today4)) / 864e5);
        return {
          macchina_id: m.id,
          seriale: m.seriale,
          modello: m.modello,
          cliente_id: m.cliente_id,
          prossimo: m.prossimo_tagliando,
          ore_lavoro: m.ore_lavoro,
          urgenza: ggDiff < 0 ? "SCADUTO" : ggDiff <= 7 ? "URGENTE" : ggDiff <= 30 ? "PROSSIMO" : "PROGRAMMATO",
          giorni: ggDiff
        };
      }).sort((a, b) => a.giorni - b.giorni);
      let vincoliNoti = "";
      try {
        if (avVincoli?.[0]?.valore) {
          const vc = JSON.parse(avVincoli[0].valore);
          vincoliNoti = (vc.categories || []).filter((c) => c.attiva !== false).map(
            (c) => `[${c.icona || "\u{1F4CC}"} ${c.nome}]
` + (c.regole || []).filter((r) => r.testo).map((r) => `- ${r.testo}`).join("\n")
          ).join("\n\n");
        }
      } catch {
      }
      const summary = {
        total_tecnici: avTecnici.length,
        ferie_days: avRich.filter((r) => r.tipo === "ferie").length,
        malattia_days: avRich.filter((r) => r.tipo === "malattia").length,
        permessi: avRich.filter((r) => !["ferie", "malattia"].includes(r.tipo)).length,
        trasferte: avTras.length,
        installazioni: avInst.length,
        tagliandi_scaduti: tagliandiPendenti.filter((t) => t.urgenza === "SCADUTO").length,
        tagliandi_urgenti: tagliandiPendenti.filter((t) => t.urgenza === "URGENTE").length,
        urgenze_aperte: avUrg.length,
        piano_esistenti: avPiano.length
      };
      return ok(pascalizeArrays({
        mese: avMese,
        tecnici,
        tagliandi_pendenti: tagliandiPendenti,
        urgenze_aperte: avUrg,
        vincoli_noti: vincoliNoti,
        summary
      }));
    }
    // ──────── APPROVAL WORKFLOW ─────────────────────────────────────
    case "createApproval": {
      const adminErr2 = await requireAdmin(env, body);
      if (adminErr2) return err(adminErr2, 403);
      const aprId = body.id || secureId("APR");
      const pianoData2 = body.piano;
      if (!pianoData2) return err("Piano mancante");
      const aprKey = `approval_${aprId}`;
      const aprVal = JSON.stringify({
        id: aprId,
        stato: "in_attesa",
        piano: pianoData2,
        mese: body.mese || "",
        creato_da: body.creato_da || body.userId || "admin",
        data_creazione: body.data_creazione || (/* @__PURE__ */ new Date()).toISOString(),
        approvato_da: null,
        note_approvazione: null,
        data_approvazione: null,
        modifiche_approvatore: null
      });
      try {
        await sb(env, "config", "POST", { chiave: aprKey, valore: aprVal, tenant_id: TENANT }, "");
      } catch (e1) {
        try {
          await sb(env, `config?chiave=eq.${aprKey}`, "PATCH", { valore: aprVal }, "");
        } catch (e2) {
          return err(`createApproval failed \u2014 Insert: ${e1.message} | Patch: ${e2.message}`);
        }
      }
      return ok({ id: aprId, stato: "in_attesa" });
    }
    case "getApprovals": {
      const rows = await sb(
        env,
        "config",
        "GET",
        null,
        `?chiave=like.approval_APR_%25&limit=50`
      );
      const filter = body.filter || "";
      let approvals = (rows || []).map((r) => {
        try {
          return JSON.parse(r.valore);
        } catch {
          return null;
        }
      }).filter(Boolean);
      if (filter) approvals = approvals.filter((a) => a.stato === filter);
      const utenti = await sb(env, "utenti", "GET", null, "?select=id,nome,cognome&limit=100");
      const nameMap = {};
      (utenti || []).forEach((u) => {
        nameMap[u.id] = `${u.nome} ${u.cognome}`;
      });
      approvals.forEach((a) => {
        a.creato_da_nome = nameMap[a.creato_da] || a.creato_da;
        a.approvato_da_nome = a.approvato_da ? nameMap[a.approvato_da] || a.approvato_da : null;
      });
      return ok(approvals);
    }
    case "getApproval": {
      const aId = body.id;
      if (!aId) return err("ID approvazione mancante");
      const rows = await sb(env, "config", "GET", null, `?chiave=eq.approval_${aId}&limit=1`);
      if (!rows?.length) return err("Approvazione non trovata", 404);
      try {
        return ok(JSON.parse(rows[0].valore));
      } catch {
        return err("Dati corrotti");
      }
    }
    case "updateApproval": {
      const uId = body.id;
      if (!uId) return err("ID mancante");
      const rows = await sb(env, "config", "GET", null, `?chiave=eq.approval_${uId}&limit=1`);
      if (!rows?.length) return err("Non trovata", 404);
      let data;
      try {
        data = JSON.parse(rows[0].valore);
      } catch {
        return err("Dati corrotti");
      }
      if (body.stato) data.stato = body.stato;
      if (body.approvato_da) data.approvato_da = body.approvato_da;
      if (body.note_approvazione !== void 0) data.note_approvazione = body.note_approvazione;
      if (body.data_approvazione) data.data_approvazione = body.data_approvazione;
      if (body.piano) data.piano = body.piano;
      if (body.modifiche_approvatore) data.modifiche_approvatore = body.modifiche_approvatore;
      await sb(env, `config?chiave=eq.approval_${uId}`, "PATCH", { valore: JSON.stringify(data) });
      return ok(data);
    }
    case "notifyPlanApproved": {
      const aprId = body.approval_id;
      if (!aprId) return err("ID mancante");
      const rows = await sb(env, "config", "GET", null, `?chiave=eq.approval_${aprId}&limit=1`);
      if (!rows?.length) return ok({ notified: false });
      let data;
      try {
        data = JSON.parse(rows[0].valore);
      } catch {
        return ok({ notified: false });
      }
      if (data.stato !== "approvato") return ok({ notified: false });
      if (env.TELEGRAM_BOT_TOKEN) {
        const msg = `\u2705 *Piano Mensile Approvato*

\u{1F4C5} Mese: ${data.mese || "?"}
\u{1F464} Approvato da: ${data.approvato_da || "?"}
\u{1F4CB} ${(data.piano?.piano || []).length} interventi

Il piano \xE8 stato applicato al sistema.`;
        const tgUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(tgUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID || "-5236723213", text: msg, parse_mode: "Markdown" })
        }).catch(() => {
        });
      }
      return ok({ notified: true });
    }
    case "backupNow": {
      const [piano, urgenze, ordini] = await Promise.all([
        sb(env, "piano", "GET", null, "?obsoleto=eq.false&order=created_at.desc&limit=1000"),
        sb(env, "urgenze", "GET", null, "?obsoleto=eq.false&stato=in.(aperta,assegnata,in_corso)"),
        sb(env, "ordini", "GET", null, "?obsoleto=eq.false&stato=in.(richiesto,preso_in_carico,ordinato)")
      ]);
      const id = secureId("BAK");
      await sb(env, "kpi_snapshot", "POST", {
        id,
        tipo_snapshot: "backup",
        data: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        ora: (/* @__PURE__ */ new Date()).toTimeString().split(" ")[0],
        dati: { piano_count: piano.length, urgenze_aperte: urgenze.length, ordini_attivi: ordini.length }
      });
      return ok({ backupId: id, piano: piano.length, urgenze: urgenze.length, ordini: ordini.length });
    }
    case "setupWebhook": {
      const { webhookUrl } = body;
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const data = await res.json();
      return ok({ telegram: data });
    }
    case "removeWebhook": {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteWebhook`);
      const data = await res.json();
      return ok({ telegram: data });
    }
    // -------- TIPI INTERVENTO (Service Types) --------
    case "getServiceTypes": {
      const types = await sb(env, "tipi_intervento", "GET", null, "?attivo=eq.true&order=nome");
      return ok(types.map(pascalizeRecord));
    }
    // -------- FURGONI MANAGEMENT --------
    case "getFurgoni": {
      const furgoni = await sb(env, "automezzi", "GET", null, "?obsoleto=eq.false&order=descrizione");
      return ok(furgoni.map(pascalizeRecord));
    }
    case "swapFurgone": {
      const { tecnico1_id, tecnico2_id, data, note_swap } = body;
      if (!tecnico1_id || !tecnico2_id || !data) return err("Serve tecnico1_id, tecnico2_id, data");
      const t1arr = await sb(env, "utenti", "GET", null, `?id=eq.${tecnico1_id}&select=id,nome,automezzo_id`).catch(() => []);
      const t2arr = await sb(env, "utenti", "GET", null, `?id=eq.${tecnico2_id}&select=id,nome,automezzo_id`).catch(() => []);
      const t1 = t1arr?.[0], t2 = t2arr?.[0];
      if (!t1 || !t2) return err("Tecnici non trovati");
      await sb(env, `piano?data=eq.${data}&tecnico_id=eq.${tecnico1_id}&obsoleto=eq.false`, "PATCH", { automezzo_id: t2.automezzo_id });
      await sb(env, `piano?data=eq.${data}&tecnico_id=eq.${tecnico2_id}&obsoleto=eq.false`, "PATCH", { automezzo_id: t1.automezzo_id });
      return ok({ swap: `${t1.nome}(${t1.automezzo_id}) \u2194 ${t2.nome}(${t2.automezzo_id})`, data });
    }
    case "assignFurgone": {
      const { tecnicoId, furgoneId, dataAssegna } = body;
      if (!tecnicoId || !furgoneId) return err("Serve tecnicoId e furgoneId");
      if (dataAssegna) {
        await sb(env, `piano?data=eq.${dataAssegna}&tecnico_id=eq.${tecnicoId}&obsoleto=eq.false`, "PATCH", { automezzo_id: furgoneId });
      } else {
        await sb(env, `automezzi?assegnatario_id=eq.${tecnicoId}`, "PATCH", { assegnatario_id: null });
        await sb(env, `automezzi?id=eq.${furgoneId}`, "PATCH", { assegnatario_id: tecnicoId });
        await sb(env, `utenti?id=eq.${tecnicoId}`, "PATCH", { automezzo_id: furgoneId });
      }
      return ok({ tecnicoId, furgoneId, data: dataAssegna || "permanente" });
    }
    // -------- SEARCH CLIENTI (by nome_interno) --------
    case "searchClienti": {
      const { q } = body;
      if (!q || q.length < 2) return err("Minimo 2 caratteri");
      const sq = sanitizePgFilter(q);
      if (!sq) return err("Ricerca non valida");
      const results = await sb(
        env,
        "anagrafica_clienti",
        "GET",
        null,
        `?or=(nome_interno.ilike.*${sq}*,nome_account.ilike.*${sq}*)&select=codice_m3,nome_account,nome_interno&limit=20`
      );
      return ok(results.map(pascalizeRecord));
    }
    // -------- TELEGRAM BOT (webhook) --------
    case "telegramWebhook": {
      const update = body;
      console.log("[TG-WEBHOOK] Ricevuto update:", JSON.stringify({ msg_id: update.message?.message_id, from: update.message?.from?.first_name, chat_id: update.message?.chat?.id, text: (update.message?.text || "").substring(0, 50) }));
      if (!update.message && !update.callback_query) return ok();
      try {
        if (update.callback_query) {
          const cb = update.callback_query;
          const cbChatId = cb.message?.chat?.id;
          const cbData = cb.data || "";
          try {
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cb.id })
            });
            const [cbAction] = cbData.split(":");
            if (cbAction === "cancel") {
              await sendTelegram(env, cbChatId, "\u274C Azione annullata.");
            }
          } catch (e) {
            console.error("CB error:", e.message);
          }
          return ok();
        }
        const msg = update.message;
        const chatId = msg.chat.id;
        const fromId = msg.from?.id || null;
        const text = msg.text || msg.caption || "";
        const parts = text.split(" ");
        const cmd = parts[0]?.toLowerCase() || "";
        let utente = null;
        if (fromId) {
          const byChatId = await sb(env, "utenti", "GET", null, `?telegram_chat_id=eq.${fromId}&attivo=eq.true&obsoleto=eq.false`).catch(() => []);
          utente = byChatId[0] || null;
        }
        if (!utente) {
          const firstName = (msg.from?.first_name || "").toLowerCase();
          const lastName = (msg.from?.last_name || "").toLowerCase();
          if (firstName) {
            const allUtenti = await sb(env, "utenti", "GET", null, "?attivo=eq.true&obsoleto=eq.false&select=id,nome,cognome,ruolo,telegram_chat_id").catch(() => []);
            utente = allUtenti.find((u) => (u.nome || "").toLowerCase() === firstName && (!lastName || (u.cognome || "").toLowerCase().startsWith(lastName))) || null;
            if (utente && fromId) {
              await sb(env, `utenti?id=eq.${utente.id}`, "PATCH", { telegram_chat_id: String(fromId) }).catch((e) => console.error("[SYNC]", e.message));
            }
          }
        }
        if (text) {
          try {
            const senderNameEarly = (msg.from?.first_name || "") + (msg.from?.last_name ? " " + msg.from.last_name : "");
            const earlyMsgId = secureId("TG");
            const urgKwEarly = ["urgenza", "fermo", "guasto", "errore", "rotto", "emergenza", "allarme"];
            const isUrgEarly = urgKwEarly.some((k) => text.toLowerCase().includes(k));
            const earlyCanale = isUrgEarly ? "CH_URGENZE" : "CH_GENERALE";
            await sb(env, "chat_messaggi", "POST", {
              id: earlyMsgId,
              canale_id: earlyCanale,
              mittente_id: utente?.id || "TELEGRAM",
              testo: `\u{1F4F1} [TG - ${senderNameEarly}] ${text}`,
              tipo: "testo",
              created_at: (/* @__PURE__ */ new Date()).toISOString()
            }).catch((e) => console.error("Early mirror save error:", e.message));
          } catch (e) {
            console.error("Early mirror error:", e.message);
          }
        }
        if (!utente && cmd === "/start") {
          const firstName = (msg.from?.first_name || "").toLowerCase();
          const lastName = (msg.from?.last_name || "").toLowerCase();
          if (firstName && fromId) {
            const allU = await sb(env, "utenti", "GET", null, "?attivo=eq.true&obsoleto=eq.false&select=id,nome,cognome,ruolo").catch(() => []);
            const match = allU.find((u) => (u.nome || "").toLowerCase() === firstName && (!lastName || (u.cognome || "").toLowerCase().startsWith(lastName)));
            if (match) {
              await sb(env, `utenti?id=eq.${match.id}`, "PATCH", { telegram_chat_id: String(fromId) }).catch(() => {
              });
              utente = match;
              console.log(`[TG] Auto-registrato ${match.id} (${firstName}) con chat_id=${fromId}`);
            }
          }
        }
        if (!utente && cmd !== "/start") {
          const nome = msg.from?.first_name || "utente";
          await sendTelegram(env, chatId, `\u274C Ciao ${nome}, non ti trovo nel sistema.

Prova con /start oppure chiedi all'admin di aggiungere il tuo Telegram ID (${fromId}) nel profilo Syntoniqa.`);
          return ok();
        }
        async function getTelegramFileUrl(fileId) {
          const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
          const d = await res.json();
          return d.ok ? `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${d.result.file_path}` : null;
        }
        __name(getTelegramFileUrl, "getTelegramFileUrl");
        async function sendTelegramWithButtons(chatId2, text2, buttons) {
          const htmlText = text2.replace(/\*([^*\n]+)\*/g, "<b>$1</b>").replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/_([^_\n]+)_/g, "<i>$1</i>");
          return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId2,
              text: htmlText,
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: buttons }
            })
          }).then((r) => r.json()).catch(() => null);
        }
        __name(sendTelegramWithButtons, "sendTelegramWithButtons");
        async function loadPartsCatalog(env2, macchina) {
          try {
            let filter = "?select=codice,nome,descrizione,gruppo,modello_macchina&attivo=eq.true&limit=60";
            if (macchina) {
              const m = macchina.toLowerCase();
              const modelMap = { astronaut: "ASTRONAUT", vector: "VECTOR", juno: "JUNO", discovery: "DISCOVERY", calm: "CALM", grazeway: "GRAZEWAY", cosmix: "COSMIX" };
              const model = Object.entries(modelMap).find(([k]) => m.includes(k));
              if (model) filter += `&modello_macchina=ilike.*${sanitizePgFilter(model[1])}*`;
            }
            const parti = await sb(env2, "tagliandi", "GET", null, filter).catch(() => []);
            if (!parti.length) return "";
            const grouped = {};
            for (const p of parti) {
              const g = p.gruppo || "Generale";
              if (!grouped[g]) grouped[g] = [];
              if (grouped[g].length < 8) grouped[g].push(`${p.codice || "?"} \u2014 ${(p.nome || p.descrizione || "").substring(0, 50)}`);
            }
            let txt = "\nCATALOGO RICAMBI LELY (usa questi codici se riconosci il pezzo):";
            for (const [g, items] of Object.entries(grouped)) {
              txt += `
[${g}]: ${items.join(" | ")}`;
            }
            return txt;
          } catch {
            return "";
          }
        }
        __name(loadPartsCatalog, "loadPartsCatalog");
        async function matchPartInCatalog(env2, descrizione) {
          if (!descrizione) return null;
          const terms = descrizione.toLowerCase().split(/[\s,;]+/).filter((t) => t.length > 3);
          if (!terms.length) return null;
          const codeMatch = descrizione.match(/\d+\.\d{4}\.\d{4}\.\d+/);
          if (codeMatch) {
            const exact = await sb(env2, "tagliandi", "GET", null, `?codice=eq.${codeMatch[0]}&attivo=eq.true&limit=1`).catch(() => []);
            if (exact.length) return exact[0];
          }
          for (const term of terms.slice(0, 3)) {
            const safeTerm = sanitizePgFilter(term);
            if (!safeTerm) continue;
            const found = await sb(env2, "tagliandi", "GET", null, `?or=(nome.ilike.*${safeTerm}*,descrizione.ilike.*${safeTerm}*)&attivo=eq.true&limit=3`).catch(() => []);
            if (found.length) return found[0];
          }
          return null;
        }
        __name(matchPartInCatalog, "matchPartInCatalog");
        async function aiParseMessage(text2, mediaUrl2, mediaType2) {
          if (!env.AI) return null;
          const clienti = await sb(env, "anagrafica_clienti", "GET", null, "?select=codice_m3,nome_account,nome_interno&limit=300").catch(() => []);
          const clientiList = clienti.map((c) => `${c.nome_interno || c.nome_account} \u2192 codice_m3: ${c.codice_m3}`).join("\n");
          const isPhoto = mediaUrl2 && mediaType2 === "photo";
          const macchinaHint = (text2 || "").match(/astronaut|vector|juno|discovery|calm|grazeway|cosmix/i)?.[0] || null;
          const partiCatalogo = isPhoto ? await loadPartsCatalog(env, macchinaHint) : "";
          const systemPrompt = `Sei l'assistente AI di Syntoniqa, il sistema FSM di ${brand(env).shortName}.
Analizza il messaggio e determina il tipo di azione da creare.

CLIENTI DISPONIBILI (usa il NOME INTERNO per riconoscerli, es. BONDIOLI, OREFICI, ecc.):
${clientiList}

TIPI DI AZIONE:
1. "urgenza" - Problema tecnico urgente su un robot/macchina (robot fermo, errore, guasto)
2. "ordine" - Richiesta ricambi (codici tipo X.XXXX.XXXX.X, quantit\xE0, destinazione)
3. "intervento" - Intervento programmato (manutenzione, service, installazione)
4. "nota" - Informazione generica, aggiornamento stato, nessuna azione specifica

CODICI RICAMBI LELY: formato X.XXXX.XXXX.X (es. 9.1189.0283.0)
${partiCatalogo}
${isPhoto ? "\nIMPORTANTE: Analizza la foto attentamente. Identifica il componente, eventuali danni, usura, rotture. Suggerisci il codice ricambio dal catalogo sopra se riconoscibile." : ""}

Rispondi SOLO con JSON valido:
{
  "tipo": "urgenza|ordine|intervento|nota",
  "cliente": "nome cliente pi\xF9 probabile o null",
  "codice_m3": "codice M3 del cliente o null",
  "problema": "descrizione sintetica del problema",
  "macchina": "tipo macchina (Astronaut/Juno/Vector/Discovery/etc) o null",
  "robot_id": "numero robot (101-108) o null",
  "priorita": "alta|media|bassa",
  "ricambi": [{"codice":"X.XXXX.XXXX.X","quantita":1,"descrizione":"..."}] o [],
  "danno_visibile": "descrizione danno visibile nella foto o null",
  "componente_identificato": "nome del componente identificato nella foto o null",
  "note": "eventuali note aggiuntive"
}`;
          if (isPhoto) {
            try {
              const imgRes = await fetch(mediaUrl2);
              const imgBuf = await imgRes.arrayBuffer();
              const imgBytes = [...new Uint8Array(imgBuf)];
              const visionRes = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", {
                image: imgBytes,
                prompt: systemPrompt + "\n\nMESSAGGIO UTENTE: " + (text2 || "Analizza questa foto di un guasto/macchina. Identifica il componente danneggiato e suggerisci il ricambio."),
                max_tokens: 768
              });
              const raw = (visionRes.description || visionRes.response || "").replace(/```json\n?|\n?```/g, "").trim();
              try {
                const parsed = JSON.parse(raw);
                if (parsed.ricambi?.length) {
                  for (let i = 0; i < parsed.ricambi.length; i++) {
                    const r = parsed.ricambi[i];
                    const match = await matchPartInCatalog(env, r.codice || r.descrizione);
                    if (match) {
                      parsed.ricambi[i] = { codice: match.codice, quantita: r.quantita || 1, descrizione: match.nome || match.descrizione, _verificato: true };
                    }
                  }
                }
                if (parsed.componente_identificato && (!parsed.ricambi || !parsed.ricambi.length)) {
                  const match = await matchPartInCatalog(env, parsed.componente_identificato);
                  if (match) {
                    parsed.ricambi = [{ codice: match.codice, quantita: 1, descrizione: match.nome || match.descrizione, _verificato: true }];
                  }
                }
                return parsed;
              } catch {
                console.error("Vision parse error, raw:", raw);
              }
            } catch (e) {
              console.error("Vision AI error:", e.message);
            }
          }
          try {
            const aiRes = await env.AI.run("@cf/meta/llama-3.1-70b-instruct", {
              messages: [
                { role: "system", content: "Rispondi SOLO con JSON valido, nessun testo extra." },
                { role: "user", content: systemPrompt + "\n\nMESSAGGIO UTENTE: " + text2 }
              ],
              max_tokens: 1024
            });
            const raw = (aiRes.response || "").replace(/```json\n?|\n?```/g, "").trim();
            try {
              const parsed = JSON.parse(raw);
              if (parsed.ricambi?.length) {
                for (let i = 0; i < parsed.ricambi.length; i++) {
                  const match = await matchPartInCatalog(env, parsed.ricambi[i].codice || parsed.ricambi[i].descrizione);
                  if (match) parsed.ricambi[i] = { codice: match.codice, quantita: parsed.ricambi[i].quantita || 1, descrizione: match.nome || match.descrizione, _verificato: true };
                }
              }
              return parsed;
            } catch {
              console.error("AI parse error, raw:", raw);
              return null;
            }
          } catch (aiErr) {
            try {
              const aiRes = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
                messages: [
                  { role: "system", content: "Rispondi SOLO con JSON valido, nessun testo extra." },
                  { role: "user", content: systemPrompt + "\n\nMESSAGGIO UTENTE: " + text2 }
                ],
                max_tokens: 1024
              });
              const raw = (aiRes.response || "").replace(/```json\n?|\n?```/g, "").trim();
              try {
                return JSON.parse(raw);
              } catch {
                return null;
              }
            } catch {
              return null;
            }
          }
        }
        __name(aiParseMessage, "aiParseMessage");
        let mediaUrl = null, mediaType = null, fileName = null;
        if (msg.photo && msg.photo.length) {
          const photo = msg.photo[msg.photo.length - 1];
          mediaUrl = await getTelegramFileUrl(photo.file_id);
          mediaType = "photo";
        } else if (msg.document) {
          mediaUrl = await getTelegramFileUrl(msg.document.file_id);
          mediaType = "document";
          fileName = msg.document.file_name || "file";
        } else if (msg.video) {
          mediaUrl = await getTelegramFileUrl(msg.video.file_id);
          mediaType = "video";
        } else if (msg.voice || msg.audio) {
          const audio = msg.voice || msg.audio;
          mediaUrl = await getTelegramFileUrl(audio.file_id);
          mediaType = "audio";
        }
        let reply = "";
        switch (cmd) {
          case "/start": {
            const regStatus = utente ? `\u2705 *Registrato come:* ${utente.nome || ""} ${utente.cognome || ""} (${utente.ruolo || ""})

` : `\u26A0\uFE0F Non ti ho trovato nel sistema. Chiedi all'admin di aggiungere il tuo Telegram ID: \`${fromId}\`

`;
            reply = `\u{1F44B} *Benvenuto in Syntoniqa ${brand(env).shortName}!*

${regStatus}\u{1F6A8} *SEGNALARE UN PROBLEMA:*
Scrivi direttamente il problema, es:
"Bondioli robot fermo errore laser"
"Da Rossi A5 non munge, codice 45"
\u2192 L'AI crea l'urgenza automaticamente!

\u{1F4F7} *INVIA UNA FOTO:*
Foto del guasto \u2192 l'AI identifica il problema

\u26A1 *COMANDI RAPIDI:*
/stato \u2014 Urgenze aperte
/vado \u2014 Prendi un'urgenza
/oggi \u2014 Interventi di oggi
/help \u2014 Tutti i comandi

\u{1F4A1} Non servono comandi speciali: scrivi e basta!`;
            break;
          }
          case "/help":
            reply = `\u{1F4CB} *Comandi Syntoniqa ${brand(env).shortName}*

\u{1F4A1} *COSA PIU' IMPORTANTE:*
Per segnalare un problema NON serve nessun comando.
Scrivi direttamente il messaggio e l'AI crea l'urgenza!

Esempi di testo libero:
\u2022 "Bondioli 102 fermo errore laser"
\u2022 "Da Rossi il robot non munge"
\u2022 "Serve intervento urgente da Bianchi"
\u2022 Oppure manda una FOTO del guasto!

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

\u{1F6A8} *GESTIRE URGENZE:*
/stato \u2192 Elenco urgenze aperte
/vado \u2192 Mostra urgenze disponibili
/vado 2 \u2192 Prendi l'urgenza n.2
/incorso \u2192 Segna "sono arrivato, lavoro"
/risolto note \u2192 Chiudi (es: /risolto sostituito laser)

\u{1F4C5} *VEDERE IL PIANO:*
/oggi \u2192 I tuoi interventi di oggi
/settimana \u2192 Piano della settimana

\u{1F4E6} *ORDINARE RICAMBI:*
/ordine codice qt cliente
Es: /ordine 1234567 2 Bondioli`;
            break;
          case "/stato": {
            const urg = await sb(env, "urgenze", "GET", null, "?stato=in.(aperta,assegnata,in_corso)&order=data_segnalazione.desc&limit=10");
            if (!urg.length) {
              reply = "\u2705 Nessuna urgenza attiva";
              break;
            }
            const cliIds4 = [...new Set(urg.map((u) => u.cliente_id).filter(Boolean))];
            const cliNames4 = {};
            for (const cid of cliIds4) {
              cliNames4[cid] = await getEntityName(env, "clienti", cid);
            }
            const statoEmoji = { aperta: "\u{1F534}", assegnata: "\u{1F7E1}", in_corso: "\u{1F7E2}" };
            reply = `\u{1F6A8} *${urg.length} urgenze attive:*
` + urg.map((u) => {
              const cli = cliNames4[u.cliente_id] || u.cliente_id || "?";
              return `${statoEmoji[u.stato] || "\u26AA"} *${cli}*: ${u.problema || "N/D"} [${u.stato}]`;
            }).join("\n");
            break;
          }
          case "/oggi": {
            const oggi = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
            const intv = await sb(env, "piano", "GET", null, `?data=eq.${oggi}&tecnico_id=eq.${utente.id}&obsoleto=eq.false`);
            if (!intv.length) {
              reply = "\u{1F4C5} Nessun intervento programmato oggi";
              break;
            }
            const cliIds5 = [...new Set(intv.map((i) => i.cliente_id).filter(Boolean))];
            const cliNames5 = {};
            for (const cid of cliIds5) {
              cliNames5[cid] = await getEntityName(env, "clienti", cid);
            }
            reply = `\u{1F4C5} *Interventi oggi (${intv.length}):*
` + intv.map((i) => {
              const cli = cliNames5[i.cliente_id] || i.cliente_id || "?";
              const tipo = i.tipo_intervento_id === "TAGLIANDO" ? "\u{1F527}" : "\u{1F4CB}";
              return `${tipo} *${cli}* \u2014 ${i.stato} ${i.note ? "(" + i.note.substring(0, 40) + ")" : ""}`;
            }).join("\n");
            break;
          }
          case "/settimana": {
            const oggi = /* @__PURE__ */ new Date();
            const lun = new Date(oggi);
            lun.setDate(oggi.getDate() - oggi.getDay() + 1);
            const dom = new Date(lun);
            dom.setDate(lun.getDate() + 6);
            const intv = await sb(env, "piano", "GET", null, `?data=gte.${lun.toISOString().split("T")[0]}&data=lte.${dom.toISOString().split("T")[0]}&tecnico_id=eq.${utente.id}&obsoleto=eq.false&order=data.asc`);
            if (!intv.length) {
              reply = "\u{1F4C5} Nessun intervento questa settimana";
              break;
            }
            const cliIds6 = [...new Set(intv.map((i) => i.cliente_id).filter(Boolean))];
            const cliNames6 = {};
            for (const cid of cliIds6) {
              cliNames6[cid] = await getEntityName(env, "clienti", cid);
            }
            const dayNames = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
            const byDay = {};
            intv.forEach((i) => {
              const d = i.data;
              if (!byDay[d]) byDay[d] = [];
              byDay[d].push(i);
            });
            reply = `\u{1F4C5} *Piano settimanale (${intv.length} interventi):*
` + Object.entries(byDay).map(([d, items]) => {
              const dayN = dayNames[(/* @__PURE__ */ new Date(d + "T00:00:00")).getDay()];
              return `
*${dayN} ${d.slice(5)}:*
` + items.map((i) => {
                const cli = cliNames6[i.cliente_id] || i.cliente_id || "?";
                return `  \u2022 ${cli} \u2014 ${i.stato}`;
              }).join("\n");
            }).join("");
            break;
          }
          case "/vado": {
            const urgList = await sb(env, "urgenze", "GET", null, "?stato=eq.aperta&order=priorita.asc,data_segnalazione.asc&limit=5");
            if (!urgList.length) {
              reply = "\u2705 Nessuna urgenza da prendere in carico";
              break;
            }
            const cliIds7 = [...new Set(urgList.map((u) => u.cliente_id).filter(Boolean))];
            const cliNames7 = {};
            for (const cid of cliIds7) {
              cliNames7[cid] = await getEntityName(env, "clienti", cid);
            }
            const scelta = parseInt(parts[1]);
            if (!scelta || scelta < 1 || scelta > urgList.length) {
              reply = `\u{1F6A8} *Urgenze aperte (${urgList.length}):*

` + urgList.map((u, i) => {
                const cli = cliNames7[u.cliente_id] || u.cliente_id || "?";
                return `*${i + 1}.* \u{1F3E0} ${cli}
   ${u.problema || "N/D"} \u2013 P${u.priorita || "?"}
   \u{1F4C5} ${u.data_segnalazione?.split("T")[0] || "?"}`;
              }).join("\n\n") + `

\u{1F449} Rispondi */vado N* per prendere (es: /vado 1)`;
              break;
            }
            const picked = urgList[scelta - 1];
            const pickedCli = cliNames7[picked.cliente_id] || picked.cliente_id || "?";
            await sb(env, `urgenze?id=eq.${picked.id}`, "PATCH", { stato: "assegnata", tecnico_assegnato: utente.id, data_assegnazione: (/* @__PURE__ */ new Date()).toISOString() });
            reply = `\u2705 Urgenza *${picked.id}* assegnata a te!
\u{1F3E0} Cliente: ${pickedCli}
\u{1F4CB} Problema: ${picked.problema}`;
            await sendTelegramNotification(env, "urgenza_assegnata", { id: picked.id, tecnicoAssegnato: utente.id });
            break;
          }
          case "/incorso": {
            const urg = await sb(env, "urgenze", "GET", null, `?tecnico_assegnato=eq.${utente.id}&stato=eq.assegnata&limit=1`);
            if (!urg.length) {
              reply = "Nessuna urgenza assegnata";
              break;
            }
            await sb(env, `urgenze?id=eq.${urg[0].id}`, "PATCH", { stato: "in_corso", data_inizio: (/* @__PURE__ */ new Date()).toISOString() });
            reply = `\u{1F527} Urgenza *${urg[0].id}* segnata come IN CORSO`;
            break;
          }
          case "/risolto": {
            const note = parts.slice(1).join(" ");
            const urg = await sb(env, "urgenze", "GET", null, `?tecnico_assegnato=eq.${utente.id}&stato=in.(assegnata,in_corso)&limit=1`);
            if (!urg.length) {
              reply = "Nessuna urgenza in corso";
              break;
            }
            await sb(env, `urgenze?id=eq.${urg[0].id}`, "PATCH", { stato: "risolta", data_risoluzione: (/* @__PURE__ */ new Date()).toISOString(), note });
            reply = `\u2705 Urgenza *${urg[0].id}* RISOLTA${note ? "\nNote: " + note : ""}`;
            break;
          }
          case "/ordine": {
            const codice = parts[1] || "";
            const qt = parseInt(parts[2]) || 1;
            const cliente = parts.slice(3).join(" ") || "non specificato";
            if (!codice || !/^\d\.\d{4}\.\d{4}\.\d$/.test(codice)) {
              reply = "\u{1F4E6} Formato: /ordine [codice] [quantit\xE0] [cliente]\nEs: /ordine 9.1189.0283.0 2 Bondioli";
              break;
            }
            const ordId = secureId("ORD_TG");
            const ordTid = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
            await sb(env, "ordini", "POST", { id: ordId, tenant_id: ordTid, tecnico_id: utente?.id || null, codice, descrizione: `${codice} x${qt} - ${cliente}`, quantita: qt, stato: "richiesto", data_richiesta: (/* @__PURE__ */ new Date()).toISOString() });
            reply = `\u{1F4E6} Ordine *${ordId}* creato:
Codice: \`${codice}\` x${qt}
Cliente: ${cliente}`;
            break;
          }
          case "/servepezz": {
            const desc2 = parts.slice(1).join(" ");
            if (!desc2) {
              reply = "Usa: /servepezz [descrizione ricambio]";
              break;
            }
            const spId = secureId("ORD_TG");
            const spTid = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
            await sb(env, "ordini", "POST", { id: spId, tenant_id: spTid, tecnico_id: utente?.id || null, descrizione: desc2, stato: "richiesto", data_richiesta: (/* @__PURE__ */ new Date()).toISOString() });
            reply = `\u{1F4E6} Ordine ricambio *${spId}* creato:
_${desc2}_`;
            break;
          }
          // ═══════════════════════════════════════════════════════
          // ═══ NUOVI COMANDI SUPER-POTENTI ══════════════════════
          // ═══════════════════════════════════════════════════════
          case "/pianifica": {
            const dateArg = (parts[1] || "").toLowerCase();
            const clienteArg = parts[2] || "";
            const tipoArg = (parts[3] || "service").toLowerCase();
            const noteArg = parts.slice(4).join(" ");
            if (!dateArg || !clienteArg) {
              reply = `\u{1F4C5} *Pianifica intervento:*

\`/pianifica [data] [cliente] [tipo] [note]\`

Esempi:
\u2022 \`/pianifica domani Bondioli service\`
\u2022 \`/pianifica 2026-03-05 Rossi tagliando\`
\u2022 \`/pianifica lunedi Palladini ispezione\`

Tipi: service, tagliando, installazione, ispezione, urgenza`;
              break;
            }
            let targetDate;
            const nowD = /* @__PURE__ */ new Date();
            if (dateArg === "domani" || dateArg === "tomorrow") {
              targetDate = new Date(nowD);
              targetDate.setDate(targetDate.getDate() + 1);
            } else if (dateArg === "dopodomani") {
              targetDate = new Date(nowD);
              targetDate.setDate(targetDate.getDate() + 2);
            } else if (["lunedi", "luned\xEC", "monday"].includes(dateArg)) {
              targetDate = new Date(nowD);
              const d = targetDate.getDay();
              targetDate.setDate(targetDate.getDate() + ((1 - d + 7) % 7 || 7));
            } else if (["martedi", "marted\xEC", "tuesday"].includes(dateArg)) {
              targetDate = new Date(nowD);
              const d = targetDate.getDay();
              targetDate.setDate(targetDate.getDate() + ((2 - d + 7) % 7 || 7));
            } else if (["mercoledi", "mercoled\xEC", "wednesday"].includes(dateArg)) {
              targetDate = new Date(nowD);
              const d = targetDate.getDay();
              targetDate.setDate(targetDate.getDate() + ((3 - d + 7) % 7 || 7));
            } else if (["giovedi", "gioved\xEC", "thursday"].includes(dateArg)) {
              targetDate = new Date(nowD);
              const d = targetDate.getDay();
              targetDate.setDate(targetDate.getDate() + ((4 - d + 7) % 7 || 7));
            } else if (["venerdi", "venerd\xEC", "friday"].includes(dateArg)) {
              targetDate = new Date(nowD);
              const d = targetDate.getDay();
              targetDate.setDate(targetDate.getDate() + ((5 - d + 7) % 7 || 7));
            } else if (["sabato", "saturday"].includes(dateArg)) {
              targetDate = new Date(nowD);
              const d = targetDate.getDay();
              targetDate.setDate(targetDate.getDate() + ((6 - d + 7) % 7 || 7));
            } else {
              targetDate = new Date(dateArg);
            }
            if (isNaN(targetDate)) {
              reply = "\u274C Data non valida. Usa: domani, lunedi, 2026-03-05, etc.";
              break;
            }
            const dataStr = targetDate.toISOString().split("T")[0];
            const cliSearch = clienteArg.toLowerCase();
            const allCli = await sb(env, "anagrafica_clienti", "GET", null, "?select=codice_m3,nome_interno,nome_account&limit=300").catch(() => []);
            const matchCli = allCli.find((c) => (c.nome_interno || "").toLowerCase().includes(cliSearch) || (c.nome_account || "").toLowerCase().includes(cliSearch));
            const pId = secureId("INT_TG");
            const pTid = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
            await sb(env, "piano", "POST", {
              id: pId,
              tenant_id: pTid,
              tecnico_id: utente.id,
              cliente_id: matchCli?.codice_m3 || null,
              data: dataStr,
              stato: "pianificato",
              tipo_intervento: tipoArg,
              origine: "telegram",
              note: `${matchCli?.nome_interno || clienteArg} \u2014 ${tipoArg}${noteArg ? " \u2014 " + noteArg : ""}`,
              obsoleto: false,
              created_at: (/* @__PURE__ */ new Date()).toISOString(),
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            });
            const giorni = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
            reply = `\u{1F4C5} *Intervento pianificato!*

\u{1F4CB} ID: \`${pId}\`
\u{1F4C6} ${giorni[targetDate.getDay()]} ${dataStr}
\u{1F3E2} ${matchCli?.nome_interno || clienteArg}
\u{1F527} ${tipoArg}
\u{1F464} ${utente.nome} ${utente.cognome}${noteArg ? "\n\u{1F4DD} " + noteArg : ""}`;
            break;
          }
          case "/assegna": {
            const urgArg = parts[1] || "";
            const tecArg = parts.slice(2).join(" ") || "";
            if (!urgArg) {
              reply = `\u{1F3AF} *Assegna urgenza:*

\`/assegna [N o ID] [tecnico]\`

Esempi:
\u2022 \`/assegna 1 Giovanni\` (urgenza #1 dalla lista)
\u2022 \`/assegna URG_TG_xxx Anton\`

Prima usa /stato per vedere le urgenze.`;
              break;
            }
            if (!["admin", "caposquadra"].includes(utente.ruolo)) {
              reply = "\u274C Solo admin e caposquadra possono assegnare urgenze.";
              break;
            }
            let urgToAssign = null;
            const urgNum = parseInt(urgArg);
            if (!isNaN(urgNum) && urgNum > 0) {
              const urgL = await sb(env, "urgenze", "GET", null, "?stato=in.(aperta,assegnata)&order=priorita.asc,data_segnalazione.asc&limit=10");
              if (urgNum <= urgL.length) urgToAssign = urgL[urgNum - 1];
            } else {
              const urgById = await sb(env, "urgenze", "GET", null, `?id=eq.${urgArg}`).catch(() => []);
              urgToAssign = urgById[0] || null;
            }
            if (!urgToAssign) {
              reply = "\u274C Urgenza non trovata. Usa /stato per la lista.";
              break;
            }
            const tecSearch = tecArg.toLowerCase();
            const allTec = await sb(env, "utenti", "GET", null, "?attivo=eq.true&select=id,nome,cognome,ruolo").catch(() => []);
            const matchTec = allTec.find((t) => (t.nome || "").toLowerCase().includes(tecSearch) || (t.cognome || "").toLowerCase().includes(tecSearch));
            if (!matchTec) {
              reply = `\u274C Tecnico "${tecArg}" non trovato. Disponibili: ${allTec.filter((t) => t.ruolo !== "admin").map((t) => t.nome).join(", ")}`;
              break;
            }
            await sb(env, `urgenze?id=eq.${urgToAssign.id}`, "PATCH", {
              stato: "assegnata",
              tecnico_assegnato: matchTec.id,
              data_assegnazione: (/* @__PURE__ */ new Date()).toISOString()
            });
            reply = `\u{1F3AF} *Urgenza assegnata!*

\u{1F6A8} ${urgToAssign.id}
\u{1F4DD} ${(urgToAssign.problema || "").substring(0, 60)}
\u{1F464} \u2192 *${matchTec.nome} ${matchTec.cognome}*`;
            if (matchTec.telegram_chat_id) {
              await sendTelegram(env, matchTec.telegram_chat_id, `\u{1F6A8} *Urgenza assegnata a te!*

ID: \`${urgToAssign.id}\`
Problema: ${urgToAssign.problema}

Usa /incorso quando inizi.`);
            }
            break;
          }
          case "/disponibile": {
            const oggi2 = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
            const dispTipo = (parts[1] || "urgenze").toLowerCase();
            const dispId = secureId("INT_DISP");
            const dispTid = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
            await sb(env, "piano", "POST", {
              id: dispId,
              tenant_id: dispTid,
              tecnico_id: utente.id,
              data: oggi2,
              stato: "pianificato",
              tipo_intervento: "varie",
              note: `DISPONIBILE ${dispTipo.toUpperCase()} \u2014 slot libero per urgenze entranti`,
              origine: "telegram",
              obsoleto: false,
              created_at: (/* @__PURE__ */ new Date()).toISOString(),
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            });
            reply = `\u2705 *Sei disponibile per ${dispTipo} oggi!*

\u{1F4C5} ${oggi2}
\u{1F464} ${utente.nome} ${utente.cognome}
\u{1F514} Riceverai notifica se arriva un'urgenza.

Usa /vado per prenderne una.`;
            break;
          }
          case "/dove": {
            const oggiDove = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
            const allT = await sb(env, "utenti", "GET", null, "?attivo=eq.true&ruolo=neq.admin&select=id,nome,cognome,ruolo,base").catch(() => []);
            const oggiPiano = await sb(env, "piano", "GET", null, `?data=eq.${oggiDove}&obsoleto=eq.false&select=tecnico_id,cliente_id,stato,note,tipo_intervento`).catch(() => []);
            const oggiUrg = await sb(env, "urgenze", "GET", null, `?stato=in.(assegnata,in_corso)&select=tecnico_assegnato,problema,stato,cliente_id`).catch(() => []);
            const cliCache = await sb(env, "anagrafica_clienti", "GET", null, "?select=codice_m3,nome_interno&limit=300").catch(() => []);
            const cliName = /* @__PURE__ */ __name((id) => (cliCache.find((c) => c.codice_m3 === id) || {}).nome_interno || id || "?", "cliName");
            let doveText = `\u{1F4CD} *Posizione tecnici \u2014 ${oggiDove}*
`;
            for (const t of allT) {
              const interventi = oggiPiano.filter((p) => p.tecnico_id === t.id);
              const urgAtt = oggiUrg.find((u) => u.tecnico_assegnato === t.id);
              let status = "";
              if (urgAtt) {
                status = urgAtt.stato === "in_corso" ? `\u{1F534} IN CORSO: ${(urgAtt.problema || "").substring(0, 30)} @${cliName(urgAtt.cliente_id)}` : `\u{1F7E1} Urgenza assegnata: ${cliName(urgAtt.cliente_id)}`;
              } else if (interventi.length) {
                const isVarie = interventi.some((p) => (p.tipo_intervento || "").includes("varie") || (p.note || "").includes("DISPONIBILE"));
                const clienti = interventi.filter((p) => p.cliente_id).map((p) => cliName(p.cliente_id));
                status = isVarie ? "\u{1F7E2} Disponibile urgenze" : `\u{1F4CB} ${clienti.join(", ") || interventi[0]?.note?.substring(0, 30) || "?"}`;
              } else {
                status = "\u26AA Nessun intervento programmato";
              }
              const ruoloIco = t.ruolo === "caposquadra" ? "\u{1F451}" : t.ruolo?.includes("senior") ? "\u2B50" : "\u{1F464}";
              doveText += `
${ruoloIco} *${t.nome} ${(t.cognome || "").charAt(0)}.*  ${status}`;
            }
            reply = doveText;
            break;
          }
          case "/catalogo": {
            const searchTerm = parts.slice(1).join(" ").trim();
            if (!searchTerm) {
              reply = `\u{1F50D} *Catalogo Ricambi ${brand(env).shortName}*

\`/catalogo [ricerca]\`

Esempi:
\u2022 \`/catalogo laser\`
\u2022 \`/catalogo tilt sensor\`
\u2022 \`/catalogo 9.1189\`
\u2022 \`/catalogo milk pump\``;
              break;
            }
            const safeTerm = sanitizePgFilter(searchTerm);
            if (!safeTerm) {
              reply = "\u274C Termine di ricerca non valido";
              break;
            }
            const results = await sb(env, "tagliandi", "GET", null, `?or=(nome.ilike.*${safeTerm}*,descrizione.ilike.*${safeTerm}*,codice.ilike.*${safeTerm}*)&limit=8`).catch(() => []);
            if (!results.length) {
              const fallbackTerm = sanitizePgFilter(searchTerm.split(" ")[0]);
              const results2 = fallbackTerm ? await sb(env, "tagliandi", "GET", null, `?descrizione=ilike.*${fallbackTerm}*&limit=5`).catch(() => []) : [];
              if (results2.length) {
                reply = `\u{1F50D} Risultati parziali per "${searchTerm}":

` + results2.map((r) => `\u2022 \`${r.codice || r.id}\` \u2014 ${(r.nome || r.descrizione || "").substring(0, 50)}`).join("\n");
              } else {
                reply = `\u274C Nessun risultato per "${searchTerm}". Prova con un termine diverso.`;
              }
            } else {
              reply = `\u{1F50D} *Catalogo ${brand(env).shortName} \u2014 "${searchTerm}":*

` + results.map((r) => `\u{1F4E6} \`${r.codice || r.id}\`
   ${(r.nome || r.descrizione || "").substring(0, 60)}`).join("\n\n");
            }
            break;
          }
          case "/tagliando": {
            const cliTagArg = parts.slice(1).join(" ").trim();
            if (!cliTagArg) {
              reply = `\u{1F527} *Prossimi Tagliandi*

\`/tagliando [cliente]\` \u2014 Mostra tagliandi in scadenza
\`/tagliando tutti\` \u2014 Top 10 pi\xF9 urgenti

Es: \`/tagliando Bondioli\``;
              break;
            }
            let macFilter = "?obsoleto=eq.false&prossimo_tagliando=not.is.null&order=prossimo_tagliando.asc&limit=15";
            if (cliTagArg.toLowerCase() !== "tutti") {
              const safeCliArg = sanitizePgFilter(cliTagArg);
              const cliMatch = safeCliArg ? await sb(env, "anagrafica_clienti", "GET", null, `?nome_interno=ilike.*${safeCliArg}*&select=codice_m3,nome_interno&limit=5`).catch(() => []) : [];
              if (cliMatch.length) {
                macFilter += `&cliente_id=eq.${cliMatch[0].codice_m3}`;
              }
            }
            const macchine = await sb(env, "macchine", "GET", null, `${macFilter}&select=id,seriale,note,modello,tipo,cliente_id,prossimo_tagliando,ultimo_tagliando`).catch(() => []);
            if (!macchine.length) {
              reply = "\u2705 Nessun tagliando in scadenza" + (cliTagArg.toLowerCase() !== "tutti" ? ` per "${cliTagArg}"` : "");
              break;
            }
            const oggiTag = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
            reply = `\u{1F527} *Tagliandi in scadenza${cliTagArg.toLowerCase() !== "tutti" ? " \u2014 " + cliTagArg : ""}:*

`;
            for (const m of macchine.slice(0, 10)) {
              const gg = Math.round((new Date(m.prossimo_tagliando) - new Date(oggiTag)) / 864e5);
              const urgIco = gg < 0 ? "\u{1F534}" : gg <= 7 ? "\u{1F7E0}" : gg <= 30 ? "\u{1F7E1}" : "\u{1F7E2}";
              reply += `${urgIco} *${m.modello || m.tipo || m.seriale || "Robot"}* (${m.id})
   \u{1F4C5} ${m.prossimo_tagliando} (${gg < 0 ? Math.abs(gg) + "gg SCADUTO" : gg + "gg"})
`;
            }
            break;
          }
          case "/report": {
            const itFmtRep = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
            const oggiRep = itFmtRep.format(/* @__PURE__ */ new Date());
            const [oggiIntv, oggiUrgRep, oggiOrd, repToday] = await Promise.all([
              sb(env, "piano", "GET", null, `?data=eq.${oggiRep}&tecnico_id=eq.${utente.id}&obsoleto=eq.false&select=id,cliente_id,note,stato,ora_inizio,tipo_intervento_id&order=ora_inizio.asc`).catch(() => []),
              sb(env, "urgenze", "GET", null, `?tecnico_assegnato=eq.${utente.id}&data_segnalazione=gte.${oggiRep}T00:00:00&select=id,problema,stato,data_risoluzione,cliente_id`).catch(() => []),
              sb(env, "ordini", "GET", null, `?tecnico_id=eq.${utente.id}&data_richiesta=gte.${oggiRep}T00:00:00&select=id,descrizione,stato`).catch(() => []),
              sb(env, "reperibilita", "GET", null, `?tecnico_id=eq.${utente.id}&data_inizio=lte.${oggiRep}&data_fine=gte.${oggiRep}&obsoleto=eq.false&limit=1`).catch(() => [])
            ]);
            const completati = oggiIntv.filter((p) => p.stato === "completato").length;
            const inCorso = oggiIntv.filter((p) => p.stato === "in_corso").length;
            const pian = oggiIntv.filter((p) => p.stato === "pianificato").length;
            const tot = oggiIntv.length;
            const perc = tot > 0 ? Math.round(completati / tot * 100) : 0;
            const barFn = /* @__PURE__ */ __name((n) => {
              const filled = Math.min(Math.round(n / 10), 10);
              return "\u2593".repeat(filled) + "\u2591".repeat(10 - filled);
            }, "barFn");
            reply = `\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  \u{1F4CA}  *REPORT GIORNALIERO*  \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

`;
            reply += `\u{1F464} *${utente.nome} ${utente.cognome || ""}*
\u{1F4C5} ${oggiRep}${repToday.length ? "  \u2022  \u{1F4DE} REP " + (repToday[0].tipo || "") : ""}

`;
            reply += `\u2500\u2500 *Avanzamento* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
`;
            reply += `${barFn(perc)}  *${perc}%*

`;
            reply += `\u{1F4CB} *Interventi:* ${tot}
   \u2705 Completati: *${completati}*
   \u{1F504} In corso: *${inCorso}*
   \u{1F4C5} Da fare: *${pian}*

`;
            if (oggiIntv.length) {
              reply += `\u2500\u2500 *Dettaglio* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
`;
              for (const p of oggiIntv.slice(0, 8)) {
                const ico = p.stato === "completato" ? "\u2705" : p.stato === "in_corso" ? "\u{1F504}" : "\u23F3";
                reply += `${ico} \`${p.ora_inizio || "--:--"}\` ${(p.note || p.tipo_intervento_id || p.id).substring(0, 35)}
`;
              }
              reply += "\n";
            }
            if (oggiUrgRep.length) {
              reply += `\u2500\u2500 *Urgenze* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
`;
              reply += `\u{1F6A8} ${oggiUrgRep.length} gestite
`;
              for (const u of oggiUrgRep.slice(0, 5)) {
                const ico = u.stato === "risolta" || u.stato === "chiusa" ? "\u2705" : "\u{1F534}";
                reply += `   ${ico} ${(u.problema || "").substring(0, 35)}
`;
              }
              reply += "\n";
            }
            if (oggiOrd.length) {
              reply += `\u2500\u2500 *Ordini* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
`;
              reply += `\u{1F4E6} ${oggiOrd.length} richiesti
`;
              for (const o of oggiOrd.slice(0, 3)) reply += `   \u2022 ${(o.descrizione || "").substring(0, 35)}
`;
              reply += "\n";
            }
            reply += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
            reply += `_${brand(env).shortName} \xB7 Syntoniqa_`;
            break;
          }
          case "/kpi": {
            const oggi7 = /* @__PURE__ */ new Date();
            const settimanafa = new Date(oggi7);
            settimanafa.setDate(settimanafa.getDate() - 7);
            const da = settimanafa.toISOString().split("T")[0];
            const a = oggi7.toISOString().split("T")[0];
            const [intv7, urg7, ord7] = await Promise.all([
              sb(env, "piano", "GET", null, `?tecnico_id=eq.${utente.id}&data=gte.${da}&data=lte.${a}&obsoleto=eq.false&select=id,stato,data`).catch(() => []),
              sb(env, "urgenze", "GET", null, `?tecnico_assegnato=eq.${utente.id}&data_segnalazione=gte.${da}T00:00:00&select=id,stato,data_segnalazione,data_risoluzione`).catch(() => []),
              sb(env, "ordini", "GET", null, `?tecnico_id=eq.${utente.id}&data_richiesta=gte.${da}T00:00:00&select=id,stato`).catch(() => [])
            ]);
            const comp = intv7.filter((p) => p.stato === "completato").length;
            const totIntv = intv7.length;
            const urgRisolte = urg7.filter((u) => u.stato === "risolta" || u.stato === "chiusa").length;
            const compRate = totIntv > 0 ? Math.round(comp / totIntv * 100) : 0;
            const barFn2 = /* @__PURE__ */ __name((n) => {
              const filled = Math.min(Math.round(n / 10), 10);
              return "\u2593".repeat(filled) + "\u2591".repeat(10 - filled);
            }, "barFn2");
            const dailyStats = {};
            for (let d = new Date(settimanafa); d <= oggi7; d.setDate(d.getDate() + 1)) {
              const ds = d.toISOString().split("T")[0];
              const dayIntv = intv7.filter((p) => p.data === ds);
              const dayComp = dayIntv.filter((p) => p.stato === "completato").length;
              dailyStats[ds] = { total: dayIntv.length, completed: dayComp };
            }
            reply = `\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  \u{1F4CA}  *KPI SETTIMANALE*     \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

`;
            reply += `\u{1F464} *${utente.nome} ${utente.cognome || ""}*
\u{1F4C5} ${da} \u2192 ${a}

`;
            reply += `\u2500\u2500 *Performance* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
`;
            reply += `\u{1F4CB} Interventi totali: *${totIntv}*
`;
            reply += `\u2705 Completamento: *${compRate}%*
${barFn2(compRate)}

`;
            reply += `\u{1F6A8} Urgenze gestite: *${urg7.length}* (${urgRisolte} risolte)
`;
            reply += `\u{1F4E6} Ordini: *${ord7.length}*

`;
            reply += `\u2500\u2500 *Andamento* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
`;
            const giorniIt = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
            for (const [ds, st] of Object.entries(dailyStats)) {
              const dayName = giorniIt[(/* @__PURE__ */ new Date(ds + "T12:00:00")).getDay()];
              const miniBar = "\u2588".repeat(Math.min(st.completed, 6)) + "\u2591".repeat(Math.min(st.total - st.completed, 4));
              reply += `${dayName} ${ds.substring(8)}: ${miniBar} ${st.completed}/${st.total}
`;
            }
            const score = Math.round(compRate * 0.6 + urgRisolte / Math.max(urg7.length, 1) * 100 * 0.4);
            const scoreEmoji = score >= 80 ? "\u{1F7E2}" : score >= 50 ? "\u{1F7E1}" : "\u{1F534}";
            reply += `
\u2500\u2500 *Score* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
`;
            reply += `${scoreEmoji} *${score}/100* \u2014 ${score >= 80 ? "Eccellente!" : score >= 50 ? "Buono" : "Da migliorare"}

`;
            reply += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
            reply += `_${brand(env).shortName} \xB7 Syntoniqa_`;
            break;
          }
          default: {
            if (text.length < 3 && !mediaUrl) {
              reply = "\u{1F914} Messaggio troppo breve. Scrivi il problema o invia /help";
              break;
            }
            let mediaInfo = null;
            if (mediaUrl) {
              mediaInfo = { url: mediaUrl, type: mediaType, fileName, telegramFileId: msg.photo?.[msg.photo.length - 1]?.file_id || msg.document?.file_id || msg.video?.file_id || msg.voice?.file_id || null };
              if (!text && mediaType === "photo") {
                await sendTelegram(env, chatId, "\u{1F4F7} Foto ricevuta! Aggiungi una descrizione o la analizzo con AI...");
              }
              if (!text && mediaType === "document") {
                await sendTelegram(env, chatId, `\u{1F4C4} Documento *${fileName}* ricevuto! Aggiungi una descrizione oppure lo salvo come allegato.`);
              }
            }
            let aiResult2 = await aiParseMessage(text || `[${mediaType} allegato: ${fileName || "foto"}]`, mediaUrl, mediaType);
            if (!aiResult2) {
              const txt = (text || "").toLowerCase();
              const urgKw = ["fermo", "guasto", "errore", "rotto", "urgente", "emergenza", "bloccato", "non funziona", "allarme"];
              const ordKw = ["ordine", "ricambio", "pezzo", "servono", "ordinare", "spedire"];
              const isUrg = urgKw.some((k) => txt.includes(k));
              const isOrd = ordKw.some((k) => txt.includes(k));
              let matchedCliente = null, matchedCodice = null;
              const clienti = await sb(env, "anagrafica_clienti", "GET", null, "?select=codice_m3,nome_interno&limit=300").catch(() => []);
              for (const c of clienti) {
                const ni = (c.nome_interno || "").toLowerCase();
                if (ni && ni.length > 2 && txt.includes(ni)) {
                  matchedCliente = c.nome_interno;
                  matchedCodice = c.codice_m3;
                  break;
                }
              }
              if (isUrg || isOrd || mediaUrl || matchedCliente) {
                aiResult2 = {
                  tipo: isOrd ? "ordine" : "urgenza",
                  cliente: matchedCliente,
                  codice_m3: matchedCodice,
                  problema: text || `[${mediaType || "messaggio"} allegato]`,
                  macchina: null,
                  robot_id: null,
                  priorita: isUrg ? "alta" : "media",
                  ricambi: [],
                  note: "Analizzato con fallback keywords (AI non disponibile)"
                };
              } else {
                reply = "\u{1F914} Non riesco ad analizzare. Prova con /help per i comandi disponibili.";
                break;
              }
            }
            if (aiResult2.cliente && !aiResult2.codice_m3) {
              const clienti = await sb(env, "anagrafica_clienti", "GET", null, "?select=codice_m3,nome_interno,nome_account&limit=300").catch(() => []);
              const searchName = (aiResult2.cliente || "").toLowerCase();
              const match = clienti.find(
                (c) => (c.nome_interno || "").toLowerCase() === searchName || (c.nome_interno || "").toLowerCase().includes(searchName) || (c.nome_account || "").toLowerCase().includes(searchName)
              );
              if (match) {
                aiResult2.codice_m3 = match.codice_m3;
                aiResult2.cliente = match.nome_interno || match.nome_account;
              }
            }
            if (aiResult2.tipo === "nota") {
              reply = `\u{1F4DD} *Nota registrata*
${aiResult2.problema || text}`;
              if (aiResult2.cliente) reply += `
Cliente: ${aiResult2.cliente}`;
              break;
            }
            const now = (/* @__PURE__ */ new Date()).toISOString();
            let payload = {}, actionReply = "";
            const tid = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
            if (aiResult2.tipo === "urgenza") {
              let realMacchinaId = null;
              if (aiResult2.codice_m3 && aiResult2.macchina) {
                const macTipo = (aiResult2.macchina || "").toUpperCase();
                const macQuery = `?cliente_id=eq.${aiResult2.codice_m3}&obsoleto=eq.false&select=id,tipo,numero_serie`;
                const macList = await sb(env, "macchine", "GET", null, macQuery).catch(() => []);
                const match = macList.find((m) => (m.tipo || "").toUpperCase().includes(macTipo));
                if (match) realMacchinaId = match.id;
                if (!realMacchinaId) {
                  const anagQ = `?codice_m3=eq.${aiResult2.codice_m3}&obsoleto=eq.false&select=id,tipo_macchina,descrizione`;
                  const anagList = await sb(env, "anagrafica_assets", "GET", null, anagQ).catch(() => []);
                  const anagMatch = anagList.find((a) => (a.tipo_macchina || a.descrizione || "").toUpperCase().includes(macTipo));
                  if (anagMatch) realMacchinaId = anagMatch.id;
                }
              }
              payload = {
                id: secureId("URG_TG"),
                tenant_id: tid,
                problema: aiResult2.problema,
                cliente_id: aiResult2.codice_m3 || null,
                macchina_id: realMacchinaId,
                priorita_id: null,
                stato: "aperta",
                data_segnalazione: now,
                tecnico_assegnato: null,
                note: `[Telegram ${utente?.nome || ""}] ${aiResult2.macchina || ""} ${aiResult2.robot_id || ""} - Priorit\xE0: ${aiResult2.priorita}${mediaUrl ? " - Allegato: " + mediaUrl : ""}`
              };
              try {
                await sb(env, "urgenze", "POST", payload);
                if (mediaUrl) {
                  const docId = secureId("DOC_TG");
                  await sb(env, "documenti", "POST", {
                    id: docId,
                    tenant_id: tid,
                    entita_tipo: "urgenza",
                    entita_id: payload.id,
                    nome: fileName || (mediaType === "photo" ? "foto_telegram.jpg" : "allegato_telegram"),
                    tipo: mediaType || "photo",
                    url: mediaUrl,
                    caricato_da: utente?.id || "TELEGRAM",
                    created_at: now
                  }).catch((e) => console.error("[DOC] Save error:", e.message));
                  await sb(env, `urgenze?id=eq.${payload.id}`, "PATCH", { allegati_ids: [docId] }).catch(() => {
                  });
                }
                actionReply = `\u{1F6A8} *URGENZA CREATA*
ID: \`${payload.id}\`
Cliente: ${aiResult2.cliente || "?"}
Problema: ${aiResult2.problema}
Macchina: ${aiResult2.macchina || "?"} ${aiResult2.robot_id || ""}
Priorit\xE0: ${aiResult2.priorita}${mediaUrl ? "\n\u{1F4CE} Allegato salvato" : ""}`;
                if (aiResult2.componente_identificato) actionReply += `

\u{1F50D} *Componente identificato:* ${aiResult2.componente_identificato}`;
                if (aiResult2.danno_visibile) actionReply += `
\u26A0\uFE0F *Danno:* ${aiResult2.danno_visibile}`;
                if (aiResult2.ricambi?.length) {
                  actionReply += "\n\n\u{1F527} *Ricambi suggeriti:*";
                  for (const r of aiResult2.ricambi) {
                    actionReply += `
\u2022 \`${r.codice}\` \u2014 ${r.descrizione || "?"} (x${r.quantita || 1})${r._verificato ? " \u2705" : " \u26A0\uFE0F _da verificare_"}`;
                  }
                }
                await sendTelegramNotification(env, "nuova_urgenza", payload);
                try {
                  const itFmt2 = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
                  const oggiSD = itFmt2.format(/* @__PURE__ */ new Date());
                  const pianoSD = await sb(
                    env,
                    "piano",
                    "GET",
                    null,
                    `?data=eq.${oggiSD}&stato=eq.pianificato&obsoleto=eq.false&select=tecnico_id,note,tipo_intervento_id`
                  ).catch(() => []);
                  const dispSD = pianoSD.filter((p) => {
                    const n = ((p.note || "") + " " + (p.tipo_intervento_id || "")).toLowerCase();
                    return n.includes("varie") || n.includes("disponibil") || n.includes("urgenz") || n.includes("backup");
                  });
                  if (dispSD.length) {
                    const tecIdsSD = [...new Set(dispSD.map((d) => d.tecnico_id).filter(Boolean))];
                    const tecSD = tecIdsSD.length ? await sb(env, "utenti", "GET", null, `?id=in.(${tecIdsSD.join(",")})&select=id,nome,cognome`).catch(() => []) : [];
                    if (tecSD.length) {
                      actionReply += "\n\n\u{1F4A1} *Tecnici disponibili oggi:*";
                      for (const t of tecSD) actionReply += `
\u2022 ${t.nome} ${t.cognome || ""}`;
                      actionReply += `

Usa \`/assegna ${payload.id} [nome]\``;
                    }
                  }
                } catch {
                }
              } catch (e) {
                actionReply = "\u274C Errore creazione urgenza: " + e.message;
              }
            } else if (aiResult2.tipo === "ordine") {
              const ricambiDesc = (aiResult2.ricambi || []).map((r) => `${r.codice} x${r.quantita}`).join(", ") || aiResult2.problema;
              payload = {
                id: secureId("ORD_TG"),
                tenant_id: tid,
                tecnico_id: utente?.id || null,
                cliente_id: aiResult2.codice_m3 || null,
                descrizione: ricambiDesc,
                stato: "richiesto",
                data_richiesta: now,
                note: `[Telegram ${utente?.nome || ""}] ${aiResult2.cliente || ""}${mediaUrl ? " - Allegato: " + mediaUrl : ""}`
              };
              try {
                await sb(env, "ordini", "POST", payload);
                actionReply = `\u{1F4E6} *ORDINE CREATO*
ID: \`${payload.id}\`
Cliente: ${aiResult2.cliente || "?"}
Ricambi: ${ricambiDesc}${mediaUrl ? "\n\u{1F4CE} Allegato salvato" : ""}`;
              } catch (e) {
                actionReply = "\u274C Errore creazione ordine: " + e.message;
              }
            } else if (aiResult2.tipo === "intervento") {
              payload = {
                id: secureId("INT_TG"),
                tenant_id: tid,
                cliente_id: aiResult2.codice_m3 || null,
                tecnico_id: utente?.id || null,
                stato: "pianificato",
                data: now.split("T")[0],
                note: `[Telegram ${utente?.nome || ""}] ${aiResult2.problema}${mediaUrl ? " - Allegato: " + mediaUrl : ""}`,
                obsoleto: false
              };
              try {
                await sb(env, "piano", "POST", payload);
                actionReply = `\u{1F4C5} *INTERVENTO PIANIFICATO*
ID: \`${payload.id}\`
Cliente: ${aiResult2.cliente || "?"}
Descrizione: ${aiResult2.problema}${mediaUrl ? "\n\u{1F4CE} Allegato salvato" : ""}`;
                await sendTelegramNotification(env, "nuovo_intervento", payload);
              } catch (e) {
                actionReply = "\u274C Errore creazione intervento: " + e.message;
              }
            }
            if (actionReply) {
              reply = actionReply;
              if (aiResult2.note) reply += `

\u{1F4A1} _${aiResult2.note}_`;
            }
          }
        }
        if (reply) {
          try {
            await sendTelegram(env, chatId, reply);
          } catch (e) {
            console.error("TG send error:", e.message);
          }
        }
        if (reply) {
          try {
            const msgLower = (text || "").toLowerCase();
            const cmdUsed = cmd || "";
            let botCanale = "CH_GENERALE";
            const routingMap = {
              urgenza: "CH_URGENZE",
              ordine: "CH_ORDINI",
              intervento: "CH_OPERATIVO",
              nota: "CH_GENERALE"
            };
            if (typeof aiResult !== "undefined" && aiResult?.tipo) {
              botCanale = routingMap[aiResult.tipo] || "CH_GENERALE";
            } else if (["/ordine", "/servepezz", "/catalogo"].includes(cmdUsed)) botCanale = "CH_ORDINI";
            else if (["/pianifica", "/oggi", "/settimana", "/disponibile", "/report"].includes(cmdUsed)) botCanale = "CH_OPERATIVO";
            else if (["/vado", "/incorso", "/risolto", "/stato", "/assegna"].includes(cmdUsed)) botCanale = "CH_URGENZE";
            else if (["/tagliando"].includes(cmdUsed)) botCanale = "CH_OPERATIVO";
            else {
              const urgKwBot = ["urgenza", "fermo", "guasto", "errore", "rotto", "emergenza", "allarme"];
              const ordKwBot = ["ordine", "ricambio", "pezzo", "servono", "ordinare"];
              const insKwBot = ["installazione", "installare", "montaggio", "commissioning"];
              if (urgKwBot.some((k) => msgLower.includes(k))) botCanale = "CH_URGENZE";
              else if (ordKwBot.some((k) => msgLower.includes(k))) botCanale = "CH_ORDINI";
              else if (insKwBot.some((k) => msgLower.includes(k))) botCanale = "CH_INSTALLAZIONI";
            }
            const cleanReply = reply.replace(/\*/g, "").replace(/_/g, "");
            const ts = new Date(Date.now() + 1e3).toISOString();
            const tecLabel = utente ? `${utente.nome || ""} ${(utente.cognome || "").charAt(0)}.` : "TG";
            const userMsgId = secureId("TG_USR");
            if (text && text.length > 2) {
              await sb(env, "chat_messaggi", "POST", {
                id: userMsgId,
                canale_id: botCanale,
                mittente_id: utente?.id || "TELEGRAM",
                testo: `\u{1F4F1} [${tecLabel}] ${text.substring(0, 500)}${mediaUrl ? " \u{1F4CE}" : ""}`,
                tipo: mediaType || "testo",
                created_at: (/* @__PURE__ */ new Date()).toISOString()
              }).catch(() => {
              });
            }
            const botMsgId = secureId("TG_BOT");
            await sb(env, "chat_messaggi", "POST", {
              id: botMsgId,
              canale_id: botCanale,
              mittente_id: "TELEGRAM",
              testo: `\u{1F916} [Bot] ${cleanReply}`,
              tipo: "testo",
              created_at: ts
            }).catch(() => {
            });
            if (botCanale !== "CH_ADMIN") {
              const botMsgId2 = secureId("TG_BOT");
              await sb(env, "chat_messaggi", "POST", {
                id: botMsgId2,
                canale_id: "CH_ADMIN",
                mittente_id: "TELEGRAM",
                testo: `\u{1F916} [Bot\u2192TG] ${cleanReply}`,
                tipo: "testo",
                created_at: ts
              }).catch(() => {
              });
            }
          } catch (e) {
            console.error("Bot mirror error:", e.message);
          }
        }
        return ok();
      } catch (tgErr) {
        console.error("Telegram handler error:", tgErr.message, tgErr.stack);
        try {
          const errChatId = body?.message?.chat?.id;
          if (errChatId) await sendTelegram(env, errChatId, `\u26A0\uFE0F Errore bot: ${tgErr.message}`);
        } catch (e2) {
        }
        return ok();
      }
    }
    // -------- CHAT INTERNA --------
    case "getChatCanali": {
      const userId = body.userId || body.user_id || "";
      const canali = await sb(env, "chat_canali", "GET", null, "?attivo=eq.true&order=nome");
      const membri = userId ? await sb(env, "chat_membri", "GET", null, `?utente_id=eq.${userId}&select=canale_id,ultimo_letto`) : [];
      const membroMap = {};
      (membri || []).forEach((m) => {
        membroMap[m.canale_id] = m;
      });
      const result = [];
      for (const c of canali || []) {
        const ultimoLetto = membroMap[c.id]?.ultimo_letto || "1970-01-01";
        const nonLetti = await sb(
          env,
          "chat_messaggi",
          "GET",
          null,
          `?canale_id=eq.${c.id}&created_at=gt.${ultimoLetto}&eliminato=eq.false&select=id`
        ).catch(() => []);
        result.push({ ...pascalizeRecord(c), nonLetti: (nonLetti || []).length, isMembro: !!membroMap[c.id] });
      }
      return ok({ canali: result });
    }
    case "getChatMessaggi": {
      const { canale_id, limit: lim } = body;
      if (!canale_id) return err("canale_id richiesto");
      const messaggi = await sb(
        env,
        "chat_messaggi",
        "GET",
        null,
        `?canale_id=eq.${canale_id}&eliminato=eq.false&order=created_at.desc&limit=${lim || 50}`
      );
      const userId = body.userId || body.user_id;
      if (userId) {
        await sb(env, "chat_membri", "POST", { id: `${canale_id}_${userId}`, canale_id, utente_id: userId, ultimo_letto: (/* @__PURE__ */ new Date()).toISOString() }).catch(() => sb(env, `chat_membri?canale_id=eq.${canale_id}&utente_id=eq.${userId}`, "PATCH", { ultimo_letto: (/* @__PURE__ */ new Date()).toISOString() }));
      }
      return ok({ messaggi: (messaggi || []).reverse().map(pascalizeRecord) });
    }
    case "sendChatMessage": {
      const { canale_id, testo, tipo, rispondi_a } = body;
      const mittente = body.userId || body.user_id || body.mittente_id;
      if (!canale_id || !testo) return err("canale_id e testo richiesti");
      const id = secureId("MSG");
      const msg = { id, canale_id, mittente_id: mittente, testo, tipo: tipo || "testo", rispondi_a: rispondi_a || null, created_at: (/* @__PURE__ */ new Date()).toISOString() };
      const result = await sb(env, "chat_messaggi", "POST", msg);
      if (testo.startsWith("/")) {
        try {
          const parts = testo.split(" ");
          const cmd = parts[0].toLowerCase();
          let botReply = "";
          const oggiStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          switch (cmd) {
            case "/stato": {
              const urg = await sb(env, "urgenze", "GET", null, "?stato=in.(aperta,assegnata,in_corso)&order=data_segnalazione.desc&limit=10").catch(() => []);
              botReply = urg.length ? `\u{1F6A8} ${urg.length} urgenze attive:
` + urg.map((u) => `\u2022 ${u.id}: ${u.problema} [${u.stato}]`).join("\n") : "\u2705 Nessuna urgenza attiva";
              break;
            }
            case "/oggi": {
              const intv = await sb(env, "piano", "GET", null, `?data=eq.${oggiStr}&tecnico_id=eq.${mittente}&obsoleto=eq.false`).catch(() => []);
              botReply = intv.length ? `\u{1F4C5} Interventi oggi (${intv.length}):
` + intv.map((i) => `\u2022 ${i.id}: ${i.stato} \u2013 ${i.cliente_id}`).join("\n") : "\u{1F4C5} Nessun intervento oggi";
              break;
            }
            case "/settimana": {
              const d2 = /* @__PURE__ */ new Date();
              const lun = new Date(d2);
              lun.setDate(d2.getDate() - d2.getDay() + 1);
              const dom = new Date(lun);
              dom.setDate(lun.getDate() + 6);
              const intv = await sb(env, "piano", "GET", null, `?data=gte.${lun.toISOString().split("T")[0]}&data=lte.${dom.toISOString().split("T")[0]}&tecnico_id=eq.${mittente}&obsoleto=eq.false&order=data.asc`).catch(() => []);
              botReply = intv.length ? `\u{1F4C5} Piano settimanale (${intv.length}):
` + intv.map((i) => `\u2022 ${i.data} ${i.stato} \u2013 ${i.cliente_id}`).join("\n") : "\u{1F4C5} Nessun intervento questa settimana";
              break;
            }
            case "/vado": {
              const urgList = await sb(env, "urgenze", "GET", null, "?stato=eq.aperta&order=priorita.asc,data_segnalazione.asc&limit=5").catch(() => []);
              if (!urgList.length) {
                botReply = "\u2705 Nessuna urgenza da prendere";
                break;
              }
              const scelta = parseInt(parts[1]);
              if (!scelta || scelta < 1 || scelta > urgList.length) {
                botReply = `\u{1F6A8} Urgenze aperte (${urgList.length}):
` + urgList.map((u, i) => `${i + 1}. ${u.problema || "N/D"} \u2013 P${u.priorita || "?"} (${u.data_segnalazione?.split("T")[0] || "?"})`).join("\n") + `

\u{1F449} Scrivi /vado N per prendere (es: /vado 1)`;
                break;
              }
              const picked = urgList[scelta - 1];
              await sb(env, `urgenze?id=eq.${picked.id}`, "PATCH", { stato: "assegnata", tecnico_assegnato: mittente, data_assegnazione: (/* @__PURE__ */ new Date()).toISOString() });
              botReply = `\u2705 Urgenza ${picked.id} assegnata a te!
${picked.problema}`;
              break;
            }
            case "/incorso": {
              const urg = await sb(env, "urgenze", "GET", null, `?tecnico_assegnato=eq.${mittente}&stato=eq.assegnata&limit=1`).catch(() => []);
              if (!urg.length) {
                botReply = "Nessuna urgenza assegnata";
                break;
              }
              await sb(env, `urgenze?id=eq.${urg[0].id}`, "PATCH", { stato: "in_corso", data_inizio: (/* @__PURE__ */ new Date()).toISOString() });
              botReply = `\u{1F527} Urgenza ${urg[0].id} IN CORSO`;
              break;
            }
            case "/risolto": {
              const note = parts.slice(1).join(" ");
              const urg = await sb(env, "urgenze", "GET", null, `?tecnico_assegnato=eq.${mittente}&stato=in.(assegnata,in_corso)&limit=1`).catch(() => []);
              if (!urg.length) {
                botReply = "Nessuna urgenza in corso";
                break;
              }
              await sb(env, `urgenze?id=eq.${urg[0].id}`, "PATCH", { stato: "risolta", data_risoluzione: (/* @__PURE__ */ new Date()).toISOString(), note });
              botReply = `\u2705 Urgenza ${urg[0].id} RISOLTA${note ? "\nNote: " + note : ""}`;
              break;
            }
            case "/ordine": {
              const codice = parts[1] || "";
              const qt = parseInt(parts[2]) || 1;
              const cliente = parts.slice(3).join(" ") || "";
              if (!codice) {
                botReply = "\u{1F4E6} Formato: /ordine [codice] [quantit\xE0] [cliente]";
                break;
              }
              const ordId = secureId("ORD_APP");
              const ordTid = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
              await sb(env, "ordini", "POST", { id: ordId, tenant_id: ordTid, tecnico_id: mittente, codice, descrizione: `${codice} x${qt}${cliente ? " - " + cliente : ""}`, quantita: qt, stato: "richiesto", data_richiesta: (/* @__PURE__ */ new Date()).toISOString() });
              botReply = `\u{1F4E6} Ordine ${ordId} creato: ${codice} x${qt}${cliente ? " \u2013 " + cliente : ""}`;
              break;
            }
            default:
              botReply = "\u2753 Comando non riconosciuto. Usa /stato, /oggi, /settimana, /vado, /incorso, /risolto, /ordine";
          }
          if (botReply) {
            const botMsgId = secureId("MSG_BOT");
            await sb(env, "chat_messaggi", "POST", {
              id: botMsgId,
              canale_id,
              mittente_id: "TELEGRAM",
              testo: `\u{1F916} ${botReply}`,
              tipo: "testo",
              created_at: new Date(Date.now() + 500).toISOString()
            }).catch(() => {
            });
          }
        } catch (cmdErr) {
          console.error("Chat bot cmd error:", cmdErr.message);
        }
      }
      if (mittente) {
        await sb(env, "chat_membri", "POST", { id: `${canale_id}_${mittente}`, canale_id, utente_id: mittente, ultimo_letto: (/* @__PURE__ */ new Date()).toISOString() }).catch(() => {
        });
      }
      try {
        const cfgRows = await sb(env, "config", "GET", null, "?chiave=in.(telegram_bot_token,telegram_group_generale)&select=chiave,valore");
        const cfg = {};
        (cfgRows || []).forEach((c) => {
          cfg[c.chiave] = c.valore;
        });
        const tgToken = cfg.telegram_bot_token || env.TELEGRAM_BOT_TOKEN;
        const tgGroup = cfg.telegram_group_generale;
        if (tgToken && tgGroup) {
          let senderName = "Admin";
          if (mittente) {
            const users = await sb(env, "utenti", "GET", null, `?id=eq.${mittente}&select=nome,cognome`).catch(() => []);
            if (users?.[0]) senderName = (users[0].nome || "") + " " + (users[0].cognome || "");
          }
          const canaleInfo = await sb(env, "chat_canali", "GET", null, `?id=eq.${canale_id}&select=nome,icona`).catch(() => []);
          const canaleNome = canaleInfo?.[0]?.nome || canale_id;
          const canaleIcona = canaleInfo?.[0]?.icona || "\u{1F4AC}";
          const escapedTesto = (testo || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const tgText = `${canaleIcona} <b>[${canaleNome}]</b>
\u{1F464} <b>${senderName}</b>:
${escapedTesto}`;
          await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: tgGroup, text: tgText, parse_mode: "HTML" })
          }).catch(() => {
          });
        }
      } catch (tgErr) {
        console.error("Telegram mirror error:", tgErr);
      }
      return ok({ messaggio: pascalizeRecord(result[0]) });
    }
    case "createChatCanale": {
      const { nome, tipo, descrizione, icona, solo_admin, membri_ids } = body;
      if (!nome) return err("nome richiesto");
      const id = secureId("CH");
      const canale = { id, nome, tipo: tipo || "gruppo", descrizione: descrizione || null, icona: icona || "\u{1F4AC}", solo_admin: solo_admin || false, creato_da: body.userId || null, created_at: (/* @__PURE__ */ new Date()).toISOString() };
      const utenti = await sb(env, "utenti", "GET", null, "?select=tenant_id&limit=1");
      if (utenti?.[0]?.tenant_id) canale.tenant_id = utenti[0].tenant_id;
      const result = await sb(env, "chat_canali", "POST", canale);
      if (membri_ids && Array.isArray(membri_ids)) {
        for (const uid of membri_ids) {
          await sb(env, "chat_membri", "POST", { id: `${id}_${uid}`, canale_id: id, utente_id: uid, ruolo: uid === body.userId ? "admin" : "membro" }).catch(() => {
          });
        }
      }
      return ok({ canale: pascalizeRecord(result[0]) });
    }
    case "joinChatCanale": {
      const { canale_id } = body;
      const userId = body.userId || body.user_id;
      if (!canale_id || !userId) return err("canale_id e userId richiesti");
      await sb(env, "chat_membri", "POST", { id: `${canale_id}_${userId}`, canale_id, utente_id: userId }).catch(() => {
      });
      return ok();
    }
    case "editChatMessage": {
      const { id, testo } = body;
      const userId = body.userId || body.user_id;
      if (!id || !testo) return err("id e testo richiesti");
      const msg = await sb(env, "chat_messaggi", "GET", null, `?id=eq.${id}&select=mittente_id,eliminato`).catch(() => []);
      if (!msg?.[0]) return err("Messaggio non trovato");
      if (msg[0].eliminato) return err("Messaggio gi\xE0 eliminato");
      if (msg[0].mittente_id !== userId) return err("Solo il mittente pu\xF2 modificare il messaggio");
      await sb(env, `chat_messaggi?id=eq.${id}`, "PATCH", { testo, modificato: true, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      return ok();
    }
    case "deleteChatMessage": {
      const { id } = body;
      const userId = body.userId || body.user_id;
      if (!id) return err("id messaggio richiesto");
      const msg = await sb(env, "chat_messaggi", "GET", null, `?id=eq.${id}&select=mittente_id`).catch(() => []);
      if (!msg?.[0]) return err("Messaggio non trovato");
      const isOwner = msg[0].mittente_id === userId;
      const isAdmin = userId ? (await sb(env, "utenti", "GET", null, `?id=eq.${userId}&select=ruolo`).catch(() => []))?.[0]?.ruolo === "admin" : false;
      if (!isOwner && !isAdmin) return err("Solo il mittente o admin pu\xF2 eliminare il messaggio");
      await sb(env, `chat_messaggi?id=eq.${id}`, "PATCH", { eliminato: true, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      return ok();
    }
    // ============ SYNC CLIENTI DA ANAGRAFICA ============
    case "migrateDB": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const results = [];
      try {
        await sb(env, "urgenze?select=note_ai&limit=1", "GET");
        results.push("note_ai: gi\xE0 esistente");
      } catch (e) {
        results.push("note_ai: colonna mancante \u2014 eseguire: ALTER TABLE urgenze ADD COLUMN note_ai TEXT DEFAULT NULL;");
      }
      try {
        await sb(env, "urgenze?select=ai_confidence&limit=1", "GET");
        results.push("ai_confidence: gi\xE0 esistente");
      } catch (e) {
        results.push("ai_confidence: colonna mancante \u2014 eseguire: ALTER TABLE urgenze ADD COLUMN ai_confidence FLOAT DEFAULT NULL;");
      }
      return ok({ migrations: results, note: "Se colonne mancanti, eseguire SQL su Supabase Dashboard > SQL Editor" });
    }
    case "syncClientiFromAnagrafica": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const anagAll = await sb(env, "anagrafica_clienti", "GET", null, "?select=codice_m3,nome_interno,lat,lng,citta_fatturazione,via_fatturazione&limit=500");
      const clientiAll = await sb(env, "clienti", "GET", null, "?select=id,nome&obsoleto=eq.false&limit=500");
      const anagByM3 = {};
      const anagByName = {};
      for (const a of anagAll) {
        if (a.codice_m3) anagByM3[String(a.codice_m3).replace(/^0+/, "")] = a;
        if (a.nome_interno) anagByName[a.nome_interno.toUpperCase()] = a;
      }
      let updated = 0;
      for (const cli of clientiAll) {
        const cid = String(cli.id).replace(/^0+/, "");
        const match = anagByM3[cid] || anagByName[(cli.nome || "").toUpperCase()];
        if (!match) continue;
        const updates = {};
        if (match.lat != null) updates.latitudine = match.lat;
        if (match.lng != null) updates.longitudine = match.lng;
        if (match.citta_fatturazione) updates.citta = match.citta_fatturazione;
        if (match.via_fatturazione) updates.indirizzo = match.via_fatturazione;
        if (Object.keys(updates).length) {
          await sb(env, `clienti?id=eq.${cli.id}`, "PATCH", updates);
          updated++;
        }
      }
      await wlog("clienti", "SYNC", "sync_from_anagrafica", body.operatoreId, `${updated} aggiornati`);
      return ok({ updated, total: clientiAll.length });
    }
    // ============ ANAGRAFICA (Clienti + Assets) ============
    case "getAnagraficaClienti": {
      const search = sanitizePgFilter(body.search || "");
      let url = "anagrafica_clienti?select=*&order=nome_account.asc&limit=500";
      if (search) url += `&or=(nome_account.ilike.*${search}*,nome_interno.ilike.*${search}*,codice_m3.ilike.*${search}*,citta_fatturazione.ilike.*${search}*)`;
      const data = await sb(env, url, "GET");
      return ok(data.map(pascalizeRecord));
    }
    case "getAnagraficaCliente": {
      const { id, codice_m3 } = body;
      let url = "anagrafica_clienti?select=*";
      if (id) url += `&id=eq.${id}`;
      else if (codice_m3) url += `&codice_m3=eq.${codice_m3}`;
      else return err("id o codice_m3 richiesto");
      const data = await sb(env, url, "GET");
      if (!data.length) return err("Cliente non trovato", 404);
      return ok(pascalizeRecord(data[0]));
    }
    case "getAnagraficaAssets": {
      const { codice_m3, search, all } = body;
      let base = "anagrafica_assets?select=*&order=gruppo_attrezzatura.asc,nome_asset.asc";
      if (codice_m3) base += `&codice_m3=eq.${codice_m3}`;
      const safeSearch = sanitizePgFilter(search || "");
      if (safeSearch) base += `&or=(nome_asset.ilike.*${safeSearch}*,numero_serie.ilike.*${safeSearch}*,modello.ilike.*${safeSearch}*,nome_account.ilike.*${safeSearch}*)`;
      if (!all) {
        const data = await sb(env, base + "&limit=1000", "GET");
        return ok(data.map(pascalizeRecord));
      }
      let allData = [];
      let offset = 0;
      const pageSize = 1e3;
      const maxPages = 20;
      for (let pageNum = 0; pageNum < maxPages; pageNum++) {
        const page = await sb(env, base, "GET", null, "", { "Range": `${offset}-${offset + pageSize - 1}`, "Prefer": "count=exact" });
        if (!Array.isArray(page) || page.length === 0) break;
        allData = allData.concat(page);
        if (page.length < pageSize) break;
        offset += pageSize;
      }
      return ok(allData.map(pascalizeRecord));
    }
    case "importAnagraficaClienti": {
      const rows = body.rows || [];
      if (!rows.length) return err("rows richiesto (array)");
      if (rows.length > 2e3) return err("Massimo 2000 righe per importazione anagrafica.");
      const results = { inserted: 0, updated: 0, skipped: 0, errors: [] };
      const batch = [];
      const allCliKeys = /* @__PURE__ */ new Set();
      for (const row of rows) {
        const fields = {};
        for (const [k, v] of Object.entries(row)) {
          const sk = toSnake(k);
          fields[sk] = v !== null && v !== void 0 && v !== "" ? v : null;
          allCliKeys.add(sk);
        }
        batch.push(fields);
      }
      const cliKeyList = [...allCliKeys];
      for (const row of batch) {
        for (const k of cliKeyList) {
          if (!(k in row)) row[k] = null;
        }
      }
      const existingCli = await sb(env, "anagrafica_clienti", "GET", null, "?select=codice_m3&limit=1000").catch(() => []);
      const existingM3 = new Set(existingCli.filter((c) => c.codice_m3).map((c) => c.codice_m3));
      const toInsert = [];
      const toUpdate = [];
      for (const row of batch) {
        const m3 = row.codice_m3 || row.numero_cliente_m3_opt;
        if (m3 && existingM3.has(m3)) {
          toUpdate.push(row);
        } else {
          toInsert.push(row);
        }
      }
      for (let i = 0; i < toInsert.length; i += 50) {
        const chunk = toInsert.slice(i, i + 50);
        try {
          await sb(env, "anagrafica_clienti", "POST", chunk, "", { "Prefer": "return=minimal" });
          results.inserted += chunk.length;
        } catch (e) {
          for (const row of chunk) {
            try {
              await sb(env, "anagrafica_clienti", "POST", row, "", { "Prefer": "return=minimal" });
              results.inserted++;
            } catch (e2) {
              results.skipped++;
              results.errors.push({ nome: row.nome_account || "?", err: e2.message });
            }
          }
        }
      }
      for (const row of toUpdate) {
        try {
          const m3 = row.codice_m3 || row.numero_cliente_m3_opt;
          await sb(env, `anagrafica_clienti?codice_m3=eq.${encodeURIComponent(m3)}`, "PATCH", row);
          results.updated++;
        } catch (e2) {
          results.skipped++;
          results.errors.push({ nome: row.nome_account || "?", err: e2.message });
        }
      }
      results.sampleErrors = results.errors.slice(0, 5);
      return ok(results);
    }
    case "importAnagraficaAssets": {
      const rows = body.rows || [];
      if (!rows.length) return err("rows richiesto (array)");
      const SKIP_ASSET_FIELDS = /* @__PURE__ */ new Set(["rh_lh", "ind", "sales_advisor", "provincia", "note", "rhlh"]);
      const clienti = await sb(env, "anagrafica_clienti?select=codice_m3", "GET");
      const validM3 = new Set(clienti.filter((c) => c.codice_m3).map((c) => c.codice_m3));
      const results = { inserted: 0, updated: 0, skipped: 0, errors: [] };
      const batch = [];
      const allKeys = /* @__PURE__ */ new Set();
      for (const row of rows) {
        const fields = {};
        for (const [k, v] of Object.entries(row)) {
          const sk = toSnake(k);
          if (SKIP_ASSET_FIELDS.has(sk)) continue;
          fields[sk] = v !== null && v !== void 0 && v !== "" ? v : null;
          allKeys.add(sk);
        }
        if (fields.codice_m3 && !validM3.has(fields.codice_m3)) {
          fields.codice_m3 = null;
        }
        batch.push(fields);
      }
      const keyList = [...allKeys];
      for (const row of batch) {
        for (const k of keyList) {
          if (!(k in row)) row[k] = null;
        }
      }
      const existingAssets = await sb(env, "anagrafica_assets", "GET", null, "?select=numero_serie&limit=1000").catch(() => []);
      const existingSerie = new Set(existingAssets.filter((a) => a.numero_serie).map((a) => a.numero_serie));
      const toInsertA = [];
      const toUpdateA = [];
      for (const row of batch) {
        if (row.numero_serie && existingSerie.has(row.numero_serie)) {
          toUpdateA.push(row);
        } else {
          toInsertA.push(row);
        }
      }
      for (let i = 0; i < toInsertA.length; i += 100) {
        const chunk = toInsertA.slice(i, i + 100);
        try {
          await sb(env, "anagrafica_assets", "POST", chunk, "", { "Prefer": "return=minimal" });
          results.inserted += chunk.length;
        } catch (e) {
          for (const row of chunk) {
            try {
              await sb(env, "anagrafica_assets", "POST", row, "", { "Prefer": "return=minimal" });
              results.inserted++;
            } catch (e2) {
              results.skipped++;
              results.errors.push({ serie: row.numero_serie || "?", err: e2.message });
            }
          }
        }
      }
      for (const row of toUpdateA) {
        try {
          await sb(env, `anagrafica_assets?numero_serie=eq.${encodeURIComponent(row.numero_serie)}`, "PATCH", row);
          results.updated++;
        } catch (e2) {
          results.skipped++;
          results.errors.push({ serie: row.numero_serie || "?", err: e2.message });
        }
      }
      results.sampleErrors = results.errors.slice(0, 5);
      return ok(results);
    }
    case "clearAnagrafica": {
      const uid = body.userId || body.operatoreId;
      if (!uid) return err("userId richiesto per clearAnagrafica");
      const caller = await sb(env, "utenti", "GET", null, `?id=eq.${uid}&select=ruolo`).catch(() => []);
      if (!caller?.[0] || caller[0].ruolo !== "admin") return err("Solo admin pu\xF2 eseguire clearAnagrafica", 403);
      if (body.confirm_token !== "CLEAR_CONFIRMED" && body.confirmToken !== "CLEAR_CONFIRMED") return err('Conferma richiesta: invia confirmToken="CLEAR_CONFIRMED"');
      await sb(env, "anagrafica_assets?numero_serie=neq.IMPOSSIBLE", "DELETE");
      await sb(env, "anagrafica_clienti?codice_m3=neq.IMPOSSIBLE", "DELETE");
      await wlog("anagrafica", "ALL", "cleared_for_reimport", uid);
      return ok({ cleared: true, method: "hard_delete" });
    }
    case "searchParts": {
      const { search, modello, gruppo, limit: maxResults } = body;
      if (!search && !modello && !gruppo) return err("Almeno uno tra search, modello, gruppo richiesto");
      const lim = Math.min(parseInt(maxResults) || 20, 50);
      let filter = "?attivo=eq.true";
      const orConditions = [];
      if (search) {
        const s = sanitizePgFilter(search);
        if (s) orConditions.push(`nome.ilike.*${s}*`, `descrizione.ilike.*${s}*`, `codice.ilike.*${s}*`, `gruppo.ilike.*${s}*`);
      }
      if (orConditions.length) filter += `&or=(${orConditions.join(",")})`;
      const safeModello = sanitizePgFilter(modello || "");
      if (safeModello) filter += `&modello_macchina=ilike.*${safeModello}*`;
      const safeGruppo = sanitizePgFilter(gruppo || "");
      if (safeGruppo) filter += `&gruppo=ilike.*${safeGruppo}*`;
      filter += `&order=nome.asc&limit=${lim}`;
      const parts = await sb(env, "tagliandi", "GET", null, filter).catch(() => []);
      return ok(parts.map(pascalizeRecord));
    }
    case "generatePMSchedule": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { mese_target, ciclo, cliente_id, dry_run } = body;
      if (!mese_target) return err("mese_target richiesto (YYYY-MM)");
      const cicliGiorni = { A1: 60, B2: 90, C3: 180, D8: 365 };
      const cicliNomi = { A1: "Bimestrale", B2: "Trimestrale", C3: "Semestrale", D8: "Annuale" };
      let macFilter = "?obsoleto=eq.false&prossimo_tagliando=not.is.null&select=id,seriale,note,modello,tipo,cliente_id,prossimo_tagliando,ultimo_tagliando,ore_lavoro&order=prossimo_tagliando.asc&limit=500";
      if (cliente_id) macFilter += `&cliente_id=eq.${cliente_id}`;
      const macchine = await sb(env, "macchine", "GET", null, macFilter).catch(() => []);
      let assFilter = "?prossimo_controllo=not.is.null&select=id,nome_asset,numero_serie,modello,gruppo_attrezzatura,codice_m3,nome_account,prossimo_controllo,ciclo_pm&order=prossimo_controllo.asc&limit=500";
      if (cliente_id) assFilter += `&codice_m3=eq.${cliente_id}`;
      const assets = await sb(env, "anagrafica_assets", "GET", null, assFilter).catch(() => []);
      const meseStart = mese_target + "-01";
      const meseEndDate = new Date(parseInt(mese_target.split("-")[0]), parseInt(mese_target.split("-")[1]), 0);
      const meseEnd = meseEndDate.toISOString().split("T")[0];
      const scheduled = [];
      const allItems = [
        ...macchine.map((m) => ({
          id: m.id,
          nome: m.modello || m.seriale || m.id,
          modello: m.modello || m.tipo,
          cliente_id: m.cliente_id,
          prossimo: m.prossimo_tagliando,
          ciclo: null,
          source: "macchine"
        })),
        ...assets.map((a) => ({
          id: a.id,
          nome: a.nome_asset || a.numero_serie || a.id,
          modello: a.modello || a.gruppo_attrezzatura,
          cliente_id: a.codice_m3,
          prossimo: a.prossimo_controllo,
          ciclo: a.ciclo_pm || null,
          source: "assets"
        }))
      ];
      for (const item of allItems) {
        if (!item.prossimo) continue;
        if (ciclo && item.ciclo && item.ciclo !== ciclo) continue;
        if (item.prossimo < meseStart || item.prossimo > meseEnd) continue;
        scheduled.push({
          macchina_id: item.id,
          macchina_nome: item.nome,
          modello: item.modello,
          cliente_id: item.cliente_id,
          data_suggerita: item.prossimo,
          ciclo: item.ciclo || "?",
          ciclo_nome: cicliNomi[item.ciclo] || "Service",
          source: item.source
        });
      }
      if (!dry_run && scheduled.length) {
        const tid = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
        const now = (/* @__PURE__ */ new Date()).toISOString();
        let created = 0, errors = [];
        for (const s of scheduled) {
          try {
            const intId = secureId("PM");
            await sb(env, "piano", "POST", {
              id: intId,
              tenant_id: tid,
              cliente_id: s.cliente_id,
              macchina_id: s.macchina_id,
              data: s.data_suggerita,
              stato: "pianificato",
              tipo_intervento_id: "TAGLIANDO",
              note: `[PM Auto] ${s.ciclo_nome} \u2014 ${s.macchina_nome} (${s.modello || "?"})`,
              obsoleto: false,
              created_at: now
            });
            created++;
          } catch (e) {
            errors.push({ macchina: s.macchina_nome, err: e.message });
          }
        }
        await wlog("pm_schedule", mese_target, "generated", body.userId || "admin", `${created} interventi creati`);
        return ok({ scheduled, created, errors, mese: mese_target });
      }
      return ok({ scheduled, count: scheduled.length, mese: mese_target, dry_run: true });
    }
    // ============ PM CALENDAR: Multi-tagliando per macchina ============
    case "getPMCalendar": {
      const { mese_target: pmMese, macchina_id: pmMacId, cliente_id: pmCliId } = body;
      const cycleRows = await sb(env, "config", "GET", null, "?chiave=eq.pm_cycle_state&limit=1").catch(() => []);
      const cycleState = cycleRows?.[0]?.valore ? JSON.parse(cycleRows[0].valore) : {};
      const defRows = await sb(env, "config", "GET", null, "?chiave=eq.pm_cycle_definitions&limit=1").catch(() => []);
      const cycleDefs = defRows?.[0]?.valore ? JSON.parse(defRows[0].valore) : getDefaultCycleDefs();
      let mFilter = "?obsoleto=eq.false&prossimo_tagliando=not.is.null&select=id,seriale,note,modello,tipo,cliente_id,prossimo_tagliando,ultimo_tagliando,ore_lavoro&limit=1000";
      if (pmMacId) mFilter += `&id=eq.${pmMacId}`;
      if (pmCliId) mFilter += `&cliente_id=eq.${pmCliId}`;
      const macchine = await sb(env, "macchine", "GET", null, mFilter).catch(() => []);
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const sixMonths = new Date(Date.now() + 180 * 864e5).toISOString().split("T")[0];
      const startDate = pmMese ? pmMese + "-01" : today;
      const endDate = pmMese ? (() => {
        const d = /* @__PURE__ */ new Date(pmMese + "-01");
        d.setMonth(d.getMonth() + 1);
        d.setDate(0);
        return d.toISOString().split("T")[0];
      })() : sixMonths;
      const pianoFilter = `?obsoleto=eq.false&tipo_intervento_id=eq.TAGLIANDO&data=gte.${startDate}&data=lte.${endDate}&order=data.asc&limit=500`;
      const pianoTags = await sb(env, "piano", "GET", null, pianoFilter).catch(() => []);
      const clienti = await sb(env, "clienti", "GET", null, "?obsoleto=eq.false&select=id,nome&limit=500").catch(() => []);
      const cliMap = {};
      clienti.forEach((c) => {
        cliMap[c.id] = c.nome;
      });
      const calendar = [];
      for (const mac of macchine) {
        const state = cycleState[mac.id] || {};
        const modelloKey = (mac.modello || mac.tipo || "").toUpperCase();
        const def = findCycleDef(cycleDefs, modelloKey);
        const cicloSequenza = def ? def.sequenza : ["A1", "B2", "A3", "C4", "A5", "B6", "A7", "D8"];
        const intervallo = def ? def.intervallo_giorni : 112;
        const posizioneCorrente = state.posizione || 0;
        const ultimoCompletato = state.ultimo_completato || mac.ultimo_tagliando || null;
        const prossimi = [];
        let baseDate = mac.prossimo_tagliando || (ultimoCompletato ? addDays(ultimoCompletato, intervallo) : null);
        if (!baseDate) continue;
        for (let i = 0; i < 4 && baseDate; i++) {
          const idx = (posizioneCorrente + i) % cicloSequenza.length;
          const tipo = cicloSequenza[idx];
          const dataTag = i === 0 ? baseDate : addDays(baseDate, intervallo * i);
          const existing = pianoTags.find((p) => p.macchina_id === mac.id && p.data === dataTag);
          prossimi.push({
            tipo,
            data: dataTag,
            stato: existing ? existing.stato : "futuro",
            piano_id: existing ? existing.id : null,
            tecnico_id: existing ? existing.tecnico_id : null,
            posizione: idx
          });
        }
        const completati = state.completati || [];
        const hasInMonth = pmMese ? prossimi.some((p) => p.data && p.data.startsWith(pmMese)) : true;
        const isOverdue = mac.prossimo_tagliando && mac.prossimo_tagliando < today;
        if (hasInMonth || isOverdue || !pmMese) {
          calendar.push({
            macchina_id: mac.id,
            macchina_nome: mac.seriale || mac.id,
            seriale: mac.seriale || "",
            note: mac.note || "",
            ore_macchina: mac.ore_lavoro || "",
            modello: mac.modello || mac.tipo,
            cliente_id: mac.cliente_id,
            cliente_nome: cliMap[mac.cliente_id] || mac.cliente_id || "\u2014",
            ciclo_tipo: def ? def.nome : "Standard",
            ciclo_sequenza: cicloSequenza,
            posizione_corrente: posizioneCorrente,
            posizione_nome: cicloSequenza[posizioneCorrente] || "A1",
            intervallo_giorni: intervallo,
            prossimi,
            completati: completati.slice(-8),
            prossimo_tagliando: mac.prossimo_tagliando,
            scaduto: isOverdue
          });
        }
      }
      calendar.sort((a, b) => {
        if (a.scaduto && !b.scaduto) return -1;
        if (!a.scaduto && b.scaduto) return 1;
        return (a.prossimo_tagliando || "").localeCompare(b.prossimo_tagliando || "");
      });
      return ok({ calendar, cycle_definitions: cycleDefs, mese: pmMese || "prossimi_6_mesi", total: calendar.length });
    }
    // ═══ PM OVERVIEW: tutti gli assets raggruppati per cliente con stato PM ═══
    case "getPMOverview": {
      const [assets, clienti] = await Promise.all([
        sb(
          env,
          "anagrafica_assets",
          "GET",
          null,
          "?obsoleto=eq.false&select=id,codice_m3,nome_account,tipo_foglio,gruppo_attrezzatura,nome_asset,numero_serie,modello,prossimo_controllo,ultimo_controllo,data_installazione,status,ciclo_pm,intervallo_settimane,schedule_type&limit=1000&order=codice_m3.asc"
        ).catch(() => []),
        sb(
          env,
          "anagrafica_clienti",
          "GET",
          null,
          "?select=codice_m3,nome_account,nome_interno,citta_fatturazione&limit=300"
        ).catch(() => [])
      ]);
      const cliMap = {};
      clienti.forEach((c) => {
        cliMap[c.codice_m3] = c;
      });
      const groups = {};
      for (const a of assets) {
        const m3 = a.codice_m3 || "__unknown__";
        if (!groups[m3]) {
          const cli = cliMap[m3];
          groups[m3] = {
            codice_m3: m3,
            nome: cli?.nome_interno || cli?.nome_account || a.nome_account || m3,
            citta: cli?.citta_fatturazione || "",
            assets: []
          };
        }
        groups[m3].assets.push(a);
      }
      const oggiDate = /* @__PURE__ */ new Date();
      const clientiList = Object.values(groups).sort((a, b) => {
        const aOvd = a.assets.filter((x) => x.prossimo_controllo && new Date(x.prossimo_controllo) < oggiDate).length;
        const bOvd = b.assets.filter((x) => x.prossimo_controllo && new Date(x.prossimo_controllo) < oggiDate).length;
        if (aOvd !== bOvd) return bOvd - aOvd;
        return (a.nome || "").localeCompare(b.nome || "");
      });
      return ok({ clienti: clientiList, total_assets: assets.length, total_clienti: clientiList.length });
    }
    // ═══ IMPORT PM OVERDUE: aggiorna prossimo_controllo da file LSSA ═══
    case "importPMOverdue": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { records } = body;
      if (!records || !Array.isArray(records)) return err("records array richiesto");
      let updated = 0, not_found = 0, errors = 0;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      for (const rec of records) {
        try {
          const rawSerial = (rec.numero_serie || rec.NumeroSerie || "").trim();
          const assetId = rec.asset_id || rec.AssetId;
          const prossimoControllo = rec.prossimo_controllo || rec.ProssimoControllo;
          const patch = {};
          if (prossimoControllo) patch.prossimo_controllo = prossimoControllo;
          if (rec.ultimo_controllo || rec.UltimoControllo) patch.ultimo_controllo = rec.ultimo_controllo || rec.UltimoControllo;
          if (rec.ciclo_pm || rec.CicloPm) patch.ciclo_pm = rec.ciclo_pm || rec.CicloPm;
          if (rec.intervallo_settimane != null) patch.intervallo_settimane = parseInt(rec.intervallo_settimane) || null;
          if (!Object.keys(patch).length) continue;
          patch.updated_at = now;
          let res;
          if (assetId) {
            res = await sb(env, `anagrafica_assets?id=eq.${encodeURIComponent(assetId)}&obsoleto=eq.false`, "PATCH", patch);
          } else if (rawSerial) {
            const stripped = normalizeSerial(rawSerial);
            const padded = padSerial10(rawSerial);
            res = await sb(env, `anagrafica_assets?numero_serie=eq.${encodeURIComponent(rawSerial)}&obsoleto=eq.false`, "PATCH", patch);
            let cnt = Array.isArray(res) ? res.length : res ? 1 : 0;
            if (!cnt && padded !== rawSerial) {
              res = await sb(env, `anagrafica_assets?numero_serie=eq.${encodeURIComponent(padded)}&obsoleto=eq.false`, "PATCH", patch);
              cnt = Array.isArray(res) ? res.length : res ? 1 : 0;
            }
            if (!cnt && stripped !== rawSerial && stripped !== padded) {
              res = await sb(env, `anagrafica_assets?numero_serie=eq.${encodeURIComponent(stripped)}&obsoleto=eq.false`, "PATCH", patch);
              cnt = Array.isArray(res) ? res.length : res ? 1 : 0;
            }
            if (cnt > 0) {
              updated++;
            } else {
              not_found++;
            }
            continue;
          } else {
            not_found++;
            continue;
          }
          const cnt2 = Array.isArray(res) ? res.length : res ? 1 : 0;
          if (cnt2 > 0) {
            updated++;
          } else {
            not_found++;
          }
        } catch (e) {
          errors++;
        }
      }
      await wlog("anagrafica_assets", "bulk", `pm_import updated:${updated} not_found:${not_found}`, body.operatoreId || body.userId);
      return ok({ updated, not_found, errors, total: records.length });
    }
    // ═══ IMPORT PM TEMPLATE v5.x (Lely standard LC Data Template) ═══
    case "importPMTemplate": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { records } = body;
      if (!records || !Array.isArray(records)) return err("records array richiesto");
      let updated = 0, not_found = 0, errors = 0;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      for (const rec of records) {
        try {
          const rawSerial = (rec.serial_no || "").trim();
          if (!rawSerial) {
            not_found++;
            continue;
          }
          const patch = { updated_at: now };
          if (rec.maintenance_type) patch.ciclo_pm = rec.maintenance_type;
          if (rec.standard_interval) {
            const intv = parseInt(rec.standard_interval);
            if (rec.weeks_months && (rec.weeks_months + "").toLowerCase().includes("month")) {
              patch.intervallo_settimane = intv * 4;
            } else {
              patch.intervallo_settimane = intv;
            }
          }
          if (rec.schedule_type) patch.schedule_type = rec.schedule_type;
          if (rec.next_pm_date) patch.prossimo_controllo = rec.next_pm_date;
          if (rec.asset_type) patch.tipo_foglio = rec.asset_type;
          if (!Object.keys(patch).length || Object.keys(patch).length === 1) {
            not_found++;
            continue;
          }
          const stripped = normalizeSerial(rawSerial);
          const padded = padSerial10(rawSerial);
          let cnt = 0;
          for (const sn of [rawSerial, padded, stripped]) {
            if (!sn) continue;
            const res = await sb(env, `anagrafica_assets?numero_serie=eq.${encodeURIComponent(sn)}&obsoleto=eq.false`, "PATCH", patch);
            cnt = Array.isArray(res) ? res.length : res ? 1 : 0;
            if (cnt) break;
          }
          if (cnt > 0) {
            updated++;
          } else {
            not_found++;
          }
        } catch (e) {
          errors++;
        }
      }
      await wlog("anagrafica_assets", "bulk", `pm_template_import updated:${updated} not_found:${not_found}`, body.operatoreId || body.userId);
      return ok({ updated, not_found, errors, total: records.length });
    }
    // ═══ UPDATE SINGLE ASSET CICLO PM ═══
    case "updateAssetCiclo": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { asset_id, ciclo_pm, intervallo_settimane } = body;
      if (!asset_id) return err("asset_id richiesto");
      const patch = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
      if (ciclo_pm !== void 0) patch.ciclo_pm = ciclo_pm || null;
      if (intervallo_settimane !== void 0) patch.intervallo_settimane = intervallo_settimane ? parseInt(intervallo_settimane) : null;
      await sb(env, `anagrafica_assets?id=eq.${encodeURIComponent(asset_id)}`, "PATCH", patch);
      return ok({ ok: true });
    }
    case "savePMCycleState": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { updates } = body;
      if (!updates || !Array.isArray(updates)) return err("updates array richiesto");
      const cycleRows2 = await sb(env, "config", "GET", null, "?chiave=eq.pm_cycle_state&limit=1").catch(() => []);
      const cycleState2 = cycleRows2?.[0]?.valore ? JSON.parse(cycleRows2[0].valore) : {};
      for (const u of updates) {
        if (!u.macchina_id) continue;
        if (!cycleState2[u.macchina_id]) cycleState2[u.macchina_id] = {};
        if (u.posizione !== void 0) cycleState2[u.macchina_id].posizione = u.posizione;
        if (u.ultimo_completato) cycleState2[u.macchina_id].ultimo_completato = u.ultimo_completato;
        if (u.completati) cycleState2[u.macchina_id].completati = u.completati;
      }
      const val2 = JSON.stringify(cycleState2);
      const tid = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
      try {
        await sb(env, "config", "POST", { chiave: "pm_cycle_state", valore: val2, tenant_id: tid }, "");
      } catch {
        await sb(env, "config?chiave=eq.pm_cycle_state", "PATCH", { valore: val2 }, "").catch(() => {
        });
      }
      return ok({ updated: updates.length });
    }
    case "savePMCycleDefinitions": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { definitions } = body;
      if (!definitions || !Array.isArray(definitions)) return err("definitions array richiesto");
      const val3 = JSON.stringify(definitions);
      const tid = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
      try {
        await sb(env, "config", "POST", { chiave: "pm_cycle_definitions", valore: val3, tenant_id: tid }, "");
      } catch {
        await sb(env, "config?chiave=eq.pm_cycle_definitions", "PATCH", { valore: val3 }, "").catch(() => {
        });
      }
      return ok({ saved: definitions.length });
    }
    case "updatePMDate": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const macchina_id = body.macchina_id || body.MacchinaID;
      const prossimo_tagliando = body.prossimo_tagliando || body.ProssimoTagliando;
      if (!macchina_id) return err("macchina_id richiesto");
      if (!prossimo_tagliando) return err("prossimo_tagliando richiesto");
      const upd = { prossimo_tagliando, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
      if (body.note !== void 0 || body.Note !== void 0) upd.note = body.note || body.Note;
      await sb(env, `macchine?id=eq.${macchina_id}`, "PATCH", upd);
      await wlog("macchina", macchina_id, "pm_date_updated", body.operatoreId);
      return ok({ updated: true, macchina_id, prossimo_tagliando });
    }
    case "completePM": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { macchina_id: cmId, piano_id: cmPianoId, data_completamento, note: cmNote } = body;
      if (!cmId) return err("macchina_id richiesto");
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const dataComp = data_completamento || now.split("T")[0];
      if (cmPianoId) {
        await sb(env, `piano?id=eq.${cmPianoId}`, "PATCH", {
          stato: "completato",
          note: cmNote || void 0,
          updated_at: now
        }).catch(() => {
        });
      }
      const cr = await sb(env, "config", "GET", null, "?chiave=eq.pm_cycle_state&limit=1").catch(() => []);
      const cs = cr?.[0]?.valore ? JSON.parse(cr[0].valore) : {};
      if (!cs[cmId]) cs[cmId] = { posizione: 0, completati: [] };
      const macRow = await sb(env, "macchine", "GET", null, `?id=eq.${cmId}&select=modello,tipo&limit=1`).catch(() => []);
      const modKey = (macRow?.[0]?.modello || macRow?.[0]?.tipo || "").toUpperCase();
      const dr = await sb(env, "config", "GET", null, "?chiave=eq.pm_cycle_definitions&limit=1").catch(() => []);
      const defs = dr?.[0]?.valore ? JSON.parse(dr[0].valore) : getDefaultCycleDefs();
      const def = findCycleDef(defs, modKey);
      const seq = def ? def.sequenza : ["A1", "B2", "A3", "C4", "A5", "B6", "A7", "D8"];
      const intervallo = def ? def.intervallo_giorni : 112;
      const pos = cs[cmId].posizione || 0;
      const tipoCompletato = seq[pos % seq.length];
      if (!cs[cmId].completati) cs[cmId].completati = [];
      cs[cmId].completati.push({
        tipo: tipoCompletato,
        data: dataComp,
        piano_id: cmPianoId || null,
        note: cmNote || ""
      });
      cs[cmId].posizione = (pos + 1) % seq.length;
      cs[cmId].ultimo_completato = dataComp;
      let prossimaData = skipWeekend(addDays(dataComp, Math.max(intervallo, 1)));
      const todayStr = now.split("T")[0];
      if (prossimaData < todayStr) {
        prossimaData = skipWeekend(addDays(todayStr, Math.max(intervallo, 1)));
      }
      const prossimoTipo = seq[cs[cmId].posizione];
      await sb(env, `macchine?id=eq.${cmId}`, "PATCH", {
        prossimo_tagliando: prossimaData,
        ultimo_tagliando: dataComp,
        updated_at: now
      }).catch(() => {
      });
      const val4 = JSON.stringify(cs);
      const tid = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
      try {
        await sb(env, "config", "POST", { chiave: "pm_cycle_state", valore: val4, tenant_id: tid }, "");
      } catch {
        await sb(env, "config?chiave=eq.pm_cycle_state", "PATCH", { valore: val4 }, "").catch(() => {
        });
      }
      const dupeCheck = await sb(
        env,
        "piano",
        "GET",
        null,
        `?obsoleto=eq.false&macchina_id=eq.${cmId}&data=eq.${prossimaData}&tipo_intervento_id=eq.TAGLIANDO&limit=1`
      ).catch(() => []);
      let nextPianoId = null;
      if (!dupeCheck.length) {
        nextPianoId = secureId("PM");
        await sb(env, "piano", "POST", {
          id: nextPianoId,
          tenant_id: tid,
          macchina_id: cmId,
          cliente_id: macRow?.[0]?.cliente_id || null,
          data: prossimaData,
          stato: "pianificato",
          tipo_intervento_id: "TAGLIANDO",
          note: `[PM Auto] ${prossimoTipo} \u2014 Prossimo dopo ${tipoCompletato}`,
          obsoleto: false,
          created_at: now
        }).catch(() => {
        });
      }
      await wlog(
        "pm_complete",
        cmId,
        tipoCompletato,
        body.userId || "admin",
        `Completato ${tipoCompletato}, prossimo ${prossimoTipo} il ${prossimaData}`
      );
      return ok({
        completato: { tipo: tipoCompletato, data: dataComp },
        prossimo: { tipo: prossimoTipo, data: prossimaData, piano_id: nextPianoId || dupeCheck[0]?.id },
        posizione: cs[cmId].posizione,
        macchina_id: cmId
      });
    }
    case "bulkGeneratePMCalendar": {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { mesi_avanti = 3 } = body;
      const tid = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const today2 = now.split("T")[0];
      const endDate2 = addDays(today2, mesi_avanti * 30);
      const [macchine2, cycleR, defR, existingPM] = await Promise.all([
        sb(env, "macchine", "GET", null, "?obsoleto=eq.false&prossimo_tagliando=not.is.null&select=id,seriale,note,modello,tipo,cliente_id,prossimo_tagliando,ultimo_tagliando,ore_lavoro&limit=1000").catch(() => []),
        sb(env, "config", "GET", null, "?chiave=eq.pm_cycle_state&limit=1").catch(() => []),
        sb(env, "config", "GET", null, "?chiave=eq.pm_cycle_definitions&limit=1").catch(() => []),
        sb(env, "piano", "GET", null, `?obsoleto=eq.false&tipo_intervento_id=eq.TAGLIANDO&stato=eq.pianificato&data=gte.${today2}&order=data.asc&limit=1000`).catch(() => [])
      ]);
      const cs2 = cycleR?.[0]?.valore ? JSON.parse(cycleR[0].valore) : {};
      const defs2 = defR?.[0]?.valore ? JSON.parse(defR[0].valore) : getDefaultCycleDefs();
      const existingKeys = new Set(existingPM.map((p) => `${p.macchina_id}_${p.data}`));
      let created2 = 0, skipped = 0, errors2 = [];
      for (const mac of macchine2) {
        const modKey2 = (mac.modello || mac.tipo || "").toUpperCase();
        const def2 = findCycleDef(defs2, modKey2);
        const seq2 = def2 ? def2.sequenza : ["A1", "B2", "A3", "C4", "A5", "B6", "A7", "D8"];
        const intervallo2 = def2 ? def2.intervallo_giorni : 112;
        const state2 = cs2[mac.id] || {};
        let pos2 = state2.posizione || 0;
        let nextDate = mac.prossimo_tagliando;
        if (!nextDate) continue;
        let safety = 0;
        while (nextDate <= endDate2 && safety < 10) {
          safety++;
          nextDate = skipWeekend(nextDate);
          const key = `${mac.id}_${nextDate}`;
          if (existingKeys.has(key)) {
            skipped++;
            nextDate = skipWeekend(addDays(nextDate, intervallo2));
            pos2 = (pos2 + 1) % seq2.length;
            continue;
          }
          const tipo2 = seq2[pos2 % seq2.length];
          try {
            const pianoId = secureId("PM");
            await sb(env, "piano", "POST", {
              id: pianoId,
              tenant_id: tid,
              macchina_id: mac.id,
              cliente_id: mac.cliente_id,
              data: nextDate,
              stato: "pianificato",
              tipo_intervento_id: "TAGLIANDO",
              note: `[PM Auto] ${tipo2} \u2014 ${mac.modello || mac.seriale || mac.id} (${mac.modello || "?"})`,
              obsoleto: false,
              created_at: now
            });
            existingKeys.add(key);
            created2++;
          } catch (e) {
            errors2.push({ macchina: mac.id, err: e.message });
          }
          nextDate = skipWeekend(addDays(nextDate, intervallo2));
          pos2 = (pos2 + 1) % seq2.length;
        }
      }
      await wlog(
        "pm_bulk_generate",
        "all",
        "generated",
        body.userId || "admin",
        `${created2} interventi PM generati, ${skipped} gi\xE0 esistenti`
      );
      return ok({ created: created2, skipped, errors: errors2, mesi_avanti, total_macchine: macchine2.length });
    }
    default:
      return err(`Azione POST non trovata: ${action}`, 404);
  }
}
__name(handlePost, "handlePost");
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
__name(addDays, "addDays");
function getDefaultCycleDefs() {
  return [
    {
      nome: "Astronaut A5",
      modelli: ["ASTRONAUT A5", "ASTRONAUT", "A5"],
      sequenza: ["A1", "B2", "A3", "C4", "A5", "B6", "A7", "D8"],
      intervallo_giorni: 112,
      // 16 settimane
      desc: "Ciclo standard Astronaut A5 \u2014 8 step, intervallo 16 settimane"
    },
    {
      nome: "Astronaut A3/A3N",
      modelli: ["ASTRONAUT A3", "ASTRONAUT A3 NEXT", "A3", "A3N", "A3 NEXT"],
      sequenza: ["A1", "B2", "A3", "C4", "A5", "B6", "A7", "D8"],
      intervallo_giorni: 105,
      // 15 settimane
      desc: "Ciclo Astronaut A3/A3 Next \u2014 8 step, intervallo 15 settimane"
    },
    {
      nome: "Vector",
      modelli: ["VECTOR", "LELY VECTOR"],
      sequenza: ["A1", "B2"],
      intervallo_giorni: 365,
      // 12 mesi
      desc: "Ciclo Vector \u2014 2 step, intervallo annuale"
    },
    {
      nome: "Juno",
      modelli: ["JUNO", "LELY JUNO"],
      sequenza: ["A1", "B2"],
      intervallo_giorni: 365,
      desc: "Ciclo Juno \u2014 2 step, intervallo annuale"
    },
    {
      nome: "Discovery/Collector",
      modelli: ["DISCOVERY", "DISCOVERY COLLECTOR", "COLLECTOR", "DISCOVERY 120", "DISCOVERY 90"],
      sequenza: ["A1", "B2"],
      intervallo_giorni: 365,
      desc: "Ciclo Discovery/Collector \u2014 2 step, intervallo annuale"
    },
    {
      nome: "Calm",
      modelli: ["CALM", "LELY CALM"],
      sequenza: ["A1"],
      intervallo_giorni: 365,
      desc: "Ciclo Calm \u2014 1 step, annuale"
    },
    {
      nome: "Grazeway",
      modelli: ["GRAZEWAY", "LELY GRAZEWAY"],
      sequenza: ["A1"],
      intervallo_giorni: 365,
      desc: "Ciclo Grazeway \u2014 1 step, annuale"
    },
    {
      nome: "Cosmix",
      modelli: ["COSMIX", "LELY COSMIX"],
      sequenza: ["A1"],
      intervallo_giorni: 365,
      desc: "Ciclo Cosmix \u2014 1 step, annuale"
    }
  ];
}
__name(getDefaultCycleDefs, "getDefaultCycleDefs");
function findCycleDef(defs, modelloKey) {
  if (!modelloKey || !defs) return null;
  const up = modelloKey.toUpperCase().trim();
  for (const d of defs) {
    if (d.modelli && d.modelli.some((m) => m && up.includes(m.toUpperCase()))) return d;
  }
  for (const d of defs) {
    if (d.nome && up.includes(d.nome.toUpperCase())) return d;
  }
  return null;
}
__name(findCycleDef, "findCycleDef");
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}
__name(urlBase64ToUint8Array, "urlBase64ToUint8Array");
function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(arrayBufferToBase64Url, "arrayBufferToBase64Url");
async function createVapidJwt(env, audience) {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1e3);
  const payload = {
    aud: audience,
    exp: now + 86400,
    sub: env.VAPID_SUBJECT || "mailto:admin@syntoniqa.app"
  };
  const headerB64 = arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  const privateKeyBytes = urlBase64ToUint8Array(env.VAPID_PRIVATE_KEY);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  ).catch(() => {
    return crypto.subtle.importKey(
      "raw",
      privateKeyBytes,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  });
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    key,
    new TextEncoder().encode(unsignedToken)
  );
  return `${unsignedToken}.${arrayBufferToBase64Url(signature)}`;
}
__name(createVapidJwt, "createVapidJwt");
async function sendWebPush(env, subscription, payload) {
  const endpoint = new URL(subscription.endpoint);
  const audience = `${endpoint.protocol}//${endpoint.host}`;
  try {
    const jwt = await createVapidJwt(env, audience);
    const vapidPublicKey = env.VAPID_PUBLIC_KEY;
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
        "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
        "Urgency": "high"
      },
      body: payload
    });
    return response;
  } catch (e) {
    return { ok: false, status: 0, statusText: e.message };
  }
}
__name(sendWebPush, "sendWebPush");
async function sendEmailAlert(env, to, subject, bodyHtml) {
  if (!env.RESEND_API_KEY || !to) return null;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: brand(env).emailFrom,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:#050C14;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;text-align:center">
            <h2 style="margin:0;font-size:1.1rem">\u{1F527} Syntoniqa FSM</h2>
          </div>
          <div style="background:#fff;padding:20px;border:1px solid #E5E7EB;border-radius:0 0 12px 12px">
            ${bodyHtml}
          </div>
          <p style="text-align:center;font-size:.75rem;color:#9CA3AF;margin-top:12px">${brand(env).name}</p>
        </div>`
      })
    });
    return await res.json();
  } catch (e) {
    console.error("Email error:", e.message);
    return null;
  }
}
__name(sendEmailAlert, "sendEmailAlert");
async function emailAdmins(env, subject, bodyHtml) {
  try {
    const admins = await sb(env, "utenti", "GET", null, "?ruolo=eq.admin&attivo=eq.true&select=email").catch(() => []);
    const emails = (admins || []).map((a) => a.email).filter(Boolean);
    if (emails.length) await sendEmailAlert(env, emails, subject, bodyHtml);
  } catch (e) {
  }
}
__name(emailAdmins, "emailAdmins");
async function sendTelegram(env, chatId, text) {
  if (!chatId) return null;
  let token = env.TELEGRAM_BOT_TOKEN || "";
  if (!token) {
    try {
      const cfgRows = await sb(env, "config", "GET", null, "?chiave=eq.telegram_bot_token&select=valore");
      if (cfgRows && cfgRows[0]) token = cfgRows[0].valore || "";
    } catch (e) {
    }
  }
  if (!token) return null;
  let htmlText = text.replace(/\*([^*\n]+)\*/g, "<b>$1</b>").replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/_([^_\n]+)_/g, "<i>$1</i>");
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: htmlText, parse_mode: "HTML" })
  }).then((r) => r.json()).catch(() => null);
}
__name(sendTelegram, "sendTelegram");
async function notifyTecnicoTG(env, tecnicoId, text) {
  if (!tecnicoId) return;
  try {
    const tec = await sb(env, "utenti", "GET", null, `?id=eq.${tecnicoId}&select=telegram_chat_id,nome,cognome`).catch(() => []);
    const chatId = tec?.[0]?.telegram_chat_id;
    if (chatId) {
      await sendTelegram(env, chatId, text);
    } else {
      console.log(`[TG-PRIV] Tecnico ${tecnicoId} (${tec?.[0]?.nome || "?"} ${tec?.[0]?.cognome || ""}) non ha telegram_chat_id \u2014 notifica non inviata`);
    }
  } catch (e) {
    console.error("[TG-PRIV]", e.message);
  }
}
__name(notifyTecnicoTG, "notifyTecnicoTG");
async function sendTelegramNotification(env, event, data) {
  const configRes = await sb(env, "config", "GET", null, "?chiave=in.(telegram_group_generale,telegram_bot_token)").catch(() => []);
  const cfg = Object.fromEntries(configRes.map((c) => [c.chiave, c.valore]));
  const group = cfg.telegram_group_generale;
  if (group) {
    const messages = {
      nuova_urgenza: `\u{1F6A8} <b>NUOVA URGENZA</b>
ID: ${data.id}
Problema: ${(data.problema || "").replace(/</g, "&lt;")}
Priorit\xE0: ${data.priorita_id || "?"}`,
      nuovo_intervento: `\u{1F4C5} <b>NUOVO INTERVENTO</b> ${data.id}
Data: ${data.data || "?"} | Tecnico: ${data.tecnico_id || "?"}`,
      urgenza_assegnata: `\u2705 Urgenza <b>${data.id}</b> assegnata a ${data.tecnicoAssegnato || "?"}`,
      richiesta_risposta: `\u{1F4CB} Richiesta <b>${data.id}</b> \u2192 ${data.stato || "?"}`,
      richiesta_nuova: `\u{1F4DD} <b>NUOVA RICHIESTA</b>
\u{1F464} ${data.tecnico || "?"}
\u{1F4CC} ${data.tipo || "?"}
\u{1F4C5} ${data.data_inizio || "?"} \u2192 ${data.data_fine || "?"}
\u{1F4AC} ${(data.motivo || "\u2014").replace(/</g, "&lt;")}`
    };
    const msg = messages[event];
    if (msg) await sendTelegram(env, group, msg);
  }
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    try {
      const pushMessages = {
        nuova_urgenza: { title: "\u{1F6A8} Nuova Urgenza", body: data.problema || "Nuova urgenza ricevuta", tag: "urgenza-" + data.id },
        nuovo_intervento: { title: "\u{1F4C5} Nuovo Intervento", body: `Intervento ${data.id} pianificato`, tag: "intervento-" + data.id },
        urgenza_assegnata: { title: "\u2705 Urgenza Assegnata", body: `Urgenza ${data.id} assegnata a te`, tag: "assegnazione-" + data.id },
        richiesta_risposta: { title: "\u{1F4CB} Risposta Richiesta", body: `Richiesta ${data.id}: ${data.stato}`, tag: "richiesta-" + data.id },
        richiesta_nuova: { title: "\u{1F4DD} Nuova Richiesta", body: `${data.tecnico || "?"}: ${data.tipo || "?"} dal ${data.data_inizio || "?"} al ${data.data_fine || "?"}`, tag: "richiesta-" + data.id }
      };
      const pushMsg = pushMessages[event];
      if (pushMsg) {
        let targetUsers = [];
        if (data.tecnico_id) targetUsers.push(data.tecnico_id);
        if (data.tecnico_assegnato) targetUsers.push(data.tecnico_assegnato);
        if (data.tecnicoAssegnato) targetUsers.push(data.tecnicoAssegnato);
        if (data.tecnici_ids) {
          try {
            targetUsers = targetUsers.concat(JSON.parse(data.tecnici_ids));
          } catch {
          }
        }
        targetUsers = [...new Set(targetUsers.filter(Boolean))];
        if (targetUsers.length) {
          const subs = await sb(
            env,
            "push_subscriptions",
            "GET",
            null,
            `?user_id=in.(${targetUsers.join(",")})&active=eq.true`
          ).catch(() => []);
          const payload = JSON.stringify({ ...pushMsg, url: "./" });
          for (const sub of subs) {
            sendWebPush(env, { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload).catch(() => {
            });
          }
        }
      }
    } catch (e) {
    }
  }
}
__name(sendTelegramNotification, "sendTelegramNotification");
async function triggerKPISnapshot(env, interventoId, tecnicoId) {
  if (!tecnicoId) return;
  const oggi = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const mese = oggi.slice(0, 7);
  const completati = await sb(env, "piano", "GET", null, `?tecnico_id=eq.${tecnicoId}&stato=in.(completato,chiuso)&data=gte.${mese}-01`);
  await sb(env, "kpi_log", "POST", {
    id: secureId("KPI"),
    data: oggi,
    tecnico_id: tecnicoId,
    metrica: "interventi_completati_mese",
    valore: completati.length,
    unita: "n",
    periodo: mese
  }).catch(() => {
  });
}
__name(triggerKPISnapshot, "triggerKPISnapshot");
async function checkInterventoReminders(env) {
  const now = /* @__PURE__ */ new Date();
  const itFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
  const itTimeFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hour12: false });
  const oggi = itFormatter.format(now);
  const oraCorrente = itTimeFormatter.format(now);
  const pianificati = await sb(
    env,
    "piano",
    "GET",
    null,
    `?data=eq.${oggi}&stato=eq.pianificato&obsoleto=eq.false&select=id,tecnico_id,cliente_id,ora_inizio,note`
  ).catch(() => []);
  for (const p of pianificati || []) {
    if (!p.ora_inizio || !p.tecnico_id) continue;
    const [ih, im] = p.ora_inizio.substring(0, 5).split(":").map(Number);
    const [ch, cm] = oraCorrente.split(":").map(Number);
    const diffMin = ch * 60 + cm - (ih * 60 + im);
    if (diffMin >= 60 && diffMin < 75) {
      const cliNome = await getEntityName(env, "clienti", p.cliente_id);
      const notifId = "NOT_REM1H_" + p.id + "_" + oggi;
      const existing = await sb(env, "notifiche", "GET", null, `?id=eq.${notifId}&select=id`).catch(() => []);
      if (existing?.length) continue;
      await sb(env, "notifiche", "POST", {
        id: notifId,
        tipo: "reminder",
        oggetto: "\u23F0 Intervento non iniziato",
        testo: `L'intervento delle ${p.ora_inizio} presso ${cliNome} non \xE8 stato ancora avviato. \xC8 passata pi\xF9 di 1 ora dall'orario previsto. Aggiorna lo stato!`,
        destinatario_id: p.tecnico_id,
        stato: "inviata",
        priorita: "alta"
      }).catch((e) => console.error("Notifica 1h error:", e.message));
      const tec = await sb(env, "utenti", "GET", null, `?id=eq.${p.tecnico_id}&select=nome,cognome,telegram_chat_id`).catch(() => []);
      if (tec?.[0]?.telegram_chat_id) {
        await sendTelegram(
          env,
          tec[0].telegram_chat_id,
          `\u23F0 <b>Intervento non iniziato!</b>
\u{1F4CB} ${cliNome} (ore ${p.ora_inizio})
\xC8 passata 1 ora \u2014 aggiorna lo stato con /incorso o dall'app.`
        ).catch(() => {
        });
      }
      await sb(env, "chat_messaggi", "POST", {
        id: secureId("MSG_REM"),
        canale_id: "CH_ADMIN",
        mittente_id: "TELEGRAM",
        testo: `\u23F0 REMINDER: Intervento ${p.id} (${cliNome}, ore ${p.ora_inizio}) \u2014 il tecnico ${tec?.[0]?.nome || ""} ${tec?.[0]?.cognome || ""} non ha ancora iniziato. +1h di ritardo.`,
        tipo: "testo",
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      }).catch(() => {
      });
    }
  }
  const inCorso = await sb(
    env,
    "piano",
    "GET",
    null,
    `?data=eq.${oggi}&stato=eq.in_corso&obsoleto=eq.false&select=id,tecnico_id,cliente_id,ora_inizio,note`
  ).catch(() => []);
  for (const p of inCorso || []) {
    if (!p.ora_inizio || !p.tecnico_id) continue;
    const [ih, im] = p.ora_inizio.substring(0, 5).split(":").map(Number);
    const [ch, cm] = oraCorrente.split(":").map(Number);
    const diffMin = ch * 60 + cm - (ih * 60 + im);
    if (diffMin >= 480 && diffMin < 495) {
      const cliNome = await getEntityName(env, "clienti", p.cliente_id);
      const notifId = "NOT_REM8H_" + p.id + "_" + oggi;
      const existing = await sb(env, "notifiche", "GET", null, `?id=eq.${notifId}&select=id`).catch(() => []);
      if (existing?.length) continue;
      await sb(env, "notifiche", "POST", {
        id: notifId,
        tipo: "reminder",
        oggetto: "\u{1F514} Aggiorna intervento (8h)",
        testo: `L'intervento presso ${cliNome} \xE8 in corso da pi\xF9 di 8 ore (inizio: ${p.ora_inizio}). Aggiorna lo stato, le note o completa l'intervento.`,
        destinatario_id: p.tecnico_id,
        stato: "inviata",
        priorita: "media"
      }).catch((e) => console.error("Notifica 8h error:", e.message));
      const tec = await sb(env, "utenti", "GET", null, `?id=eq.${p.tecnico_id}&select=nome,cognome,telegram_chat_id`).catch(() => []);
      if (tec?.[0]?.telegram_chat_id) {
        await sendTelegram(
          env,
          tec[0].telegram_chat_id,
          `\u{1F514} <b>Aggiorna intervento!</b>
\u{1F4CB} ${cliNome} \u2014 in corso da 8+ ore
Aggiorna le note o completa con /risolto`
        ).catch(() => {
        });
      }
    }
  }
  console.log(`[CRON] checkInterventoReminders: ${pianificati?.length || 0} pianificati, ${inCorso?.length || 0} in_corso checked`);
}
__name(checkInterventoReminders, "checkInterventoReminders");
async function checkSLAUrgenze(env) {
  try {
    const urgenze = await sb(
      env,
      "urgenze",
      "GET",
      null,
      "?stato=in.(aperta,assegnata,schedulata,in_corso)&sla_scadenza=not.is.null&obsoleto=eq.false&select=id,sla_scadenza,sla_status,tecnico_assegnato,cliente_id,problema"
    ).catch(() => []);
    const now = /* @__PURE__ */ new Date();
    let updated = 0;
    for (const u of urgenze || []) {
      try {
        const scadenza = new Date(u.sla_scadenza);
        const diffOre = (scadenza - now) / 36e5;
        let newStatus = "ok";
        if (diffOre < 0) newStatus = "breach";
        else if (diffOre < 2) newStatus = "critical";
        else if (diffOre < 6) newStatus = "warning";
        if (newStatus !== u.sla_status) {
          await sb(env, `urgenze?id=eq.${u.id}`, "PATCH", { sla_status: newStatus });
          updated++;
          if ((newStatus === "breach" || newStatus === "critical") && u.sla_status !== "breach") {
            const cliNome = await getEntityName(env, "clienti", u.cliente_id);
            const emoji = newStatus === "breach" ? "\u{1F534}" : "\u{1F7E0}";
            const label = newStatus === "breach" ? "SLA SCADUTO" : "SLA CRITICO";
            await sb(env, "chat_messaggi", "POST", {
              id: secureId("MSG_SLA"),
              canale_id: "CH_URGENZE",
              mittente_id: "TELEGRAM",
              testo: `${emoji} ${label}: Urgenza ${u.id}
\u{1F3E2} ${cliNome}
\u{1F4DD} ${(u.problema || "").substring(0, 60)}
\u23F1\uFE0F Scadenza: ${u.sla_scadenza?.substring(0, 16)?.replace("T", " ")}`,
              tipo: "testo",
              created_at: (/* @__PURE__ */ new Date()).toISOString()
            }).catch(() => {
            });
            if (newStatus === "breach") {
              await emailAdmins(
                env,
                `\u{1F534} SLA SCADUTO - Urgenza ${u.id}`,
                `<h3 style="color:#DC2626">${emoji} ${label}</h3>
                <p><strong>Urgenza:</strong> ${u.id}</p>
                <p><strong>Cliente:</strong> ${cliNome}</p>
                <p><strong>Problema:</strong> ${(u.problema || "").substring(0, 120)}</p>
                <p><strong>Scadenza SLA:</strong> ${u.sla_scadenza?.substring(0, 16)?.replace("T", " ")}</p>
                <p><strong>Tecnico:</strong> ${u.tecnico_assegnato || "Non assegnato"}</p>
                <p style="margin-top:16px"><a href="${brand(env).adminUrl}" style="background:#DC2626;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Apri Admin Dashboard</a></p>`
              );
            }
            if (u.tecnico_assegnato) {
              const notifId = "NOT_SLA_" + u.id + "_" + newStatus + "_" + now.toISOString().split("T")[0];
              const existing = await sb(env, "notifiche", "GET", null, `?id=eq.${notifId}&select=id`).catch(() => []);
              if (!existing?.length) {
                await sb(env, "notifiche", "POST", {
                  id: notifId,
                  tipo: "sla_alert",
                  oggetto: `${emoji} ${label}`,
                  testo: `Urgenza ${u.id} per ${cliNome}: ${label}! Intervieni subito.`,
                  destinatario_id: u.tecnico_assegnato,
                  stato: "inviata",
                  priorita: "urgente",
                  riferimento_id: u.id,
                  riferimento_tipo: "urgenza",
                  tenant_id: env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045"
                }).catch(() => {
                });
              }
            }
          }
        }
      } catch (e) {
        console.error(`[CRON] SLA check failed for urgenza ${u.id}: ${e.message}`);
      }
    }
    console.log(`[CRON] checkSLAUrgenze: ${urgenze?.length || 0} urgenze checked, ${updated} updated`);
    const urgAssegnate = await sb(
      env,
      "urgenze",
      "GET",
      null,
      "?stato=eq.assegnata&obsoleto=eq.false&select=id,data_assegnazione,tecnico_assegnato,problema,cliente_id"
    ).catch(() => []);
    for (const ua of urgAssegnate || []) {
      if (!ua.data_assegnazione) continue;
      const oreAssegnata = (now - new Date(ua.data_assegnazione)) / 36e5;
      if (oreAssegnata >= 4) {
        const escId = "NOT_ESC_" + ua.id + "_" + now.toISOString().split("T")[0];
        const existing = await sb(env, "notifiche", "GET", null, `?id=eq.${escId}&select=id`).catch(() => []);
        if (!existing?.length) {
          const cliName = await getEntityName(env, "clienti", ua.cliente_id).catch(() => "");
          const tecName = ua.tecnico_assegnato ? await getEntityName(env, "utenti", ua.tecnico_assegnato).catch(() => "") : "\u2014";
          const admins = await sb(env, "utenti", "GET", null, "?ruolo=eq.admin&attivo=eq.true&select=id").catch(() => []);
          for (const a of admins || []) {
            await sb(env, "notifiche", "POST", {
              id: escId + "_" + a.id.slice(-3),
              tipo: "escalation",
              oggetto: "\u23F0 ESCALATION: urgenza non iniziata",
              testo: `Urgenza ${ua.id} assegnata a ${tecName} da ${Math.floor(oreAssegnata)}h, non ancora iniziata! Cliente: ${cliName}`,
              destinatario_id: a.id,
              stato: "inviata",
              priorita: "urgente",
              riferimento_id: ua.id,
              riferimento_tipo: "urgenza",
              tenant_id: env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045"
            }).catch((e) => console.error("[SYNC]", e.message));
          }
          await notifyTecnicoTG(
            env,
            ua.tecnico_assegnato,
            `\u23F0 <b>SOLLECITO URGENZA</b>
\u{1F4CB} ${ua.id}: ${(ua.problema || "").substring(0, 80)}
\u{1F3E2} ${cliName}

\u26A0\uFE0F Assegnata da ${Math.floor(oreAssegnata)} ore, non ancora iniziata.
<i>Apri l'app e premi \u26A1 Inizia oppure \u274C Rifiuta</i>`
          );
          await sb(env, "chat_messaggi", "POST", {
            id: secureId("MSG_ESC"),
            canale_id: "CH_URGENZE",
            mittente_id: "SYSTEM",
            testo: `\u23F0 ESCALATION: Urgenza ${ua.id} assegnata a ${tecName} da ${Math.floor(oreAssegnata)}h, non iniziata!`,
            tipo: "testo",
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          }).catch((e) => console.error("[SYNC]", e.message));
          console.log(`[CRON] Escalation for urgenza ${ua.id} (${Math.floor(oreAssegnata)}h)`);
        }
      }
    }
  } catch (e) {
    console.error("[CRON] checkSLAUrgenze error:", e.message);
  }
}
__name(checkSLAUrgenze, "checkSLAUrgenze");
async function checkPMExpiry(env) {
  try {
    const now = /* @__PURE__ */ new Date();
    const itFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
    const today3 = itFormatter.format(now);
    const warning7 = addDays(today3, 7);
    const hourIT = parseInt(new Intl.DateTimeFormat("en", { timeZone: "Europe/Rome", hour: "numeric", hour12: false }).format(now));
    const isMorningSummaryWindow = hourIT >= 7 && hourIT < 8;
    const macchine3 = await sb(
      env,
      "macchine",
      "GET",
      null,
      `?obsoleto=eq.false&prossimo_tagliando=not.is.null&prossimo_tagliando=lte.${warning7}&select=id,seriale,modello,prossimo_tagliando,cliente_id&order=prossimo_tagliando.asc&limit=200`
    ).catch(() => []);
    if (!macchine3.length) {
      console.log("[CRON] checkPMExpiry: 0 tagliandi critici");
      return;
    }
    const tid = env.TENANT_ID || "785d94d0-b947-4a00-9c4e-3b67833e7045";
    const group = env.TELEGRAM_CHAT_ID || "-5236723213";
    let scaduti = 0, urgenti = 0;
    const tgLines = [];
    const clienteIds = [...new Set(macchine3.map((m) => m.cliente_id).filter(Boolean))];
    const anagClienti = clienteIds.length ? await sb(
      env,
      "anagrafica_clienti",
      "GET",
      null,
      `?codice_m3=in.(${clienteIds.join(",")})`
    ).catch(() => []) : [];
    const anagMap = {};
    (anagClienti || []).forEach((c) => {
      anagMap[c.codice_m3] = c;
    });
    for (const m of macchine3) {
      const gg = Math.round((new Date(m.prossimo_tagliando) - new Date(today3)) / 864e5);
      const isScaduto = gg < 0;
      const anagCli = anagMap[m.cliente_id];
      let cliNome = anagCli ? anagCli.nome_interno || anagCli.nome_account || m.cliente_id : await getEntityName(env, "clienti", m.cliente_id);
      const notifId = `PM_${isScaduto ? "SCAD" : "URG"}_${m.id}_${today3}`;
      const existing = await sb(env, "notifiche", "GET", null, `?id=eq.${notifId}&limit=1`).catch(() => []);
      if (existing?.length) {
        if (isScaduto) scaduti++;
        else urgenti++;
        continue;
      }
      const emoji = isScaduto ? "\u{1F534}" : "\u{1F7E1}";
      const label = isScaduto ? "SCADUTO" : "URGENTE";
      const admins = await sb(env, "utenti", "GET", null, "?ruolo=eq.admin&obsoleto=eq.false&select=id").catch(() => []);
      for (const adm of admins) {
        await sb(env, "notifiche", "POST", {
          id: notifId + "_" + adm.id.slice(-3),
          tenant_id: tid,
          tipo: isScaduto ? "pm_scaduto" : "pm_urgente",
          oggetto: `${emoji} Tagliando ${label} \u2014 ${m.modello || m.id}`,
          testo: `${m.modello || m.id} (S/N: ${m.seriale || "?"}) presso ${cliNome}. Tagliando ${isScaduto ? "scaduto da " + Math.abs(gg) + " giorni" : "in scadenza tra " + gg + " giorni"} (${m.prossimo_tagliando}).`,
          destinatario_id: adm.id,
          priorita: isScaduto ? "alta" : "media",
          data_invio: now.toISOString()
        }).catch(() => {
        });
      }
      tgLines.push(`${emoji} ${m.modello || m.id} (${m.seriale || "?"}) \u2014 ${cliNome} \u2014 ${isScaduto ? "scaduto da " + Math.abs(gg) + "gg" : "tra " + gg + "gg"}`);
      if (isScaduto) scaduti++;
      else urgenti++;
    }
    if (isMorningSummaryWindow && tgLines.length && env.TELEGRAM_BOT_TOKEN) {
      const tgNotifId = `PM_TG_DAILY_${today3}`;
      const tgExisting = await sb(env, "notifiche", "GET", null, `?id=eq.${tgNotifId}&limit=1`).catch(() => []);
      if (!tgExisting?.length) {
        const header = `\u{1F4CB} *Riepilogo Tagliandi PM \u2014 ${today3}*
\u{1F534} ${scaduti} scaduti | \u{1F7E1} ${urgenti} in scadenza (<7gg)
`;
        const body = tgLines.slice(0, 20).join("\n");
        const footer = tgLines.length > 20 ? `
... e altri ${tgLines.length - 20}` : "";
        await sendTelegram(env, group, header + body + footer).catch(() => {
        });
        await sb(env, "notifiche", "POST", {
          id: tgNotifId,
          tenant_id: tid,
          tipo: "pm_riepilogo_tg",
          oggetto: "Riepilogo PM TG giornaliero",
          testo: `${scaduti} scaduti, ${urgenti} urgenti`,
          destinatario_id: "SYSTEM",
          priorita: "bassa",
          data_invio: now.toISOString()
        }).catch(() => {
        });
      }
    }
    console.log(`[CRON] checkPMExpiry: ${scaduti} scaduti, ${urgenti} urgenti (<7gg), TG window: ${isMorningSummaryWindow}`);
  } catch (e) {
    console.error("[CRON] checkPMExpiry error:", e.message);
  }
}
__name(checkPMExpiry, "checkPMExpiry");
function skipWeekend(dateStr) {
  const d = new Date(dateStr);
  const dow = d.getDay();
  if (dow === 0) return addDays(dateStr, 1);
  if (dow === 6) return addDays(dateStr, 2);
  return dateStr;
}
__name(skipWeekend, "skipWeekend");
async function getEntityName(env, table, id) {
  if (!id) return "\u2014";
  if (table === "clienti") {
    const anag = await sb(env, "anagrafica_clienti", "GET", null, `?codice_m3=eq.${id}&select=nome_interno,nome_account`).catch(() => []);
    if (anag?.length) {
      return anag[0].nome_interno || anag[0].nome_account || id;
    }
  }
  const rows = await sb(env, table, "GET", null, `?id=eq.${id}&select=nome,ragione_sociale,cognome`).catch(() => []);
  if (!rows?.length) return id;
  const r = rows[0];
  return r.ragione_sociale || ((r.nome || "") + " " + (r.cognome || "")).trim() || id;
}
__name(getEntityName, "getEntityName");
export {
  cloudflare_worker_default as default
};
//# sourceMappingURL=cloudflare_worker.js.map
