/**
 * Syntoniqa v2.0 — Cloudflare Worker
 * Zero-cost backend: CF Workers (free 100k req/day) + Supabase (free Postgres)
 * Sostituisce Google Apps Script (3531 righe → Worker modulare)
 * 
 * ENV VARS (Cloudflare Dashboard → Settings → Variables):
 *   SUPABASE_URL        = https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY= eyJ...  (service_role key)
 *   SQ_TOKEN            = MRS_Syntoniqa_2026_MBGOAT   (o custom per tenant)
 *   [ai] binding        = AI (Workers AI — Llama 3.1 + LLaVA Vision)
 *   TELEGRAM_BOT_TOKEN  = 123456:ABC...
 *   RESEND_API_KEY      = re_...  (email via Resend - free 3k/mese)
 */

// ============ HELPERS ============

const ALLOWED_ORIGINS = [
  'https://fieldforcemrser2026.github.io',
  'https://app.syntoniqa.app',
  'http://localhost:3000',
  'http://localhost:8787'
];

// Dynamic CORS - aggiornato per request
let corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Token',
};

function setCorsForRequest(request) {
  const origin = request?.headers?.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  corsHeaders = {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Token',
  };
}

// ============ STATE MACHINE: transizioni valide ============
const VALID_PIANO_TRANSITIONS = {
  pianificato: ['in_corso', 'annullato'],
  in_corso: ['completato', 'pianificato', 'annullato'],
  completato: [],   // terminale
  annullato: ['pianificato']  // può essere ripianificato
};
const VALID_URGENZA_TRANSITIONS = {
  aperta: ['assegnata', 'chiusa'],
  assegnata: ['schedulata', 'in_corso', 'aperta', 'chiusa'],
  schedulata: ['in_corso', 'assegnata', 'chiusa'],
  in_corso: ['risolta', 'chiusa'],
  risolta: ['chiusa', 'in_corso'],   // riapertura se serve
  chiusa: []  // terminale
};

function validateTransition(validMap, currentStato, newStato, entityType) {
  if (!newStato || newStato === currentStato) return null; // nessun cambio
  const allowed = validMap[currentStato];
  if (!allowed) return `Stato corrente '${currentStato}' non valido per ${entityType}`;
  if (!allowed.includes(newStato)) return `Transizione ${entityType} non valida: ${currentStato} → ${newStato}. Consentite: ${allowed.join(', ')}`;
  return null; // valida
}

// ============ AUTHORIZATION HELPERS ============

async function requireAdmin(env, body) {
  const uid = body.operatoreId || body.userId;
  if (!uid) return 'operatoreId richiesto';
  const caller = await sb(env, 'utenti', 'GET', null, `?id=eq.${uid}&select=ruolo`).catch(()=>[]);
  if (!caller?.[0]) return 'Utente non trovato';
  if (caller[0].ruolo !== 'admin') return 'Solo admin può eseguire questa azione';
  return null; // ok
}

function validateNumeric(value, field, min = 0) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (isNaN(num)) return `${field} deve essere numerico`;
  if (num < min) return `${field} deve essere >= ${min}`;
  return null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function err(msg, status = 400) {
  return json({ success: false, error: msg }, status);
}


function ok(data = {}) {
  return json({ success: true, data });
}

// ============ PostgREST SANITIZER (CRIT-01: prevent filter injection) ============

function sanitizePgFilter(input) {
  if (!input || typeof input !== 'string') return '';
  // Remove PostgREST special chars that could break filter syntax
  return input.replace(/[*.,=|:()&!<>;\[\]{}\\/"'`%]/g, '').trim().slice(0, 100);
}

// ============ FIX CRIT-02: PascalCase ↔ snake_case TRANSFORM ============

function toPascal(key) {
  if (key === 'id') return 'ID';
  return key.split('_').map(part => {
    if (part === 'id') return 'ID';
    if (part === 'ids') return 'IDs';
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join('');
}

function toSnake(key) {
  if (key === 'ID') return 'id';
  return key
    .replace(/IDs$/g, '_ids')
    .replace(/ID$/g, '_id')
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/__+/g, '_');
}

function pascalizeRecord(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toPascal(k), v]));
}

function pascalizeArrays(data) {
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      result[key] = value.map(item => item && typeof item === 'object' ? pascalizeRecord(item) : item);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// FIX CRIT-04: Extract data from frontend's {data:{...}} wrapping and convert PascalCase → snake_case
function getFields(body) {
  const source = (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) ? body.data : body;
  const skip = new Set(['action', 'userId', 'operatoreId', 'token', 'method']);
  const result = {};
  for (const [k, v] of Object.entries(source)) {
    if (skip.has(k)) continue;
    if (v === undefined) continue; // skip undefined only — null/'' allowed to clear fields
    result[toSnake(k)] = v;
  }
  return result;
}

// Pre-processing globale body POST: flatten wrapper, PascalCase→snake_case, strip meta
function normalizeBody(raw) {
  const isDataWrapper = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data);
  const dataObj = isDataWrapper ? raw.data : {};
  // Convert nested data PascalCase → snake_case
  const converted = {};
  for (const [k, v] of Object.entries(dataObj)) {
    converted[toSnake(k)] = v;
  }
  // Process top-level fields (skip meta that would pollute INSERT)
  const { action, token, data, method, ...rest } = raw;
  const result = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k === 'userId' || k === 'operatoreId') {
      result[k] = v; // Keep as-is for logging
    } else {
      result[toSnake(k)] = v;
    }
  }
  // Keep 'data' if it was a primitive (e.g. date string "2026-02-22"), not a wrapper object
  if (data !== undefined && !isDataWrapper) {
    result.data = data;
  }
  // Overlay converted nested data (has priority)
  Object.assign(result, converted);
  return result;
}

// Supabase REST helper
async function sb(env, table, method = 'GET', body = null, params = '', extraHeaders = {}) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}${params}`;
  const res = await fetch(url, {
    method,
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table}: ${res.status} ${text}`);
  }
  const text = await res.text();
  if (!text) return method === 'GET' ? [] : null;
  try { return JSON.parse(text); } catch { return text; }
}

// Hash SHA-256 (Web Crypto API disponibile in CF Workers)
async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Auth check
function checkToken(request, env, bodyToken) {
  const token = request.headers.get('X-Token') || new URL(request.url).searchParams.get('token') || bodyToken || '';
  return token === env.SQ_TOKEN;
}

// ============ RATE LIMITER ============
// In-memory sliding window per IP. Resettato al cold-start.
const RATE_LIMITS = {
  default:   { max: 120, windowSec: 60 },   // 120 req/min per IP
  login:     { max: 5,   windowSec: 60 },   // 5 login/min
  ai:        { max: 10,  windowSec: 60 },   // 10 AI calls/min
};
const _rateStore = new Map(); // key: "ip:bucket" → [timestamps]

function rateLimit(ip, bucket = 'default') {
  const cfg = RATE_LIMITS[bucket] || RATE_LIMITS.default;
  const key = `${ip}:${bucket}`;
  const now = Date.now();
  const windowMs = cfg.windowSec * 1000;
  let hits = _rateStore.get(key) || [];
  hits = hits.filter(t => t > now - windowMs); // Remove expired
  if (hits.length >= cfg.max) {
    return { limited: true, retryAfter: Math.ceil((hits[0] + windowMs - now) / 1000) };
  }
  hits.push(now);
  _rateStore.set(key, hits);
  // Cleanup old keys periodically (every 1000th call)
  if (Math.random() < 0.001) {
    for (const [k, v] of _rateStore) {
      if (!v.length || v[v.length - 1] < now - windowMs * 2) _rateStore.delete(k);
    }
  }
  return { limited: false, remaining: cfg.max - hits.length };
}

// ============ ROUTER ============

export default {
  async fetch(request, env) {
    setCorsForRequest(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action') || url.pathname.split('/').pop();
    const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

    // Telegram webhook bypassa rate limit e token check ma valida secret se configurato
    if (action === 'telegramWebhook') {
      if (env.TELEGRAM_WEBHOOK_SECRET) {
        const webhookSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
        if (webhookSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
          return new Response('Unauthorized', { status: 401 });
        }
      }
      const body = await request.json().catch(() => ({}));
      return await handlePost(action, body, env);
    }

    // Rate limit check
    const bucket = action === 'login' ? 'login'
      : (action === 'generateAIPlan' || action === 'analyzeImage') ? 'ai'
      : 'default';
    const rl = rateLimit(clientIP, bucket);
    if (rl.limited) {
      return new Response(JSON.stringify({
        success: false,
        error: `Troppe richieste. Riprova tra ${rl.retryAfter} secondi.`
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) }
      });
    }

    try {
      if (request.method === 'GET') {
        if (!checkToken(request, env)) return err('Token non valido', 401);
        return await handleGet(action, url, env);
      } else if (request.method === 'POST') {
        const rawBody = await request.json().catch(() => ({}));
        if (!checkToken(request, env, rawBody.token)) return err('Token non valido', 401);
        const postAction = action || rawBody.action || '';
        const body = normalizeBody(rawBody);
        return await handlePost(postAction, body, env);
      }
      return err('Metodo non supportato', 405);
    } catch (e) {
      console.error('Worker error:', e);
      return err(`Errore interno: ${e.message}`, 500);
    }
  },

  // ============ CRON: notifiche automatiche interventi ============
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([
      checkInterventoReminders(env),
      checkSLAUrgenze(env)
    ]));
  }
};

// ============ GET HANDLERS ============

