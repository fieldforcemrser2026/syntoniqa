/**
 * Syntoniqa v2.0 — Cloudflare Worker
 * Zero-cost backend: CF Workers (free 100k req/day) + Supabase (free Postgres)
 * Sostituisce Google Apps Script (3531 righe → Worker modulare)
 * 
 * ENV VARS (Cloudflare Dashboard → Settings → Variables):
 *   SUPABASE_URL        = https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY= eyJ...  (service_role key)
 *   SQ_TOKEN            = MRS_Syntoniqa_2026_MBGOAT   (o custom per tenant)
 *   GEMINI_KEY          = AIza...
 *   TELEGRAM_BOT_TOKEN  = 123456:ABC...
 *   RESEND_API_KEY      = re_...  (email via Resend - free 3k/mese)
 */

// ============ HELPERS ============

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Token',
};

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
async function sb(env, table, method = 'GET', body = null, params = '') {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}${params}`;
  const res = await fetch(url, {
    method,
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table}: ${res.status} ${text}`);
  }
  const text = await res.text();
  if (!text) return null;
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

// ============ ROUTER ============

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action') || url.pathname.split('/').pop();

    // Telegram webhook bypassa il token check (usa secret_token separato)
    if (action === 'telegramWebhook') {
      const body = await request.json().catch(() => ({}));
      return await handlePost(action, body, env);
    }

    try {
      if (request.method === 'GET') {
        if (!checkToken(request, env)) return err('Token non valido', 401);
        return await handleGet(action, url, env);
      } else if (request.method === 'POST') {
        const rawBody = await request.json().catch(() => ({}));
        if (!checkToken(request, env, rawBody.token)) return err('Token non valido', 401);
        // FIX CRIT-04 (globale): Pre-process body per TUTTI gli handler
        // 1. Estrai dati dal wrapper {data:{...}} se presente
        // 2. Converti PascalCase → snake_case
        // 3. Rimuovi meta-fields (action, token, method) che inquinerebbero gli INSERT
        const body = normalizeBody(rawBody);
        return await handlePost(action, body, env);
      }
      return err('Metodo non supportato', 405);
    } catch (e) {
      console.error('Worker error:', e);
      return err(`Errore interno: ${e.message}`, 500);
    }
  }
};

// ============ GET HANDLERS ============