async function handleGet(action, url, env) {
  switch (action) {

    case 'getAll': {
      // Carica tutti i dati per dashboard/login (equivalente GAS getAll)
      // SECURITY: role-based filtering — tecnici vedono solo propri interventi/urgenze/ordini
      const reqUserId = url.searchParams.get('userId') || '';
      let userRole = 'admin';
      if (reqUserId) {
        const reqUser = await sb(env, 'utenti', 'GET', null, `?id=eq.${reqUserId}&select=ruolo`).catch(()=>[]);
        userRole = reqUser?.[0]?.ruolo || 'tecnico';
      }
      const isTecnico = userRole === 'tecnico';
      const tecFilter = isTecnico ? `&tecnico_id=eq.${reqUserId}` : '';
      const tecFilterUrg = isTecnico ? `&or=(tecnico_assegnato.eq.${reqUserId},segnalato_da.eq.${reqUserId})` : '';

      const [
        utenti, clienti, macchine, piano, urgenze, ordini,
        reperibilita, trasferte, notifiche, richieste, installazioni,
        pagellini, automezzi, tipi_intervento, priorita, squadre,
        tagliandi, fasi_installazione, sla_config,
        checklist_template, documenti, config
      ] = await Promise.all([
        sb(env, 'utenti',             'GET', null, '?select=*&obsoleto=eq.false&order=cognome'),
        sb(env, 'clienti',            'GET', null, '?select=*&obsoleto=eq.false&order=nome'),
        sb(env, 'macchine',           'GET', null, '?select=*&obsoleto=eq.false&limit=1000'),
        sb(env, 'piano',              'GET', null, `?select=*&obsoleto=eq.false&order=data.desc&limit=500${tecFilter}`),
        sb(env, 'urgenze',            'GET', null, `?select=*&obsoleto=eq.false&order=data_segnalazione.desc&limit=200${tecFilterUrg}`),
        sb(env, 'ordini',             'GET', null, `?select=*&obsoleto=eq.false&order=data_richiesta.desc&limit=300${tecFilter}`),
        sb(env, 'reperibilita',       'GET', null, `?select=*&obsoleto=eq.false&order=data_inizio.desc&limit=200${tecFilter}`),
        sb(env, 'trasferte',          'GET', null, `?select=*&obsoleto=eq.false&order=data_inizio.desc&limit=100${tecFilter}`),
        sb(env, 'notifiche',          'GET', null, isTecnico ? `?select=*&obsoleto=eq.false&destinatario_id=eq.${reqUserId}&order=data_invio.desc&limit=100` : '?select=*&obsoleto=eq.false&order=data_invio.desc&limit=200'),
        sb(env, 'richieste',          'GET', null, '?select=*&obsoleto=eq.false&order=data_richiesta.desc'),
        sb(env, 'installazioni',      'GET', null, '?select=*&obsoleto=eq.false'),
        sb(env, 'pagellini',          'GET', null, isTecnico ? `?select=*&obsoleto=eq.false&tecnico_id=eq.${reqUserId}&order=data_creazione.desc` : '?select=*&obsoleto=eq.false&order=data_creazione.desc'),
        sb(env, 'automezzi',          'GET', null, '?select=*&obsoleto=eq.false'),
        sb(env, 'tipi_intervento',    'GET', null, '?select=*&attivo=eq.true'),
        sb(env, 'priorita',           'GET', null, '?select=*&attivo=eq.true&order=livello'),
        sb(env, 'squadre',            'GET', null, '?select=*&attivo=eq.true'),
        sb(env, 'tagliandi',          'GET', null, '?select=*&attivo=eq.true'),
        sb(env, 'fasi_installazione', 'GET', null, '?select=*&attivo=eq.true&order=ordine'),
        sb(env, 'sla_config',         'GET', null, '?select=*&attivo=eq.true'),
        sb(env, 'checklist_template', 'GET', null, '?select=*&attivo=eq.true'),
        sb(env, 'documenti',          'GET', null, '?select=*&obsoleto=eq.false&order=data_caricamento.desc'),
        sb(env, 'config',             'GET', null, '?select=chiave,valore'),
      ]);
      
      // Rimuovi password_hash da utenti
      const utentiSafe = utenti.map(u => { const {password_hash, ...rest} = u; return rest; });
      
      // FIX CRIT-02: Converti snake_case → PascalCase per compatibilità frontend
      return ok(pascalizeArrays({
        utenti: utentiSafe, clienti, macchine, piano, urgenze, ordini,
        reperibilita, trasferte, notifiche, richieste, installazioni,
        pagellini, automezzi, tipiIntervento: tipi_intervento,
        priorita, squadre, tagliandi,
        fasiInstallazione: fasi_installazione,
        slaConfig: sla_config,
        checklistTemplate: checklist_template,
        documenti,
        config: Object.fromEntries(config.map(c => [c.chiave, c.valore])),
        timestamp: new Date().toISOString()
      }));
    }

    case 'getKPI': {
      const tecnicoId = url.searchParams.get('tecnicoId') || '';
      const periodo   = url.searchParams.get('periodo') || 'mese';
      
      let dateFilter = '';
      const now = new Date();
      if (periodo === 'settimana') {
        const d = new Date(now); d.setDate(d.getDate() - 7);
        dateFilter = `&data=gte.${d.toISOString().split('T')[0]}`;
      } else if (periodo === 'mese') {
        dateFilter = `&data=gte.${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      } else if (periodo === 'anno') {
        dateFilter = `&data=gte.${now.getFullYear()}-01-01`;
      }
      
      const tecnicoFilter = tecnicoId ? `&tecnico_id=eq.${tecnicoId}` : '';
      const kpi = await sb(env, 'kpi_log', 'GET', null, `?select=*${dateFilter}${tecnicoFilter}`);
      return ok({ kpi, periodo, tecnicoId });
    }

    case 'getKPITecnici': {
      // Aggregazione KPI per tutti i tecnici dal piano
      const mese = url.searchParams.get('mese') || new Date().toISOString().slice(0, 7);
      const interventi = await sb(env, 'piano', 'GET', null,
        `?select=tecnico_id,stato,ore_lavorate,km_percorsi&data=gte.${mese}-01&data=lte.${mese}-31&obsoleto=eq.false`);
      
      const byTecnico = {};
      interventi.forEach(i => {
        if (!i.tecnico_id) return;
        if (!byTecnico[i.tecnico_id]) byTecnico[i.tecnico_id] = { total: 0, completati: 0, ore: 0, km: 0 };
        byTecnico[i.tecnico_id].total++;
        if (i.stato === 'completato' || i.stato === 'chiuso') byTecnico[i.tecnico_id].completati++;
        byTecnico[i.tecnico_id].ore += parseFloat(i.ore_lavorate || 0);
        byTecnico[i.tecnico_id].km  += parseInt(i.km_percorsi || 0);
      });
      return ok({ kpiTecnici: byTecnico, mese });
    }

    case 'getBackupHistory': {
      const backups = await sb(env, 'kpi_snapshot', 'GET', null,
        '?tipo_snapshot=eq.backup&order=data.desc&limit=30');
      return ok({ backups });
    }

    case 'getAuditLog': {
      const entityType = url.searchParams.get('entityType') || '';
      const userId     = url.searchParams.get('userId') || '';
      const limit      = url.searchParams.get('limit') || '100';
      let params = `?order=timestamp_at.desc&limit=${limit}`;
      if (entityType) params += `&entity_type=eq.${entityType}`;
      if (userId)     params += `&user_id=eq.${userId}`;
      const logs = await sb(env, 'workflow_log', 'GET', null, params);
      return ok({ logs });
    }

    case 'getChecklistTemplates': {
      const templates = await sb(env, 'checklist_template', 'GET', null, '?attivo=eq.true');
      return ok({ templates });
    }

    case 'getPagellini': {
      const tecnicoId = url.searchParams.get('tecnicoId') || '';
      const params = tecnicoId ? `?tecnico_id=eq.${tecnicoId}&obsoleto=eq.false` : '?obsoleto=eq.false';
      const [pagellini, voci] = await Promise.all([
        sb(env, 'pagellini', 'GET', null, params),
        sb(env, 'pagellini_voci', 'GET', null, '?select=*'),
      ]);
      return ok({ pagellini, voci });
    }

    case 'exportPowerBI': {
      // SECURITY: solo admin
      const pbiUser = url.searchParams.get('userId') || '';
      if (pbiUser) {
        const pbiCaller = await sb(env, 'utenti', 'GET', null, `?id=eq.${pbiUser}&select=ruolo`).catch(()=>[]);
        if (pbiCaller?.[0]?.ruolo !== 'admin') return err('Solo admin può esportare PowerBI', 403);
      }
      const [piano, urgenze, utenti, clienti, macchine, kpiLog] = await Promise.all([
        sb(env, 'piano',    'GET', null, '?select=*&obsoleto=eq.false&order=data.desc&limit=5000'),
        sb(env, 'urgenze',  'GET', null, '?select=*&obsoleto=eq.false&order=data_segnalazione.desc&limit=2000'),
        sb(env, 'utenti',   'GET', null, '?select=id,nome,cognome,ruolo,squadra_id&obsoleto=eq.false'),
        sb(env, 'clienti',  'GET', null, '?select=id,nome,citta,prov&obsoleto=eq.false'),
        sb(env, 'macchine', 'GET', null, '?select=id,cliente_id,tipo,modello&obsoleto=eq.false'),
        sb(env, 'kpi_log',  'GET', null, '?order=data.desc&limit=1000&obsoleto=eq.false'),
      ]);
      return ok({ fact_interventi: piano, fact_urgenze: urgenze, fact_kpi: kpiLog, dim_tecnici: utenti, dim_clienti: clienti, dim_macchine: macchine });
    }

    default:
      return err(`Azione GET non trovata: ${action}`, 404);
  }
}

// ============ POST HANDLERS ============

async function handlePost(action, body, env) {
  // Wrapper per log workflow automatico
  const TENANT = env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045';
  async function wlog(entityType, entityId, action, userId, note = '') {
    await sb(env, 'workflow_log', 'POST', {
      id: `WL_${Date.now()}`,
      entity_type: entityType, entity_id: entityId,
      action, user_id: userId, note,
      tenant_id: TENANT,
      timestamp_at: new Date().toISOString()
    }).catch(() => {}); // non-blocking
  }

  switch (action) {

    // -------- AUTH --------

    case 'login': {
      const { username, password } = body;
      if (!username || !password) return err('Username e password richiesti');
      
      const utenti = await sb(env, 'utenti', 'GET', null,
        `?username=eq.${encodeURIComponent(username)}&attivo=eq.true&obsoleto=eq.false`);
      
      if (!utenti.length) return err('Credenziali non valide', 401);
      const utente = utenti[0];
      
      const hashed = await hashPassword(password);
      const validHash  = utente.password_hash === hashed;
      const validPlain = utente.password_hash === password; // fallback legacy
      
      if (!validHash && !validPlain) return err('Credenziali non valide', 401);
      
      // Migra a hash se era plain
      if (validPlain && !validHash) {
        await sb(env, `utenti?id=eq.${utente.id}`, 'PATCH', { password_hash: hashed });
      }
      
      const { password_hash, ...utenteSafe } = utente;
      await wlog('auth', utente.id, 'login', utente.id);
      // FIX CRIT-01: Frontend aspetta 'user' non 'utente', + PascalCase record
      return ok({ user: pascalizeRecord(utenteSafe) });
    }

    case 'resetPassword': {
      const uid = body.userId || body.user_id;
      const newPwd = body.new_password || body.newPassword;
      if (!uid || !newPwd) return err('userId e newPassword richiesti');
      const hashed = await hashPassword(newPwd);
      await sb(env, `utenti?id=eq.${uid}`, 'PATCH', { password_hash: hashed, updated_at: new Date().toISOString() });
      await wlog('utente', uid, 'reset_password', body.operatoreId || body.operatore_id || 'system');
      return ok();
    }

    case 'changePassword': {
      const uid = body.userId || body.user_id;
      const { old_password, new_password } = body;
      if (!uid || !old_password || !new_password) return err('userId, old_password e new_password richiesti');
      if (new_password.length < 6) return err('La nuova password deve avere almeno 6 caratteri');
      // Verifica vecchia password
      const users = await sb(env, 'utenti', 'GET', null, `?id=eq.${uid}&select=id,password_hash`);
      if (!users?.length) return err('Utente non trovato');
      const oldHash = await hashPassword(old_password);
      if (users[0].password_hash !== oldHash) return err('Password attuale non corretta');
      // Aggiorna
      const newHash = await hashPassword(new_password);
      await sb(env, `utenti?id=eq.${uid}`, 'PATCH', { password_hash: newHash, updated_at: new Date().toISOString() });
      await wlog('utente', uid, 'change_password', uid);
      return ok({ message: 'Password aggiornata con successo' });
    }

    case 'requestPasswordReset': {
      const { username } = body;
      if (!username) return err('Username richiesto');
      // Trova utente
      const users = await sb(env, 'utenti', 'GET', null, `?username=eq.${username}&select=id,nome,cognome,username,email`);
      if (!users?.length) return err('Username non trovato nel sistema');
      const u = users[0];
      // Crea notifica per admin (trova primo admin reale)
      const admins = await sb(env, 'utenti', 'GET', null, '?ruolo=eq.admin&attivo=eq.true&select=id,tenant_id&limit=1').catch(()=>[]);
      const adminId = admins?.[0]?.id || 'USR001';
      const tenantId = admins?.[0]?.tenant_id || u.tenant_id || null;
      const notifId = 'NOT_RST_' + Date.now();
      await sb(env, 'notifiche', 'POST', {
        id: notifId, tipo: 'reset_password', oggetto: '🔑 Richiesta Reset Password',
        testo: `L'utente ${u.nome} ${u.cognome} (${u.username}) ha richiesto il reset della password. Vai su Gestione Utenti per resettarla.`,
        destinatario_id: adminId, stato: 'inviata', priorita: 'alta',
        tenant_id: tenantId
      });
      // Manda anche su chat admin
      try {
        const msgId = 'MSG_RST_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
        await sb(env, 'chat_messaggi', 'POST', {
          id: msgId, canale_id: 'CH_ADMIN', mittente_id: 'TELEGRAM',
          testo: `🔑 RICHIESTA RESET PASSWORD\n👤 ${u.nome} ${u.cognome} (${u.username})\n📧 ${u.email || 'nessuna email'}\n\n→ Vai su Gestione Utenti > Modifica > Reset Password`,
          tipo: 'testo', created_at: new Date().toISOString()
        });
      } catch(e) {}
      // Manda su Telegram
      try {
        const cfgRows = await sb(env, 'config', 'GET', null, '?chiave=in.(telegram_bot_token,telegram_group_generale)&select=chiave,valore');
        const cfg = {}; (cfgRows||[]).forEach(c => { cfg[c.chiave] = c.valore; });
        if (cfg.telegram_bot_token && cfg.telegram_group_generale) {
          await fetch(`https://api.telegram.org/bot${cfg.telegram_bot_token}/sendMessage`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ chat_id: cfg.telegram_group_generale, text: `🔑 <b>RESET PASSWORD</b>\n👤 ${u.nome} ${u.cognome} (${u.username}) ha chiesto il reset password.\nAdmin: vai su Gestione Utenti per resettarla.`, parse_mode: 'HTML' })
          }).catch(e=>console.error('[SYNC]',e.message));
        }
      } catch(e) {}
      return ok({ message: 'Richiesta inviata. L\'admin riceverà una notifica per resettare la tua password.' });
    }

    // -------- PIANO (INTERVENTI) --------

    case 'createPiano': {
      const id = 'INT_' + Date.now();
      const fields = getFields(body);
      if (!fields.data) return err('Campo data obbligatorio per createPiano');
      if (!fields.cliente_id) return err('Campo cliente_id obbligatorio per createPiano');
      // Writable: id,tenant_id,tecnico_id,cliente_id,automezzo_id,tipo_intervento_id,data,ora_inizio,ora_fine,stato,note,data_fine
      const row = {
        id,
        tenant_id: fields.tenant_id || env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045',
        tecnico_id: fields.tecnico_id || null,
        cliente_id: fields.cliente_id || null,
        automezzo_id: fields.automezzo_id || null,
        tipo_intervento_id: fields.tipo_intervento_id || null,
        data: fields.data || null,
        ora_inizio: fields.ora_inizio || null,
        ora_fine: fields.ora_fine || null,
        stato: fields.stato || 'pianificato',
        note: fields.note || null,
        data_fine: fields.data_fine || null
      };
      const result = await sb(env, 'piano', 'POST', row);
      await wlog('piano', id, 'created', body.operatoreId || body.userId);
      await sendTelegramNotification(env, 'nuovo_intervento', row);
      return ok({ intervento: pascalizeRecord(result[0]) });
    }

    case 'updatePiano': {
      const id = body.id;
      if (!id) return err('id piano richiesto');
      const allFields = getFields(body);
      // Only writable piano columns
      const pianoWritable = ['tecnico_id','cliente_id','macchina_id','automezzo_id','tipo_intervento_id','priorita_id','data','ora_inizio','ora_fine','durata_ore','stato','note','data_fine','obsoleto'];
      const updates = {};
      for (const k of pianoWritable) { if (allFields[k] !== undefined) updates[k] = allFields[k]; }
      // Validazione numerici
      for (const [field, min] of [['durata_ore', 0], ['ore_lavorate', 0], ['km_percorsi', 0]]) {
        const numErr = validateNumeric(updates[field], field, min);
        if (numErr) return err(numErr);
      }
      // Validazione transizione stato
      if (updates.stato) {
        const current = await sb(env, 'piano', 'GET', null, `?id=eq.${id}&select=stato`).catch(()=>[]);
        if (current?.[0]?.stato) {
          const transErr = validateTransition(VALID_PIANO_TRANSITIONS, current[0].stato, updates.stato, 'piano');
          if (transErr) return err(transErr);
        }
      }
      updates.updated_at = new Date().toISOString();
      await sb(env, `piano?id=eq.${id}`, 'PATCH', updates);
      await wlog('piano', id, `updated_stato_${updates.stato || 'fields'}`, body.operatoreId || body.userId);
      if (updates.stato === 'completato') {
        await triggerKPISnapshot(env, id, updates.tecnico_id);
        // Auto-risolvi urgenza collegata se esiste
        try {
          const linkedUrg = await sb(env, 'urgenze', 'GET', null, `?intervento_id=eq.${id}&stato=in.(assegnata,schedulata,in_corso)&select=id`).catch(()=>[]);
          for (const u of (linkedUrg||[])) {
            await sb(env, `urgenze?id=eq.${u.id}`, 'PATCH', { stato: 'risolta', data_risoluzione: new Date().toISOString(), updated_at: new Date().toISOString() });
            await wlog('urgenza', u.id, 'auto_resolved_from_piano', body.operatoreId || body.userId, `piano ${id} completato`);
          }
        } catch(e){ console.error('Auto-resolve urgenza error:', e.message); }
      }
      if (updates.stato === 'in_corso') {
        // Auto-start urgenza collegata se è in stato assegnata
        try {
          const linkedUrg2 = await sb(env, 'urgenze', 'GET', null, `?intervento_id=eq.${id}&stato=eq.assegnata&select=id`).catch(()=>[]);
          for (const u of (linkedUrg2||[])) {
            await sb(env, `urgenze?id=eq.${u.id}`, 'PATCH', { stato: 'in_corso', data_inizio: new Date().toISOString(), updated_at: new Date().toISOString() });
            await wlog('urgenza', u.id, 'auto_started_from_piano', body.operatoreId || body.userId);
          }
        } catch(e){ console.error('Auto-start urgenza error:', e.message); }
      }
      if (updates.stato === 'annullato') {
        // Ripristina urgenze collegate a stato aperta (l'intervento è annullato, l'urgenza rimane aperta)
        try {
          const linkedUrgAnn = await sb(env, 'urgenze', 'GET', null, `?intervento_id=eq.${id}&stato=in.(assegnata,schedulata,in_corso)&select=id`).catch(()=>[]);
          for (const u of (linkedUrgAnn||[])) {
            await sb(env, `urgenze?id=eq.${u.id}`, 'PATCH', { stato: 'aperta', intervento_id: null, tecnico_assegnato: null, updated_at: new Date().toISOString() });
            await wlog('urgenza', u.id, 'reopened_from_piano_annullato', body.operatoreId || body.userId, `piano ${id} annullato`);
          }
        } catch(e){ console.error('Reopen urgenza from annullato error:', e.message); }
      }
      return ok();
    }

    // -------- URGENZE --------

    case 'createUrgenza': {
      const id = 'URG_' + Date.now();
      // FIX CRIT-04: Estrai e converti campi PascalCase → snake_case
      const fields = getFields(body);
      // Calcola SLA scadenza
      let slaScadenza = null;
      const pId = fields.priorita_id;
      if (pId) {
        const sla = await sb(env, 'sla_config', 'GET', null, `?priorita_id=eq.${pId}&attivo=eq.true`);
        if (sla.length && sla[0].tempo_risoluzione_ore) {
          const d = new Date();
          d.setHours(d.getHours() + sla[0].tempo_risoluzione_ore);
          slaScadenza = d.toISOString();
        }
      }
      // Only writable urgenze columns
      const urgWritable = ['tenant_id','cliente_id','macchina_id','problema','priorita_id','stato','tecnico_assegnato','tecnici_ids','automezzo_id','data_segnalazione','data_assegnazione','data_prevista','ora_prevista','data_inizio','data_risoluzione','intervento_id','note','allegati_ids','sla_scadenza','sla_status'];
      const row = { id };
      for (const k of urgWritable) { if (fields[k] !== undefined) row[k] = fields[k]; }
      row.tenant_id = row.tenant_id || env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045';
      row.stato = row.stato || 'aperta'; row.sla_scadenza = slaScadenza; row.sla_status = 'ok'; row.data_segnalazione = row.data_segnalazione || new Date().toISOString();
      const result = await sb(env, 'urgenze', 'POST', row);
      await wlog('urgenza', id, 'created', body.operatoreId || body.userId);
      await sendTelegramNotification(env, 'nuova_urgenza', row);

      // ---- SMART DISPATCHING: trova tecnici con slot varie/disponibili oggi ----
      let smartSuggestion = null;
      try {
        const itFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
        const oggi = itFmt.format(new Date());
        // Cerca interventi "varie" o "gestione urgenze" pianificati per oggi
        const pianoOggi = await sb(env, 'piano', 'GET', null,
          `?data=eq.${oggi}&stato=eq.pianificato&obsoleto=eq.false&select=id,tecnico_id,note,tipo_intervento_id`
        ).catch(() => []);
        const disponibili = pianoOggi.filter(p => {
          const nota = ((p.note || '') + ' ' + (p.tipo_intervento_id || '')).toLowerCase();
          return nota.includes('varie') || nota.includes('disponibil') || nota.includes('urgenz') || nota.includes('backup');
        });

        if (disponibili.length) {
          // Arricchisci con nomi tecnici
          const tecIds = [...new Set(disponibili.map(d => d.tecnico_id).filter(Boolean))];
          const tecnici = tecIds.length ? await sb(env, 'utenti', 'GET', null,
            `?id=in.(${tecIds.join(',')})&select=id,nome,cognome,base,telegram_chat_id`
          ).catch(() => []) : [];
          const tecMap = Object.fromEntries(tecnici.map(t => [t.id, t]));

          // Trova il migliore: preferisci chi ha base vicina al cliente
          const candidates = disponibili.map(d => {
            const t = tecMap[d.tecnico_id] || {};
            return { tecnicoId: d.tecnico_id, nome: `${t.nome || ''} ${t.cognome || ''}`.trim(), base: t.base, chatId: t.telegram_chat_id, pianoId: d.id };
          }).filter(c => c.nome);

          if (candidates.length) {
            smartSuggestion = { tecnici_disponibili: candidates, urgenza_id: id };
            // Notifica nel gruppo TG con suggerimento smart
            const sugTxt = candidates.map(c => `• ${c.nome}${c.base ? ' (da ' + c.base + ')' : ''}`).join('\n');
            const configRes2 = await sb(env, 'config', 'GET', null, '?chiave=eq.telegram_group_generale').catch(() => []);
            const groupId = configRes2?.[0]?.valore;
            if (groupId) {
              await sendTelegram(env, groupId,
                `💡 <b>SMART DISPATCH</b>\n` +
                `Urgenza ${id}: ${(row.problema||'').substring(0,60)}\n\n` +
                `Tecnici con slot VARIE oggi:\n${sugTxt}\n\n` +
                `Usa <code>/assegna ${id} [tecnico]</code> per assegnare`
              );
            }
          }
        }
      } catch(e) { console.error('Smart dispatch error:', e.message); }

      // Email admin per nuova urgenza
      const cliNomeUrg = await getEntityName(env, 'clienti', row.cliente_id).catch(()=>'');
      emailAdmins(env, `🚨 Nuova Urgenza ${id}`,
        `<h3 style="color:#DC2626">🚨 Nuova Urgenza</h3>
        <p><strong>ID:</strong> ${id}</p>
        <p><strong>Cliente:</strong> ${cliNomeUrg}</p>
        <p><strong>Problema:</strong> ${(row.problema || '').substring(0, 200)}</p>
        <p><strong>SLA:</strong> ${slaScadenza ? slaScadenza.substring(0,16).replace('T',' ') : 'N/D'}</p>
        ${smartSuggestion ? '<p><strong>💡 Tecnici disponibili oggi:</strong> ' + smartSuggestion.tecnici_disponibili.map(t=>t.nome).join(', ') + '</p>' : ''}
        <p style="margin-top:16px"><a href="https://fieldforcemrser2026.github.io/syntoniqa/admin_v1.html" style="background:#C30A14;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Vai alla Dashboard</a></p>`
      ).catch(e=>console.error('[SYNC]',e.message));
      return ok({ urgenza: pascalizeRecord(result[0]), smartDispatch: smartSuggestion });
    }

    case 'assignUrgenza': {
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
        stato: 'assegnata',
        data_assegnazione: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (dataPrev) patch.data_prevista = dataPrev;
      if (oraPrev) patch.ora_prevista = oraPrev;
      await sb(env, `urgenze?id=eq.${id}`, 'PATCH', patch);
      await wlog('urgenza', id, 'assigned', operatoreId || userId, `a ${tecId}`);
      await sendTelegramNotification(env, 'urgenza_assegnata', { id, tecnicoAssegnato: tecId });
      // Notifica in-app al tecnico assegnato
      if (tecId) {
        const urgDet = await sb(env, 'urgenze', 'GET', null, `?id=eq.${id}&select=problema,cliente_id`).catch(()=>[]);
        const prob = urgDet?.[0]?.problema || '';
        const cliId = urgDet?.[0]?.cliente_id || '';
        const cliName = cliId ? await getEntityName(env, 'clienti', cliId).catch(()=>'') : '';
        await sb(env, 'notifiche', 'POST', {
          id: 'NOT_ASS_' + Date.now(), tipo: 'urgenza', oggetto: '🚨 Urgenza assegnata a te',
          testo: `Urgenza ${id}: ${prob.substring(0,80)}${cliName?' · '+cliName:''}`,
          destinatario_id: tecId, stato: 'inviata', priorita: 'alta',
          riferimento_id: id, riferimento_tipo: 'urgenza',
          tenant_id: env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045'
        }).catch(e=>console.error('[SYNC]',e.message));
        // Telegram privato al tecnico
        await notifyTecnicoTG(env, tecId, `🚨 <b>URGENZA ASSEGNATA A TE</b>\n📋 ${prob.substring(0,100)}\n🏢 ${cliName||'—'}\n📅 ${dataPrev||'ASAP'} ${oraPrev||''}\n\n<i>Apri l'app per iniziare</i>`);
      }
      return ok();
    }

    case 'rejectUrgenza': {
      const { id } = body;
      if (!id) return err('id urgenza richiesto');
      const motivo = body.motivo || body.note || 'Nessun motivo specificato';
      const userId = body.operatoreId || body.userId;
      // Verifica che sia assegnata
      const urgCheck = await sb(env, 'urgenze', 'GET', null, `?id=eq.${id}&select=stato,tecnico_assegnato,problema,cliente_id`).catch(()=>[]);
      if (!urgCheck?.[0]) return err('Urgenza non trovata');
      if (urgCheck[0].stato !== 'assegnata' && urgCheck[0].stato !== 'schedulata') return err('Solo urgenze assegnate/schedulate possono essere rifiutate');
      // Riporta ad aperta, rimuovi tecnico
      await sb(env, `urgenze?id=eq.${id}`, 'PATCH', {
        stato: 'aperta', tecnico_assegnato: null, tecnici_ids: null, automezzo_id: null,
        note: `[RIFIUTATA da ${userId}] ${motivo}\n${urgCheck[0].note||''}`.trim(),
        updated_at: new Date().toISOString()
      });
      await wlog('urgenza', id, 'rejected', userId, motivo);
      // Notifica admin
      const admins = await sb(env, 'utenti', 'GET', null, '?ruolo=eq.admin&attivo=eq.true&select=id,nome,cognome').catch(()=>[]);
      const tecName = userId ? await getEntityName(env, 'utenti', userId).catch(()=>userId) : userId;
      for (const a of (admins||[])) {
        await sb(env, 'notifiche', 'POST', {
          id: 'NOT_REJ_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
          tipo: 'urgenza', oggetto: '⚠️ Urgenza RIFIUTATA',
          testo: `${tecName} ha rifiutato urgenza ${id}: ${motivo}`,
          destinatario_id: a.id, stato: 'inviata', priorita: 'alta',
          riferimento_id: id, riferimento_tipo: 'urgenza',
          tenant_id: env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045'
        }).catch(e=>console.error('[SYNC]',e.message));
      }
      // Chat + Telegram
      try {
        const msgId = 'MSG_URG_REJ_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
        await sb(env, 'chat_messaggi', 'POST', {
          id: msgId, canale_id: 'CH_URGENZE', mittente_id: userId || 'SYSTEM',
          testo: `⚠️ Urgenza ${id} RIFIUTATA da ${tecName}\n📝 Motivo: ${motivo}`, tipo: 'testo', created_at: new Date().toISOString()
        });
      } catch(e){}
      // Email admin
      await emailAdmins(env, `⚠️ Urgenza ${id} rifiutata`,
        `<h3>⚠️ Urgenza Rifiutata</h3><p><strong>${tecName}</strong> ha rifiutato l'urgenza <strong>${id}</strong></p><p><strong>Motivo:</strong> ${motivo}</p><p><strong>Problema:</strong> ${urgCheck[0].problema||'—'}</p><p style="color:#DC2626"><strong>Azione richiesta:</strong> Riassegnare l'urgenza a un altro tecnico</p>`
      ).catch(e=>console.error('[EMAIL]',e.message));
      return ok();
    }

    case 'startUrgenza': {
      const { id } = body;
      if (!id) return err('id urgenza richiesto');
      await sb(env, `urgenze?id=eq.${id}`, 'PATCH', {
        stato: 'in_corso',
        data_inizio: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      await wlog('urgenza', id, 'started', body.operatoreId || body.userId);
      // Aggiorna anche il piano collegato se esiste
      const urg = await sb(env, 'urgenze', 'GET', null, `?id=eq.${id}&select=intervento_id`).catch(()=>[]);
      if (urg?.[0]?.intervento_id) {
        await sb(env, `piano?id=eq.${urg[0].intervento_id}`, 'PATCH', { stato: 'in_corso', updated_at: new Date().toISOString() }).catch(e=>console.error('[SYNC]',e.message));
      }
      // Notifica chat admin
      try {
        const msgId = 'MSG_URG_START_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
        await sb(env, 'chat_messaggi', 'POST', {
          id: msgId, canale_id: 'CH_URGENZE', mittente_id: body.operatoreId || body.userId || 'SYSTEM',
          testo: `⚡ Urgenza ${id} INIZIATA`, tipo: 'testo', created_at: new Date().toISOString()
        });
      } catch(e){}
      return ok();
    }

    case 'resolveUrgenza': {
      const { id } = body;
      if (!id) return err('id urgenza richiesto');
      // Valida transizione stato
      const urgCurrent = await sb(env, 'urgenze', 'GET', null, `?id=eq.${id}&select=stato`).catch(() => []);
      if (!urgCurrent?.[0]) return err('Urgenza non trovata', 404);
      const stateErr = validateTransition(VALID_URGENZA_TRANSITIONS, urgCurrent[0].stato, 'risolta', 'urgenza');
      if (stateErr) return err(stateErr);
      const noteRisoluzione = body.noteRisoluzione || body.note_risoluzione || body.note || '';
      await sb(env, `urgenze?id=eq.${id}`, 'PATCH', {
        stato: 'risolta',
        data_risoluzione: new Date().toISOString(),
        note: noteRisoluzione ? noteRisoluzione : undefined,
        updated_at: new Date().toISOString()
      });
      await wlog('urgenza', id, 'resolved', body.operatoreId || body.userId);
      // Completa anche il piano collegato se esiste
      const urg2 = await sb(env, 'urgenze', 'GET', null, `?id=eq.${id}&select=intervento_id,tecnico_assegnato`).catch(()=>[]);
      if (urg2?.[0]?.intervento_id) {
        await sb(env, `piano?id=eq.${urg2[0].intervento_id}`, 'PATCH', { stato: 'completato', data_fine: new Date().toISOString(), updated_at: new Date().toISOString() }).catch(e=>console.error('[SYNC]',e.message));
      }
      // Notifica chat
      try {
        const msgId = 'MSG_URG_RESOL_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
        await sb(env, 'chat_messaggi', 'POST', {
          id: msgId, canale_id: 'CH_URGENZE', mittente_id: body.operatoreId || body.userId || 'SYSTEM',
          testo: `✅ Urgenza ${id} RISOLTA` + (noteRisoluzione ? `\n📝 ${noteRisoluzione}` : ''), tipo: 'testo', created_at: new Date().toISOString()
        });
      } catch(e){}
      // Notifica admin
      try {
        const admins = await sb(env, 'utenti', 'GET', null, '?ruolo=eq.admin&attivo=eq.true&select=id&limit=3').catch(()=>[]);
        for (const a of (admins||[])) {
          await sb(env, 'notifiche', 'POST', {
            id: 'NOT_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
            tipo: 'urgenza', oggetto: '✅ Urgenza risolta',
            testo: `Urgenza ${id} è stata risolta dal tecnico`,
            destinatario_id: a.id, stato: 'inviata', priorita: 'normale',
            riferimento_id: id, riferimento_tipo: 'urgenza',
            tenant_id: env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045'
          }).catch(e=>console.error('[SYNC]',e.message));
        }
      } catch(e){}
      return ok();
    }

    case 'updateUrgenza': {
      const id = body.id;
      if (!id) return err('id urgenza richiesto');
      const allFields = getFields(body);
      const urgWritable = ['cliente_id','macchina_id','problema','priorita_id','stato','tecnico_assegnato','tecnici_ids','automezzo_id','data_prevista','ora_prevista','data_inizio','data_risoluzione','intervento_id','note','allegati_ids','sla_scadenza','sla_status','obsoleto'];
      const updates = {};
      for (const k of urgWritable) { if (allFields[k] !== undefined) updates[k] = allFields[k]; }
      // Validazione transizione stato
      if (updates.stato) {
        const current = await sb(env, 'urgenze', 'GET', null, `?id=eq.${id}&select=stato`).catch(()=>[]);
        if (current?.[0]?.stato) {
          const transErr = validateTransition(VALID_URGENZA_TRANSITIONS, current[0].stato, updates.stato, 'urgenza');
          if (transErr) return err(transErr);
        }
      }
      updates.updated_at = new Date().toISOString();
      await sb(env, `urgenze?id=eq.${id}`, 'PATCH', updates);
      await wlog('urgenza', id, 'updated', body.operatoreId || body.userId);
      return ok();
    }

    // -------- ORDINI --------

    case 'createOrdine': {
      const id = 'ORD_' + Date.now();
      const fields = getFields(body);
      const qty = fields.quantita || fields.qty;
      if (qty !== undefined && qty !== null && (isNaN(qty) || Number(qty) <= 0)) {
        return err('Quantità non valida: deve essere un numero maggiore di 0');
      }
      // Only send writable columns: id,tenant_id,cliente_id,codice,descrizione,stato,quantita,data_ordine,data_richiesta,note,tecnico_id
      const row = {
        id,
        tenant_id: fields.tenant_id || env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045',
        cliente_id: fields.cliente_id || null,
        codice: fields.codice || null,
        descrizione: fields.descrizione || fields.note || fields.codice || 'Ordine ricambio',
        stato: fields.stato || 'richiesto',
        quantita: qty ? Number(qty) : null,
        data_ordine: fields.data_ordine || null,
        data_richiesta: new Date().toISOString(),
        note: fields.note || null,
        tecnico_id: fields.tecnico_id || null
      };
      const result = await sb(env, 'ordini', 'POST', row);
      await wlog('ordine', id, 'created', body.operatoreId || body.userId);
      return ok({ ordine: pascalizeRecord(result[0]) });
    }

    case 'updateOrdineStato': {
      const { id, stato, operatoreId, userId: _u2 } = body;
      // Salva timestamp specifici per ogni stato
      const datePatch = {};
      if (stato === 'preso_in_carico') datePatch.data_presa_carico = new Date().toISOString();
      if (stato === 'ordinato') datePatch.data_ordine = new Date().toISOString();
      if (stato === 'arrivato') datePatch.data_arrivo = new Date().toISOString();
      // Allowlist esplicita — no spread diretto di body
      const ordPatch = { stato, ...datePatch, updated_at: new Date().toISOString() };
      if (body.note !== undefined) ordPatch.note = body.note;
      if (body.fornitore !== undefined) ordPatch.fornitore = body.fornitore;
      if (body.numero_ordine !== undefined) ordPatch.numero_ordine = body.numero_ordine;
      await sb(env, `ordini?id=eq.${id}`, 'PATCH', ordPatch);
      await wlog('ordine', id, `stato_${stato}`, operatoreId);
      // Notifica tecnico che ha richiesto l'ordine
      try {
        const ord = await sb(env, 'ordini', 'GET', null, `?id=eq.${id}&select=tecnico_id,codice,descrizione`).catch(()=>[]);
        if (ord?.[0]?.tecnico_id) {
          const labels = { preso_in_carico: '👋 Preso in carico', ordinato: '📦 Ordinato al fornitore', in_arrivo: '🚚 In arrivo', arrivato: '✅ Arrivato in magazzino' };
          await sb(env, 'notifiche', 'POST', {
            id: 'NOT_ORD_' + Date.now(), tipo: 'ordine',
            oggetto: labels[stato] || `Ordine ${stato}`,
            testo: `Il tuo ordine ${ord[0].codice || id} (${(ord[0].descrizione || '').substring(0, 50)}) è stato aggiornato: ${labels[stato] || stato}`,
            destinatario_id: ord[0].tecnico_id, stato: 'inviata', priorita: 'normale',
            riferimento_id: id, riferimento_tipo: 'ordine',
            tenant_id: env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045'
          }).catch(e=>console.error('[SYNC]',e.message));
        }
      } catch(e){}
      return ok();
    }

    // -------- UTENTI --------

    case 'createUtente': {
      // SECURITY: solo admin può creare utenti
      const callerId = body.operatoreId || body.userId;
      if (callerId) {
        const caller = await sb(env, 'utenti', 'GET', null, `?id=eq.${callerId}&select=ruolo`).catch(()=>[]);
        if (caller?.[0] && caller[0].ruolo !== 'admin') return err('Solo admin può creare utenti', 403);
      }
      const pwd = body.password;
      if (!pwd || pwd.length < 8) return err('Password richiesta (min 8 caratteri)');
      const id = 'TEC_' + String(Date.now()).slice(-3);
      const hashed = await hashPassword(pwd);
      const row = { id, ...getFields(body), password_hash: hashed, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      delete row.password;
      const result = await sb(env, 'utenti', 'POST', row);
      // SYNC: se ha automezzo_id, aggiorna assegnatario_id nell'automezzo
      if (row.automezzo_id) {
        await sb(env, `automezzi?id=eq.${row.automezzo_id}`, 'PATCH', { assegnatario_id: id }).catch(() => {});
      }
      await wlog('utente', id, 'created', body.operatoreId);
      const { password_hash, ...safe } = result[0];
      return ok({ utente: safe });
    }

    case 'updateUtente': {
      const { id, password, userId: _u3, operatoreId: _op3, tenant_id: _t, ...updates } = body;
      // SECURITY: tecnici possono modificare solo se stessi (campi limitati), admin può modificare tutti
      const callerId3 = body.operatoreId || body.userId;
      if (callerId3 && callerId3 !== id) {
        const adminErr3 = await requireAdmin(env, body);
        if (adminErr3) return err('Solo admin può modificare altri utenti', 403);
      }
      if (password) updates.password_hash = await hashPassword(password);
      updates.updated_at = new Date().toISOString();
      // Remove null FK fields to avoid FK violations
      for (const k of Object.keys(updates)) {
        if (updates[k] === null && (k.endsWith('_id') || k === 'squadra_id' || k === 'automezzo_id')) delete updates[k];
      }
      // SYNC BIDIREZIONALE: se cambia automezzo_id, aggiorna anche l'automezzo
      const newAutoId = updates.automezzo_id;
      if (newAutoId) {
        // Leggi vecchio automezzo assegnato a questo utente
        const oldUserArr = await sb(env, 'utenti', 'GET', null, `?id=eq.${id}&select=automezzo_id`).catch(() => []);
        const oldAutoId = oldUserArr?.[0]?.automezzo_id;
        // Rimuovi assegnazione dal vecchio automezzo (se diverso)
        if (oldAutoId && oldAutoId !== newAutoId) {
          await sb(env, `automezzi?id=eq.${oldAutoId}`, 'PATCH', { assegnatario_id: null }).catch(() => {});
        }
        // Assegna il nuovo automezzo a questo utente
        await sb(env, `automezzi?id=eq.${newAutoId}`, 'PATCH', { assegnatario_id: id }).catch(() => {});
        // Rimuovi vecchio assegnatario dal nuovo automezzo (se un altro utente lo aveva)
        const otherUsers = await sb(env, 'utenti', 'GET', null, `?automezzo_id=eq.${newAutoId}&id=neq.${id}&select=id`);
        for (const ou of (otherUsers || [])) {
          await sb(env, `utenti?id=eq.${ou.id}`, 'PATCH', { automezzo_id: null, updated_at: new Date().toISOString() }).catch(() => {});
        }
      }
      await sb(env, `utenti?id=eq.${id}`, 'PATCH', updates);
      await wlog('utente', id, 'updated', body.operatoreId);
      return ok({ synced: !!newAutoId });
    }

    // -------- CLIENTI --------

    case 'createCliente': {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = 'CLI_' + Date.now();
      const row = { id, ...getFields(body), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const result = await sb(env, 'clienti', 'POST', row);
      await wlog('cliente', id, 'created', body.operatoreId);
      return ok({ cliente: pascalizeRecord(result[0]) });
    }

    case 'updateCliente': {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { id, userId: _u, operatoreId: _op, tenant_id: _t, ...updates } = body;
      updates.updated_at = new Date().toISOString();
      for (const k of Object.keys(updates)) { if (updates[k] === null && k.endsWith('_id')) delete updates[k]; }
      await sb(env, `clienti?id=eq.${id}`, 'PATCH', updates);
      await wlog('cliente', id, 'updated', body.operatoreId);
      return ok();
    }

    // -------- MACCHINE --------

    case 'createMacchina': {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = 'MAC_' + Date.now();
      const result = await sb(env, 'macchine', 'POST', { id, ...getFields(body), created_at: new Date().toISOString() });
      await wlog('macchina', id, 'created', body.operatoreId);
      return ok({ macchina: pascalizeRecord(result[0]) });
    }

    case 'updateMacchina': {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { id, userId: _u, operatoreId: _op, tenant_id: _t, ...updates } = body;
      for (const k of Object.keys(updates)) { if (updates[k] === null && k.endsWith('_id')) delete updates[k]; }
      await sb(env, `macchine?id=eq.${id}`, 'PATCH', updates);
      await wlog('macchina', id, 'updated', body.operatoreId);
      return ok();
    }

    // -------- AUTOMEZZI --------

    case 'createAutomezzo': {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = 'AUT_' + Date.now();
      const fields = getFields(body);
      const result = await sb(env, 'automezzi', 'POST', { id, ...fields });
      // SYNC: se ha assegnatario_id, aggiorna automezzo_id nell'utente
      if (fields.assegnatario_id) {
        await sb(env, `utenti?id=eq.${fields.assegnatario_id}`, 'PATCH', { automezzo_id: id, updated_at: new Date().toISOString() }).catch(() => {});
      }
      await wlog('automezzo', id, 'created', body.operatoreId);
      return ok({ automezzo: pascalizeRecord(result[0]) });
    }

    case 'updateAutomezzo': {
      const adminErr2 = await requireAdmin(env, body);
      if (adminErr2) return err(adminErr2, 403);
      const { id, userId: _u, operatoreId: _op, tenant_id: _t, ...updates } = body;
      for (const k of Object.keys(updates)) { if (updates[k] === null && k.endsWith('_id')) delete updates[k]; }
      // SYNC BIDIREZIONALE: se cambia assegnatario_id, aggiorna anche l'utente
      const newAssId = updates.assegnatario_id;
      if (newAssId) {
        // Leggi vecchio assegnatario di questo automezzo
        const oldAutoArr = await sb(env, 'automezzi', 'GET', null, `?id=eq.${id}&select=assegnatario_id`).catch(() => []);
        const oldAssId = oldAutoArr?.[0]?.assegnatario_id;
        // Rimuovi automezzo dal vecchio assegnatario (se diverso)
        if (oldAssId && oldAssId !== newAssId) {
          await sb(env, `utenti?id=eq.${oldAssId}`, 'PATCH', { automezzo_id: null, updated_at: new Date().toISOString() }).catch(() => {});
        }
        // Assegna automezzo al nuovo assegnatario
        await sb(env, `utenti?id=eq.${newAssId}`, 'PATCH', { automezzo_id: id, updated_at: new Date().toISOString() }).catch(() => {});
        // Rimuovi questo automezzo da altri utenti che lo avevano
        const otherUsers = await sb(env, 'utenti', 'GET', null, `?automezzo_id=eq.${id}&id=neq.${newAssId}&select=id`);
        for (const ou of (otherUsers || [])) {
          await sb(env, `utenti?id=eq.${ou.id}`, 'PATCH', { automezzo_id: null, updated_at: new Date().toISOString() }).catch(() => {});
        }
      }
      await sb(env, `automezzi?id=eq.${id}`, 'PATCH', updates);
      await wlog('automezzo', id, 'updated', body.operatoreId);
      return ok({ synced: !!newAssId });
    }

    // -------- INSTALLAZIONI --------

    case 'createInstallazione': {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = 'INS_' + Date.now();
      const fields = getFields(body);
      // Writable: id,tenant_id,cliente_id,macchina_id,stato,data_inizio,note,obsoleto
      const row = {
        id,
        tenant_id: fields.tenant_id || env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045',
        cliente_id: fields.cliente_id || null,
        macchina_id: fields.macchina_id || null,
        stato: 'pianificata',
        data_inizio: fields.data_inizio || fields.data_prevista || null,
        note: fields.note || null,
        created_at: new Date().toISOString()
      };
      const result = await sb(env, 'installazioni', 'POST', row);
      await wlog('installazione', id, 'created', body.operatoreId);
      return ok({ installazione: pascalizeRecord(result[0]) });
    }

    case 'updateInstallazione': {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { id, userId: _u, operatoreId: _op, ...updates } = body;
      updates.updated_at = new Date().toISOString();
      await sb(env, `installazioni?id=eq.${id}`, 'PATCH', updates);
      await wlog('installazione', id, 'updated', body.operatoreId);
      return ok();
    }

    // -------- REPERIBILITA --------

    case 'createReperibilita': {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = 'REP_' + Date.now();
      const result = await sb(env, 'reperibilita', 'POST', { id, ...getFields(body), created_at: new Date().toISOString() });
      await wlog('reperibilita', id, 'created', body.operatoreId);
      return ok({ reperibilita: pascalizeRecord(result[0]) });
    }

    // -------- TRASFERTE --------

    case 'createTrasferta': {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const id = 'TRA_' + Date.now();
      const fields = getFields(body);
      // Writable: id,tenant_id,cliente_id,tecnico_id,automezzo_id,motivo,stato,note,data_inizio,obsoleto
      const row = {
        id,
        tenant_id: fields.tenant_id || env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045',
        cliente_id: fields.cliente_id || null,
        tecnico_id: fields.tecnico_id || fields.tecnici_i_ds?.[0] || null,
        automezzo_id: fields.automezzo_id || null,
        motivo: fields.motivo || fields.note || '',
        stato: fields.stato || 'pianificata',
        data_inizio: fields.data_inizio || new Date().toISOString().slice(0,10),
        data_fine: fields.data_fine || null,
        note: fields.note || null,
        created_at: new Date().toISOString()
      };
      const result = await sb(env, 'trasferte', 'POST', row);
      await wlog('trasferta', id, 'created', body.operatoreId);
      return ok({ trasferta: pascalizeRecord(result[0]) });
    }

    // -------- NOTIFICHE --------

    case 'createNotifica': {
      const id = 'NOT_' + Date.now();
      const fields = getFields(body);
      const testo = fields.messaggio || fields.testo || fields.contenuto || '';
      const oggetto = fields.oggetto || fields.titolo || null;
      const priorita = fields.priorita || 'normale';
      const row = { id, tenant_id: fields.tenant_id || env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045', tipo: fields.tipo || 'info', oggetto, testo, priorita, stato: fields.stato || 'inviata', mittente_id: fields.mittente_id || null, destinatario_id: fields.destinatario_id || null, destinatari_ids: fields.destinatari_ids || null, riferimento_id: fields.riferimento_id || null, riferimento_tipo: fields.riferimento_tipo || null, data_invio: new Date().toISOString() };
      const result = await sb(env, 'notifiche', 'POST', row);
      return ok({ notifica: result?.[0] ? pascalizeRecord(result[0]) : { id } });
    }

    case 'markNotifica': {
      const { id } = body;
      await sb(env, `notifiche?id=eq.${id}`, 'PATCH', { stato: 'letta', data_lettura: new Date().toISOString() });
      return ok();
    }

    case 'markAllRead': {
      const { userId } = body;
      await sb(env, `notifiche?destinatario_id=eq.${userId}&stato=eq.inviata`, 'PATCH',
        { stato: 'letta', data_lettura: new Date().toISOString() });
      return ok();
    }

    case 'deleteNotifica': {
      const { id } = body;
      if (!id) return err('id notifica richiesto');
      await sb(env, `notifiche?id=eq.${id}`, 'PATCH', { obsoleto: true, updated_at: new Date().toISOString() });
      return ok();
    }

    case 'deleteAllNotifiche': {
      const { userId } = body;
      if (!userId) return err('userId richiesto');
      await sb(env, `notifiche?destinatario_id=eq.${userId}&stato=eq.letta`, 'PATCH',
        { obsoleto: true, updated_at: new Date().toISOString() });
      return ok();
    }

    // -------- RICHIESTE --------

    case 'createRichiesta': {
      const id = 'RIC_' + Date.now();
      const fields = getFields(body);
      // Writable: id,tenant_id,tipo,stato,data_richiesta,data_risposta,tecnico_id,motivo,data_inizio,obsoleto
      const row = {
        id,
        tenant_id: fields.tenant_id || env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045',
        tipo: fields.tipo || 'generico',
        stato: 'in_attesa',
        motivo: fields.motivo || fields.testo || fields.messaggio || fields.descrizione || '',
        tecnico_id: fields.tecnico_id || null,
        data_inizio: fields.data_inizio || new Date().toISOString().slice(0,10),
        data_richiesta: new Date().toISOString()
      };
      const result = await sb(env, 'richieste', 'POST', row);
      return ok({ richiesta: pascalizeRecord(result[0]) });
    }

    case 'updateRichiesta': {
      const { id, userId: _u, operatoreId: _op, ...updates } = body;
      if (updates.stato && updates.stato !== 'in_attesa') updates.data_risposta = new Date().toISOString();
      updates.updated_at = new Date().toISOString();
      await sb(env, `richieste?id=eq.${id}`, 'PATCH', updates);
      await sendTelegramNotification(env, 'richiesta_risposta', { id, stato: updates.stato });
      return ok();
    }

    // -------- PAGELLINI --------

    case 'createPagellino': {
      const id = 'PAG_' + Date.now();
      const result = await sb(env, 'pagellini', 'POST', { id, ...getFields(body), stato: 'bozza', data_creazione: new Date().toISOString() });
      return ok({ pagellino: pascalizeRecord(result[0]) });
    }

    case 'approvaPagellino': {
      const { id } = body;
      await sb(env, `pagellini?id=eq.${id}`, 'PATCH', { stato: 'approvato', data_approvazione: new Date().toISOString() });
      return ok();
    }

    // -------- CHECKLIST --------

    case 'createChecklistTemplate': {
      const id = 'CHK_' + Date.now();
      const result = await sb(env, 'checklist_template', 'POST', { id, ...getFields(body), created_at: new Date().toISOString() });
      return ok({ template: result[0] });
    }

    case 'updateChecklistTemplate': {
      const { id, userId: _u, operatoreId: _op, ...updates } = body;
      await sb(env, `checklist_template?id=eq.${id}`, 'PATCH', updates);
      return ok();
    }

    case 'deleteChecklistTemplate': {
      const { id } = body;
      await sb(env, `checklist_template?id=eq.${id}`, 'PATCH', { attivo: false });
      return ok();
    }

    case 'compileChecklist': {
      const id = 'CKC_' + Date.now();
      const result = await sb(env, 'checklist_compilata', 'POST', { id, ...getFields(body), data_compilazione: new Date().toISOString() });
      // Aggiorna intervento con checklist_id
      if (body.intervento_id) {
        await sb(env, `piano?id=eq.${body.intervento_id}`, 'PATCH', { checklist_id: id });
      }
      return ok({ checklist: pascalizeRecord(result[0]) });
    }

    // -------- DOCUMENTI & ALLEGATI --------

    case 'createDocumento': {
      const id = 'DOC_' + Date.now();
      const result = await sb(env, 'documenti', 'POST', { id, ...getFields(body), data_caricamento: new Date().toISOString() });
      return ok({ documento: pascalizeRecord(result[0]) });
    }

    case 'deleteDocumento': {
      const { id } = body;
      await sb(env, `documenti?id=eq.${id}`, 'PATCH', { obsoleto: true });
      return ok();
    }

    case 'createAllegato': {
      const id = 'ALL_' + Date.now();
      const result = await sb(env, 'allegati', 'POST', { id, ...getFields(body), data_upload: new Date().toISOString() });
      return ok({ allegato: pascalizeRecord(result[0]) });
    }

    case 'deleteAllegato': {
      const { id } = body;
      await sb(env, `allegati?id=eq.${id}`, 'PATCH', { obsoleto: true });
      return ok();
    }

    case 'uploadFile': {
      // Upload a Supabase Storage — read both camelCase and snake_case (normalizeBody converts)
      const fileName = body.file_name || body.fileName || 'file';
      const base64Data = body.base64_data || body.base64Data;
      const mimeType = body.mime_type || body.mimeType || 'application/octet-stream';
      const riferimentoTipo = body.riferimento_tipo || body.riferimentoTipo || 'generico';
      const riferimentoId = body.riferimento_id || body.riferimentoId || 'na';
      const uploaderId = body.uploader_id || body.uploaderId || null;
      if (!base64Data) return err('base64Data richiesto');
      const bucket  = 'syntoniqa-allegati';
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path    = `${riferimentoTipo}/${riferimentoId}/${Date.now()}_${safeName}`;
      const fileData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      const uploadRes = await fetch(
        `${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': mimeType,
          },
          body: fileData,
        }
      );
      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(()=>'');
        throw new Error('Upload storage fallito: ' + uploadRes.status + ' ' + errText);
      }

      const fileUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
      const id = 'ALL_' + Date.now();
      await sb(env, 'allegati', 'POST', {
        id, nome: fileName, file_url: fileUrl, mime_type: mimeType,
        uploader_id: uploaderId, riferimento_tipo: riferimentoTipo, riferimento_id: riferimentoId,
        data_upload: new Date().toISOString()
      }).catch(() => {}); // allegati table might not exist yet, don't block upload
      return ok({ url: fileUrl, id, nome: fileName });
    }

    case 'uploadFotoProfilo': {
      const { userId, base64Data, mimeType } = body;
      const bucket = 'syntoniqa-profili';
      const path   = `profili/${userId}.jpg`;
      const fileData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': mimeType },
        body: fileData
      });
      const url = `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
      await sb(env, `utenti?id=eq.${userId}`, 'PATCH', { foto_url: url });
      return ok({ url });
    }

    // -------- NOTIFICHE ESTERNE --------

    case 'sendEmail': {
      const { to, subject, html, text } = body;
      if (!env.RESEND_API_KEY) return err('Email non configurata');
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Syntoniqa <noreply@syntoniqa.app>', to, subject, html, text })
      });
      const result = await res.json();
      return ok({ result });
    }

    case 'testEmail': {
      const toAddr = body.email || body.destinatario || body.to;
      if (!toAddr) return err('Campo email/destinatario mancante');
      return handlePost('sendEmail', { to: toAddr, subject: 'Test Syntoniqa', html: '<h1>✅ Test Email Syntoniqa — OK</h1><p>Connessione email funzionante.</p>' }, env);
    }

    case 'sendTelegramMsg': {
      const { chatId, text } = body;
      const res = await sendTelegram(env, chatId, text);
      return ok({ result: res });
    }

    case 'testTelegram': {
      const chatId = body.chat_id || body.chatId;
      if (!chatId) return err('Chat ID mancante');
      const msg = body.message || body.messaggio || '🤖 Syntoniqa v2.0 – Telegram OK!';
      // Try env token first, then read from DB config
      let token = env.TELEGRAM_BOT_TOKEN || '';
      if (!token) {
        try {
          const cfgRows = await sb(env, 'config', 'GET', null, '?chiave=eq.telegram_bot_token&select=valore');
          if (cfgRows && cfgRows[0]) token = cfgRows[0].valore || '';
        } catch(e) {}
      }
      if (!token) return ok({ sent: false, reason: 'Bot token non configurato' });
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' })
        });
        const tgJson = await tgRes.json();
        return ok({ sent: !!tgJson.ok, reason: tgJson.ok ? '' : (tgJson.description || 'Errore Telegram') });
      } catch(e) {
        return ok({ sent: false, reason: e.message });
      }
    }

    // -------- PUSH NOTIFICATIONS (FIX F-30) --------

    case 'getVapidPublicKey': {
      if (!env.VAPID_PUBLIC_KEY) return err('VAPID non configurato');
      return ok({ vapidPublicKey: env.VAPID_PUBLIC_KEY });
    }

    case 'savePushSubscription': {
      const userId = body.userId || body.operatoreId;
      const sub = body.subscription || body;
      if (!sub.endpoint) return err('Subscription endpoint richiesto');
      const keys = sub.keys || {};
      const id = 'PUSH_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
      
      // Upsert: remove old subscription for same endpoint
      await sb(env, `push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&endpoint=eq.${encodeURIComponent(sub.endpoint)}`, 'DELETE');
      
      await sb(env, 'push_subscriptions', 'POST', {
        id,
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: keys.p256dh || '',
        auth: keys.auth || '',
        user_agent: body.userAgent || '',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      await wlog('push', id, 'subscription_saved', userId);
      return ok({ id });
    }

    case 'removePushSubscription': {
      const userId = body.userId || body.operatoreId;
      const endpoint = body.endpoint;
      if (endpoint) {
        await sb(env, `push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&endpoint=eq.${encodeURIComponent(endpoint)}`, 'DELETE');
      } else {
        await sb(env, `push_subscriptions?user_id=eq.${encodeURIComponent(userId)}`, 'PATCH', { active: false, updated_at: new Date().toISOString() });
      }
      return ok();
    }

    case 'sendPush': {
      // Invia push a uno o più utenti
      const { targetUserIds, title, body: pushBody, url, tag, actions } = body;
      if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return err('VAPID keys non configurate');
      if (!targetUserIds || !targetUserIds.length) return err('targetUserIds richiesti');

      const subs = await sb(env, 'push_subscriptions', 'GET', null,
        `?user_id=in.(${targetUserIds.map(id => encodeURIComponent(id)).join(',')})&active=eq.true`);
      
      const payload = JSON.stringify({
        title: title || 'Syntoniqa',
        body: pushBody || '',
        url: url || './',
        tag: tag || 'syntoniqa-' + Date.now(),
        actions: actions || []
      });

      let sent = 0, failed = 0;
      for (const sub of subs) {
        try {
          const res = await sendWebPush(env, {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          }, payload);
          if (res.ok) { sent++; }
          else if (res.status === 410 || res.status === 404) {
            // Subscription scaduta, rimuovi
            await sb(env, `push_subscriptions?id=eq.${sub.id}`, 'DELETE');
            failed++;
          } else { failed++; }
        } catch (e) { failed++; }
      }
      return ok({ sent, failed, total: subs.length });
    }

    // -------- INTELLIGENCE --------

    case 'generateAIPlan': {
      if (!env.AI) return err('Workers AI non configurato. Aggiungi [ai] binding = "AI" in wrangler.toml e rideploya.');

      const vincoli = body.vincoli || {};
      const testo = vincoli.testo || '';
      const files = vincoli.files || [];
      const ctx = vincoli.ctx || { vincoli: true, reperibilita: true, piano: true, urgenze: true, tagliandi: true };
      const modalita = vincoli.modalita || 'mese';
      const settimanaNum = parseInt(vincoli.settimana || '1', 10);

      // Load data context + vincoli dinamici (lean queries to avoid timeout)
      const meseTarget = vincoli.mese_target || '';
      const repFilter = meseTarget ? `&data_inizio=lte.${meseTarget}-31&data_fine=gte.${meseTarget}-01` : '';
      const [allTecnici, allUrgenze, allClienti, vincoliCfg, allRep, allAutomezzi, allMacchine, allAssets] = await Promise.all([
        sb(env, 'utenti', 'GET', null, '?attivo=eq.true&obsoleto=eq.false&select=id,nome,cognome,base,ruolo,automezzo_id').catch(()=>[]),
        sb(env, 'urgenze', 'GET', null, '?stato=in.(aperta,assegnata,schedulata)&order=data_segnalazione.desc&limit=20&select=id,problema,cliente_id,priorita_id').catch(()=>[]),
        sb(env, 'anagrafica_clienti', 'GET', null, '?select=codice_m3,nome_account,nome_interno,citta_fatturazione&limit=150').catch(()=>[]),
        sb(env, 'config', 'GET', null, '?chiave=eq.vincoli_categories&limit=1').catch(()=>[]),
        sb(env, 'reperibilita', 'GET', null, `?obsoleto=eq.false${repFilter}&select=id,tecnico_id,data_inizio,data_fine,turno,tipo&order=data_inizio.asc&limit=100`).catch(()=>[]),
        sb(env, 'automezzi', 'GET', null, '?obsoleto=eq.false&select=id,targa,modello,stato&limit=20').catch(()=>[]),
        sb(env, 'macchine', 'GET', null, '?obsoleto=eq.false&prossimo_tagliando=not.is.null&select=id,nome,modello,tipo,cliente_id,prossimo_tagliando,ultimo_tagliando,ore_lavoro&order=prossimo_tagliando.asc&limit=50').catch(()=>[]),
        sb(env, 'anagrafica_assets', 'GET', null, '?prossimo_controllo=not.is.null&select=id,nome_asset,numero_serie,modello,gruppo_attrezzatura,codice_m3,nome_account,prossimo_controllo&order=prossimo_controllo.asc&limit=50').catch(()=>[])
      ]);

      // Parse vincoli dinamici dalla config (only if ctx.vincoli)
      let vincoliText = '';
      if (ctx.vincoli && vincoliCfg.length) {
        try {
          const vc = JSON.parse(vincoliCfg[0].valore);
          const cats = (vc.categories || []).filter(c => c.attiva !== false);
          const oggi = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Rome' }).format(new Date());
          const getName = (id) => { const u = allTecnici.find(t => t.id === id); return u ? `${u.nome} ${u.cognome}` : id; };
          cats.forEach(cat => {
            const regole = (cat.regole || []).filter(r => {
              if (!r.testo) return false;
              if (r.permanente) return true;
              if (r.data_fine && r.data_fine < oggi) return false;
              return true;
            });
            if (!regole.length) return;
            vincoliText += `\n[${cat.icona || ''} ${cat.nome}]\n`;
            regole.forEach(r => {
              let line = `- ${r.testo}`;
              if (r.soggetti?.length) line += ` (Soggetti: ${r.soggetti.map(getName).join(', ')})`;
              if (r.riferimenti?.length) line += ` (Con: ${r.riferimenti.map(getName).join(', ')})`;
              if (!r.permanente && (r.data_inizio || r.data_fine)) line += ` (${r.data_inizio ? 'Dal ' + r.data_inizio : ''}${r.data_fine ? ' Al ' + r.data_fine : ''})`;
              line += r.priorita === 'alta' ? ' [PRIORITA ALTA]' : '';
              vincoliText += line + '\n';
            });
          });
        } catch {}
      }

      // Reperibilita context (only if ctx.reperibilita)
      let repContext = '';
      if (ctx.reperibilita && allRep.length) {
        repContext = '\nREPERIBILITA ATTIVE:\n' + allRep.map(r => {
          const tecName = allTecnici.find(t => t.id === r.tecnico_id);
          return `- ${tecName ? tecName.nome + ' ' + tecName.cognome : r.tecnico_id}: ${r.turno || '24h'} (${r.tipo || 'rep'}) dal ${r.data_inizio} al ${r.data_fine}`;
        }).join('\n');
      }

      // Piano esistente context (only if ctx.piano)
      let pianoEsistente = '';
      if (ctx.piano && vincoli.piano_esistente?.length) {
        pianoEsistente = '\nPIANO GIA ESISTENTE (non duplicare, complementa):\n' +
          vincoli.piano_esistente.slice(0, 30).map(p => `- ${p.data} ${p.tecnico}: ${p.cliente} (${p.note || ''})`).join('\n');
      }

      // Automezzi context
      const autoList = allAutomezzi.map(a => `${a.id}(${a.targa||''},${a.stato||'attivo'})`).join('; ');

      // Tagliandi/Service scaduti e in scadenza — prioritized list (only if ctx.tagliandi)
      let tagliandiContext = '';
      const oggi = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Rome' }).format(new Date());
      const tagItems = [];
      if (ctx.tagliandi) {
      // From macchine table (prossimo_tagliando)
      for (const m of allMacchine) {
        if (!m.prossimo_tagliando) continue;
        const cli = allClienti.find(c => c.codice_m3 === m.cliente_id) || {};
        const ggDiff = Math.round((new Date(m.prossimo_tagliando) - new Date(oggi)) / 86400000);
        tagItems.push({
          tipo: 'tagliando',
          macchina: `${m.nome||m.modello||m.tipo||'?'} (${m.id})`,
          cliente: cli.nome_interno || cli.nome_account || m.cliente_id || '?',
          clienteId: m.cliente_id || '',
          data: m.prossimo_tagliando,
          giorniScadenza: ggDiff,
          urgenza: ggDiff < 0 ? 'SCADUTO' : ggDiff <= 7 ? 'URGENTE' : ggDiff <= 30 ? 'PROSSIMO' : 'PROGRAMMATO',
          oreLavoro: m.ore_lavoro || null
        });
      }
      // From anagrafica_assets table (prossimo_controllo)
      for (const a of allAssets) {
        if (!a.prossimo_controllo) continue;
        const ggDiff = Math.round((new Date(a.prossimo_controllo) - new Date(oggi)) / 86400000);
        tagItems.push({
          tipo: 'controllo',
          macchina: `${a.nome_asset||a.modello||a.gruppo_attrezzatura||'?'} (S/N:${a.numero_serie||'?'})`,
          cliente: a.nome_account || '',
          clienteId: a.codice_m3 || '',
          data: a.prossimo_controllo,
          giorniScadenza: ggDiff,
          urgenza: ggDiff < 0 ? 'SCADUTO' : ggDiff <= 7 ? 'URGENTE' : ggDiff <= 30 ? 'PROSSIMO' : 'PROGRAMMATO'
        });
      }
      // Sort by urgenza: scaduti first, then by date ascending
      tagItems.sort((a, b) => a.giorniScadenza - b.giorniScadenza);
      if (tagItems.length) {
        const scaduti = tagItems.filter(t => t.giorniScadenza < 0);
        const urgenti = tagItems.filter(t => t.giorniScadenza >= 0 && t.giorniScadenza <= 7);
        const prossimi = tagItems.filter(t => t.giorniScadenza > 7 && t.giorniScadenza <= 30);
        const programmati = tagItems.filter(t => t.giorniScadenza > 30);
        const fmtItem = t => `- [${t.urgenza}] ${t.tipo.toUpperCase()} ${t.macchina} @ ${t.cliente}(${t.clienteId}) — data prevista: ${t.data} (${t.giorniScadenza < 0 ? Math.abs(t.giorniScadenza)+'gg SCADUTO' : t.giorniScadenza+'gg'})${t.oreLavoro ? ' ore:'+t.oreLavoro : ''}`;
        tagliandiContext = '\nTAGLIANDI E SERVICE IN SCADENZA (pianifica PRIMA i piu urgenti):';
        if (scaduti.length) tagliandiContext += '\n⚠️ SCADUTI:\n' + scaduti.slice(0,15).map(fmtItem).join('\n');
        if (urgenti.length) tagliandiContext += '\n🔴 URGENTI (entro 7gg):\n' + urgenti.slice(0,10).map(fmtItem).join('\n');
        if (prossimi.length) tagliandiContext += '\n🟡 PROSSIMI (entro 30gg):\n' + prossimi.slice(0,10).map(fmtItem).join('\n');
        if (programmati.length) tagliandiContext += '\n🟢 PROGRAMMATI:\n' + programmati.slice(0,5).map(fmtItem).join('\n');
      }
      } // end if ctx.tagliandi

      // Modalità: calcola periodo target
      let periodoIstruzione = '';
      if (meseTarget) {
        const [yy, mm] = meseTarget.split('-').map(Number);
        if (modalita === 'settimana') {
          // Calcola date settimana N del mese
          const firstDay = new Date(yy, mm - 1, 1);
          const startOffset = (settimanaNum - 1) * 7;
          const weekStart = new Date(yy, mm - 1, 1 + startOffset);
          const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
          const lastOfMonth = new Date(yy, mm, 0);
          if (weekEnd > lastOfMonth) weekEnd.setTime(lastOfMonth.getTime());
          const fmtD = d => d.toISOString().split('T')[0];
          periodoIstruzione = `GENERA PIANO SOLO per la SETTIMANA ${settimanaNum} del mese: dal ${fmtD(weekStart)} al ${fmtD(weekEnd)}`;
        } else if (modalita === 'vuoti') {
          periodoIstruzione = `GENERA PIANO SOLO per i giorni SENZA interventi nel piano esistente. Non duplicare giorni gia coperti.`;
        } else {
          periodoIstruzione = `GENERA PIANO per TUTTO il mese ${meseTarget} (tutti i giorni lavorativi Lun-Sab)`;
        }
      }

      // File context (max 3000 chars)
      let fileContext = '';
      for (const f of files) {
        const content = typeof f.content === 'string' ? f.content : '';
        if (content.length > 10 && !content.match(/^[A-Za-z0-9+/=]{50,}$/)) {
          fileContext += `\n[${f.name}]:\n${content.substring(0, 3000)}\n`;
        }
      }

      // Date (oggi already defined above for tagliandi)
      const isoOggi = oggi; // reuse
      const oggiIt = new Intl.DateTimeFormat('it-IT', { weekday:'long', year:'numeric', month:'long', day:'numeric', timeZone:'Europe/Rome' }).format(new Date());

      // Compact data
      const tecList = allTecnici.filter(t=>t.ruolo!=='admin').map(t => `${t.nome} ${t.cognome}(${t.id},${t.ruolo},${t.base||'?'})`).join('; ');
      const urgList = ctx.urgenze ? allUrgenze.slice(0,15).map(u => `${u.id}:${(u.problema||'').substring(0,30)}|${u.cliente_id}|pri:${u.priorita_id}`).join('; ') : '';
      const cliList = allClienti.slice(0,80).map(c => `${c.codice_m3}:${c.nome_interno||c.nome_account||'?'}(${c.citta_fatturazione||''})`).join(', ');

      const prompt = `PLANNER FSM — Pianificazione intelligente interventi
OGGI: ${oggiIt} (${isoOggi})
${meseTarget ? 'MESE TARGET: ' + meseTarget : ''}

=== VINCOLI UTENTE (dal prompt) ===
${testo || 'Nessuno'}

${vincoliText ? vincoliText : '(Nessun vincolo configurato nel sistema)'}

TECNICI DISPONIBILI: ${tecList}
AUTOMEZZI: ${autoList || 'Nessuno'}
URGENZE APERTE: ${urgList || 'Nessuna'}
CLIENTI: ${cliList}
${repContext}
${pianoEsistente}
${tagliandiContext}
${fileContext ? '\nFILE ALLEGATI (riferimento — genera piano COMPLETO, non solo i giorni nel file):\n' + fileContext : ''}

ISTRUZIONI GENERAZIONE:
${periodoIstruzione || '1. Genera piano per OGNI giorno lavorativo (lun-sab) del periodo richiesto'}
2. Se chiesto un mese intero → genera TUTTI i giorni lavorativi
3. Assegna 2-4 interventi/giorno per tecnico. Usa clienti REALI.
4. Raggruppa per zona geografica (stessa citta nello stesso giorno)
5. Urgenze aperte → priorita assoluta nei primi giorni
6. Rispetta OGNI vincolo senza eccezioni — vincoli con priorita ALTA sono inviolabili
7. Non duplicare interventi gia nel piano esistente
8. Assegna automezzi coerenti con tecnico
9. Rispetta turni reperibilita (chi e' reperibile ha carico ridotto)
10. Tagliandi/service scaduti o in scadenza → pianifica PRIMA quelli piu urgenti

Rispondi SOLO JSON:
{"summary":"...","piano":[{"data":"YYYY-MM-DD","tecnico":"nome","tecnicoId":"TEC_xxx","cliente":"nome","clienteId":"codice_m3","tipo":"tagliando|service|urgenza|installazione|ispezione","oraInizio":"HH:MM","durataOre":N,"furgone":"FURG_x","note":"..."}],"warnings":["..."]}`;

      // ─── AI Call with week-by-week chunking for full months ───
      const models = ['@cf/meta/llama-3.1-70b-instruct', '@cf/meta/llama-3.1-8b-instruct'];
      const validIds = new Set(allTecnici.map(t => t.id));

      // Helper: call AI with fallback chain
      async function callAI(promptText) {
        for (const model of models) {
          try {
            const res = await env.AI.run(model, {
              messages: [
                { role: 'system', content: 'Sei un pianificatore FSM. Rispondi SOLO JSON valido. Zero testo extra.' },
                { role: 'user', content: promptText }
              ],
              max_tokens: 4096
            });
            if (res && res.response) return res.response;
          } catch (aiErr) {
            if (model === models[models.length - 1]) throw new Error(aiErr.message || 'timeout');
          }
        }
        return null;
      }

      // Helper: parse AI response JSON
      function parseAIResponse(rawText) {
        let clean = (rawText || '{}').replace(/```json\n?|\n?```/g, '').trim();
        const js = clean.indexOf('{'), je = clean.lastIndexOf('}');
        if (js >= 0 && je > js) clean = clean.substring(js, je + 1);
        try { return JSON.parse(clean); } catch {
          const m = rawText.match(/\{[\s\S]*\}/);
          if (m) { try { return JSON.parse(m[0]); } catch {} }
          return null;
        }
      }

      // Helper: validate and fix tecnicoId
      function postProcess(piano) {
        return (piano || []).map(p => {
          if (p.tecnicoId && !validIds.has(p.tecnicoId)) {
            const match = allTecnici.find(t => (t.nome + ' ' + t.cognome).toLowerCase().includes((p.tecnico||'').split(' ')[0].toLowerCase()));
            if (match) { p.tecnicoId = match.id; p.tecnico = match.nome + ' ' + match.cognome; }
          }
          return p;
        }).filter(p => p.tecnicoId && validIds.has(p.tecnicoId));
      }

      // Determine if chunking is needed (full month = 4-5 weeks)
      const needsChunking = modalita === 'mese' && meseTarget;
      if (needsChunking) {
        // Split month into weeks
        const [yy, mm] = meseTarget.split('-').map(Number);
        const weeks = [];
        let d = new Date(yy, mm - 1, 1);
        const lastDay = new Date(yy, mm, 0).getDate();
        let weekNum = 1;
        while (d.getDate() <= lastDay && d.getMonth() === mm - 1) {
          const weekStart = new Date(d);
          const weekEnd = new Date(d);
          weekEnd.setDate(weekEnd.getDate() + 6);
          if (weekEnd.getMonth() !== mm - 1) weekEnd.setDate(lastDay);
          if (weekEnd.getMonth() !== mm - 1) { weekEnd.setMonth(mm - 1); weekEnd.setDate(lastDay); }
          const fmtD = dt => dt.toISOString().split('T')[0];
          weeks.push({ num: weekNum, start: fmtD(weekStart), end: fmtD(weekEnd) });
          d.setDate(d.getDate() + 7);
          weekNum++;
        }

        const allPiano = [];
        const allWarnings = [];
        let allSummary = '';
        let prevWeekSummary = '';

        for (const week of weeks) {
          const weekPrompt = prompt
            .replace(periodoIstruzione, `GENERA PIANO per SETTIMANA ${week.num}: dal ${week.start} al ${week.end}`)
            + (prevWeekSummary ? `\n\nSETTIMANE PRECEDENTI GIA GENERATE:\n${prevWeekSummary}` : '');

          try {
            const raw = await callAI(weekPrompt);
            if (!raw) { allWarnings.push(`Settimana ${week.num}: nessuna risposta AI`); continue; }
            const parsed = parseAIResponse(raw);
            if (!parsed) { allWarnings.push(`Settimana ${week.num}: risposta non parsabile`); continue; }
            const weekPiano = postProcess(parsed.piano);
            allPiano.push(...weekPiano);
            if (parsed.warnings) allWarnings.push(...parsed.warnings);
            if (parsed.summary) allSummary += (allSummary ? ' | ' : '') + `S${week.num}: ${parsed.summary}`;
            // Build context for next weeks
            prevWeekSummary += weekPiano.slice(0, 10).map(p => `${p.data} ${p.tecnico}: ${p.cliente}`).join('; ') + '\n';
          } catch (e) {
            allWarnings.push(`Settimana ${week.num}: errore ${e.message}`);
          }
        }

        return ok({
          summary: allSummary || `Piano ${meseTarget} generato in ${weeks.length} chunk settimanali`,
          piano: allPiano,
          warnings: allWarnings.length ? allWarnings : undefined,
          chunks: weeks.length
        });
      }

      // Single call (settimana or vuoti mode, or no meseTarget)
      try {
        const rawText = await callAI(prompt);
        if (!rawText) return err('Workers AI non ha generato risposta. Riprova.');
        const result = parseAIResponse(rawText);
        if (!result) return ok({ summary: 'Errore formato', piano: [], warnings: ['Risposta AI non parsabile. Riprova.'], raw: rawText.substring(0, 1500) });
        result.piano = postProcess(result.piano);
        return ok(result);
      } catch (e) {
        return err(`Workers AI errore: ${e.message}. Riprova con prompt più breve.`);
      }
    }

    case 'analyzeImage': {
      if (!env.AI) return err('Workers AI non configurato. Aggiungi [ai] binding in wrangler.toml.');
      const { image_base64, urgenza_id, contesto } = body;
      if (!image_base64) return err('Immagine mancante (campo image_base64 richiesto)');

      // 0. Carica catalogo parti per contesto
      let partiContext = '';
      try {
        let partsFilter = '?select=codice,nome,descrizione,gruppo,modello_macchina&attivo=eq.true&limit=50';
        const machHint = (contesto || '').match(/astronaut|vector|juno|discovery|calm|grazeway|cosmix/i)?.[0];
        if (machHint) partsFilter += `&modello_macchina=ilike.*${sanitizePgFilter(machHint.toUpperCase())}*`;
        const parti = await sb(env, 'tagliandi', 'GET', null, partsFilter).catch(() => []);
        if (parti.length) {
          partiContext = '\n\nCATALOGO RICAMBI LELY DISPONIBILI (suggerisci il codice se riconosci il pezzo):';
          for (const p of parti.slice(0, 40)) {
            partiContext += `\n• ${p.codice || '?'} — ${(p.nome || p.descrizione || '').substring(0, 60)}`;
          }
        }
      } catch { /* ignore */ }

      // 1. Chiamata Vision AI (LLaVA) con catalogo
      let visionRes;
      try {
        visionRes = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
          image: [...Uint8Array.from(atob(image_base64), c => c.charCodeAt(0))],
          prompt: `Sei un tecnico esperto di macchine agricole Lely (robot mungitura Astronaut, alimentatori Vector, spingivacca Juno, Discovery).
Analizza questa foto di un guasto. Contesto macchina: ${contesto || 'non specificato'}
${partiContext}

Rispondi SOLO con JSON valido:
{
  "diagnosi": "descrizione del problema identificato",
  "gravita": "alta|media|bassa",
  "ricambio_suggerito": "nome del pezzo di ricambio necessario",
  "codice_ricambio": "codice Lely dal catalogo sopra se riconoscibile, altrimenti null",
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

      // 2. Parse risposta
      let analisi;
      try {
        const raw = visionRes.description || visionRes.response || '';
        analisi = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
      } catch (e) {
        analisi = {
          diagnosi: visionRes.description || visionRes.response || 'Analisi non disponibile',
          gravita: 'media',
          ricambio_suggerito: null,
          codice_ricambio: null,
          componente_identificato: null,
          danno_visibile: null,
          azione_consigliata: 'Verificare manualmente',
          urgenza_intervento: false,
          confidence: 0.3
        };
      }

      // 3. Post-process: verifica codice ricambio nel catalogo reale
      if (analisi.codice_ricambio || analisi.ricambio_suggerito) {
        const searchTerm = analisi.codice_ricambio || analisi.ricambio_suggerito;
        const codeMatch = (searchTerm || '').match(/\d+\.\d{4}\.\d{4}\.\d+/);
        let catalogMatch = null;
        if (codeMatch) {
          const exact = await sb(env, 'tagliandi', 'GET', null, `?codice=eq.${codeMatch[0]}&attivo=eq.true&limit=1`).catch(() => []);
          if (exact.length) catalogMatch = exact[0];
        }
        if (!catalogMatch && analisi.ricambio_suggerito) {
          const terms = analisi.ricambio_suggerito.toLowerCase().split(/[\s,;]+/).filter(t => t.length > 3);
          for (const term of terms.slice(0, 2)) {
            const safeTerm = sanitizePgFilter(term);
            if (!safeTerm) continue;
            const found = await sb(env, 'tagliandi', 'GET', null, `?or=(nome.ilike.*${safeTerm}*,descrizione.ilike.*${safeTerm}*)&attivo=eq.true&limit=1`).catch(() => []);
            if (found.length) { catalogMatch = found[0]; break; }
          }
        }
        if (catalogMatch) {
          analisi.codice_ricambio_verificato = catalogMatch.codice;
          analisi.ricambio_nome_catalogo = catalogMatch.nome || catalogMatch.descrizione;
          analisi.ricambio_gruppo = catalogMatch.gruppo;
        }
      }

      // 4. Se urgenza_id fornito, aggiorna note con analisi completa
      if (urgenza_id) {
        const nota = `[AI Vision] ${analisi.diagnosi} | Gravità: ${analisi.gravita} | Componente: ${analisi.componente_identificato || 'N/A'} | Ricambio: ${analisi.codice_ricambio_verificato || analisi.ricambio_suggerito || 'N/A'} | Danno: ${analisi.danno_visibile || 'N/A'}`;
        await sb(env, `urgenze?id=eq.${urgenza_id}`, 'PATCH', {
          note_ai: nota,
          ai_confidence: analisi.confidence
        }).catch(e => console.error('Errore aggiornamento urgenza:', e));
      }

      return ok(analisi);
    }

    case 'applyAIPlan': {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const pianoAI = body.piano?.piano || body.piano || [];
      const forceOverwrite = body.force_overwrite === true;
      const operatoreId = body.operatore_id || body.userId || 'admin';
      if (!Array.isArray(pianoAI) || !pianoAI.length) return err('Piano vuoto, nulla da applicare');

      // 1. Check for conflicts (existing interventions same tecnico+data)
      const dates = [...new Set(pianoAI.map(p => p.data).filter(Boolean))];
      const tecIds = [...new Set(pianoAI.map(p => p.tecnicoId).filter(Boolean))];
      let existing = [];
      if (dates.length && tecIds.length) {
        const dateMin = dates.sort()[0];
        const dateMax = dates.sort().reverse()[0];
        existing = await sb(env, 'piano', 'GET', null,
          `?data=gte.${dateMin}&data=lte.${dateMax}&stato=neq.annullato&obsoleto=eq.false&select=id,tecnico_id,data,cliente_id,note&limit=500`
        ).catch(() => []);
      }

      // Build conflict map: tecnico+data → existing items
      const conflictMap = {};
      for (const ex of existing) {
        const key = `${ex.tecnico_id}|${ex.data}`;
        if (!conflictMap[key]) conflictMap[key] = [];
        conflictMap[key].push(ex);
      }

      const conflicts = [];
      const toCreate = [];
      for (const item of pianoAI) {
        const key = `${item.tecnicoId}|${item.data}`;
        if (conflictMap[key] && conflictMap[key].length > 0) {
          conflicts.push({
            nuovo: { data: item.data, tecnico: item.tecnico, cliente: item.cliente, tipo: item.tipo },
            esistenti: conflictMap[key].map(e => ({ id: e.id, cliente_id: e.cliente_id, note: (e.note || '').substring(0, 50) }))
          });
          if (!forceOverwrite) continue; // Skip conflicts unless forced
          // Overwrite: annulla existing
          for (const e of conflictMap[key]) {
            await sb(env, `piano?id=eq.${e.id}`, 'PATCH', {
              stato: 'annullato', note: (e.note || '') + ' [Sovrascritto da AI]', updated_at: new Date().toISOString()
            }).catch(() => {});
          }
        }
        toCreate.push(item);
      }

      // If there are conflicts and not forcing, return them for user confirmation
      if (conflicts.length && !forceOverwrite) {
        return ok({
          has_conflicts: true,
          conflicts_count: conflicts.length,
          conflicts: conflicts.slice(0, 20),
          skipped: conflicts.length,
          message: `${conflicts.length} conflitti trovati (stesso tecnico+data). Invia force_overwrite:true per sovrascrivere.`
        });
      }

      // 2. Create new interventions
      const created = [], errors = [];
      const now = new Date().toISOString();
      for (const item of toCreate) {
        try {
          const id = 'INT_AI_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          const noteParts = [item.tipo || '', item.note || ''].filter(Boolean);
          await sb(env, 'piano', 'POST', {
            id,
            tecnico_id: item.tecnicoId,
            cliente_id: item.clienteId || null,
            data: item.data,
            ora_inizio: item.oraInizio || null,
            durata_ore: item.durataOre || null,
            tipo_intervento: item.tipo || 'service',
            automezzo_id: item.furgone || null,
            stato: 'pianificato',
            origine: 'ai',
            note: noteParts.join(' — '),
            obsoleto: false,
            tenant_id: env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045',
            created_at: now,
            updated_at: now
          });
          created.push(id);
          await wlog('piano', id, 'ai_plan_applied', operatoreId, `${item.tecnico} @ ${item.cliente}`);
        } catch (e) {
          errors.push({ item: `${item.data} ${item.tecnico}`, err: e.message });
        }
      }

      return ok({
        created: created.length,
        overwritten: forceOverwrite ? conflicts.length : 0,
        errors: errors.length ? errors : undefined,
        ids: created
      });
    }

    case 'importExcelPlan': {
      // Import plan rows from parsed Excel data
      const { rows, operatoreId } = body;
      if (!rows || !rows.length) return err('rows richiesto');
      if (rows.length > 500) return err('Massimo 500 righe per importazione. Dividi il file in più parti.');
      // Get tecnici for name→id mapping
      const tecnici = await sb(env, 'utenti', 'GET', null, '?attivo=eq.true&select=id,nome,cognome');
      const tecMap = {};
      tecnici.forEach(t => {
        const nome = (t.nome || '').toLowerCase();
        const full = ((t.nome || '') + ' ' + (t.cognome || '')).toLowerCase().trim();
        tecMap[nome] = t.id;
        tecMap[full] = t.id;
      });
      const created = [], errors = [];
      for (const row of rows) {
        try {
          const tecId = tecMap[(row.tecnico_nome || '').toLowerCase()] || null;
          const id = 'INT_XLS_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          // Build note with all details
          const noteParts = [row.cliente, row.service_detail, row.reperibilita ? 'REP: ' + row.reperibilita : ''].filter(Boolean);
          await sb(env, 'piano', 'POST', {
            id,
            tecnico_id: tecId,
            data: row.data,
            stato: 'pianificato',
            origine: 'excel_import',
            note: noteParts.join(' | ') || row.note_complete || '',
            automezzo_id: row.furgone ? 'FURG_' + row.furgone : null,
            obsoleto: false,
            tenant_id: env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          created.push(id);
        } catch (e) {
          errors.push({ row: row.data + ' ' + row.tecnico_nome, err: e.message });
        }
      }
      return ok({ created: created.length, errors });
    }

    // -------- WORKFLOW APPROVATIVO --------

    case 'createApproval': {
      const { id, piano, creato_da, ruolo_creatore, stato, data_creazione } = body;
      // Store in config table as JSON (no separate table needed)
      await sb(env, 'config', 'POST', {
        chiave: `approval_${id}`,
        valore: JSON.stringify({ id, piano, creato_da, ruolo_creatore, stato, data_creazione }),
        tenant_id: env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045'
      }, null, { 'Prefer': 'return=minimal,resolution=merge-duplicates' });
      return ok({ id, stato });
    }

    case 'getApprovals': {
      const filter = body.filter || '';
      const configs = await sb(env, 'config', 'GET', null, `?chiave=like.approval_*&tenant_id=eq.${env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045'}`);
      let approvals = configs.map(c => {
        try { return JSON.parse(c.valore); } catch { return null; }
      }).filter(Boolean);
      if (filter) approvals = approvals.filter(a => a.stato === filter);
      approvals.sort((a, b) => (b.data_creazione || '').localeCompare(a.data_creazione || ''));
      // Enrich with user names
      const userIds = [...new Set(approvals.map(a => a.creato_da).concat(approvals.map(a => a.approvato_da)).filter(Boolean))];
      if (userIds.length) {
        const users = await sb(env, 'utenti', 'GET', null, `?id=in.(${userIds.join(',')})&select=id,nome,cognome`).catch(() => []);
        const userMap = Object.fromEntries(users.map(u => [u.id, (u.nome || '') + ' ' + (u.cognome || '')]));
        approvals.forEach(a => {
          a.creato_da_nome = userMap[a.creato_da] || a.creato_da;
          a.approvato_da_nome = userMap[a.approvato_da] || '';
        });
      }
      return ok(approvals);
    }

    case 'getApproval': {
      const cfg = await sb(env, 'config', 'GET', null, `?chiave=eq.approval_${body.id}&tenant_id=eq.${env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045'}`);
      if (!cfg.length) return err('Approvazione non trovata', 404);
      try { return ok(JSON.parse(cfg[0].valore)); }
      catch { return err('Dati approvazione corrotti', 500); }
    }

    case 'updateApproval': {
      const { id, stato, approvato_da, note_approvazione, data_approvazione } = body;
      const cfg = await sb(env, 'config', 'GET', null, `?chiave=eq.approval_${id}&tenant_id=eq.${env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045'}`);
      if (!cfg.length) return err('Approvazione non trovata', 404);
      const approval = JSON.parse(cfg[0].valore);
      approval.stato = stato;
      approval.approvato_da = approvato_da;
      approval.note_approvazione = note_approvazione;
      approval.data_approvazione = data_approvazione;
      await sb(env, `config?chiave=eq.approval_${id}&tenant_id=eq.${env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045'}`, 'PATCH', {
        valore: JSON.stringify(approval)
      });
      return ok(approval);
    }

    case 'notifyPlanApproved': {
      const { approval_id } = body;
      const cfg = await sb(env, 'config', 'GET', null, `?chiave=eq.approval_${approval_id}&tenant_id=eq.${env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045'}`);
      if (!cfg.length) return ok({ notified: 0 });
      const approval = JSON.parse(cfg[0].valore);
      if (approval.stato !== 'approvato') return ok({ notified: 0 });
      // Notify all active technicians via Telegram
      const tecnici = await sb(env, 'utenti', 'GET', null, '?attivo=eq.true&ruolo=in.(tecnico,caposquadra)&telegram_chat_id=not.is.null');
      let notified = 0;
      for (const tec of tecnici) {
        if (tec.telegram_chat_id) {
          await sendTelegram(env, tec.telegram_chat_id, `📋 *Piano approvato!*\nIl piano è stato approvato. Controlla i tuoi interventi su Syntoniqa.`);
          notified++;
        }
      }
      return ok({ notified });
    }

    case 'geocodeAll': {
      // FIX B-V2-5: Geocoding Nominatim con retry, backoff esponenziale, error log
      const batchSize = Math.min(parseInt(body?.limit) || 20, 50); // max 50
      const clientiSenzaGeo = await sb(env, 'clienti', 'GET', null,
        '?latitudine=is.null&obsoleto=eq.false&select=id,indirizzo,citta,prov,cap');

      // Legge config email per User-Agent (Nominatim ToS richiede contatto)
      const cfgArr = await sb(env, 'config', 'GET', null, '?tenant_id=eq.' + (env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045') + '&chiave=eq.email_mittente');
      const contactEmail = cfgArr?.[0]?.valore || 'admin@syntoniqa.app';

      // Helper: geocoda singolo indirizzo con retry + backoff
      const geocodeOne = async (c, attempt = 0) => {
        const query = [c.indirizzo, c.citta, c.prov, 'Italia'].filter(Boolean).join(', ');
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=0`;
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent': `Syntoniqa/2.0 (${contactEmail})`,
              'Accept-Language': 'it',
            }
          });
          if (res.status === 429) {
            // Rate limited: backoff 2^attempt * 1.5s (max 3 tentativi)
            if (attempt >= 3) return { ok: false, reason: 'rate_limit_exceeded' };
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1500));
            return geocodeOne(c, attempt + 1);
          }
          if (!res.ok) return { ok: false, reason: `http_${res.status}` };
          const data = await res.json();
          if (!data.length) return { ok: false, reason: 'no_results' };
          return { ok: true, lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        } catch (e) {
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 2000));
            return geocodeOne(c, attempt + 1);
          }
          return { ok: false, reason: e.message };
        }
      };

      let updated = 0;
      const errors = [];
      const batch = clientiSenzaGeo.slice(0, batchSize);

      for (let i = 0; i < batch.length; i++) {
        const c = batch[i];
        const result = await geocodeOne(c);
        if (result.ok) {
          await sb(env, `clienti?id=eq.${c.id}`, 'PATCH', {
            latitudine: result.lat, longitudine: result.lon
          });
          updated++;
        } else {
          errors.push({ id: c.id, citta: c.citta, reason: result.reason });
          // Log in workflow_log per tracciabilità
          await wlog('clienti', c.id, 'geocode_failed', 'system', result.reason).catch(() => {});
        }
        // Rispetta ToS Nominatim: min 1.1s tra richieste (tranne ultimo)
        if (i < batch.length - 1) {
          await new Promise(r => setTimeout(r, 1200));
        }
      }

      return ok({
        updated,
        failed: errors.length,
        skipped: Math.max(0, clientiSenzaGeo.length - batchSize),
        total_senza_geo: clientiSenzaGeo.length,
        errors: errors.slice(0, 10), // max 10 errori nel response
        message: errors.length
          ? `${updated} geocodificati, ${errors.length} falliti. Controlla audit log per dettagli.`
          : `${updated} clienti geocodificati con successo.`
      });
    }

    case 'generateReport': {
      const filtri = body.filtri || {};
      const tipo = body.tipo || 'kpi_mensile';
      const dateFrom = filtri.data_inizio || filtri.dataInizio || body.date_from || '';
      const dateTo = filtri.data_fine || filtri.dataFine || body.date_to || '';
      const tecnicoId = filtri.tecnico_id || filtri.tecnicoId || body.tecnico_id || '';
      if (!dateFrom) return err('Data inizio richiesta');
      const dtTo = dateTo || new Date().toISOString().split('T')[0];

      // Load data
      let pFilter = `?data=gte.${dateFrom}&data=lte.${dtTo}&obsoleto=eq.false`;
      if (tecnicoId) pFilter += `&tecnico_id=eq.${tecnicoId}`;
      const [piano, urgenze, utenti, clienti] = await Promise.all([
        sb(env, 'piano', 'GET', null, pFilter + '&order=data.asc&limit=1000'),
        sb(env, 'urgenze', 'GET', null, `?data_segnalazione=gte.${dateFrom}&data_segnalazione=lte.${dtTo}T23:59:59&obsoleto=eq.false&limit=1000`),
        sb(env, 'utenti', 'GET', null, '?attivo=eq.true&select=id,nome,cognome,ruolo'),
        sb(env, 'clienti', 'GET', null, '?obsoleto=eq.false&select=id,nome&limit=500'),
      ]);
      const getName = (list, id, field='nome') => { const f = list.find(x => x.id === id); return f ? (f[field] || f.nome || id) : id; };
      const tecName = (id) => { const u = utenti.find(x => x.id === id); return u ? `${u.nome||''} ${u.cognome||''}`.trim() : id||'—'; };
      const now = new Date().toISOString().substring(0, 19).replace('T', ' ');

      let result = { titolo: '', colonne: [], righe: [], generato: now };

      switch (tipo) {
        case 'interventi_tecnico': {
          result.titolo = `Interventi per Tecnico (${dateFrom} — ${dtTo})`;
          result.colonne = ['Tecnico', 'Totale', 'Completati', 'In Corso', 'Pianificati', 'Ore', 'Km'];
          const byTec = {};
          piano.forEach(p => {
            const t = p.tecnico_id || '—';
            if (!byTec[t]) byTec[t] = { tot: 0, comp: 0, inCorso: 0, pian: 0, ore: 0, km: 0 };
            byTec[t].tot++;
            if (p.stato === 'completato') byTec[t].comp++;
            else if (p.stato === 'in_corso') byTec[t].inCorso++;
            else byTec[t].pian++;
            byTec[t].ore += parseFloat(p.ore_lavorate || 0);
            byTec[t].km += parseInt(p.km_percorsi || 0);
          });
          result.righe = Object.entries(byTec).map(([id, v]) => [tecName(id), v.tot, v.comp, v.inCorso, v.pian, v.ore.toFixed(1), v.km]);
          break;
        }
        case 'urgenze_summary': {
          result.titolo = `Riepilogo Urgenze (${dateFrom} — ${dtTo})`;
          result.colonne = ['ID', 'Data', 'Cliente', 'Problema', 'Priorità', 'Stato', 'Tecnico', 'SLA'];
          result.righe = urgenze.map(u => [u.id, (u.data_segnalazione||'').substring(0,10), getName(clienti, u.cliente_id), (u.problema||'').substring(0,60), u.priorita_id||'—', u.stato, tecName(u.tecnico_assegnato), u.sla_status||'—']);
          break;
        }
        case 'kpi_mensile': {
          result.titolo = `KPI Mensile (${dateFrom} — ${dtTo})`;
          result.colonne = ['Metrica', 'Valore'];
          const comp = piano.filter(p => p.stato === 'completato');
          const ore = comp.reduce((s, p) => s + parseFloat(p.ore_lavorate || 0), 0);
          const km = comp.reduce((s, p) => s + parseInt(p.km_percorsi || 0), 0);
          const urgRisolte = urgenze.filter(u => u.stato === 'risolta' || u.stato === 'chiusa');
          const urgSlaOk = urgenze.filter(u => u.sla_status === 'ok' || u.sla_status === 'warning');
          const slaPerc = urgenze.length ? Math.round(urgSlaOk.length / urgenze.length * 100) : 100;
          result.righe = [
            ['Interventi totali', piano.length],
            ['Interventi completati', comp.length],
            ['% Completamento', piano.length ? Math.round(comp.length / piano.length * 100) + '%' : '—'],
            ['Ore lavorate totali', ore.toFixed(1)],
            ['Km percorsi totali', km],
            ['Urgenze totali', urgenze.length],
            ['Urgenze risolte', urgRisolte.length],
            ['SLA Compliance', slaPerc + '%'],
            ['Tecnici attivi', new Set(piano.map(p => p.tecnico_id).filter(Boolean)).size],
            ['Clienti serviti', new Set(piano.map(p => p.cliente_id).filter(Boolean)).size],
          ];
          break;
        }
        case 'performance_squadra': {
          result.titolo = `Performance per Squadra (${dateFrom} — ${dtTo})`;
          result.colonne = ['Tecnico', 'Ruolo', 'Interventi', 'Completati', '%', 'Urgenze', 'Ore', 'Km'];
          const tecIds = [...new Set([...piano.map(p => p.tecnico_id), ...urgenze.map(u => u.tecnico_assegnato)].filter(Boolean))];
          result.righe = tecIds.map(tid => {
            const pTec = piano.filter(p => p.tecnico_id === tid);
            const uTec = urgenze.filter(u => u.tecnico_assegnato === tid);
            const comp = pTec.filter(p => p.stato === 'completato');
            const u = utenti.find(x => x.id === tid);
            return [tecName(tid), u?.ruolo||'—', pTec.length, comp.length, pTec.length ? Math.round(comp.length/pTec.length*100)+'%':'—', uTec.filter(u=>u.stato==='risolta'||u.stato==='chiusa').length, comp.reduce((s,p)=>s+parseFloat(p.ore_lavorate||0),0).toFixed(1), comp.reduce((s,p)=>s+parseInt(p.km_percorsi||0),0)];
          });
          break;
        }
        case 'clienti_inattivi': {
          result.titolo = `Clienti Inattivi (>90 giorni senza interventi)`;
          result.colonne = ['Cliente', 'Ultimo Intervento', 'Giorni Inattivo'];
          const d90 = new Date(); d90.setDate(d90.getDate() - 90);
          const allPiano = await sb(env, 'piano', 'GET', null, '?obsoleto=eq.false&order=data.desc&limit=1000');
          const lastByClient = {};
          allPiano.forEach(p => { if (p.cliente_id && !lastByClient[p.cliente_id]) lastByClient[p.cliente_id] = p.data; });
          result.righe = clienti.filter(c => {
            const last = lastByClient[c.id];
            return !last || new Date(last) < d90;
          }).map(c => {
            const last = lastByClient[c.id];
            const days = last ? Math.round((new Date() - new Date(last)) / 86400000) : '—';
            return [c.nome || c.id, last || 'Mai', days];
          }).sort((a, b) => (typeof b[2] === 'number' ? b[2] : 9999) - (typeof a[2] === 'number' ? a[2] : 9999));
          break;
        }
        case 'daily_team': {
          // Report giornaliero team — Apple-style premium
          const giorno = dateFrom;
          result.titolo = `Report Team — ${giorno}`;
          result.colonne = ['Tecnico', 'Ruolo', 'Interventi', 'Completati', 'Urgenze', 'Ordini', 'Rep.', 'Score'];
          const allTecPiano = piano.filter(p => p.data === giorno);
          const allTecUrg = urgenze.filter(u => (u.data_segnalazione || '').startsWith(giorno));
          const ordini = await sb(env, 'ordini', 'GET', null, `?data_richiesta=gte.${giorno}T00:00:00&data_richiesta=lte.${giorno}T23:59:59&obsoleto=eq.false`).catch(() => []);
          const allRep = await sb(env, 'reperibilita', 'GET', null, `?data_inizio=lte.${giorno}&data_fine=gte.${giorno}&obsoleto=eq.false`).catch(() => []);
          const repMap = Object.fromEntries(allRep.map(r => [r.tecnico_id, r.tipo || '✓']));

          const tecActiveTday = [...new Set([
            ...allTecPiano.map(p => p.tecnico_id),
            ...allTecUrg.map(u => u.tecnico_assegnato)
          ].filter(Boolean))];

          // Include all active technicians even without interventions
          const allActiveTec = utenti.filter(u => u.ruolo && u.ruolo !== 'admin');
          const finalTecIds = [...new Set([...tecActiveTday, ...allActiveTec.map(u => u.id)])];

          result.righe = finalTecIds.map(tid => {
            const pTec = allTecPiano.filter(p => p.tecnico_id === tid);
            const uTec = allTecUrg.filter(u => u.tecnico_assegnato === tid);
            const oTec = ordini.filter(o => o.tecnico_id === tid);
            const compTec = pTec.filter(p => p.stato === 'completato').length;
            const compRate = pTec.length > 0 ? Math.round(compTec / pTec.length * 100) : 0;
            const urgDone = uTec.filter(u => u.stato === 'risolta' || u.stato === 'chiusa').length;
            const score = pTec.length > 0 ? Math.round((compRate * 0.6) + (uTec.length > 0 ? urgDone / uTec.length * 100 * 0.4 : 40)) : 0;
            const u = utenti.find(x => x.id === tid);
            return [
              tecName(tid), u?.ruolo || '—',
              pTec.length, compTec, uTec.length, oTec.length,
              repMap[tid] || '—', score
            ];
          }).sort((a, b) => b[7] - a[7]);

          // Add summary row
          const totI = result.righe.reduce((s, r) => s + r[2], 0);
          const totC = result.righe.reduce((s, r) => s + r[3], 0);
          const totU = result.righe.reduce((s, r) => s + r[4], 0);
          const totO = result.righe.reduce((s, r) => s + r[5], 0);
          const avgScore = result.righe.length > 0 ? Math.round(result.righe.reduce((s, r) => s + r[7], 0) / result.righe.length) : 0;
          result.summary = { totale_interventi: totI, completati: totC, urgenze: totU, ordini: totO, score_medio: avgScore };
          break;
        }
        case 'tagliandi_scadenza': {
          result.titolo = `Tagliandi/Service in Scadenza`;
          result.colonne = ['Macchina', 'Modello', 'Cliente', 'Prossimo Tagliando', 'Giorni', 'Urgenza'];
          const macchine = await sb(env, 'macchine', 'GET', null, '?prossimo_tagliando=not.is.null&obsoleto=eq.false&order=prossimo_tagliando.asc&limit=50').catch(() => []);
          const assets = await sb(env, 'anagrafica_assets', 'GET', null, '?prossimo_controllo=not.is.null&order=prossimo_controllo.asc&limit=50').catch(() => []);
          const todayTag = new Date().toISOString().split('T')[0];
          const items = [
            ...macchine.map(m => ({ nome: m.nome || m.id, modello: m.modello || m.tipo || '—', cliente: getName(clienti, m.cliente_id), data: m.prossimo_tagliando })),
            ...assets.map(a => ({ nome: a.nome_asset || a.id, modello: a.modello || a.gruppo_attrezzatura || '—', cliente: a.nome_account || a.codice_m3 || '—', data: a.prossimo_controllo }))
          ].sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999'));

          result.righe = items.map(it => {
            const days = Math.round((new Date(it.data) - new Date(todayTag)) / 86400000);
            const urgLvl = days < 0 ? '🔴 SCADUTO' : days <= 7 ? '🟠 URGENTE' : days <= 30 ? '🟡 PROSSIMO' : '🟢 OK';
            return [it.nome, it.modello, it.cliente, it.data, days, urgLvl];
          });
          break;
        }
        default:
          return err('Tipo report non supportato: ' + tipo);
      }
      return ok(result);
    }

    case 'logKPISnapshot': {
      const id = 'KSN_' + Date.now();
      await sb(env, 'kpi_snapshot', 'POST', { id, ...getFields(body), data: new Date().toISOString().split('T')[0], ora: new Date().toTimeString().split(' ')[0] });
      return ok({ id });
    }

    case 'updateSLAStatus': {
      // Aggiorna stato SLA su tutte le urgenze aperte
      const urgenze = await sb(env, 'urgenze', 'GET', null, '?stato=in.(aperta,assegnata,in_corso)&sla_scadenza=not.is.null');
      const now = new Date();
      let updated = 0;
      for (const u of urgenze) {
        const scadenza = new Date(u.sla_scadenza);
        const diffOre = (scadenza - now) / 3600000;
        let newStatus = 'ok';
        if (diffOre < 0)  newStatus = 'scaduto';
        else if (diffOre < 2)  newStatus = 'critical';
        else if (diffOre < 6)  newStatus = 'warning';
        if (newStatus !== u.sla_status) {
          await sb(env, `urgenze?id=eq.${u.id}`, 'PATCH', { sla_status: newStatus });
          updated++;
        }
      }
      return ok({ updated, total: urgenze.length });
    }

    case 'saveConfig':
    case 'updateConfig': {
      const config = body.config || body.data;
      if (!config || typeof config !== 'object') return err('config richiesto (oggetto chiave/valore)');
      for (const [chiave, valore] of Object.entries(config)) {
        await sb(env, 'config', 'POST', { chiave, valore }).catch(async () => {
          await sb(env, `config?chiave=eq.${chiave}`, 'PATCH', { valore });
        });
      }
      return ok();
    }

    // ─── VINCOLI PIANIFICAZIONE (dinamici, white-label) ───────────────
    case 'saveVincoliCategories': {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const payload = body.vincoli || body.data;
      if (!payload) return err('vincoli richiesti');
      const valStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
      // Upsert: POST con fallback a PATCH
      await sb(env, 'config', 'POST', {
        chiave: 'vincoli_categories',
        valore: valStr,
        tenant_id: env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045'
      }).catch(async () => {
        await sb(env, `config?chiave=eq.vincoli_categories`, 'PATCH', { valore: valStr });
      });
      await wlog('config', 'vincoli_categories', 'vincoli_saved', body.operatore_id || body.userId || 'system');
      return ok({ saved: true, timestamp: new Date().toISOString() });
    }

    case 'getVincoliCategories': {
      const rows = await sb(env, 'config', 'GET', null,
        `?chiave=eq.vincoli_categories&limit=1`);
      if (!rows || !rows.length) return ok({ categories: [], meta: {} });
      try {
        const parsed = JSON.parse(rows[0].valore);
        return ok(parsed);
      } catch {
        return ok({ categories: [], meta: {}, raw: rows[0].valore });
      }
    }

    case 'backupNow': {
      // Snapshot di tutti i dati critici in kpi_snapshot
      const [piano, urgenze, ordini] = await Promise.all([
        sb(env, 'piano',   'GET', null, '?obsoleto=eq.false&order=created_at.desc&limit=1000'),
        sb(env, 'urgenze', 'GET', null, '?obsoleto=eq.false&stato=in.(aperta,assegnata,in_corso)'),
        sb(env, 'ordini',  'GET', null, '?obsoleto=eq.false&stato=in.(richiesto,preso_in_carico,ordinato)'),
      ]);
      const id = 'BAK_' + Date.now();
      await sb(env, 'kpi_snapshot', 'POST', {
        id, tipo_snapshot: 'backup',
        data: new Date().toISOString().split('T')[0],
        ora: new Date().toTimeString().split(' ')[0],
        dati: { piano_count: piano.length, urgenze_aperte: urgenze.length, ordini_attivi: ordini.length }
      });
      return ok({ backupId: id, piano: piano.length, urgenze: urgenze.length, ordini: ordini.length });
    }

    case 'setupWebhook': {
      const { webhookUrl } = body;
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const data = await res.json();
      return ok({ telegram: data });
    }

    case 'removeWebhook': {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteWebhook`);
      const data = await res.json();
      return ok({ telegram: data });
    }

    // -------- TIPI INTERVENTO (Service Types) --------

    case 'getServiceTypes': {
      const types = await sb(env, 'tipi_intervento', 'GET', null, '?attivo=eq.true&order=nome');
      return ok(types.map(pascalizeRecord));
    }

    // -------- FURGONI MANAGEMENT --------

    case 'getFurgoni': {
      const furgoni = await sb(env, 'automezzi', 'GET', null, '?obsoleto=eq.false&order=descrizione');
      return ok(furgoni.map(pascalizeRecord));
    }

    case 'swapFurgone': {
      // Scambia furgone tra due tecnici per una data specifica
      const { tecnico1_id, tecnico2_id, data, note_swap } = body;
      if (!tecnico1_id || !tecnico2_id || !data) return err('Serve tecnico1_id, tecnico2_id, data');
      // Get current assignments
      const t1arr = await sb(env, 'utenti', 'GET', null, `?id=eq.${tecnico1_id}&select=id,nome,automezzo_id`).catch(() => []);
      const t2arr = await sb(env, 'utenti', 'GET', null, `?id=eq.${tecnico2_id}&select=id,nome,automezzo_id`).catch(() => []);
      const t1 = t1arr?.[0], t2 = t2arr?.[0];
      if (!t1 || !t2) return err('Tecnici non trovati');
      // Update piano entries for that date to swap furgoni
      await sb(env, `piano?data=eq.${data}&tecnico_id=eq.${tecnico1_id}&obsoleto=eq.false`, 'PATCH', { automezzo_id: t2.automezzo_id });
      await sb(env, `piano?data=eq.${data}&tecnico_id=eq.${tecnico2_id}&obsoleto=eq.false`, 'PATCH', { automezzo_id: t1.automezzo_id });
      return ok({ swap: `${t1.nome}(${t1.automezzo_id}) ↔ ${t2.nome}(${t2.automezzo_id})`, data });
    }

    case 'assignFurgone': {
      // Assegna un furgone a un tecnico per una data specifica (piano)
      const { tecnicoId, furgoneId, dataAssegna } = body;
      if (!tecnicoId || !furgoneId) return err('Serve tecnicoId e furgoneId');
      if (dataAssegna) {
        // Assign for a specific date (only piano entries)
        await sb(env, `piano?data=eq.${dataAssegna}&tecnico_id=eq.${tecnicoId}&obsoleto=eq.false`, 'PATCH', { automezzo_id: furgoneId });
      } else {
        // Permanent assignment
        await sb(env, `automezzi?assegnatario_id=eq.${tecnicoId}`, 'PATCH', { assegnatario_id: null });
        await sb(env, `automezzi?id=eq.${furgoneId}`, 'PATCH', { assegnatario_id: tecnicoId });
        await sb(env, `utenti?id=eq.${tecnicoId}`, 'PATCH', { automezzo_id: furgoneId });
      }
      return ok({ tecnicoId, furgoneId, data: dataAssegna || 'permanente' });
    }

    // -------- SEARCH CLIENTI (by nome_interno) --------

    case 'searchClienti': {
      // Search clienti by nome_interno or nome_account (for autocomplete)
      const { q } = body;
      if (!q || q.length < 2) return err('Minimo 2 caratteri');
      const sq = sanitizePgFilter(q);
      if (!sq) return err('Ricerca non valida');
      const results = await sb(env, 'anagrafica_clienti', 'GET', null,
        `?or=(nome_interno.ilike.*${sq}*,nome_account.ilike.*${sq}*)&select=codice_m3,nome_account,nome_interno&limit=20`);
      return ok(results.map(pascalizeRecord));
    }

    // -------- TELEGRAM BOT (webhook) --------

    case 'telegramWebhook': {
      const update = body;
      if (!update.message && !update.callback_query) return ok();
      try {

      // Handle callback queries (inline button responses)
      if (update.callback_query) {
        const cb = update.callback_query;
        const cbChatId = cb.message?.chat?.id;
        const cbData = cb.data || '';
        try {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ callback_query_id: cb.id })
          });
          // Callback data format: "confirm:type:encodedId" or "cancel:x:x"
          const [cbAction] = cbData.split(':');
          if (cbAction === 'cancel') {
            await sendTelegram(env, cbChatId, '❌ Azione annullata.');
          }
          // Note: confirm actions are handled by the original message creating the record directly
          // The buttons are just UX feedback - actions are created immediately on AI parse
        } catch(e) { console.error('CB error:', e.message); }
        return ok();
      }

      const msg     = update.message;
      const chatId  = msg.chat.id;
      const fromId  = msg.from?.id || null; // Telegram user ID (individual)
      const text    = msg.text || msg.caption || '';
      const parts   = text.split(' ');
      const cmd     = parts[0]?.toLowerCase() || '';

      // Trova utente: prima per telegram_chat_id (= Telegram user from.id), poi match fuzzy per nome
      let utente = null;
      if (fromId) {
        const byChatId = await sb(env, 'utenti', 'GET', null, `?telegram_chat_id=eq.${fromId}&attivo=eq.true`).catch(()=>[]);
        utente = byChatId[0] || null;
      }
      // In gruppo MRS noto: se non troviamo utente, usa il nome Telegram per match fuzzy
      if (!utente) {
        const firstName = (msg.from?.first_name || '').toLowerCase();
        const lastName = (msg.from?.last_name || '').toLowerCase();
        if (firstName) {
          const allUtenti = await sb(env, 'utenti', 'GET', null, '?attivo=eq.true&select=id,nome,cognome,ruolo').catch(()=>[]);
          utente = allUtenti.find(u => (u.nome||'').toLowerCase() === firstName && (!lastName || (u.cognome||'').toLowerCase().startsWith(lastName))) || null;
          // Auto-save telegram user id in telegram_chat_id for future fast lookups
          if (utente && fromId) {
            await sb(env, `utenti?id=eq.${utente.id}`, 'PATCH', { telegram_chat_id: String(fromId) }).catch(e=>console.error('[SYNC]',e.message));
          }
        }
      }

      // ---- MIRROR Telegram → Chat Admin (PRIMA di qualsiasi return) ----
      // Salva TUTTI i messaggi ricevuti da Telegram nella chat admin, inclusi comandi bot
      if (text) {
        try {
          const senderNameEarly = (msg.from?.first_name || '') + (msg.from?.last_name ? ' ' + msg.from.last_name : '');
          const earlyMsgId = 'TG_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          const urgKwEarly = ['urgenza','fermo','guasto','errore','rotto','emergenza','allarme'];
          const isUrgEarly = urgKwEarly.some(k => text.toLowerCase().includes(k));
          const earlyCanale = isUrgEarly ? 'CH_URGENZE' : 'CH_GENERALE';
          await sb(env, 'chat_messaggi', 'POST', {
            id: earlyMsgId, canale_id: earlyCanale,
            mittente_id: utente?.id || 'TELEGRAM',
            testo: `📱 [TG - ${senderNameEarly}] ${text}`,
            tipo: 'testo', created_at: new Date().toISOString()
          }).catch(e => console.error('Early mirror save error:', e.message));
        } catch(e) { console.error('Early mirror error:', e.message); }
      }

      // /start è permesso anche senza utente registrato
      if (!utente && cmd !== '/start') {
        const nome = msg.from?.first_name || 'utente';
        await sendTelegram(env, chatId, `❌ Ciao ${nome}, non ti trovo nel sistema. Chiedi all'admin di aggiungere il tuo Telegram ID (${fromId}) nel profilo Syntoniqa.`);
        return ok();
      }

      // ---- Helper: download Telegram file and store URL ----
      async function getTelegramFileUrl(fileId) {
        const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
        const d = await res.json();
        return d.ok ? `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${d.result.file_path}` : null;
      }

      // ---- Helper: send with inline keyboard ----
      async function sendTelegramWithButtons(chatId, text, buttons) {
        const htmlText = text.replace(/\*([^*\n]+)\*/g,'<b>$1</b>').replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/_([^_\n]+)_/g,'<i>$1</i>');
        return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            chat_id: chatId, text: htmlText, parse_mode: 'HTML',
            reply_markup: { inline_keyboard: buttons }
          })
        }).then(r=>r.json()).catch(()=>null);
      }

      // ---- Helper: carica catalogo parti Lely dal DB per contesto AI ----
      async function loadPartsCatalog(env, macchina) {
        try {
          // Carica parti più comuni dal catalogo tagliandi
          let filter = '?select=codice,nome,descrizione,gruppo,modello_macchina&attivo=eq.true&limit=60';
          // Se sappiamo la macchina, filtriamo per modello
          if (macchina) {
            const m = macchina.toLowerCase();
            const modelMap = { astronaut: 'ASTRONAUT', vector: 'VECTOR', juno: 'JUNO', discovery: 'DISCOVERY', calm: 'CALM', grazeway: 'GRAZEWAY', cosmix: 'COSMIX' };
            const model = Object.entries(modelMap).find(([k]) => m.includes(k));
            if (model) filter += `&modello_macchina=ilike.*${sanitizePgFilter(model[1])}*`;
          }
          const parti = await sb(env, 'tagliandi', 'GET', null, filter).catch(() => []);
          if (!parti.length) return '';
          const grouped = {};
          for (const p of parti) {
            const g = p.gruppo || 'Generale';
            if (!grouped[g]) grouped[g] = [];
            if (grouped[g].length < 8) grouped[g].push(`${p.codice || '?'} — ${(p.nome || p.descrizione || '').substring(0, 50)}`);
          }
          let txt = '\nCATALOGO RICAMBI LELY (usa questi codici se riconosci il pezzo):';
          for (const [g, items] of Object.entries(grouped)) {
            txt += `\n[${g}]: ${items.join(' | ')}`;
          }
          return txt;
        } catch { return ''; }
      }

      // ---- Helper: match fuzzy ricambio nel catalogo ----
      async function matchPartInCatalog(env, descrizione) {
        if (!descrizione) return null;
        const terms = descrizione.toLowerCase().split(/[\s,;]+/).filter(t => t.length > 3);
        if (!terms.length) return null;
        // Prova ricerca esatta per codice
        const codeMatch = descrizione.match(/\d+\.\d{4}\.\d{4}\.\d+/);
        if (codeMatch) {
          const exact = await sb(env, 'tagliandi', 'GET', null, `?codice=eq.${codeMatch[0]}&attivo=eq.true&limit=1`).catch(() => []);
          if (exact.length) return exact[0];
        }
        // Ricerca fuzzy per termini chiave
        for (const term of terms.slice(0, 3)) {
          const safeTerm = sanitizePgFilter(term);
          if (!safeTerm) continue;
          const found = await sb(env, 'tagliandi', 'GET', null, `?or=(nome.ilike.*${safeTerm}*,descrizione.ilike.*${safeTerm}*)&attivo=eq.true&limit=3`).catch(() => []);
          if (found.length) return found[0];
        }
        return null;
      }

      // ---- Helper: AI parse message with Workers AI (Llama + LLaVA) ----
      async function aiParseMessage(text, mediaUrl, mediaType) {
        if (!env.AI) return null;
        // Get clients list for context — usa nome_interno come chiave primaria
        const clienti = await sb(env, 'anagrafica_clienti', 'GET', null, '?select=codice_m3,nome_account,nome_interno&limit=300').catch(()=>[]);
        const clientiList = clienti.map(c => `${c.nome_interno || c.nome_account} → codice_m3: ${c.codice_m3}`).join('\n');

        // Carica catalogo parti per dare contesto AI (se foto, prioritizza)
        const isPhoto = mediaUrl && mediaType === 'photo';
        const macchinaHint = (text || '').match(/astronaut|vector|juno|discovery|calm|grazeway|cosmix/i)?.[0] || null;
        const partiCatalogo = isPhoto ? await loadPartsCatalog(env, macchinaHint) : '';

        const systemPrompt = `Sei l'assistente AI di Syntoniqa, il sistema FSM di MRS Lely Center.
Analizza il messaggio e determina il tipo di azione da creare.

CLIENTI DISPONIBILI (usa il NOME INTERNO per riconoscerli, es. BONDIOLI, OREFICI, ecc.):
${clientiList}

TIPI DI AZIONE:
1. "urgenza" - Problema tecnico urgente su un robot/macchina (robot fermo, errore, guasto)
2. "ordine" - Richiesta ricambi (codici tipo X.XXXX.XXXX.X, quantità, destinazione)
3. "intervento" - Intervento programmato (manutenzione, service, installazione)
4. "nota" - Informazione generica, aggiornamento stato, nessuna azione specifica

CODICI RICAMBI LELY: formato X.XXXX.XXXX.X (es. 9.1189.0283.0)
${partiCatalogo}
${isPhoto ? '\nIMPORTANTE: Analizza la foto attentamente. Identifica il componente, eventuali danni, usura, rotture. Suggerisci il codice ricambio dal catalogo sopra se riconoscibile.' : ''}

Rispondi SOLO con JSON valido:
{
  "tipo": "urgenza|ordine|intervento|nota",
  "cliente": "nome cliente più probabile o null",
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

        // If there's a photo, use LLaVA Vision model
        if (isPhoto) {
          try {
            const imgRes = await fetch(mediaUrl);
            const imgBuf = await imgRes.arrayBuffer();
            const imgBytes = [...new Uint8Array(imgBuf)];
            const visionRes = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
              image: imgBytes,
              prompt: systemPrompt + '\n\nMESSAGGIO UTENTE: ' + (text || 'Analizza questa foto di un guasto/macchina agricola Lely. Identifica il componente danneggiato e suggerisci il ricambio.'),
              max_tokens: 768
            });
            const raw = (visionRes.description || visionRes.response || '').replace(/```json\n?|\n?```/g, '').trim();
            try {
              const parsed = JSON.parse(raw);
              // Post-process: match ricambi suggeriti con catalogo reale
              if (parsed.ricambi?.length) {
                for (let i = 0; i < parsed.ricambi.length; i++) {
                  const r = parsed.ricambi[i];
                  const match = await matchPartInCatalog(env, r.codice || r.descrizione);
                  if (match) {
                    parsed.ricambi[i] = { codice: match.codice, quantita: r.quantita || 1, descrizione: match.nome || match.descrizione, _verificato: true };
                  }
                }
              }
              // Se AI ha suggerito componente ma no ricambi, prova match
              if (parsed.componente_identificato && (!parsed.ricambi || !parsed.ricambi.length)) {
                const match = await matchPartInCatalog(env, parsed.componente_identificato);
                if (match) {
                  parsed.ricambi = [{ codice: match.codice, quantita: 1, descrizione: match.nome || match.descrizione, _verificato: true }];
                }
              }
              return parsed;
            } catch { console.error('Vision parse error, raw:', raw); /* fall through to text model */ }
          } catch(e) { console.error('Vision AI error:', e.message); /* fall through to text model */ }
        }

        // Text-only: use Llama 3.1
        try {
          const aiRes = await env.AI.run('@cf/meta/llama-3.1-70b-instruct', {
            messages: [
              { role: 'system', content: 'Rispondi SOLO con JSON valido, nessun testo extra.' },
              { role: 'user', content: systemPrompt + '\n\nMESSAGGIO UTENTE: ' + text }
            ],
            max_tokens: 1024
          });
          const raw = (aiRes.response || '').replace(/```json\n?|\n?```/g, '').trim();
          try {
            const parsed = JSON.parse(raw);
            // Post-process: match ricambi con catalogo
            if (parsed.ricambi?.length) {
              for (let i = 0; i < parsed.ricambi.length; i++) {
                const match = await matchPartInCatalog(env, parsed.ricambi[i].codice || parsed.ricambi[i].descrizione);
                if (match) parsed.ricambi[i] = { codice: match.codice, quantita: parsed.ricambi[i].quantita || 1, descrizione: match.nome || match.descrizione, _verificato: true };
              }
            }
            return parsed;
          } catch { console.error('AI parse error, raw:', raw); return null; }
        } catch (aiErr) {
          // Fallback a modello più piccolo
          try {
            const aiRes = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
              messages: [
                { role: 'system', content: 'Rispondi SOLO con JSON valido, nessun testo extra.' },
                { role: 'user', content: systemPrompt + '\n\nMESSAGGIO UTENTE: ' + text }
              ],
              max_tokens: 1024
            });
            const raw = (aiRes.response || '').replace(/```json\n?|\n?```/g, '').trim();
            try { return JSON.parse(raw); } catch { return null; }
          } catch { return null; }
        }
      }

      // ---- Handle media uploads (photo, document, video, audio) ----
      let mediaUrl = null, mediaType = null, fileName = null;

      if (msg.photo && msg.photo.length) {
        const photo = msg.photo[msg.photo.length - 1]; // Highest resolution
        mediaUrl = await getTelegramFileUrl(photo.file_id);
        mediaType = 'photo';
      } else if (msg.document) {
        mediaUrl = await getTelegramFileUrl(msg.document.file_id);
        mediaType = 'document';
        fileName = msg.document.file_name || 'file';
      } else if (msg.video) {
        mediaUrl = await getTelegramFileUrl(msg.video.file_id);
        mediaType = 'video';
      } else if (msg.voice || msg.audio) {
        const audio = msg.voice || msg.audio;
        mediaUrl = await getTelegramFileUrl(audio.file_id);
        mediaType = 'audio';
      }

      let reply = '';

      // ---- SLASH COMMANDS ----
      switch (cmd) {
        case '/start':
          reply = `👋 *Benvenuto in Syntoniqa MRS!*\n\n🤖 Il tuo assistente intelligente per il Field Service.\n\n📤 Puoi inviarmi:\n• ✍️ Testo con problemi/ordini\n• 📷 Foto di guasti → AI identifica pezzo\n• 📄 Documenti (PDF, Excel)\n• 🎤 Audio/Video\n\n⚡ L'AI analizza tutto e crea urgenze, ordini, interventi!\n\nInvia /help per tutti i comandi.`;
          break;
        case '/help':
          reply = `📋 *Comandi Syntoniqa:*\n\n🚨 *Urgenze:*\n/stato — Urgenze aperte\n/vado — Lista urgenze, /vado N per prendere\n/incorso — Segna in corso\n/risolto [note] — Chiudi urgenza\n/assegna [N] [tecnico] — Assegna urgenza\n\n📅 *Piano:*\n/oggi — I tuoi interventi oggi\n/settimana — Piano settimanale\n/pianifica [data] [cliente] [tipo] — Crea intervento\n/disponibile — Segnati disponibile per urgenze\n\n📦 *Ordini:*\n/ordine [cod] [qt] [cliente] — Ordine ricambio\n/servepezz [desc] — Ricambio generico\n\n🔍 *Ricerca:*\n/catalogo [testo] — Cerca ricambio nel catalogo Lely\n/tagliando [cliente] — Prossimi tagliandi\n/dove — Posizione tecnici oggi\n\n📊 *Report:*\n/report — Il tuo report giornaliero\n/kpi — KPI personali\n\n📤 *Upload:*\nInvia foto, PDF, Excel → AI analizza!\n\n💡 Testo libero: "Bondioli 102 fermo, errore laser"`;
          break;
        case '/stato': {
          const urg = await sb(env, 'urgenze', 'GET', null, '?stato=in.(aperta,assegnata,in_corso)&order=data_segnalazione.desc&limit=10');
          reply = urg.length ? `🚨 *${urg.length} urgenze attive:*\n` + urg.map(u => `• ${u.id}: ${u.problema} [${u.stato}]`).join('\n') : '✅ Nessuna urgenza attiva';
          break;
        }
        case '/oggi': {
          const oggi = new Date().toISOString().split('T')[0];
          const intv = await sb(env, 'piano', 'GET', null, `?data=eq.${oggi}&tecnico_id=eq.${utente.id}&obsoleto=eq.false`);
          reply = intv.length ? `📅 *Interventi oggi (${intv.length}):*\n` + intv.map(i => `• ${i.id}: ${i.stato} – Cliente ${i.cliente_id}`).join('\n') : '📅 Nessun intervento programmato oggi';
          break;
        }
        case '/settimana': {
          const oggi = new Date();
          const lun = new Date(oggi); lun.setDate(oggi.getDate() - oggi.getDay() + 1);
          const dom = new Date(lun); dom.setDate(lun.getDate() + 6);
          const intv = await sb(env, 'piano', 'GET', null, `?data=gte.${lun.toISOString().split('T')[0]}&data=lte.${dom.toISOString().split('T')[0]}&tecnico_id=eq.${utente.id}&obsoleto=eq.false&order=data.asc`);
          if (!intv.length) { reply = '📅 Nessun intervento questa settimana'; break; }
          const byDay = {};
          intv.forEach(i => { const d = i.data; if (!byDay[d]) byDay[d] = []; byDay[d].push(i); });
          reply = `📅 *Piano settimanale (${intv.length} interventi):*\n` + Object.entries(byDay).map(([d, items]) => `\n*${d}:*\n` + items.map(i => `  • ${i.stato} – ${i.cliente_id}`).join('\n')).join('');
          break;
        }
        case '/vado': {
          const urgList = await sb(env, 'urgenze', 'GET', null, '?stato=eq.aperta&order=priorita.asc,data_segnalazione.asc&limit=5');
          if (!urgList.length) { reply = '✅ Nessuna urgenza da prendere in carico'; break; }
          const scelta = parseInt(parts[1]);
          if (!scelta || scelta < 1 || scelta > urgList.length) {
            reply = `🚨 *Urgenze aperte (${urgList.length}):*\n` + urgList.map((u, i) => `*${i + 1}.* ${u.problema || 'N/D'} – P${u.priorita || '?'}\n   📅 ${u.data_segnalazione?.split('T')[0] || '?'} | ID: \`${u.id}\``).join('\n\n') + `\n\n👉 Rispondi */vado N* per prendere in carico (es: /vado 1)`;
            break;
          }
          const picked = urgList[scelta - 1];
          await sb(env, `urgenze?id=eq.${picked.id}`, 'PATCH', { stato: 'assegnata', tecnico_assegnato: utente.id, data_assegnazione: new Date().toISOString() });
          reply = `✅ Urgenza *${picked.id}* assegnata a te!\nProblema: ${picked.problema}`;
          await sendTelegramNotification(env, 'urgenza_assegnata', { id: picked.id, tecnicoAssegnato: utente.id });
          break;
        }
        case '/incorso': {
          const urg = await sb(env, 'urgenze', 'GET', null, `?tecnico_assegnato=eq.${utente.id}&stato=eq.assegnata&limit=1`);
          if (!urg.length) { reply = 'Nessuna urgenza assegnata'; break; }
          await sb(env, `urgenze?id=eq.${urg[0].id}`, 'PATCH', { stato: 'in_corso', data_inizio: new Date().toISOString() });
          reply = `🔧 Urgenza *${urg[0].id}* segnata come IN CORSO`;
          break;
        }
        case '/risolto': {
          const note = parts.slice(1).join(' ');
          const urg = await sb(env, 'urgenze', 'GET', null, `?tecnico_assegnato=eq.${utente.id}&stato=in.(assegnata,in_corso)&limit=1`);
          if (!urg.length) { reply = 'Nessuna urgenza in corso'; break; }
          await sb(env, `urgenze?id=eq.${urg[0].id}`, 'PATCH', { stato: 'risolta', data_risoluzione: new Date().toISOString(), note });
          reply = `✅ Urgenza *${urg[0].id}* RISOLTA${note ? '\nNote: ' + note : ''}`;
          break;
        }
        case '/ordine': {
          // /ordine 9.1189.0283.0 2 Bondioli
          const codice = parts[1] || '';
          const qt = parseInt(parts[2]) || 1;
          const cliente = parts.slice(3).join(' ') || 'non specificato';
          if (!codice || !/^\d\.\d{4}\.\d{4}\.\d$/.test(codice)) {
            reply = '📦 Formato: /ordine [codice] [quantità] [cliente]\nEs: /ordine 9.1189.0283.0 2 Bondioli';
            break;
          }
          const ordId = 'ORD_TG_' + Date.now();
          const ordTid = env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045';
          await sb(env, 'ordini', 'POST', { id: ordId, tenant_id: ordTid, tecnico_id: utente?.id || null, codice, descrizione: `${codice} x${qt} - ${cliente}`, quantita: qt, stato: 'richiesto', data_richiesta: new Date().toISOString() });
          reply = `📦 Ordine *${ordId}* creato:\nCodice: \`${codice}\` x${qt}\nCliente: ${cliente}`;
          break;
        }
        case '/servepezz': {
          const desc2 = parts.slice(1).join(' ');
          if (!desc2) { reply = 'Usa: /servepezz [descrizione ricambio]'; break; }
          const spId = 'ORD_TG_' + Date.now();
          const spTid = env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045';
          await sb(env, 'ordini', 'POST', { id: spId, tenant_id: spTid, tecnico_id: utente?.id || null, descrizione: desc2, stato: 'richiesto', data_richiesta: new Date().toISOString() });
          reply = `📦 Ordine ricambio *${spId}* creato:\n_${desc2}_`;
          break;
        }

        // ═══════════════════════════════════════════════════════
        // ═══ NUOVI COMANDI SUPER-POTENTI ══════════════════════
        // ═══════════════════════════════════════════════════════

        case '/pianifica': {
          // /pianifica domani Bondioli service
          // /pianifica 2026-03-05 Rossi tagliando
          // /pianifica lunedi Palladini ispezione nota qui
          const dateArg = (parts[1] || '').toLowerCase();
          const clienteArg = parts[2] || '';
          const tipoArg = (parts[3] || 'service').toLowerCase();
          const noteArg = parts.slice(4).join(' ');
          if (!dateArg || !clienteArg) {
            reply = `📅 *Pianifica intervento:*\n\n\`/pianifica [data] [cliente] [tipo] [note]\`\n\nEsempi:\n• \`/pianifica domani Bondioli service\`\n• \`/pianifica 2026-03-05 Rossi tagliando\`\n• \`/pianifica lunedi Palladini ispezione\`\n\nTipi: service, tagliando, installazione, ispezione, urgenza`;
            break;
          }
          // Parse data
          let targetDate;
          const nowD = new Date();
          if (dateArg === 'domani' || dateArg === 'tomorrow') { targetDate = new Date(nowD); targetDate.setDate(targetDate.getDate() + 1); }
          else if (dateArg === 'dopodomani') { targetDate = new Date(nowD); targetDate.setDate(targetDate.getDate() + 2); }
          else if (['lunedi','lunedì','monday'].includes(dateArg)) { targetDate = new Date(nowD); const d = targetDate.getDay(); targetDate.setDate(targetDate.getDate() + ((1 - d + 7) % 7 || 7)); }
          else if (['martedi','martedì','tuesday'].includes(dateArg)) { targetDate = new Date(nowD); const d = targetDate.getDay(); targetDate.setDate(targetDate.getDate() + ((2 - d + 7) % 7 || 7)); }
          else if (['mercoledi','mercoledì','wednesday'].includes(dateArg)) { targetDate = new Date(nowD); const d = targetDate.getDay(); targetDate.setDate(targetDate.getDate() + ((3 - d + 7) % 7 || 7)); }
          else if (['giovedi','giovedì','thursday'].includes(dateArg)) { targetDate = new Date(nowD); const d = targetDate.getDay(); targetDate.setDate(targetDate.getDate() + ((4 - d + 7) % 7 || 7)); }
          else if (['venerdi','venerdì','friday'].includes(dateArg)) { targetDate = new Date(nowD); const d = targetDate.getDay(); targetDate.setDate(targetDate.getDate() + ((5 - d + 7) % 7 || 7)); }
          else if (['sabato','saturday'].includes(dateArg)) { targetDate = new Date(nowD); const d = targetDate.getDay(); targetDate.setDate(targetDate.getDate() + ((6 - d + 7) % 7 || 7)); }
          else { targetDate = new Date(dateArg); }
          if (isNaN(targetDate)) { reply = '❌ Data non valida. Usa: domani, lunedi, 2026-03-05, etc.'; break; }
          const dataStr = targetDate.toISOString().split('T')[0];
          // Match cliente
          const cliSearch = clienteArg.toLowerCase();
          const allCli = await sb(env, 'anagrafica_clienti', 'GET', null, '?select=codice_m3,nome_interno,nome_account&limit=300').catch(()=>[]);
          const matchCli = allCli.find(c => (c.nome_interno||'').toLowerCase().includes(cliSearch) || (c.nome_account||'').toLowerCase().includes(cliSearch));
          const pId = 'INT_TG_' + Date.now();
          const pTid = env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045';
          await sb(env, 'piano', 'POST', {
            id: pId, tenant_id: pTid, tecnico_id: utente.id, cliente_id: matchCli?.codice_m3 || null,
            data: dataStr, stato: 'pianificato', tipo_intervento: tipoArg, origine: 'telegram',
            note: `${matchCli?.nome_interno || clienteArg} — ${tipoArg}${noteArg ? ' — ' + noteArg : ''}`,
            obsoleto: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
          });
          const giorni = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
          reply = `📅 *Intervento pianificato!*\n\n📋 ID: \`${pId}\`\n📆 ${giorni[targetDate.getDay()]} ${dataStr}\n🏢 ${matchCli?.nome_interno || clienteArg}\n🔧 ${tipoArg}\n👤 ${utente.nome} ${utente.cognome}${noteArg ? '\n📝 ' + noteArg : ''}`;
          break;
        }

        case '/assegna': {
          // /assegna 2 Giovanni — assegna urgenza #2 a Giovanni
          // /assegna URG_xxx Giovanni
          const urgArg = parts[1] || '';
          const tecArg = parts.slice(2).join(' ') || '';
          if (!urgArg) {
            reply = `🎯 *Assegna urgenza:*\n\n\`/assegna [N o ID] [tecnico]\`\n\nEsempi:\n• \`/assegna 1 Giovanni\` (urgenza #1 dalla lista)\n• \`/assegna URG_TG_xxx Anton\`\n\nPrima usa /stato per vedere le urgenze.`;
            break;
          }
          // Check admin/caposquadra
          if (!['admin','caposquadra'].includes(utente.ruolo)) {
            reply = '❌ Solo admin e caposquadra possono assegnare urgenze.';
            break;
          }
          // Find urgenza
          let urgToAssign = null;
          const urgNum = parseInt(urgArg);
          if (!isNaN(urgNum) && urgNum > 0) {
            const urgL = await sb(env, 'urgenze', 'GET', null, '?stato=in.(aperta,assegnata)&order=priorita.asc,data_segnalazione.asc&limit=10');
            if (urgNum <= urgL.length) urgToAssign = urgL[urgNum - 1];
          } else {
            const urgById = await sb(env, 'urgenze', 'GET', null, `?id=eq.${urgArg}`).catch(()=>[]);
            urgToAssign = urgById[0] || null;
          }
          if (!urgToAssign) { reply = '❌ Urgenza non trovata. Usa /stato per la lista.'; break; }
          // Find tecnico
          const tecSearch = tecArg.toLowerCase();
          const allTec = await sb(env, 'utenti', 'GET', null, '?attivo=eq.true&select=id,nome,cognome,ruolo').catch(()=>[]);
          const matchTec = allTec.find(t => (t.nome||'').toLowerCase().includes(tecSearch) || (t.cognome||'').toLowerCase().includes(tecSearch));
          if (!matchTec) { reply = `❌ Tecnico "${tecArg}" non trovato. Disponibili: ${allTec.filter(t=>t.ruolo!=='admin').map(t=>t.nome).join(', ')}`; break; }
          await sb(env, `urgenze?id=eq.${urgToAssign.id}`, 'PATCH', {
            stato: 'assegnata', tecnico_assegnato: matchTec.id,
            data_assegnazione: new Date().toISOString()
          });
          reply = `🎯 *Urgenza assegnata!*\n\n🚨 ${urgToAssign.id}\n📝 ${(urgToAssign.problema||'').substring(0,60)}\n👤 → *${matchTec.nome} ${matchTec.cognome}*`;
          // Notify the assigned technician
          if (matchTec.telegram_chat_id) {
            await sendTelegram(env, matchTec.telegram_chat_id, `🚨 *Urgenza assegnata a te!*\n\nID: \`${urgToAssign.id}\`\nProblema: ${urgToAssign.problema}\n\nUsa /incorso quando inizi.`);
          }
          break;
        }

        case '/disponibile': {
          // Segna il tecnico come disponibile per urgenze oggi
          const oggi2 = new Date().toISOString().split('T')[0];
          const dispTipo = (parts[1] || 'urgenze').toLowerCase();
          const dispId = 'INT_DISP_' + Date.now();
          const dispTid = env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045';
          await sb(env, 'piano', 'POST', {
            id: dispId, tenant_id: dispTid, tecnico_id: utente.id,
            data: oggi2, stato: 'pianificato', tipo_intervento: 'varie',
            note: `DISPONIBILE ${dispTipo.toUpperCase()} — slot libero per urgenze entranti`,
            origine: 'telegram', obsoleto: false,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString()
          });
          reply = `✅ *Sei disponibile per ${dispTipo} oggi!*\n\n📅 ${oggi2}\n👤 ${utente.nome} ${utente.cognome}\n🔔 Riceverai notifica se arriva un'urgenza.\n\nUsa /vado per prenderne una.`;
          break;
        }

        case '/dove': {
          // Dove sono tutti i tecnici oggi
          const oggiDove = new Date().toISOString().split('T')[0];
          const allT = await sb(env, 'utenti', 'GET', null, '?attivo=eq.true&ruolo=neq.admin&select=id,nome,cognome,ruolo,base').catch(()=>[]);
          const oggiPiano = await sb(env, 'piano', 'GET', null, `?data=eq.${oggiDove}&obsoleto=eq.false&select=tecnico_id,cliente_id,stato,note,tipo_intervento`).catch(()=>[]);
          const oggiUrg = await sb(env, 'urgenze', 'GET', null, `?stato=in.(assegnata,in_corso)&select=tecnico_assegnato,problema,stato,cliente_id`).catch(()=>[]);
          const cliCache = await sb(env, 'anagrafica_clienti', 'GET', null, '?select=codice_m3,nome_interno&limit=300').catch(()=>[]);
          const cliName = id => (cliCache.find(c=>c.codice_m3===id)||{}).nome_interno || id || '?';
          let doveText = `📍 *Posizione tecnici — ${oggiDove}*\n`;
          for (const t of allT) {
            const interventi = oggiPiano.filter(p => p.tecnico_id === t.id);
            const urgAtt = oggiUrg.find(u => u.tecnico_assegnato === t.id);
            let status = '';
            if (urgAtt) {
              status = urgAtt.stato === 'in_corso' ? `🔴 IN CORSO: ${(urgAtt.problema||'').substring(0,30)} @${cliName(urgAtt.cliente_id)}` : `🟡 Urgenza assegnata: ${cliName(urgAtt.cliente_id)}`;
            } else if (interventi.length) {
              const isVarie = interventi.some(p => (p.tipo_intervento||'').includes('varie') || (p.note||'').includes('DISPONIBILE'));
              const clienti = interventi.filter(p => p.cliente_id).map(p => cliName(p.cliente_id));
              status = isVarie ? '🟢 Disponibile urgenze' : `📋 ${clienti.join(', ') || interventi[0]?.note?.substring(0,30) || '?'}`;
            } else {
              status = '⚪ Nessun intervento programmato';
            }
            const ruoloIco = t.ruolo === 'caposquadra' ? '👑' : t.ruolo?.includes('senior') ? '⭐' : '👤';
            doveText += `\n${ruoloIco} *${t.nome} ${(t.cognome||'').charAt(0)}.*  ${status}`;
          }
          reply = doveText;
          break;
        }

        case '/catalogo': {
          // Cerca nel catalogo parti Lely
          const searchTerm = parts.slice(1).join(' ').trim();
          if (!searchTerm) {
            reply = `🔍 *Catalogo Ricambi Lely*\n\n\`/catalogo [ricerca]\`\n\nEsempi:\n• \`/catalogo laser\`\n• \`/catalogo tilt sensor\`\n• \`/catalogo 9.1189\`\n• \`/catalogo milk pump\``;
            break;
          }
          // Search in anagrafica_assets and item catalog (tagliandi table)
          const safeTerm = sanitizePgFilter(searchTerm);
          if (!safeTerm) { reply = '❌ Termine di ricerca non valido'; break; }
          const results = await sb(env, 'tagliandi', 'GET', null, `?or=(nome.ilike.*${safeTerm}*,descrizione.ilike.*${safeTerm}*,codice.ilike.*${safeTerm}*)&limit=8`).catch(()=>[]);
          if (!results.length) {
            // Fallback: try broader search
            const fallbackTerm = sanitizePgFilter(searchTerm.split(' ')[0]);
            const results2 = fallbackTerm ? await sb(env, 'tagliandi', 'GET', null, `?descrizione=ilike.*${fallbackTerm}*&limit=5`).catch(()=>[]) : [];
            if (results2.length) {
              reply = `🔍 Risultati parziali per "${searchTerm}":\n\n` + results2.map(r => `• \`${r.codice||r.id}\` — ${(r.nome||r.descrizione||'').substring(0,50)}`).join('\n');
            } else {
              reply = `❌ Nessun risultato per "${searchTerm}". Prova con un termine diverso.`;
            }
          } else {
            reply = `🔍 *Catalogo Lely — "${searchTerm}":*\n\n` + results.map(r => `📦 \`${r.codice||r.id}\`\n   ${(r.nome||r.descrizione||'').substring(0,60)}`).join('\n\n');
          }
          break;
        }

        case '/tagliando': {
          // Prossimi tagliandi per un cliente
          const cliTagArg = parts.slice(1).join(' ').trim();
          if (!cliTagArg) {
            reply = `🔧 *Prossimi Tagliandi*\n\n\`/tagliando [cliente]\` — Mostra tagliandi in scadenza\n\`/tagliando tutti\` — Top 10 più urgenti\n\nEs: \`/tagliando Bondioli\``;
            break;
          }
          let macFilter = '?obsoleto=eq.false&prossimo_tagliando=not.is.null&order=prossimo_tagliando.asc&limit=15';
          if (cliTagArg.toLowerCase() !== 'tutti') {
            const safeCliArg = sanitizePgFilter(cliTagArg);
            const cliMatch = safeCliArg ? await sb(env, 'anagrafica_clienti', 'GET', null, `?nome_interno=ilike.*${safeCliArg}*&select=codice_m3,nome_interno&limit=5`).catch(()=>[]) : [];
            if (cliMatch.length) {
              macFilter += `&cliente_id=eq.${cliMatch[0].codice_m3}`;
            }
          }
          const macchine = await sb(env, 'macchine', 'GET', null, `${macFilter}&select=id,nome,modello,tipo,cliente_id,prossimo_tagliando,ultimo_tagliando`).catch(()=>[]);
          if (!macchine.length) { reply = '✅ Nessun tagliando in scadenza' + (cliTagArg.toLowerCase() !== 'tutti' ? ` per "${cliTagArg}"` : ''); break; }
          const oggiTag = new Date().toISOString().split('T')[0];
          reply = `🔧 *Tagliandi in scadenza${cliTagArg.toLowerCase() !== 'tutti' ? ' — ' + cliTagArg : ''}:*\n\n`;
          for (const m of macchine.slice(0, 10)) {
            const gg = Math.round((new Date(m.prossimo_tagliando) - new Date(oggiTag)) / 86400000);
            const urgIco = gg < 0 ? '🔴' : gg <= 7 ? '🟠' : gg <= 30 ? '🟡' : '🟢';
            reply += `${urgIco} *${m.nome || m.modello || m.tipo || 'Robot'}* (${m.id})\n   📅 ${m.prossimo_tagliando} (${gg < 0 ? Math.abs(gg) + 'gg SCADUTO' : gg + 'gg'})\n`;
          }
          break;
        }

        case '/report': {
          // Report giornaliero premium — Apple-style con dettaglio avanzato
          const itFmtRep = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
          const oggiRep = itFmtRep.format(new Date());
          const [oggiIntv, oggiUrgRep, oggiOrd, repToday] = await Promise.all([
            sb(env, 'piano', 'GET', null, `?data=eq.${oggiRep}&tecnico_id=eq.${utente.id}&obsoleto=eq.false&select=id,cliente_id,note,stato,ora_inizio,tipo_intervento_id&order=ora_inizio.asc`).catch(()=>[]),
            sb(env, 'urgenze', 'GET', null, `?tecnico_assegnato=eq.${utente.id}&data_segnalazione=gte.${oggiRep}T00:00:00&select=id,problema,stato,data_risoluzione,cliente_id`).catch(()=>[]),
            sb(env, 'ordini', 'GET', null, `?tecnico_id=eq.${utente.id}&data_richiesta=gte.${oggiRep}T00:00:00&select=id,descrizione,stato`).catch(()=>[]),
            sb(env, 'reperibilita', 'GET', null, `?tecnico_id=eq.${utente.id}&data_inizio=lte.${oggiRep}&data_fine=gte.${oggiRep}&obsoleto=eq.false&limit=1`).catch(()=>[])
          ]);
          const completati = oggiIntv.filter(p => p.stato === 'completato').length;
          const inCorso = oggiIntv.filter(p => p.stato === 'in_corso').length;
          const pian = oggiIntv.filter(p => p.stato === 'pianificato').length;
          const tot = oggiIntv.length;
          const perc = tot > 0 ? Math.round(completati / tot * 100) : 0;
          const barFn = n => { const filled = Math.min(Math.round(n / 10), 10); return '▓'.repeat(filled) + '░'.repeat(10 - filled); };

          reply = `┌─────────────────────────┐\n│  📊  *REPORT GIORNALIERO*  │\n└─────────────────────────┘\n\n`;
          reply += `👤 *${utente.nome} ${utente.cognome || ''}*\n📅 ${oggiRep}${repToday.length ? '  •  📞 REP ' + (repToday[0].tipo || '') : ''}\n\n`;
          reply += `── *Avanzamento* ──────────\n`;
          reply += `${barFn(perc)}  *${perc}%*\n\n`;
          reply += `📋 *Interventi:* ${tot}\n   ✅ Completati: *${completati}*\n   🔄 In corso: *${inCorso}*\n   📅 Da fare: *${pian}*\n\n`;

          if (oggiIntv.length) {
            reply += `── *Dettaglio* ───────────\n`;
            for (const p of oggiIntv.slice(0, 8)) {
              const ico = p.stato === 'completato' ? '✅' : p.stato === 'in_corso' ? '🔄' : '⏳';
              reply += `${ico} \`${p.ora_inizio || '--:--'}\` ${(p.note || p.tipo_intervento_id || p.id).substring(0, 35)}\n`;
            }
            reply += '\n';
          }

          if (oggiUrgRep.length) {
            reply += `── *Urgenze* ─────────────\n`;
            reply += `🚨 ${oggiUrgRep.length} gestite\n`;
            for (const u of oggiUrgRep.slice(0, 5)) {
              const ico = (u.stato === 'risolta' || u.stato === 'chiusa') ? '✅' : '🔴';
              reply += `   ${ico} ${(u.problema||'').substring(0, 35)}\n`;
            }
            reply += '\n';
          }

          if (oggiOrd.length) {
            reply += `── *Ordini* ──────────────\n`;
            reply += `📦 ${oggiOrd.length} richiesti\n`;
            for (const o of oggiOrd.slice(0, 3)) reply += `   • ${(o.descrizione||'').substring(0, 35)}\n`;
            reply += '\n';
          }

          reply += `━━━━━━━━━━━━━━━━━━━━━━\n`;
          reply += `_MRS Lely Center · Syntoniqa_`;
          break;
        }

        case '/kpi': {
          // KPI personali premium — 7 giorni con breakdown giornaliero
          const oggi7 = new Date();
          const settimanafa = new Date(oggi7);
          settimanafa.setDate(settimanafa.getDate() - 7);
          const da = settimanafa.toISOString().split('T')[0];
          const a = oggi7.toISOString().split('T')[0];
          const [intv7, urg7, ord7] = await Promise.all([
            sb(env, 'piano', 'GET', null, `?tecnico_id=eq.${utente.id}&data=gte.${da}&data=lte.${a}&obsoleto=eq.false&select=id,stato,data`).catch(()=>[]),
            sb(env, 'urgenze', 'GET', null, `?tecnico_assegnato=eq.${utente.id}&data_segnalazione=gte.${da}T00:00:00&select=id,stato,data_segnalazione,data_risoluzione`).catch(()=>[]),
            sb(env, 'ordini', 'GET', null, `?tecnico_id=eq.${utente.id}&data_richiesta=gte.${da}T00:00:00&select=id,stato`).catch(()=>[])
          ]);

          const comp = intv7.filter(p => p.stato === 'completato').length;
          const totIntv = intv7.length;
          const urgRisolte = urg7.filter(u => u.stato === 'risolta' || u.stato === 'chiusa').length;
          const compRate = totIntv > 0 ? Math.round(comp / totIntv * 100) : 0;
          const barFn2 = n => { const filled = Math.min(Math.round(n / 10), 10); return '▓'.repeat(filled) + '░'.repeat(10 - filled); };

          // Grafico giornaliero (mini-sparkline per ogni giorno)
          const dailyStats = {};
          for (let d = new Date(settimanafa); d <= oggi7; d.setDate(d.getDate() + 1)) {
            const ds = d.toISOString().split('T')[0];
            const dayIntv = intv7.filter(p => p.data === ds);
            const dayComp = dayIntv.filter(p => p.stato === 'completato').length;
            dailyStats[ds] = { total: dayIntv.length, completed: dayComp };
          }

          reply = `┌─────────────────────────┐\n│  📊  *KPI SETTIMANALE*     │\n└─────────────────────────┘\n\n`;
          reply += `👤 *${utente.nome} ${utente.cognome || ''}*\n📅 ${da} → ${a}\n\n`;
          reply += `── *Performance* ─────────\n`;
          reply += `📋 Interventi totali: *${totIntv}*\n`;
          reply += `✅ Completamento: *${compRate}%*\n${barFn2(compRate)}\n\n`;
          reply += `🚨 Urgenze gestite: *${urg7.length}* (${urgRisolte} risolte)\n`;
          reply += `📦 Ordini: *${ord7.length}*\n\n`;

          // Mini-chart giornaliero
          reply += `── *Andamento* ───────────\n`;
          const giorniIt = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
          for (const [ds, st] of Object.entries(dailyStats)) {
            const dayName = giorniIt[new Date(ds + 'T12:00:00').getDay()];
            const miniBar = '█'.repeat(Math.min(st.completed, 6)) + '░'.repeat(Math.min(st.total - st.completed, 4));
            reply += `${dayName} ${ds.substring(8)}: ${miniBar} ${st.completed}/${st.total}\n`;
          }

          // Score complessivo
          const score = Math.round((compRate * 0.6) + (urgRisolte / Math.max(urg7.length, 1) * 100 * 0.4));
          const scoreEmoji = score >= 80 ? '🟢' : score >= 50 ? '🟡' : '🔴';
          reply += `\n── *Score* ───────────────\n`;
          reply += `${scoreEmoji} *${score}/100* — ${score >= 80 ? 'Eccellente!' : score >= 50 ? 'Buono' : 'Da migliorare'}\n\n`;
          reply += `━━━━━━━━━━━━━━━━━━━━━━\n`;
          reply += `_MRS Lely Center · Syntoniqa_`;
          break;
        }

        default: {
          // ---- FREE TEXT + MEDIA: AI ANALYSIS ----
          if (text.length < 3 && !mediaUrl) { reply = '🤔 Messaggio troppo breve. Scrivi il problema o invia /help'; break; }

          // Store media metadata for later attachment
          let mediaInfo = null;
          if (mediaUrl) {
            mediaInfo = { url: mediaUrl, type: mediaType, fileName, telegramFileId: msg.photo?.[msg.photo.length-1]?.file_id || msg.document?.file_id || msg.video?.file_id || msg.voice?.file_id || null };
            if (!text && mediaType === 'photo') {
              await sendTelegram(env, chatId, '📷 Foto ricevuta! Aggiungi una descrizione o la analizzo con AI...');
            }
            if (!text && mediaType === 'document') {
              await sendTelegram(env, chatId, `📄 Documento *${fileName}* ricevuto! Aggiungi una descrizione oppure lo salvo come allegato.`);
            }
          }

          // AI Parse (Workers AI Llama + LLaVA, with fallback to keyword-based parsing)
          let aiResult = await aiParseMessage(text || `[${mediaType} allegato: ${fileName || 'foto'}]`, mediaUrl, mediaType);

          if (!aiResult) {
            // Fallback: keyword-based parsing + nome_interno client matching
            const txt = (text || '').toLowerCase();
            const urgKw = ['fermo', 'guasto', 'errore', 'rotto', 'urgente', 'emergenza', 'bloccato', 'non funziona', 'allarme'];
            const ordKw = ['ordine', 'ricambio', 'pezzo', 'servono', 'ordinare', 'spedire'];
            const isUrg = urgKw.some(k => txt.includes(k));
            const isOrd = ordKw.some(k => txt.includes(k));

            // Try to match client by nome_interno
            let matchedCliente = null, matchedCodice = null;
            const clienti = await sb(env, 'anagrafica_clienti', 'GET', null, '?select=codice_m3,nome_interno&limit=300').catch(()=>[]);
            for (const c of clienti) {
              const ni = (c.nome_interno || '').toLowerCase();
              if (ni && ni.length > 2 && txt.includes(ni)) {
                matchedCliente = c.nome_interno;
                matchedCodice = c.codice_m3;
                break;
              }
            }

            if (isUrg || isOrd || mediaUrl || matchedCliente) {
              aiResult = {
                tipo: isOrd ? 'ordine' : 'urgenza',
                cliente: matchedCliente, codice_m3: matchedCodice,
                problema: text || `[${mediaType || 'messaggio'} allegato]`,
                macchina: null, robot_id: null,
                priorita: isUrg ? 'alta' : 'media',
                ricambi: [], note: 'Analizzato con fallback keywords (AI non disponibile)'
              };
            } else {
              reply = '🤔 Non riesco ad analizzare. Prova con /help per i comandi disponibili.';
              break;
            }
          }

          // Post-AI: verify/resolve cliente by nome_interno if AI returned a name but no codice_m3
          if (aiResult.cliente && !aiResult.codice_m3) {
            const clienti = await sb(env, 'anagrafica_clienti', 'GET', null, '?select=codice_m3,nome_interno,nome_account&limit=300').catch(()=>[]);
            const searchName = (aiResult.cliente || '').toLowerCase();
            const match = clienti.find(c =>
              (c.nome_interno || '').toLowerCase() === searchName ||
              (c.nome_interno || '').toLowerCase().includes(searchName) ||
              (c.nome_account || '').toLowerCase().includes(searchName)
            );
            if (match) {
              aiResult.codice_m3 = match.codice_m3;
              aiResult.cliente = match.nome_interno || match.nome_account;
            }
          }

          if (aiResult.tipo === 'nota') {
            reply = `📝 *Nota registrata*\n${aiResult.problema || text}`;
            if (aiResult.cliente) reply += `\nCliente: ${aiResult.cliente}`;
            break;
          }

          // Create action directly based on AI analysis
          const now = new Date().toISOString();
          let payload = {}, actionReply = '';

          const tid = env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045';
          if (aiResult.tipo === 'urgenza') {
            payload = {
              id: 'URG_TG_' + Date.now(),
              tenant_id: tid,
              problema: aiResult.problema,
              cliente_id: aiResult.codice_m3 || null,
              macchina_id: aiResult.robot_id ? `${aiResult.macchina || 'ROBOT'}_${aiResult.robot_id}` : null,
              priorita_id: null,
              stato: 'aperta',
              data_segnalazione: now,
              tecnico_assegnato: null,
              note: `[Telegram ${utente?.nome || ''}] ${aiResult.macchina || ''} ${aiResult.robot_id || ''} - Priorità: ${aiResult.priorita}${mediaUrl ? ' - Allegato: ' + mediaUrl : ''}`
            };
            try {
              await sb(env, 'urgenze', 'POST', payload);
              actionReply = `🚨 *URGENZA CREATA*\nID: \`${payload.id}\`\nCliente: ${aiResult.cliente || '?'}\nProblema: ${aiResult.problema}\nMacchina: ${aiResult.macchina || '?'} ${aiResult.robot_id || ''}\nPriorità: ${aiResult.priorita}${mediaUrl ? '\n📎 Allegato salvato' : ''}`;
              // Aggiungi info ricambi se AI ha identificato componenti dalla foto
              if (aiResult.componente_identificato) actionReply += `\n\n🔍 *Componente identificato:* ${aiResult.componente_identificato}`;
              if (aiResult.danno_visibile) actionReply += `\n⚠️ *Danno:* ${aiResult.danno_visibile}`;
              if (aiResult.ricambi?.length) {
                actionReply += '\n\n🔧 *Ricambi suggeriti:*';
                for (const r of aiResult.ricambi) {
                  actionReply += `\n• \`${r.codice}\` — ${r.descrizione || '?'} (x${r.quantita || 1})${r._verificato ? ' ✅' : ' ⚠️ _da verificare_'}`;
                }
              }
              await sendTelegramNotification(env, 'nuova_urgenza', payload);
              // Smart dispatch: trova tecnici con slot varie oggi
              try {
                const itFmt2 = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
                const oggiSD = itFmt2.format(new Date());
                const pianoSD = await sb(env, 'piano', 'GET', null,
                  `?data=eq.${oggiSD}&stato=eq.pianificato&obsoleto=eq.false&select=tecnico_id,note,tipo_intervento_id`
                ).catch(() => []);
                const dispSD = pianoSD.filter(p => {
                  const n = ((p.note || '') + ' ' + (p.tipo_intervento_id || '')).toLowerCase();
                  return n.includes('varie') || n.includes('disponibil') || n.includes('urgenz') || n.includes('backup');
                });
                if (dispSD.length) {
                  const tecIdsSD = [...new Set(dispSD.map(d => d.tecnico_id).filter(Boolean))];
                  const tecSD = tecIdsSD.length ? await sb(env, 'utenti', 'GET', null, `?id=in.(${tecIdsSD.join(',')})&select=id,nome,cognome`).catch(() => []) : [];
                  if (tecSD.length) {
                    actionReply += '\n\n💡 *Tecnici disponibili oggi:*';
                    for (const t of tecSD) actionReply += `\n• ${t.nome} ${t.cognome || ''}`;
                    actionReply += `\n\nUsa \`/assegna ${payload.id} [nome]\``;
                  }
                }
              } catch { /* ignore smart dispatch errors */ }
            } catch(e) { actionReply = '❌ Errore creazione urgenza: ' + e.message; }
          } else if (aiResult.tipo === 'ordine') {
            const ricambiDesc = (aiResult.ricambi || []).map(r => `${r.codice} x${r.quantita}`).join(', ') || aiResult.problema;
            payload = {
              id: 'ORD_TG_' + Date.now(),
              tenant_id: tid,
              tecnico_id: utente?.id || null,
              cliente_id: aiResult.codice_m3 || null,
              descrizione: ricambiDesc,
              stato: 'richiesto',
              data_richiesta: now,
              note: `[Telegram ${utente?.nome || ''}] ${aiResult.cliente || ''}${mediaUrl ? ' - Allegato: ' + mediaUrl : ''}`
            };
            try {
              await sb(env, 'ordini', 'POST', payload);
              actionReply = `📦 *ORDINE CREATO*\nID: \`${payload.id}\`\nCliente: ${aiResult.cliente || '?'}\nRicambi: ${ricambiDesc}${mediaUrl ? '\n📎 Allegato salvato' : ''}`;
            } catch(e) { actionReply = '❌ Errore creazione ordine: ' + e.message; }
          } else if (aiResult.tipo === 'intervento') {
            payload = {
              id: 'INT_TG_' + Date.now(),
              tenant_id: tid,
              cliente_id: aiResult.codice_m3 || null,
              tecnico_id: utente?.id || null,
              stato: 'pianificato',
              data: now.split('T')[0],
              note: `[Telegram ${utente?.nome || ''}] ${aiResult.problema}${mediaUrl ? ' - Allegato: ' + mediaUrl : ''}`,
              obsoleto: false
            };
            try {
              await sb(env, 'piano', 'POST', payload);
              actionReply = `📅 *INTERVENTO PIANIFICATO*\nID: \`${payload.id}\`\nCliente: ${aiResult.cliente || '?'}\nDescrizione: ${aiResult.problema}${mediaUrl ? '\n📎 Allegato salvato' : ''}`;
              await sendTelegramNotification(env, 'nuovo_intervento', payload);
            } catch(e) { actionReply = '❌ Errore creazione intervento: ' + e.message; }
          }

          if (actionReply) {
            reply = actionReply;
            if (aiResult.note) reply += `\n\n💡 _${aiResult.note}_`;
          }
        }
      }

      if (reply) {
        try { await sendTelegram(env, chatId, reply); } catch(e) { console.error('TG send error:', e.message); }
      }

      // ---- SMART MIRROR: Auto-routing verso canali tematici ----
      if (reply) {
        try {
          // Determina canale basato su AI result o keyword analysis
          const msgLower = (text || '').toLowerCase();
          const cmdUsed = cmd || '';
          let botCanale = 'CH_GENERALE';

          // Auto-routing intelligente: comando → canale
          const routingMap = {
            urgenza: 'CH_URGENZE',
            ordine: 'CH_ORDINI',
            intervento: 'CH_OPERATIVO',
            nota: 'CH_GENERALE'
          };

          // 1. Se abbiamo un aiResult con tipo, usa quello
          if (typeof aiResult !== 'undefined' && aiResult?.tipo) {
            botCanale = routingMap[aiResult.tipo] || 'CH_GENERALE';
          }
          // 2. Altrimenti routing per comando
          else if (['/ordine', '/servepezz', '/catalogo'].includes(cmdUsed)) botCanale = 'CH_ORDINI';
          else if (['/pianifica', '/oggi', '/settimana', '/disponibile', '/report'].includes(cmdUsed)) botCanale = 'CH_OPERATIVO';
          else if (['/vado', '/incorso', '/risolto', '/stato', '/assegna'].includes(cmdUsed)) botCanale = 'CH_URGENZE';
          else if (['/tagliando'].includes(cmdUsed)) botCanale = 'CH_OPERATIVO';
          // 3. Fallback keyword
          else {
            const urgKwBot = ['urgenza', 'fermo', 'guasto', 'errore', 'rotto', 'emergenza', 'allarme'];
            const ordKwBot = ['ordine', 'ricambio', 'pezzo', 'servono', 'ordinare'];
            const insKwBot = ['installazione', 'installare', 'montaggio', 'commissioning'];
            if (urgKwBot.some(k => msgLower.includes(k))) botCanale = 'CH_URGENZE';
            else if (ordKwBot.some(k => msgLower.includes(k))) botCanale = 'CH_ORDINI';
            else if (insKwBot.some(k => msgLower.includes(k))) botCanale = 'CH_INSTALLAZIONI';
          }

          const cleanReply = reply.replace(/\*/g, '').replace(/_/g, '');
          const ts = new Date(Date.now() + 1000).toISOString();
          const tecLabel = utente ? `${utente.nome || ''} ${(utente.cognome || '').charAt(0)}.` : 'TG';

          // Mirror messaggio originale utente nel canale tematico
          const userMsgId = 'TG_USR_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          if (text && text.length > 2) {
            await sb(env, 'chat_messaggi', 'POST', {
              id: userMsgId, canale_id: botCanale, mittente_id: utente?.id || 'TELEGRAM',
              testo: `📱 [${tecLabel}] ${text.substring(0, 500)}${mediaUrl ? ' 📎' : ''}`, tipo: mediaType || 'testo', created_at: new Date().toISOString()
            }).catch(() => {});
          }

          // Mirror risposta bot nel canale tematico
          const botMsgId = 'TG_BOT_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          await sb(env, 'chat_messaggi', 'POST', {
            id: botMsgId, canale_id: botCanale, mittente_id: 'TELEGRAM',
            testo: `🤖 [Bot] ${cleanReply}`, tipo: 'testo', created_at: ts
          }).catch(() => {});
          // Mirror ANCHE in CH_ADMIN per visibilità completa
          if (botCanale !== 'CH_ADMIN') {
            const botMsgId2 = 'TG_BOT_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
            await sb(env, 'chat_messaggi', 'POST', {
              id: botMsgId2, canale_id: 'CH_ADMIN', mittente_id: 'TELEGRAM',
              testo: `🤖 [Bot→TG] ${cleanReply}`, tipo: 'testo', created_at: ts
            }).catch(() => {});
          }
        } catch(e) { console.error('Bot mirror error:', e.message); }
      }

      return ok();
      } catch (tgErr) {
        console.error('Telegram handler error:', tgErr.message, tgErr.stack);
        try {
          const errChatId = body?.message?.chat?.id;
          if (errChatId) await sendTelegram(env, errChatId, `⚠️ Errore bot: ${tgErr.message}`);
        } catch(e2) {}
        return ok();
      }
    }

    // -------- CHAT INTERNA --------

    case 'getChatCanali': {
      const userId = body.userId || body.user_id || '';
      // Canali di cui l'utente è membro + canali pubblici
      const canali = await sb(env, 'chat_canali', 'GET', null, '?attivo=eq.true&order=nome');
      const membri = userId ? await sb(env, 'chat_membri', 'GET', null, `?utente_id=eq.${userId}&select=canale_id,ultimo_letto`) : [];
      const membroMap = {};
      (membri || []).forEach(m => { membroMap[m.canale_id] = m; });
      // Per ogni canale, conta messaggi non letti
      const result = [];
      for (const c of (canali || [])) {
        const ultimoLetto = membroMap[c.id]?.ultimo_letto || '1970-01-01';
        const nonLetti = await sb(env, 'chat_messaggi', 'GET', null,
          `?canale_id=eq.${c.id}&created_at=gt.${ultimoLetto}&eliminato=eq.false&select=id`).catch(() => []);
        result.push({ ...pascalizeRecord(c), nonLetti: (nonLetti || []).length, isMembro: !!membroMap[c.id] });
      }
      return ok({ canali: result });
    }

    case 'getChatMessaggi': {
      const { canale_id, limit: lim } = body;
      if (!canale_id) return err('canale_id richiesto');
      const messaggi = await sb(env, 'chat_messaggi', 'GET', null,
        `?canale_id=eq.${canale_id}&eliminato=eq.false&order=created_at.desc&limit=${lim || 50}`);
      // Segna come letto
      const userId = body.userId || body.user_id;
      if (userId) {
        await sb(env, 'chat_membri', 'POST', { id: `${canale_id}_${userId}`, canale_id, utente_id: userId, ultimo_letto: new Date().toISOString() })
          .catch(() => sb(env, `chat_membri?canale_id=eq.${canale_id}&utente_id=eq.${userId}`, 'PATCH', { ultimo_letto: new Date().toISOString() }));
      }
      return ok({ messaggi: (messaggi || []).reverse().map(pascalizeRecord) });
    }

    case 'sendChatMessage': {
      const { canale_id, testo, tipo, rispondi_a } = body;
      const mittente = body.userId || body.user_id || body.mittente_id;
      if (!canale_id || !testo) return err('canale_id e testo richiesti');
      const id = 'MSG_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const msg = { id, canale_id, mittente_id: mittente, testo, tipo: tipo || 'testo', rispondi_a: rispondi_a || null, created_at: new Date().toISOString() };
      const result = await sb(env, 'chat_messaggi', 'POST', msg);

      // ---- BOT COMMANDS in-app: se il messaggio inizia con / processalo come comando ----
      if (testo.startsWith('/')) {
        try {
          const parts = testo.split(' ');
          const cmd = parts[0].toLowerCase();
          let botReply = '';
          const oggiStr = new Date().toISOString().split('T')[0];

          switch (cmd) {
            case '/stato': {
              const urg = await sb(env, 'urgenze', 'GET', null, '?stato=in.(aperta,assegnata,in_corso)&order=data_segnalazione.desc&limit=10').catch(()=>[]);
              botReply = urg.length ? `🚨 ${urg.length} urgenze attive:\n` + urg.map(u => `• ${u.id}: ${u.problema} [${u.stato}]`).join('\n') : '✅ Nessuna urgenza attiva';
              break;
            }
            case '/oggi': {
              const intv = await sb(env, 'piano', 'GET', null, `?data=eq.${oggiStr}&tecnico_id=eq.${mittente}&obsoleto=eq.false`).catch(()=>[]);
              botReply = intv.length ? `📅 Interventi oggi (${intv.length}):\n` + intv.map(i => `• ${i.id}: ${i.stato} – ${i.cliente_id}`).join('\n') : '📅 Nessun intervento oggi';
              break;
            }
            case '/settimana': {
              const d2 = new Date(); const lun = new Date(d2); lun.setDate(d2.getDate() - d2.getDay() + 1);
              const dom = new Date(lun); dom.setDate(lun.getDate() + 6);
              const intv = await sb(env, 'piano', 'GET', null, `?data=gte.${lun.toISOString().split('T')[0]}&data=lte.${dom.toISOString().split('T')[0]}&tecnico_id=eq.${mittente}&obsoleto=eq.false&order=data.asc`).catch(()=>[]);
              botReply = intv.length ? `📅 Piano settimanale (${intv.length}):\n` + intv.map(i => `• ${i.data} ${i.stato} – ${i.cliente_id}`).join('\n') : '📅 Nessun intervento questa settimana';
              break;
            }
            case '/vado': {
              const urgList = await sb(env, 'urgenze', 'GET', null, '?stato=eq.aperta&order=priorita.asc,data_segnalazione.asc&limit=5').catch(()=>[]);
              if (!urgList.length) { botReply = '✅ Nessuna urgenza da prendere'; break; }
              const scelta = parseInt(parts[1]);
              if (!scelta || scelta < 1 || scelta > urgList.length) {
                botReply = `🚨 Urgenze aperte (${urgList.length}):\n` + urgList.map((u, i) => `${i + 1}. ${u.problema || 'N/D'} – P${u.priorita || '?'} (${u.data_segnalazione?.split('T')[0] || '?'})`).join('\n') + `\n\n👉 Scrivi /vado N per prendere (es: /vado 1)`;
                break;
              }
              const picked = urgList[scelta - 1];
              await sb(env, `urgenze?id=eq.${picked.id}`, 'PATCH', { stato: 'assegnata', tecnico_assegnato: mittente, data_assegnazione: new Date().toISOString() });
              botReply = `✅ Urgenza ${picked.id} assegnata a te!\n${picked.problema}`;
              break;
            }
            case '/incorso': {
              const urg = await sb(env, 'urgenze', 'GET', null, `?tecnico_assegnato=eq.${mittente}&stato=eq.assegnata&limit=1`).catch(()=>[]);
              if (!urg.length) { botReply = 'Nessuna urgenza assegnata'; break; }
              await sb(env, `urgenze?id=eq.${urg[0].id}`, 'PATCH', { stato: 'in_corso', data_inizio: new Date().toISOString() });
              botReply = `🔧 Urgenza ${urg[0].id} IN CORSO`;
              break;
            }
            case '/risolto': {
              const note = parts.slice(1).join(' ');
              const urg = await sb(env, 'urgenze', 'GET', null, `?tecnico_assegnato=eq.${mittente}&stato=in.(assegnata,in_corso)&limit=1`).catch(()=>[]);
              if (!urg.length) { botReply = 'Nessuna urgenza in corso'; break; }
              await sb(env, `urgenze?id=eq.${urg[0].id}`, 'PATCH', { stato: 'risolta', data_risoluzione: new Date().toISOString(), note });
              botReply = `✅ Urgenza ${urg[0].id} RISOLTA${note ? '\nNote: ' + note : ''}`;
              break;
            }
            case '/ordine': {
              const codice = parts[1] || '';
              const qt = parseInt(parts[2]) || 1;
              const cliente = parts.slice(3).join(' ') || '';
              if (!codice) { botReply = '📦 Formato: /ordine [codice] [quantità] [cliente]'; break; }
              const ordId = 'ORD_APP_' + Date.now();
              const ordTid = env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045';
              await sb(env, 'ordini', 'POST', { id: ordId, tenant_id: ordTid, tecnico_id: mittente, codice, descrizione: `${codice} x${qt}${cliente ? ' - ' + cliente : ''}`, quantita: qt, stato: 'richiesto', data_richiesta: new Date().toISOString() });
              botReply = `📦 Ordine ${ordId} creato: ${codice} x${qt}${cliente ? ' – ' + cliente : ''}`;
              break;
            }
            default:
              botReply = '❓ Comando non riconosciuto. Usa /stato, /oggi, /settimana, /vado, /incorso, /risolto, /ordine';
          }

          if (botReply) {
            const botMsgId = 'MSG_BOT_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
            await sb(env, 'chat_messaggi', 'POST', {
              id: botMsgId, canale_id, mittente_id: 'TELEGRAM',
              testo: `🤖 ${botReply}`, tipo: 'testo', created_at: new Date(Date.now() + 500).toISOString()
            }).catch(() => {});
          }
        } catch(cmdErr) { console.error('Chat bot cmd error:', cmdErr.message); }
      }
      // Auto-join se non è membro
      if (mittente) {
        await sb(env, 'chat_membri', 'POST', { id: `${canale_id}_${mittente}`, canale_id, utente_id: mittente, ultimo_letto: new Date().toISOString() }).catch(() => {});
      }
      // MIRROR → Telegram: invia il messaggio anche al gruppo Telegram
      try {
        const cfgRows = await sb(env, 'config', 'GET', null, '?chiave=in.(telegram_bot_token,telegram_group_generale)&select=chiave,valore');
        const cfg = {};
        (cfgRows || []).forEach(c => { cfg[c.chiave] = c.valore; });
        const tgToken = cfg.telegram_bot_token || env.TELEGRAM_BOT_TOKEN;
        const tgGroup = cfg.telegram_group_generale;
        if (tgToken && tgGroup) {
          // Trova nome mittente
          let senderName = 'Admin';
          if (mittente) {
            const users = await sb(env, 'utenti', 'GET', null, `?id=eq.${mittente}&select=nome,cognome`).catch(() => []);
            if (users?.[0]) senderName = (users[0].nome || '') + ' ' + (users[0].cognome || '');
          }
          // Trova nome canale
          const canaleInfo = await sb(env, 'chat_canali', 'GET', null, `?id=eq.${canale_id}&select=nome,icona`).catch(() => []);
          const canaleNome = canaleInfo?.[0]?.nome || canale_id;
          const canaleIcona = canaleInfo?.[0]?.icona || '💬';
          const escapedTesto = (testo || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const tgText = `${canaleIcona} <b>[${canaleNome}]</b>\n👤 <b>${senderName}</b>:\n${escapedTesto}`;
          await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: tgGroup, text: tgText, parse_mode: 'HTML' })
          }).catch(() => {});
        }
      } catch(tgErr) { console.error('Telegram mirror error:', tgErr); }
      return ok({ messaggio: pascalizeRecord(result[0]) });
    }

    case 'createChatCanale': {
      const { nome, tipo, descrizione, icona, solo_admin, membri_ids } = body;
      if (!nome) return err('nome richiesto');
      const id = 'CH_' + Date.now();
      const canale = { id, nome, tipo: tipo || 'gruppo', descrizione: descrizione || null, icona: icona || '💬', solo_admin: solo_admin || false, creato_da: body.userId || null, created_at: new Date().toISOString() };
      // Cerca tenant_id
      const utenti = await sb(env, 'utenti', 'GET', null, '?select=tenant_id&limit=1');
      if (utenti?.[0]?.tenant_id) canale.tenant_id = utenti[0].tenant_id;
      const result = await sb(env, 'chat_canali', 'POST', canale);
      // Aggiungi membri iniziali
      if (membri_ids && Array.isArray(membri_ids)) {
        for (const uid of membri_ids) {
          await sb(env, 'chat_membri', 'POST', { id: `${id}_${uid}`, canale_id: id, utente_id: uid, ruolo: uid === body.userId ? 'admin' : 'membro' }).catch(() => {});
        }
      }
      return ok({ canale: pascalizeRecord(result[0]) });
    }

    case 'joinChatCanale': {
      const { canale_id } = body;
      const userId = body.userId || body.user_id;
      if (!canale_id || !userId) return err('canale_id e userId richiesti');
      await sb(env, 'chat_membri', 'POST', { id: `${canale_id}_${userId}`, canale_id, utente_id: userId }).catch(() => {});
      return ok();
    }

    case 'editChatMessage': {
      const { id, testo } = body;
      const userId = body.userId || body.user_id;
      if (!id || !testo) return err('id e testo richiesti');
      // Verifica ownership: solo il mittente può modificare
      const msg = await sb(env, 'chat_messaggi', 'GET', null, `?id=eq.${id}&select=mittente_id,eliminato`).catch(()=>[]);
      if (!msg?.[0]) return err('Messaggio non trovato');
      if (msg[0].eliminato) return err('Messaggio già eliminato');
      if (msg[0].mittente_id !== userId) return err('Solo il mittente può modificare il messaggio');
      await sb(env, `chat_messaggi?id=eq.${id}`, 'PATCH', { testo, modificato: true, updated_at: new Date().toISOString() });
      return ok();
    }

    case 'deleteChatMessage': {
      const { id } = body;
      const userId = body.userId || body.user_id;
      if (!id) return err('id messaggio richiesto');
      // Verifica ownership: mittente o admin
      const msg = await sb(env, 'chat_messaggi', 'GET', null, `?id=eq.${id}&select=mittente_id`).catch(()=>[]);
      if (!msg?.[0]) return err('Messaggio non trovato');
      const isOwner = msg[0].mittente_id === userId;
      const isAdmin = userId ? (await sb(env, 'utenti', 'GET', null, `?id=eq.${userId}&select=ruolo`).catch(()=>[]))?.[0]?.ruolo === 'admin' : false;
      if (!isOwner && !isAdmin) return err('Solo il mittente o admin può eliminare il messaggio');
      await sb(env, `chat_messaggi?id=eq.${id}`, 'PATCH', { eliminato: true, updated_at: new Date().toISOString() });
      return ok();
    }

    // ============ SYNC CLIENTI DA ANAGRAFICA ============

    case 'migrateDB': {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const results = [];
      // Add note_ai column to urgenze
      try {
        await sb(env, 'urgenze?select=note_ai&limit=1', 'GET');
        results.push('note_ai: già esistente');
      } catch(e) {
        // Column doesn't exist — add it via a dummy PATCH that will fail,
        // then use raw SQL approach via Supabase REST
        // Actually, we can't do ALTER TABLE via REST API.
        // Instead, create a Supabase RPC function or use another approach.
        results.push('note_ai: colonna mancante — eseguire: ALTER TABLE urgenze ADD COLUMN note_ai TEXT DEFAULT NULL;');
      }
      try {
        await sb(env, 'urgenze?select=ai_confidence&limit=1', 'GET');
        results.push('ai_confidence: già esistente');
      } catch(e) {
        results.push('ai_confidence: colonna mancante — eseguire: ALTER TABLE urgenze ADD COLUMN ai_confidence FLOAT DEFAULT NULL;');
      }
      return ok({ migrations: results, note: 'Se colonne mancanti, eseguire SQL su Supabase Dashboard > SQL Editor' });
    }

    case 'syncClientiFromAnagrafica': {
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      // Leggi anagrafica con lat/lng/citta
      const anagAll = await sb(env, 'anagrafica_clienti', 'GET', null, '?select=codice_m3,nome_interno,lat,lng,citta_fatturazione,via_fatturazione&limit=500');
      const clientiAll = await sb(env, 'clienti', 'GET', null, '?select=id,nome&obsoleto=eq.false&limit=500');
      // Build lookup
      const anagByM3 = {};
      const anagByName = {};
      for (const a of anagAll) {
        if (a.codice_m3) anagByM3[String(a.codice_m3).replace(/^0+/,'')] = a;
        if (a.nome_interno) anagByName[a.nome_interno.toUpperCase()] = a;
      }
      let updated = 0;
      for (const cli of clientiAll) {
        const cid = String(cli.id).replace(/^0+/,'');
        const match = anagByM3[cid] || anagByName[(cli.nome||'').toUpperCase()];
        if (!match) continue;
        const updates = {};
        if (match.lat != null) updates.latitudine = match.lat;
        if (match.lng != null) updates.longitudine = match.lng;
        if (match.citta_fatturazione) updates.citta = match.citta_fatturazione;
        if (match.via_fatturazione) updates.indirizzo = match.via_fatturazione;
        if (Object.keys(updates).length) {
          await sb(env, `clienti?id=eq.${cli.id}`, 'PATCH', updates);
          updated++;
        }
      }
      await wlog('clienti', 'SYNC', 'sync_from_anagrafica', body.operatoreId, `${updated} aggiornati`);
      return ok({ updated, total: clientiAll.length });
    }

    // ============ ANAGRAFICA (Clienti + Assets) ============

    case 'getAnagraficaClienti': {
      const search = sanitizePgFilter(body.search || '');
      let url = 'anagrafica_clienti?select=*&order=nome_account.asc&limit=500';
      if (search) url += `&or=(nome_account.ilike.*${search}*,nome_interno.ilike.*${search}*,codice_m3.ilike.*${search}*,citta_fatturazione.ilike.*${search}*)`;
      const data = await sb(env, url, 'GET');
      return ok(data.map(pascalizeRecord));
    }

    case 'getAnagraficaCliente': {
      const { id, codice_m3 } = body;
      let url = 'anagrafica_clienti?select=*';
      if (id) url += `&id=eq.${id}`;
      else if (codice_m3) url += `&codice_m3=eq.${codice_m3}`;
      else return err('id o codice_m3 richiesto');
      const data = await sb(env, url, 'GET');
      if (!data.length) return err('Cliente non trovato', 404);
      return ok(pascalizeRecord(data[0]));
    }

    case 'getAnagraficaAssets': {
      const { codice_m3, search, all } = body;
      let base = 'anagrafica_assets?select=*&order=gruppo_attrezzatura.asc,nome_asset.asc';
      if (codice_m3) base += `&codice_m3=eq.${codice_m3}`;
      const safeSearch = sanitizePgFilter(search || '');
      if (safeSearch) base += `&or=(nome_asset.ilike.*${safeSearch}*,numero_serie.ilike.*${safeSearch}*,modello.ilike.*${safeSearch}*,nome_account.ilike.*${safeSearch}*)`;
      if (!all) {
        const data = await sb(env, base + '&limit=1000', 'GET');
        return ok(data.map(pascalizeRecord));
      }
      // Paginate: Supabase PostgREST caps at 1000 rows per request
      let allData = [];
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const page = await sb(env, base, 'GET', null, '', { 'Range': `${offset}-${offset + pageSize - 1}`, 'Prefer': 'count=exact' });
        if (!Array.isArray(page) || page.length === 0) break;
        allData = allData.concat(page);
        if (page.length < pageSize) break;
        offset += pageSize;
      }
      return ok(allData.map(pascalizeRecord));
    }

    case 'importAnagraficaClienti': {
      const rows = body.rows || [];
      if (!rows.length) return err('rows richiesto (array)');
      if (rows.length > 2000) return err('Massimo 2000 righe per importazione anagrafica.');
      const results = { inserted: 0, errors: [] };
      for (const row of rows) {
        const fields = {};
        for (const [k, v] of Object.entries(row)) {
          if (v !== null && v !== undefined && v !== '') fields[toSnake(k)] = v;
        }
        try {
          await sb(env, 'anagrafica_clienti', 'POST', fields, null, { 'Prefer': 'return=minimal,resolution=merge-duplicates' });
          results.inserted++;
        } catch (e) {
          results.errors.push({ nome: fields.nome_account || '?', err: e.message });
        }
      }
      return ok(results);
    }

    case 'importAnagraficaAssets': {
      const rows = body.rows || [];
      if (!rows.length) return err('rows richiesto (array)');
      // Verify existing codice_m3
      const clienti = await sb(env, 'anagrafica_clienti?select=codice_m3', 'GET');
      const validM3 = new Set(clienti.filter(c => c.codice_m3).map(c => c.codice_m3));
      const results = { inserted: 0, skipped: 0, errors: [] };
      // Batch insert
      const batch = [];
      const allKeys = new Set();
      for (const row of rows) {
        const fields = {};
        for (const [k, v] of Object.entries(row)) {
          const sk = toSnake(k);
          fields[sk] = (v !== null && v !== undefined && v !== '') ? v : null;
          allKeys.add(sk);
        }
        if (fields.codice_m3 && !validM3.has(fields.codice_m3)) {
          fields.codice_m3 = null;
        }
        batch.push(fields);
      }
      // Ensure all objects have uniform keys (Supabase requires it)
      const keyList = [...allKeys];
      for (const row of batch) {
        for (const k of keyList) {
          if (!(k in row)) row[k] = null;
        }
      }
      // Insert in chunks of 100
      for (let i = 0; i < batch.length; i += 100) {
        const chunk = batch.slice(i, i + 100);
        try {
          await sb(env, 'anagrafica_assets', 'POST', chunk, null, { 'Prefer': 'return=minimal' });
          results.inserted += chunk.length;
        } catch (e) {
          // Fallback: one by one
          for (const row of chunk) {
            try {
              await sb(env, 'anagrafica_assets', 'POST', row, null, { 'Prefer': 'return=minimal' });
              results.inserted++;
            } catch (e2) {
              results.skipped++;
              results.errors.push({ serie: row.numero_serie || '?', err: e2.message });
            }
          }
        }
      }
      return ok(results);
    }

    case 'clearAnagrafica': {
      // SECURITY: Richiede admin + confirmToken per proteggere cancellazione massiva
      const uid = body.userId || body.operatoreId;
      if (!uid) return err('userId richiesto per clearAnagrafica');
      const caller = await sb(env, 'utenti', 'GET', null, `?id=eq.${uid}&select=ruolo`).catch(()=>[]);
      if (!caller?.[0] || caller[0].ruolo !== 'admin') return err('Solo admin può eseguire clearAnagrafica', 403);
      if (body.confirmToken !== 'CLEAR_CONFIRMED') return err('Conferma richiesta: invia confirmToken="CLEAR_CONFIRMED"');
      // Soft-delete con audit trail
      const now = new Date().toISOString();
      await sb(env, 'anagrafica_assets?obsoleto=eq.false', 'PATCH', { obsoleto: true, updated_at: now });
      await sb(env, 'anagrafica_clienti?obsoleto=eq.false', 'PATCH', { obsoleto: true, updated_at: now });
      await wlog('anagrafica', 'ALL', 'cleared_for_reimport', uid);
      return ok({ cleared: true, method: 'soft_delete' });
    }

    case 'searchParts': {
      // Ricerca catalogo parti Lely da tagliandi + anagrafica_assets
      const { search, modello, gruppo, limit: maxResults } = body;
      if (!search && !modello && !gruppo) return err('Almeno uno tra search, modello, gruppo richiesto');
      const lim = Math.min(parseInt(maxResults) || 20, 50);
      let filter = '?attivo=eq.true';
      const orConditions = [];
      if (search) {
        const s = sanitizePgFilter(search);
        if (s) orConditions.push(`nome.ilike.*${s}*`, `descrizione.ilike.*${s}*`, `codice.ilike.*${s}*`, `gruppo.ilike.*${s}*`);
      }
      if (orConditions.length) filter += `&or=(${orConditions.join(',')})`;
      const safeModello = sanitizePgFilter(modello || '');
      if (safeModello) filter += `&modello_macchina=ilike.*${safeModello}*`;
      const safeGruppo = sanitizePgFilter(gruppo || '');
      if (safeGruppo) filter += `&gruppo=ilike.*${safeGruppo}*`;
      filter += `&order=nome.asc&limit=${lim}`;
      const parts = await sb(env, 'tagliandi', 'GET', null, filter).catch(() => []);
      return ok(parts.map(pascalizeRecord));
    }

    case 'generatePMSchedule': {
      // Auto-scheduling PM basato su cicli manutenzione Lely
      // Cicli: A1=bimestrale(60gg), B2=trimestrale(90gg), C3=semestrale(180gg), D8=annuale(365gg)
      const adminErr = await requireAdmin(env, body);
      if (adminErr) return err(adminErr, 403);
      const { mese_target, ciclo, cliente_id, dry_run } = body;
      if (!mese_target) return err('mese_target richiesto (YYYY-MM)');

      const cicliGiorni = { A1: 60, B2: 90, C3: 180, D8: 365 };
      const cicliNomi = { A1: 'Bimestrale', B2: 'Trimestrale', C3: 'Semestrale', D8: 'Annuale' };

      // Carica macchine con prossimo_tagliando
      let macFilter = '?obsoleto=eq.false&prossimo_tagliando=not.is.null&select=id,nome,modello,tipo,cliente_id,prossimo_tagliando,ultimo_tagliando,ore_lavoro&order=prossimo_tagliando.asc&limit=500';
      if (cliente_id) macFilter += `&cliente_id=eq.${cliente_id}`;
      const macchine = await sb(env, 'macchine', 'GET', null, macFilter).catch(() => []);

      // Carica assets con prossimo_controllo
      let assFilter = '?prossimo_controllo=not.is.null&select=id,nome_asset,numero_serie,modello,gruppo_attrezzatura,codice_m3,nome_account,prossimo_controllo,ciclo_pm&order=prossimo_controllo.asc&limit=500';
      if (cliente_id) assFilter += `&codice_m3=eq.${cliente_id}`;
      const assets = await sb(env, 'anagrafica_assets', 'GET', null, assFilter).catch(() => []);

      const meseStart = mese_target + '-01';
      const meseEndDate = new Date(parseInt(mese_target.split('-')[0]), parseInt(mese_target.split('-')[1]), 0);
      const meseEnd = meseEndDate.toISOString().split('T')[0];

      // Filtra per mese target e ciclo
      const scheduled = [];
      const allItems = [
        ...macchine.map(m => ({
          id: m.id, nome: m.nome || m.id, modello: m.modello || m.tipo,
          cliente_id: m.cliente_id, prossimo: m.prossimo_tagliando,
          ciclo: null, source: 'macchine'
        })),
        ...assets.map(a => ({
          id: a.id, nome: a.nome_asset || a.numero_serie || a.id, modello: a.modello || a.gruppo_attrezzatura,
          cliente_id: a.codice_m3, prossimo: a.prossimo_controllo,
          ciclo: a.ciclo_pm || null, source: 'assets'
        }))
      ];

      for (const item of allItems) {
        if (!item.prossimo) continue;
        // Filtra per ciclo se specificato
        if (ciclo && item.ciclo && item.ciclo !== ciclo) continue;
        // Filtra per mese target
        if (item.prossimo < meseStart || item.prossimo > meseEnd) continue;
        scheduled.push({
          macchina_id: item.id,
          macchina_nome: item.nome,
          modello: item.modello,
          cliente_id: item.cliente_id,
          data_suggerita: item.prossimo,
          ciclo: item.ciclo || '?',
          ciclo_nome: cicliNomi[item.ciclo] || 'Service',
          source: item.source
        });
      }

      // Se non dry_run, crea gli interventi nel piano
      if (!dry_run && scheduled.length) {
        const tid = env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045';
        const now = new Date().toISOString();
        let created = 0, errors = [];
        for (const s of scheduled) {
          try {
            const intId = 'PM_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
            await sb(env, 'piano', 'POST', {
              id: intId, tenant_id: tid,
              cliente_id: s.cliente_id, macchina_id: s.macchina_id,
              data: s.data_suggerita, stato: 'pianificato',
              tipo_intervento_id: 'TAGLIANDO',
              note: `[PM Auto] ${s.ciclo_nome} — ${s.macchina_nome} (${s.modello || '?'})`,
              obsoleto: false, created_at: now
            });
            created++;
          } catch (e) { errors.push({ macchina: s.macchina_nome, err: e.message }); }
        }
        await wlog('pm_schedule', mese_target, 'generated', body.userId || 'admin', `${created} interventi creati`);
        return ok({ scheduled, created, errors, mese: mese_target });
      }

      return ok({ scheduled, count: scheduled.length, mese: mese_target, dry_run: true });
    }

    default:
      return err(`Azione POST non trovata: ${action}`, 404);
  }
}

// ============ UTILITIES ============

// ============ WEB PUSH (VAPID) ============

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createVapidJwt(env, audience) {
  // Create VAPID JWT token for Web Push authentication
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 86400,
    sub: env.VAPID_SUBJECT || 'mailto:admin@syntoniqa.app'
  };

  const headerB64 = arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const privateKeyBytes = urlBase64ToUint8Array(env.VAPID_PRIVATE_KEY);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  ).catch(() => {
    // Try JWK format if PKCS8 fails
    return crypto.subtle.importKey(
      'raw',
      privateKeyBytes,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  });

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  return `${unsignedToken}.${arrayBufferToBase64Url(signature)}`;
}

async function sendWebPush(env, subscription, payload) {
  const endpoint = new URL(subscription.endpoint);
  const audience = `${endpoint.protocol}//${endpoint.host}`;

  try {
    const jwt = await createVapidJwt(env, audience);
    const vapidPublicKey = env.VAPID_PUBLIC_KEY;

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
        'Urgency': 'high'
      },
      body: payload
    });
    return response;
  } catch (e) {
    return { ok: false, status: 0, statusText: e.message };
  }
}

// ============ EMAIL UTILITY ============
async function sendEmailAlert(env, to, subject, bodyHtml) {
  if (!env.RESEND_API_KEY || !to) return null;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Syntoniqa <noreply@syntoniqa.app>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html: `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:#050C14;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;text-align:center">
            <h2 style="margin:0;font-size:1.1rem">🔧 Syntoniqa FSM</h2>
          </div>
          <div style="background:#fff;padding:20px;border:1px solid #E5E7EB;border-radius:0 0 12px 12px">
            ${bodyHtml}
          </div>
          <p style="text-align:center;font-size:.75rem;color:#9CA3AF;margin-top:12px">MRS Lely Center Emilia Romagna</p>
        </div>`
      })
    });
    return await res.json();
  } catch(e) { console.error('Email error:', e.message); return null; }
}