async function handleGet(action, url, env) {
  switch (action) {

    case 'getAll': {
      // Carica tutti i dati per dashboard/login (equivalente GAS getAll)
      const [
        utenti, clienti, macchine, piano, urgenze, ordini,
        reperibilita, trasferte, notifiche, richieste, installazioni,
        pagellini, automezzi, tipi_intervento, priorita, squadre,
        tagliandi, fasi_installazione, sla_config,
        checklist_template, documenti, config
      ] = await Promise.all([
        sb(env, 'utenti',             'GET', null, '?select=*&obsoleto=eq.false&order=cognome'),
        sb(env, 'clienti',            'GET', null, '?select=*&obsoleto=eq.false&order=nome'),
        sb(env, 'macchine',           'GET', null, '?select=*&obsoleto=eq.false'),
        sb(env, 'piano',              'GET', null, '?select=*&obsoleto=eq.false&order=data.desc&limit=500'),
        sb(env, 'urgenze',            'GET', null, '?select=*&obsoleto=eq.false&order=data_segnalazione.desc&limit=200'),
        sb(env, 'ordini',             'GET', null, '?select=*&obsoleto=eq.false&order=data_richiesta.desc&limit=300'),
        sb(env, 'reperibilita',       'GET', null, '?select=*&obsoleto=eq.false&order=data_inizio.desc&limit=200'),
        sb(env, 'trasferte',          'GET', null, '?select=*&obsoleto=eq.false&order=data_inizio.desc&limit=100'),
        sb(env, 'notifiche',          'GET', null, '?select=*&obsoleto=eq.false&order=data_invio.desc&limit=200'),
        sb(env, 'richieste',          'GET', null, '?select=*&obsoleto=eq.false&order=data_richiesta.desc'),
        sb(env, 'installazioni',      'GET', null, '?select=*&obsoleto=eq.false'),
        sb(env, 'pagellini',          'GET', null, '?select=*&obsoleto=eq.false&order=data_creazione.desc'),
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
        `?select=tecnico_id,stato,ore_lavorate,km_percorsi&data=gte.${mese}-01&data=lte.${mese}-31`);
      
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
      const [piano, urgenze, utenti, clienti, macchine, kpiLog] = await Promise.all([
        sb(env, 'piano',    'GET', null, '?select=*&obsoleto=eq.false&order=data.desc&limit=5000'),
        sb(env, 'urgenze',  'GET', null, '?select=*&obsoleto=eq.false&order=data_segnalazione.desc&limit=2000'),
        sb(env, 'utenti',   'GET', null, '?select=id,nome,cognome,ruolo,squadra_id&obsoleto=eq.false'),
        sb(env, 'clienti',  'GET', null, '?select=id,nome,citta,prov&obsoleto=eq.false'),
        sb(env, 'macchine', 'GET', null, '?select=id,cliente_id,tipo,modello&obsoleto=eq.false'),
        sb(env, 'kpi_log',  'GET', null, '?order=data.desc&limit=1000'),
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
  async function wlog(entityType, entityId, action, userId, note = '') {
    await sb(env, 'workflow_log', 'POST', {
      id: `WL_${Date.now()}`,
      entity_type: entityType, entity_id: entityId,
      action, user_id: userId, note,
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
      const { userId, newPassword } = body;
      const hashed = await hashPassword(newPassword);
      await sb(env, `utenti?id=eq.${userId}`, 'PATCH', { password_hash: hashed, updated_at: new Date().toISOString() });
      await wlog('utente', userId, 'reset_password', body.operatoreId || 'system');
      return ok();
    }

    // -------- PIANO (INTERVENTI) --------

    case 'createPiano': {
      const id = 'INT_' + Date.now();
      // FIX CRIT-04: Estrai e converti campi dal wrapper {data:{...PascalCase}}
      const fields = getFields(body);
      const row = { id, ...fields, stato: fields.stato || 'pianificato', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const result = await sb(env, 'piano', 'POST', row);
      await wlog('piano', id, 'created', body.operatoreId || body.userId);
      await sendTelegramNotification(env, 'nuovo_intervento', row);
      return ok({ intervento: pascalizeRecord(result[0]) });
    }

    case 'updatePiano': {
      const id = body.id;
      // FIX CRIT-04: Estrai e converti campi PascalCase → snake_case
      const updates = getFields(body);
      delete updates.id; // non aggiornare l'id
      updates.updated_at = new Date().toISOString();
      await sb(env, `piano?id=eq.${id}`, 'PATCH', updates);
      await wlog('piano', id, `updated_stato_${updates.stato || 'unknown'}`, body.operatoreId || body.userId);
      if (updates.stato === 'completato') {
        await triggerKPISnapshot(env, id, updates.tecnico_id);
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
      const row = { id, ...fields, stato: 'aperta', sla_scadenza: slaScadenza, sla_status: 'ok', data_segnalazione: new Date().toISOString() };
      const result = await sb(env, 'urgenze', 'POST', row);
      await wlog('urgenza', id, 'created', body.operatoreId || body.userId);
      await sendTelegramNotification(env, 'nuova_urgenza', row);
      return ok({ urgenza: pascalizeRecord(result[0]) });
    }

    case 'assignUrgenza': {
      const { id, tecnicoAssegnato, TecnicoID, tecniciIds, TecniciIDs, operatoreId, userId } = body;
      const tecId = tecnicoAssegnato || TecnicoID;
      const tecIds = tecniciIds || TecniciIDs;
      await sb(env, `urgenze?id=eq.${id}`, 'PATCH', {
        tecnico_assegnato: tecId,
        tecnici_ids: tecIds,
        stato: 'assegnata',
        data_assegnazione: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      await wlog('urgenza', id, 'assigned', operatoreId || userId, `a ${tecId}`);
      await sendTelegramNotification(env, 'urgenza_assegnata', { id, tecnicoAssegnato: tecId });
      return ok();
    }

    // FIX CRIT-05: Aggiunta azione updateUrgenza (mancava completamente)
    case 'updateUrgenza': {
      const id = body.id;
      const updates = getFields(body);
      delete updates.id;
      updates.updated_at = new Date().toISOString();
      await sb(env, `urgenze?id=eq.${id}`, 'PATCH', updates);
      await wlog('urgenza', id, 'updated', body.operatoreId || body.userId);
      return ok();
    }

    // -------- ORDINI --------

    case 'createOrdine': {
      const id = 'ORD_' + Date.now();
      // FIX CRIT-04: Estrai e converti campi
      const fields = getFields(body);
      // FIX CRIT-06 (B-008): Validazione quantità
      const qty = fields.quantita || fields.qty;
      if (qty !== undefined && qty !== null && (isNaN(qty) || Number(qty) <= 0)) {
        return err('Quantità non valida: deve essere un numero maggiore di 0');
      }
      const row = { id, ...fields, stato: 'richiesto', data_richiesta: new Date().toISOString() };
      const result = await sb(env, 'ordini', 'POST', row);
      await wlog('ordine', id, 'created', body.operatoreId || body.userId);
      return ok({ ordine: pascalizeRecord(result[0]) });
    }

    case 'updateOrdineStato': {
      const { id, stato, operatoreId, userId: _u2, ...rest } = body;
      await sb(env, `ordini?id=eq.${id}`, 'PATCH', { stato, ...rest, updated_at: new Date().toISOString() });
      await wlog('ordine', id, `stato_${stato}`, operatoreId);
      return ok();
    }

    // -------- UTENTI --------

    case 'createUtente': {
      const id = 'TEC_' + String(Date.now()).slice(-3);
      const hashed = await hashPassword(body.password || 'Syntoniqa2026!');
      const row = { id, ...getFields(body), password_hash: hashed, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      delete row.password;
      const result = await sb(env, 'utenti', 'POST', row);
      await wlog('utente', id, 'created', body.operatoreId);
      const { password_hash, ...safe } = result[0];
      return ok({ utente: safe });
    }

    case 'updateUtente': {
      const { id, password, userId: _u3, operatoreId: _op3, ...updates } = body;
      if (password) updates.password_hash = await hashPassword(password);
      updates.updated_at = new Date().toISOString();
      await sb(env, `utenti?id=eq.${id}`, 'PATCH', updates);
      await wlog('utente', id, 'updated', body.operatoreId);
      return ok();
    }

    // -------- CLIENTI --------

    case 'createCliente': {
      const id = 'CLI_' + Date.now();
      const row = { id, ...getFields(body), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const result = await sb(env, 'clienti', 'POST', row);
      return ok({ cliente: pascalizeRecord(result[0]) });
    }

    case 'updateCliente': {
      const { id, userId: _u, operatoreId: _op, ...updates } = body;
      updates.updated_at = new Date().toISOString();
      await sb(env, `clienti?id=eq.${id}`, 'PATCH', updates);
      return ok();
    }

    // -------- MACCHINE --------

    case 'createMacchina': {
      const id = 'MAC_' + Date.now();
      const result = await sb(env, 'macchine', 'POST', { id, ...getFields(body), created_at: new Date().toISOString() });
      return ok({ macchina: pascalizeRecord(result[0]) });
    }

    case 'updateMacchina': {
      const { id, userId: _u, operatoreId: _op, ...updates } = body;
      await sb(env, `macchine?id=eq.${id}`, 'PATCH', updates);
      return ok();
    }

    // -------- AUTOMEZZI --------

    case 'createAutomezzo': {
      const id = 'AUT_' + Date.now();
      const result = await sb(env, 'automezzi', 'POST', { id, ...getFields(body) });
      return ok({ automezzo: pascalizeRecord(result[0]) });
    }

    case 'updateAutomezzo': {
      const { id, userId: _u, operatoreId: _op, ...updates } = body;
      await sb(env, `automezzi?id=eq.${id}`, 'PATCH', updates);
      return ok();
    }

    // -------- INSTALLAZIONI --------

    case 'createInstallazione': {
      const id = 'INS_' + Date.now();
      const result = await sb(env, 'installazioni', 'POST', { id, ...getFields(body), stato: 'pianificata', created_at: new Date().toISOString() });
      return ok({ installazione: pascalizeRecord(result[0]) });
    }

    case 'updateInstallazione': {
      const { id, userId: _u, operatoreId: _op, ...updates } = body;
      updates.updated_at = new Date().toISOString();
      await sb(env, `installazioni?id=eq.${id}`, 'PATCH', updates);
      return ok();
    }

    // -------- REPERIBILITA --------

    case 'createReperibilita': {
      const id = 'REP_' + Date.now();
      const result = await sb(env, 'reperibilita', 'POST', { id, ...getFields(body), created_at: new Date().toISOString() });
      return ok({ reperibilita: pascalizeRecord(result[0]) });
    }

    // -------- TRASFERTE --------

    case 'createTrasferta': {
      const id = 'TRA_' + Date.now();
      const result = await sb(env, 'trasferte', 'POST', { id, ...getFields(body), created_at: new Date().toISOString() });
      return ok({ trasferta: pascalizeRecord(result[0]) });
    }

    // -------- NOTIFICHE --------

    case 'createNotifica': {
      const id = 'NOT_' + Date.now();
      const result = await sb(env, 'notifiche', 'POST', { id, ...getFields(body), data_invio: new Date().toISOString() });
      return ok({ notifica: pascalizeRecord(result[0]) });
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

    // -------- RICHIESTE --------

    case 'createRichiesta': {
      const id = 'RIC_' + Date.now();
      const result = await sb(env, 'richieste', 'POST', { id, ...getFields(body), stato: 'in_attesa', data_richiesta: new Date().toISOString() });
      return ok({ richiesta: pascalizeRecord(result[0]) });
    }

    case 'updateRichiesta': {
      const { id, userId: _u, operatoreId: _op, ...updates } = body;
      if (updates.stato !== 'in_attesa') updates.data_risposta = new Date().toISOString();
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
      // Upload a Supabase Storage
      const { fileName, base64Data, mimeType, riferimentoTipo, riferimentoId, uploaderId } = body;
      const bucket  = 'syntoniqa-allegati';
      const path    = `${riferimentoTipo}/${riferimentoId}/${Date.now()}_${fileName}`;
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
      if (!uploadRes.ok) throw new Error('Upload storage fallito');
      
      const fileUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
      const id = 'ALL_' + Date.now();
      await sb(env, 'allegati', 'POST', {
        id, nome: fileName, file_url: fileUrl, mime_type: mimeType,
        uploader_id: uploaderId, riferimento_tipo: riferimentoTipo, riferimento_id: riferimentoId,
        data_upload: new Date().toISOString()
      });
      return ok({ url: fileUrl, id });
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
      return handlePost('sendEmail', { to: body.email, subject: 'Test Syntoniqa', html: '<h1>Test OK</h1>' }, env);
    }

    case 'sendTelegramMsg': {
      const { chatId, text } = body;
      const res = await sendTelegram(env, chatId, text);
      return ok({ result: res });
    }

    case 'testTelegram': {
      const res = await sendTelegram(env, body.chatId, '🤖 Syntoniqa v2.0 – Telegram OK!');
      return ok({ result: res });
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
      // FIX CRIT-07 (B-009): Batch tecnici max 15 per chiamata Gemini
      const { urgenze, tecnici, data } = body;
      if (!env.GEMINI_KEY) return err('Gemini API key non configurata');
      
      const BATCH_SIZE = 15;
      const tecBatches = [];
      for (let i = 0; i < tecnici.length; i += BATCH_SIZE) {
        tecBatches.push(tecnici.slice(i, i + BATCH_SIZE));
      }
      
      let allPiano = [];
      let remainingUrgenze = [...urgenze];
      
      for (const tecBatch of tecBatches) {
        if (remainingUrgenze.length === 0) break;
        
        const prompt = `Sei un ottimizzatore di interventi tecnici per assistenza macchine agricole Lely.
Data: ${data}
Tecnici disponibili: ${JSON.stringify(tecBatch.map(t => ({ nome: (t.nome||t.Nome) + ' ' + (t.cognome||t.Cognome), base: t.base||t.Base, squadra: t.squadra_id||t.SquadraID })))}
Urgenze da assegnare: ${JSON.stringify(remainingUrgenze.map(u => ({ id: u.id||u.ID, cliente: u.cliente_id||u.ClienteID, problema: u.problema||u.Problema, priorita: u.priorita_id||u.PrioritaID, sla: u.sla_scadenza||u.SlaScadenza })))}

Genera un piano di interventi ottimizzato che:
1. Rispetti le priorità SLA
2. Minimizzi i km percorsi (raggruppa interventi vicini)
3. Bilanci il carico tra tecnici
4. Assegni prima le urgenze critiche

Rispondi SOLO con JSON array: [{ "urgenzaId": "...", "tecnicoId": "...", "data": "YYYY-MM-DD", "oraInizio": "HH:MM", "motivazione": "..." }]`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          }
        );
        const geminiData = await geminiRes.json();
        const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        const cleanText = rawText.replace(/```json\n?|\n?```/g, '').trim();
        try {
          const batchPiano = JSON.parse(cleanText);
          allPiano = allPiano.concat(batchPiano);
          const assignedIds = new Set(batchPiano.map(p => p.urgenzaId));
          remainingUrgenze = remainingUrgenze.filter(u => !assignedIds.has(u.id||u.ID));
        } catch (e) {
          await wlog('ai', 'generateAIPlan', 'parse_error', 'system', e.message);
        }
      }
      
      return ok({ piano: allPiano });
    }

    case 'applyAIPlan': {
      const { piano, operatoreId } = body;
      const created = [];
      for (const item of piano) {
        const id = 'INT_AI_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        await sb(env, 'piano', 'POST', {
          id, tecnico_id: item.tecnicoId, data: item.data, ora_inizio: item.oraInizio,
          urgenza_id: item.urgenzaId, stato: 'pianificato', origine: 'ai',
          created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        });
        if (item.urgenzaId) {
          await sb(env, `urgenze?id=eq.${item.urgenzaId}`, 'PATCH', {
            stato: 'assegnata', tecnico_assegnato: item.tecnicoId,
            data_assegnazione: new Date().toISOString()
          });
        }
        created.push(id);
        await wlog('piano', id, 'ai_created', operatoreId, item.motivazione);
      }
      return ok({ created, count: created.length });
    }

    case 'geocodeAll': {
      // FIX B-V2-5: Geocoding Nominatim con retry, backoff esponenziale, error log
      const batchSize = Math.min(parseInt(body?.limit) || 20, 50); // max 50
      const clientiSenzaGeo = await sb(env, 'clienti', 'GET', null,
        '?latitudine=is.null&obsoleto=eq.false&select=id,indirizzo,citta,prov,cap');

      // Legge config email per User-Agent (Nominatim ToS richiede contatto)
      const cfgArr = await sb(env, 'config', 'GET', null, '?tenant_id=eq.' + (env.TENANT_ID || 'default') + '&chiave=eq.email_mittente');
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
      const { tipo, dateFrom, dateTo, tecnicoId } = body;
      let filter = `?data=gte.${dateFrom}&data=lte.${dateTo}`;
      if (tecnicoId) filter += `&tecnico_id=eq.${tecnicoId}`;
      
      const [interventi, urgenze] = await Promise.all([
        sb(env, 'piano',   'GET', null, filter + '&obsoleto=eq.false'),
        sb(env, 'urgenze', 'GET', null, `?data_segnalazione=gte.${dateFrom}&obsoleto=eq.false`),
      ]);
      
      const report = {
        periodo: { from: dateFrom, to: dateTo },
        interventi: { totale: interventi.length, completati: interventi.filter(i => i.stato === 'completato' || i.stato === 'chiuso').length },
        urgenze:    { totale: urgenze.length,    risolte: urgenze.filter(u => u.stato === 'risolta').length },
        ore_totali: interventi.reduce((s, i) => s + parseFloat(i.ore_lavorate || 0), 0),
        km_totali:  interventi.reduce((s, i) => s + parseInt(i.km_percorsi || 0), 0),
      };
      return ok({ report });
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
      const { config } = body;
      for (const [chiave, valore] of Object.entries(config)) {
        await sb(env, 'config', 'POST', { chiave, valore }).catch(async () => {
          await sb(env, `config?chiave=eq.${chiave}`, 'PATCH', { valore });
        });
      }
      return ok();
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

    // -------- TELEGRAM BOT (webhook) --------

    case 'telegramWebhook': {
      // Gestisce i comandi Telegram in arrivo
      const update = body;
      if (!update.message) return ok();
      
      const chatId  = update.message.chat.id;
      const text    = update.message.text || '';
      const parts   = text.split(' ');
      const cmd     = parts[0].toLowerCase();
      
      // Trova utente dal chat_id
      const utenti  = await sb(env, 'utenti', 'GET', null, `?telegram_chat_id=eq.${chatId}&attivo=eq.true`);
      const utente  = utenti[0] || null;
      
      if (!utente && cmd !== '/start') {
        await sendTelegram(env, chatId, '❌ Non autorizzato. Registra il tuo Telegram ID nel profilo.');
        return ok();
      }

      let reply = '';
      
      switch (cmd) {
        case '/start':
          reply = `👋 Benvenuto in *Syntoniqa*!\nInvia /help per i comandi disponibili.`;
          break;
        case '/help':
          reply = `📋 *Comandi disponibili:*\n/stato - Urgenze aperte\n/oggi - Interventi di oggi\n/vado - Auto-assegna urgenza\n/risolto [note] - Chiudi urgenza\n/servepezz [desc] - Ordine ricambio\n/incorso - Urgenza in corso`;
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
        case '/vado': {
          const urg = await sb(env, 'urgenze', 'GET', null, '?stato=eq.aperta&order=data_segnalazione.asc&limit=1');
          if (!urg.length) { reply = '✅ Nessuna urgenza da prendere in carico'; break; }
          await sb(env, `urgenze?id=eq.${urg[0].id}`, 'PATCH', { stato: 'assegnata', tecnico_assegnato: utente.id, data_assegnazione: new Date().toISOString() });
          reply = `✅ Urgenza *${urg[0].id}* assegnata a te!\nProblema: ${urg[0].problema}`;
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
        case '/servepezz': {
          const desc = parts.slice(1).join(' ');
          if (!desc) { reply = 'Usa: /servepezz [descrizione ricambio]'; break; }
          const id = 'ORD_TG_' + Date.now();
          await sb(env, 'ordini', 'POST', { id, tecnico_id: utente.id, descrizione: desc, stato: 'richiesto', data_richiesta: new Date().toISOString() });
          reply = `📦 Ordine ricambio *${id}* creato:\n_${desc}_`;
          break;
        }
        default: {
          // Testo libero: Gemini riconosce cliente
          if (env.GEMINI_KEY && text.length > 3) {
            const clienti = await sb(env, 'clienti', 'GET', null, '?obsoleto=eq.false&select=id,nome,citta');
            const prompt = `Messaggio: "${text}"\nClienti: ${JSON.stringify(clienti.map(c => c.nome + ' (' + c.citta + ')'))}\nRispondi SOLO con JSON: {"clienteNome": "...", "problema": "..."}`;
            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_KEY}`,
              { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
            const gd = await geminiRes.json();
            const raw = gd.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/```json\n?|\n?```/g, '').trim();
            try {
              const parsed = JSON.parse(raw);
              reply = `🤖 Ho capito:\nCliente: *${parsed.clienteNome}*\nProblema: _${parsed.problema}_\n\nConfermi la creazione urgenza? Rispondi SI o NO`;
            } catch {
              reply = '🤔 Non ho capito. Prova /help';
            }
          }
          break;
        }
      }
      
      if (reply) await sendTelegram(env, chatId, reply);
      return ok();
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

async function sendTelegram(env, chatId, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return null;
  return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  }).then(r => r.json()).catch(() => null);
}

async function sendTelegramNotification(env, event, data) {
  // Notifiche automatiche al gruppo generale
  const configRes = await sb(env, 'config', 'GET', null, '?chiave=in.(telegram_group_generale,telegram_bot_token)').catch(() => []);
  const cfg = Object.fromEntries(configRes.map(c => [c.chiave, c.valore]));
  const group = cfg.telegram_group_generale;
  if (group) {
    const messages = {
      nuova_urgenza:      `🚨 *NUOVA URGENZA*\nID: ${data.id}\nProblema: ${data.problema}\nPriorità: ${data.priorita_id}`,
      nuovo_intervento:   `📅 *NUOVO INTERVENTO* ${data.id}\nData: ${data.data} | Tecnico: ${data.tecnico_id}`,
      urgenza_assegnata:  `✅ Urgenza *${data.id}* assegnata a ${data.tecnicoAssegnato}`,
      richiesta_risposta: `📋 Richiesta *${data.id}* → ${data.stato}`,
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