// Send email to all admins
async function emailAdmins(env, subject, bodyHtml) {
  try {
    const admins = await sb(env, 'utenti', 'GET', null, '?ruolo=eq.admin&attivo=eq.true&select=email').catch(()=>[]);
    const emails = (admins||[]).map(a=>a.email).filter(Boolean);
    if (emails.length) await sendEmailAlert(env, emails, subject, bodyHtml);
  } catch(e){}
}

async function sendTelegram(env, chatId, text) {
  if (!chatId) return null;
  let token = env.TELEGRAM_BOT_TOKEN || '';
  if (!token) {
    try {
      const cfgRows = await sb(env, 'config', 'GET', null, '?chiave=eq.telegram_bot_token&select=valore');
      if (cfgRows && cfgRows[0]) token = cfgRows[0].valore || '';
    } catch(e) {}
  }
  if (!token) return null;
  // Auto-convert Markdown *bold* and `code` to HTML <b> and <code>
  let htmlText = text
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/_([^_\n]+)_/g, '<i>$1</i>');
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: htmlText, parse_mode: 'HTML' })
  }).then(r => r.json()).catch(() => null);
}

// Notifica privata Telegram al tecnico (se ha telegram_chat_id)
async function notifyTecnicoTG(env, tecnicoId, text) {
  if (!tecnicoId) return;
  try {
    const tec = await sb(env, 'utenti', 'GET', null, `?id=eq.${tecnicoId}&select=telegram_chat_id,nome,cognome`).catch(()=>[]);
    const chatId = tec?.[0]?.telegram_chat_id;
    if (chatId) {
      await sendTelegram(env, chatId, text);
    } else {
      console.log(`[TG-PRIV] Tecnico ${tecnicoId} (${tec?.[0]?.nome || '?'} ${tec?.[0]?.cognome || ''}) non ha telegram_chat_id — notifica non inviata`);
    }
  } catch(e) { console.error('[TG-PRIV]', e.message); }
}

async function sendTelegramNotification(env, event, data) {
  // Notifiche automatiche al gruppo generale
  const configRes = await sb(env, 'config', 'GET', null, '?chiave=in.(telegram_group_generale,telegram_bot_token)').catch(() => []);
  const cfg = Object.fromEntries(configRes.map(c => [c.chiave, c.valore]));
  const group = cfg.telegram_group_generale;
  if (group) {
    const messages = {
      nuova_urgenza:      `🚨 <b>NUOVA URGENZA</b>\nID: ${data.id}\nProblema: ${(data.problema||'').replace(/</g,'&lt;')}\nPriorità: ${data.priorita_id||'?'}`,
      nuovo_intervento:   `📅 <b>NUOVO INTERVENTO</b> ${data.id}\nData: ${data.data||'?'} | Tecnico: ${data.tecnico_id||'?'}`,
      urgenza_assegnata:  `✅ Urgenza <b>${data.id}</b> assegnata a ${data.tecnicoAssegnato||'?'}`,
      richiesta_risposta: `📋 Richiesta <b>${data.id}</b> → ${data.stato||'?'}`,
    };
    const msg = messages[event];
    if (msg) await sendTelegram(env, group, msg);
  }
  
  // FIX F-30: Invia anche push notification ai tecnici coinvolti
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    try {
      const pushMessages = {
        nuova_urgenza:      { title: '🚨 Nuova Urgenza', body: data.problema || 'Nuova urgenza ricevuta', tag: 'urgenza-' + data.id },
        nuovo_intervento:   { title: '📅 Nuovo Intervento', body: `Intervento ${data.id} pianificato`, tag: 'intervento-' + data.id },
        urgenza_assegnata:  { title: '✅ Urgenza Assegnata', body: `Urgenza ${data.id} assegnata a te`, tag: 'assegnazione-' + data.id },
        richiesta_risposta: { title: '📋 Risposta Richiesta', body: `Richiesta ${data.id}: ${data.stato}`, tag: 'richiesta-' + data.id },
      };
      const pushMsg = pushMessages[event];
      if (pushMsg) {
        // Determine target users
        let targetUsers = [];
        if (data.tecnico_id) targetUsers.push(data.tecnico_id);
        if (data.tecnico_assegnato) targetUsers.push(data.tecnico_assegnato);
        if (data.tecnicoAssegnato) targetUsers.push(data.tecnicoAssegnato);
        if (data.tecnici_ids) {
          try { targetUsers = targetUsers.concat(JSON.parse(data.tecnici_ids)); } catch {}
        }
        targetUsers = [...new Set(targetUsers.filter(Boolean))];
        
        if (targetUsers.length) {
          const subs = await sb(env, 'push_subscriptions', 'GET', null,
            `?user_id=in.(${targetUsers.join(',')})&active=eq.true`).catch(() => []);
          const payload = JSON.stringify({ ...pushMsg, url: './' });
          for (const sub of subs) {
            sendWebPush(env, { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload).catch(() => {});
          }
        }
      }
    } catch (e) { /* Push failure shouldn't block main flow */ }
  }
}

async function triggerKPISnapshot(env, interventoId, tecnicoId) {
  if (!tecnicoId) return;
  const oggi = new Date().toISOString().split('T')[0];
  const mese = oggi.slice(0, 7);
  const completati = await sb(env, 'piano', 'GET', null, `?tecnico_id=eq.${tecnicoId}&stato=in.(completato,chiuso)&data=gte.${mese}-01`);
  await sb(env, 'kpi_log', 'POST', {
    id: 'KPI_' + Date.now(),
    data: oggi, tecnico_id: tecnicoId,
    metrica: 'interventi_completati_mese', valore: completati.length, unita: 'n', periodo: mese
  }).catch(() => {});
}

// ============ CRON: Check interventi e manda notifiche ============
async function checkInterventoReminders(env) {
  const now = new Date();
  // Usa fuso orario italiano (CET/CEST)
  const itFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
  const itTimeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false });
  const oggi = itFormatter.format(now); // YYYY-MM-DD in Italian time
  const oraCorrente = itTimeFormatter.format(now); // HH:MM in Italian time

  // 1. Interventi PIANIFICATI oggi dove l'ora di inizio è passata da >1h → notifica "inizia intervento"
  const pianificati = await sb(env, 'piano', 'GET', null,
    `?data=eq.${oggi}&stato=eq.pianificato&obsoleto=eq.false&select=id,tecnico_id,cliente_id,ora_inizio,note`
  ).catch(() => []);

  for (const p of (pianificati || [])) {
    if (!p.ora_inizio || !p.tecnico_id) continue;
    // Calcola diff in minuti tra ora corrente italiana e ora inizio
    const [ih, im] = p.ora_inizio.substring(0,5).split(':').map(Number);
    const [ch, cm] = oraCorrente.split(':').map(Number);
    const diffMin = (ch * 60 + cm) - (ih * 60 + im);

    // Se tra 60 e 75 minuti di ritardo (per evitare notifiche ripetute ogni 15 min del cron)
    if (diffMin >= 60 && diffMin < 75) {
      const cliNome = await getEntityName(env, 'clienti', p.cliente_id);
      const notifId = 'NOT_REM1H_' + p.id + '_' + oggi;
      // Evita duplicati
      const existing = await sb(env, 'notifiche', 'GET', null, `?id=eq.${notifId}&select=id`).catch(() => []);
      if (existing?.length) continue;

      await sb(env, 'notifiche', 'POST', {
        id: notifId, tipo: 'reminder',
        oggetto: '⏰ Intervento non iniziato',
        testo: `L'intervento delle ${p.ora_inizio} presso ${cliNome} non è stato ancora avviato. È passata più di 1 ora dall'orario previsto. Aggiorna lo stato!`,
        destinatario_id: p.tecnico_id, stato: 'inviata', priorita: 'alta'
      }).catch(e => console.error('Notifica 1h error:', e.message));

      // Notifica anche su Telegram al tecnico
      const tec = await sb(env, 'utenti', 'GET', null, `?id=eq.${p.tecnico_id}&select=nome,cognome,telegram_chat_id`).catch(() => []);
      if (tec?.[0]?.telegram_chat_id) {
        await sendTelegram(env, tec[0].telegram_chat_id,
          `⏰ <b>Intervento non iniziato!</b>\n📋 ${cliNome} (ore ${p.ora_inizio})\nÈ passata 1 ora — aggiorna lo stato con /incorso o dall'app.`
        ).catch(() => {});
      }
      // Notifica anche su chat admin
      await sb(env, 'chat_messaggi', 'POST', {
        id: 'MSG_REM_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
        canale_id: 'CH_ADMIN', mittente_id: 'TELEGRAM',
        testo: `⏰ REMINDER: Intervento ${p.id} (${cliNome}, ore ${p.ora_inizio}) — il tecnico ${tec?.[0]?.nome || ''} ${tec?.[0]?.cognome || ''} non ha ancora iniziato. +1h di ritardo.`,
        tipo: 'testo', created_at: new Date().toISOString()
      }).catch(() => {});
    }
  }

  // 2. Interventi IN_CORSO da >8h → notifica "aggiorna stato/note"
  const inCorso = await sb(env, 'piano', 'GET', null,
    `?data=eq.${oggi}&stato=eq.in_corso&obsoleto=eq.false&select=id,tecnico_id,cliente_id,ora_inizio,note`
  ).catch(() => []);

  for (const p of (inCorso || [])) {
    if (!p.ora_inizio || !p.tecnico_id) continue;
    // Calcola diff in minuti tra ora corrente italiana e ora inizio
    const [ih, im] = p.ora_inizio.substring(0,5).split(':').map(Number);
    const [ch, cm] = oraCorrente.split(':').map(Number);
    const diffMin = (ch * 60 + cm) - (ih * 60 + im);

    // Se tra 480 e 495 minuti (8h-8h15)
    if (diffMin >= 480 && diffMin < 495) {
      const cliNome = await getEntityName(env, 'clienti', p.cliente_id);
      const notifId = 'NOT_REM8H_' + p.id + '_' + oggi;
      const existing = await sb(env, 'notifiche', 'GET', null, `?id=eq.${notifId}&select=id`).catch(() => []);
      if (existing?.length) continue;

      await sb(env, 'notifiche', 'POST', {
        id: notifId, tipo: 'reminder',
        oggetto: '🔔 Aggiorna intervento (8h)',
        testo: `L'intervento presso ${cliNome} è in corso da più di 8 ore (inizio: ${p.ora_inizio}). Aggiorna lo stato, le note o completa l'intervento.`,
        destinatario_id: p.tecnico_id, stato: 'inviata', priorita: 'media'
      }).catch(e => console.error('Notifica 8h error:', e.message));

      const tec = await sb(env, 'utenti', 'GET', null, `?id=eq.${p.tecnico_id}&select=nome,cognome,telegram_chat_id`).catch(() => []);
      if (tec?.[0]?.telegram_chat_id) {
        await sendTelegram(env, tec[0].telegram_chat_id,
          `🔔 <b>Aggiorna intervento!</b>\n📋 ${cliNome} — in corso da 8+ ore\nAggiorna le note o completa con /risolto`
        ).catch(() => {});
      }
    }
  }
  console.log(`[CRON] checkInterventoReminders: ${pianificati?.length || 0} pianificati, ${inCorso?.length || 0} in_corso checked`);
}

// ============ CRON: SLA MONITORING ============
async function checkSLAUrgenze(env) {
  try {
    const urgenze = await sb(env, 'urgenze', 'GET', null,
      '?stato=in.(aperta,assegnata,schedulata,in_corso)&sla_scadenza=not.is.null&obsoleto=eq.false&select=id,sla_scadenza,sla_status,tecnico_assegnato,cliente_id,problema'
    ).catch(() => []);
    const now = new Date();
    let updated = 0;
    for (const u of (urgenze || [])) {
      const scadenza = new Date(u.sla_scadenza);
      const diffOre = (scadenza - now) / 3600000;
      let newStatus = 'ok';
      if (diffOre < 0) newStatus = 'breach';
      else if (diffOre < 2) newStatus = 'critical';
      else if (diffOre < 6) newStatus = 'warning';
      if (newStatus !== u.sla_status) {
        await sb(env, `urgenze?id=eq.${u.id}`, 'PATCH', { sla_status: newStatus });
        updated++;
        // Notifica se breach o critical
        if ((newStatus === 'breach' || newStatus === 'critical') && u.sla_status !== 'breach') {
          const cliNome = await getEntityName(env, 'clienti', u.cliente_id);
          const emoji = newStatus === 'breach' ? '🔴' : '🟠';
          const label = newStatus === 'breach' ? 'SLA SCADUTO' : 'SLA CRITICO';
          // Notifica admin via chat
          await sb(env, 'chat_messaggi', 'POST', {
            id: 'MSG_SLA_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
            canale_id: 'CH_URGENZE', mittente_id: 'TELEGRAM',
            testo: `${emoji} ${label}: Urgenza ${u.id}\n🏢 ${cliNome}\n📝 ${(u.problema || '').substring(0, 60)}\n⏱️ Scadenza: ${u.sla_scadenza?.substring(0, 16)?.replace('T', ' ')}`,
            tipo: 'testo', created_at: new Date().toISOString()
          }).catch(() => {});
          // Email admin se breach
          if (newStatus === 'breach') {
            await emailAdmins(env, `🔴 SLA SCADUTO - Urgenza ${u.id}`,
              `<h3 style="color:#DC2626">${emoji} ${label}</h3>
              <p><strong>Urgenza:</strong> ${u.id}</p>
              <p><strong>Cliente:</strong> ${cliNome}</p>
              <p><strong>Problema:</strong> ${(u.problema || '').substring(0, 120)}</p>
              <p><strong>Scadenza SLA:</strong> ${u.sla_scadenza?.substring(0, 16)?.replace('T', ' ')}</p>
              <p><strong>Tecnico:</strong> ${u.tecnico_assegnato || 'Non assegnato'}</p>
              <p style="margin-top:16px"><a href="https://fieldforcemrser2026.github.io/syntoniqa/admin_v1.html" style="background:#DC2626;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Apri Admin Dashboard</a></p>`
            );
          }
          // Notifica tecnico assegnato
          if (u.tecnico_assegnato) {
            const notifId = 'NOT_SLA_' + u.id + '_' + newStatus + '_' + now.toISOString().split('T')[0];
            const existing = await sb(env, 'notifiche', 'GET', null, `?id=eq.${notifId}&select=id`).catch(() => []);
            if (!existing?.length) {
              await sb(env, 'notifiche', 'POST', {
                id: notifId, tipo: 'sla_alert', oggetto: `${emoji} ${label}`,
                testo: `Urgenza ${u.id} per ${cliNome}: ${label}! Intervieni subito.`,
                destinatario_id: u.tecnico_assegnato, stato: 'inviata', priorita: 'urgente',
                riferimento_id: u.id, riferimento_tipo: 'urgenza',
                tenant_id: env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045'
              }).catch(() => {});
            }
          }
        }
      }
    }
    console.log(`[CRON] checkSLAUrgenze: ${urgenze?.length || 0} urgenze checked, ${updated} updated`);

    // ESCALATION: urgenze assegnate ma non iniziate da >4 ore
    const urgAssegnate = await sb(env, 'urgenze', 'GET', null,
      '?stato=eq.assegnata&obsoleto=eq.false&select=id,data_assegnazione,tecnico_assegnato,problema,cliente_id'
    ).catch(() => []);
    for (const ua of (urgAssegnate || [])) {
      if (!ua.data_assegnazione) continue;
      const oreAssegnata = (now - new Date(ua.data_assegnazione)) / 3600000;
      if (oreAssegnata >= 4) {
        // Anti-duplicato: max 1 escalation al giorno per urgenza
        const escId = 'NOT_ESC_' + ua.id + '_' + now.toISOString().split('T')[0];
        const existing = await sb(env, 'notifiche', 'GET', null, `?id=eq.${escId}&select=id`).catch(() => []);
        if (!existing?.length) {
          const cliName = await getEntityName(env, 'clienti', ua.cliente_id).catch(()=>'');
          const tecName = ua.tecnico_assegnato ? await getEntityName(env, 'utenti', ua.tecnico_assegnato).catch(()=>'') : '—';
          // Notifica admin
          const admins = await sb(env, 'utenti', 'GET', null, '?ruolo=eq.admin&attivo=eq.true&select=id').catch(()=>[]);
          for (const a of (admins||[])) {
            await sb(env, 'notifiche', 'POST', {
              id: escId + '_' + a.id.slice(-3), tipo: 'escalation', oggetto: '⏰ ESCALATION: urgenza non iniziata',
              testo: `Urgenza ${ua.id} assegnata a ${tecName} da ${Math.floor(oreAssegnata)}h, non ancora iniziata! Cliente: ${cliName}`,
              destinatario_id: a.id, stato: 'inviata', priorita: 'urgente',
              riferimento_id: ua.id, riferimento_tipo: 'urgenza',
              tenant_id: env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045'
            }).catch(e=>console.error('[SYNC]',e.message));
          }
          // Sollecita il tecnico via Telegram privato
          await notifyTecnicoTG(env, ua.tecnico_assegnato,
            `⏰ <b>SOLLECITO URGENZA</b>\n📋 ${ua.id}: ${(ua.problema||'').substring(0,80)}\n🏢 ${cliName}\n\n⚠️ Assegnata da ${Math.floor(oreAssegnata)} ore, non ancora iniziata.\n<i>Apri l'app e premi ⚡ Inizia oppure ❌ Rifiuta</i>`
          );
          // Chat
          await sb(env, 'chat_messaggi', 'POST', {
            id: 'MSG_ESC_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
            canale_id: 'CH_URGENZE', mittente_id: 'SYSTEM',
            testo: `⏰ ESCALATION: Urgenza ${ua.id} assegnata a ${tecName} da ${Math.floor(oreAssegnata)}h, non iniziata!`,
            tipo: 'testo', created_at: new Date().toISOString()
          }).catch(e=>console.error('[SYNC]',e.message));
          console.log(`[CRON] Escalation for urgenza ${ua.id} (${Math.floor(oreAssegnata)}h)`);
        }
      }
    }
  } catch (e) { console.error('[CRON] checkSLAUrgenze error:', e.message); }
}

// Helper per nome entità
async function getEntityName(env, table, id) {
  if (!id) return '—';
  const rows = await sb(env, table, 'GET', null, `?id=eq.${id}&select=nome,ragione_sociale,cognome`).catch(() => []);
  if (!rows?.length) return id;
  const r = rows[0];
  return r.ragione_sociale || ((r.nome || '') + ' ' + (r.cognome || '')).trim() || id;
}
