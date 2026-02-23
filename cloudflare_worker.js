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
    if (v === null || v === undefined || v === '') continue; // skip empty/null fields
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
        // FIX: leggi action anche dal body POST (il frontend la manda lì)
        const postAction = action || rawBody.action || '';
        // FIX CRIT-04 (globale): Pre-process body per TUTTI gli handler
        // 1. Estrai dati dal wrapper {data:{...}} se presente
        // 2. Converti PascalCase → snake_case
        // 3. Rimuovi meta-fields (action, token, method) che inquinerebbero gli INSERT
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
    ctx.waitUntil(checkInterventoReminders(env));
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
        sb(env, 'macchine',           'GET', null, '?select=*&obsoleto=eq.false&limit=2000'),
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
          }).catch(()=>{});
        }
      } catch(e) {}
      return ok({ message: 'Richiesta inviata. L\'admin riceverà una notifica per resettare la tua password.' });
    }

    // -------- PIANO (INTERVENTI) --------

    case 'createPiano': {
      const id = 'INT_' + Date.now();
      const fields = getFields(body);
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
      const allFields = getFields(body);
      // Only writable piano columns
      const pianoWritable = ['tecnico_id','cliente_id','automezzo_id','tipo_intervento_id','data','ora_inizio','ora_fine','stato','note','data_fine','obsoleto'];
      const updates = {};
      for (const k of pianoWritable) { if (allFields[k] !== undefined) updates[k] = allFields[k]; }
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
      // Only writable urgenze columns
      const urgWritable = ['tenant_id','cliente_id','macchina_id','problema','priorita_id','stato','tecnico_assegnato','tecnici_ids','automezzo_id','data_segnalazione','data_assegnazione','data_prevista','ora_prevista','data_inizio','data_risoluzione','intervento_id','note','allegati_ids','sla_scadenza','sla_status'];
      const row = { id };
      for (const k of urgWritable) { if (fields[k] !== undefined) row[k] = fields[k]; }
      row.tenant_id = row.tenant_id || env.TENANT_ID || '785d94d0-b947-4a00-9c4e-3b67833e7045';
      row.stato = 'aperta'; row.sla_scadenza = slaScadenza; row.sla_status = 'ok'; row.data_segnalazione = new Date().toISOString();
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

    case 'updateUrgenza': {
      const id = body.id;
      const allFields = getFields(body);
      const urgWritable = ['cliente_id','macchina_id','problema','priorita_id','stato','tecnico_assegnato','tecnici_ids','automezzo_id','data_prevista','ora_prevista','data_inizio','data_risoluzione','intervento_id','note','allegati_ids','sla_scadenza','sla_status','obsoleto'];
      const updates = {};
      for (const k of urgWritable) { if (allFields[k] !== undefined) updates[k] = allFields[k]; }
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
        const [oldUser] = await sb(env, 'utenti', 'GET', null, `?id=eq.${id}&select=automezzo_id`);
        const oldAutoId = oldUser?.automezzo_id;
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
      const id = 'CLI_' + Date.now();
      const row = { id, ...getFields(body), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const result = await sb(env, 'clienti', 'POST', row);
      return ok({ cliente: pascalizeRecord(result[0]) });
    }

    case 'updateCliente': {
      const { id, userId: _u, operatoreId: _op, tenant_id: _t, ...updates } = body;
      updates.updated_at = new Date().toISOString();
      for (const k of Object.keys(updates)) { if (updates[k] === null && k.endsWith('_id')) delete updates[k]; }
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
      const { id, userId: _u, operatoreId: _op, tenant_id: _t, ...updates } = body;
      for (const k of Object.keys(updates)) { if (updates[k] === null && k.endsWith('_id')) delete updates[k]; }
      await sb(env, `macchine?id=eq.${id}`, 'PATCH', updates);
      return ok();
    }

    // -------- AUTOMEZZI --------

    case 'createAutomezzo': {
      const id = 'AUT_' + Date.now();
      const fields = getFields(body);
      const result = await sb(env, 'automezzi', 'POST', { id, ...fields });
      // SYNC: se ha assegnatario_id, aggiorna automezzo_id nell'utente
      if (fields.assegnatario_id) {
        await sb(env, `utenti?id=eq.${fields.assegnatario_id}`, 'PATCH', { automezzo_id: id, updated_at: new Date().toISOString() }).catch(() => {});
      }
      return ok({ automezzo: pascalizeRecord(result[0]) });
    }

    case 'updateAutomezzo': {
      const { id, userId: _u, operatoreId: _op, tenant_id: _t, ...updates } = body;
      for (const k of Object.keys(updates)) { if (updates[k] === null && k.endsWith('_id')) delete updates[k]; }
      // SYNC BIDIREZIONALE: se cambia assegnatario_id, aggiorna anche l'utente
      const newAssId = updates.assegnatario_id;
      if (newAssId) {
        // Leggi vecchio assegnatario di questo automezzo
        const [oldAuto] = await sb(env, 'automezzi', 'GET', null, `?id=eq.${id}&select=assegnatario_id`);
        const oldAssId = oldAuto?.assegnatario_id;
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
      return ok({ synced: !!newAssId });
    }

    // -------- INSTALLAZIONI --------

    case 'createInstallazione': {
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
      return handlePost('sendEmail', { to: body.email, subject: 'Test Syntoniqa', html: '<h1>Test OK</h1>' }, env);
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
      if (!env.GEMINI_KEY) return err('Gemini API key non configurata');

      const vincoli = body.vincoli || {};
      const testo = vincoli.testo || '';
      const files = vincoli.files || [];

      // If called from old interface with urgenze/tecnici
      const urgenze = body.urgenze || [];
      const tecnici = body.tecnici || [];

      // Load current data context
      const [allTecnici, allUrgenze, allPiano, allClienti] = await Promise.all([
        tecnici.length ? Promise.resolve(tecnici) : sb(env, 'utenti', 'GET', null, '?attivo=eq.true&ruolo=in.(tecnico,caposquadra)&select=id,nome,cognome,base,squadra_id').catch(()=>[]),
        urgenze.length ? Promise.resolve(urgenze) : sb(env, 'urgenze', 'GET', null, '?stato=in.(aperta,assegnata)&order=data_segnalazione.desc&limit=50').catch(()=>[]),
        sb(env, 'piano', 'GET', null, '?obsoleto=eq.false&order=data.desc&limit=100').catch(()=>[]),
        sb(env, 'anagrafica_clienti', 'GET', null, '?select=codice_m3,nome_account,nome_interno,citta&limit=200').catch(()=>[])
      ]);

      // Build file descriptions for context
      let fileContext = '';
      for (const f of files) {
        if (f.name.match(/\.(csv|txt)$/i) && typeof f.content === 'string' && !f.content.includes('base64')) {
          fileContext += `\n--- FILE: ${f.name} ---\n${f.content.substring(0, 3000)}\n`;
        } else {
          fileContext += `\n--- FILE: ${f.name} (${f.type}, ${Math.round((f.size||0)/1024)}KB) ---\n[Documento allegato]\n`;
        }
      }

      const prompt = `Sei l'AI planner di Syntoniqa, il sistema FSM di MRS Lely Center Emilia Romagna.
Genera un piano di interventi ottimizzato per la prossima settimana.

VINCOLI UTENTE: ${testo || 'Nessun vincolo specificato'}

TECNICI DISPONIBILI (${allTecnici.length}):
${allTecnici.map(t => `- ${t.nome||''} ${t.cognome||''} (ID: ${t.id}, base: ${t.base||'?'}, squadra: ${t.squadra_id||'?'})`).join('\n')}

URGENZE APERTE (${allUrgenze.length}):
${allUrgenze.slice(0,30).map(u => `- ${u.id}: ${u.problema||'?'} | Cliente: ${u.cliente_id||'?'} | Priorità: ${u.priorita_id||'?'} | SLA: ${u.sla_scadenza||'?'}`).join('\n')}

INTERVENTI GIÀ PIANIFICATI: ${allPiano.length}

CLIENTI: ${allClienti.slice(0,50).map(c => `${c.nome_account||c.nome_interno} (${c.codice_m3}, ${c.citta||'?'})`).join(', ')}
${fileContext ? '\nDOCUMENTI ALLEGATI:' + fileContext : ''}

Genera un piano ottimizzato che:
1. Rispetti i vincoli dell'utente
2. Prioritizzi le urgenze per SLA
3. Minimizzi i km (raggruppa interventi per zona)
4. Bilanci il carico tra tecnici
5. Consideri i documenti allegati se presenti

Rispondi con JSON:
{
  "summary": "breve riepilogo del piano",
  "piano": [
    {"data":"YYYY-MM-DD","tecnico":"nome","tecnicoId":"id","cliente":"nome","clienteId":"codice_m3","tipo":"urgenza|tagliando|service|installazione","oraInizio":"HH:MM","durataOre":2,"note":"...","urgenzaId":"se applicabile"}
  ],
  "warnings": ["eventuali avvisi/conflitti"]
}`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );
      const geminiData = await geminiRes.json();
      const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const cleanText = rawText.replace(/```json\n?|\n?```/g, '').trim();
      try {
        const result = JSON.parse(cleanText);
        return ok(result);
      } catch (e) {
        return ok({ summary: 'Piano generato (testo)', piano: [], warnings: ['Risposta AI non parsabile'], raw: cleanText });
      }
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

    case 'importExcelPlan': {
      // Import plan rows from parsed Excel data
      const { rows, operatoreId } = body;
      if (!rows || !rows.length) return err('rows richiesto');
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
      return ok(JSON.parse(cfg[0].valore));
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
      const [t1] = await sb(env, 'utenti', 'GET', null, `?id=eq.${tecnico1_id}&select=id,nome,automezzo_id`);
      const [t2] = await sb(env, 'utenti', 'GET', null, `?id=eq.${tecnico2_id}&select=id,nome,automezzo_id`);
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
      const results = await sb(env, 'anagrafica_clienti', 'GET', null,
        `?or=(nome_interno.ilike.*${q}*,nome_account.ilike.*${q}*)&select=codice_m3,nome_account,nome_interno&limit=20`);
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
            await sb(env, `utenti?id=eq.${utente.id}`, 'PATCH', { telegram_chat_id: String(fromId) }).catch(()=>{});
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
        return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            chat_id: chatId, text, parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
          })
        }).then(r=>r.json()).catch(()=>null);
      }

      // ---- Helper: AI parse message with Gemini ----
      async function aiParseMessage(text, mediaUrl, mediaType) {
        if (!env.GEMINI_KEY) return null;
        // Get clients list for context — usa nome_interno come chiave primaria
        const clienti = await sb(env, 'anagrafica_clienti', 'GET', null, '?select=codice_m3,nome_account,nome_interno&limit=300').catch(()=>[]);
        const clientiList = clienti.map(c => `${c.nome_interno || c.nome_account} → codice_m3: ${c.codice_m3}`).join('\n');

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
  "note": "eventuali note aggiuntive"
}`;

        const contentParts = [{ text: systemPrompt + '\n\nMESSAGGIO UTENTE: ' + text }];
        // If there's a photo, use vision model
        if (mediaUrl && mediaType === 'photo') {
          try {
            const imgRes = await fetch(mediaUrl);
            const imgBuf = await imgRes.arrayBuffer();
            const b64 = btoa(String.fromCharCode(...new Uint8Array(imgBuf)));
            contentParts.push({ inline_data: { mime_type: 'image/jpeg', data: b64 } });
          } catch(e) { /* ignore image fetch errors */ }
        }

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_KEY}`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ contents: [{ parts: contentParts }] })
        });
        if (!geminiRes.ok) {
          console.error('Gemini API error:', geminiRes.status, await geminiRes.text().catch(()=>''));
          return null;
        }
        const gd = await geminiRes.json();
        const raw = gd.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/```json\n?|\n?```/g, '').trim();
        try { return JSON.parse(raw); } catch { console.error('Gemini parse error, raw:', raw); return null; }
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
          reply = `👋 Benvenuto in *Syntoniqa MRS*!\n\n📤 Puoi inviarmi:\n• Testo con problemi/ordini\n• 📷 Foto di guasti o ricambi\n• 📄 Documenti (PDF, Excel)\n• 🎤 Audio/Video\n\n🤖 L'AI analizzerà tutto e creerà le azioni giuste!\n\nInvia /help per i comandi.`;
          break;
        case '/help':
          reply = `📋 *Comandi Syntoniqa:*\n\n🚨 *Urgenze:*\n/stato - Urgenze aperte\n/vado - Prendi urgenza\n/incorso - Segna in corso\n/risolto [note] - Chiudi urgenza\n\n📅 *Interventi:*\n/oggi - I tuoi interventi oggi\n/settimana - Piano settimanale\n\n📦 *Ordini:*\n/ordine [cod] [qt] [cliente] - Ordine ricambio\n/servepezz [desc] - Ricambio generico\n\n📤 *Upload:*\nInvia foto, PDF, Excel, audio → l'AI analizza e crea azioni automaticamente!\n\n💡 Puoi anche scrivere testo libero, es: "Bondioli 102 fermo, errore laser"`;
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
          const urg = await sb(env, 'urgenze', 'GET', null, '?stato=eq.aperta&order=data_segnalazione.asc&limit=1');
          if (!urg.length) { reply = '✅ Nessuna urgenza da prendere in carico'; break; }
          await sb(env, `urgenze?id=eq.${urg[0].id}`, 'PATCH', { stato: 'assegnata', tecnico_assegnato: utente.id, data_assegnazione: new Date().toISOString() });
          reply = `✅ Urgenza *${urg[0].id}* assegnata a te!\nProblema: ${urg[0].problema}`;
          await sendTelegramNotification(env, 'urgenza_assegnata', { id: urg[0].id, tecnicoAssegnato: utente.id });
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

          // AI Parse (with fallback to keyword-based parsing if Gemini quota exceeded)
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
              await sendTelegramNotification(env, 'nuova_urgenza', payload);
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

      // ---- MIRROR Bot response → Chat Admin ----
      if (reply) {
        try {
          const urgKwBot = ['urgenza','fermo','guasto','errore','rotto','emergenza','allarme'];
          const isUrgBot = urgKwBot.some(k => (text||'').toLowerCase().includes(k));
          const botCanale = isUrgBot ? 'CH_URGENZE' : 'CH_GENERALE';
          const cleanReply = reply.replace(/\*/g, '').replace(/_/g, '');
          const ts = new Date(Date.now() + 1000).toISOString();
          // Mirror in canale tematico
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
              const urg = await sb(env, 'urgenze', 'GET', null, '?stato=eq.aperta&order=data_segnalazione.asc&limit=1').catch(()=>[]);
              if (!urg.length) { botReply = '✅ Nessuna urgenza da prendere'; break; }
              await sb(env, `urgenze?id=eq.${urg[0].id}`, 'PATCH', { stato: 'assegnata', tecnico_assegnato: mittente, data_assegnazione: new Date().toISOString() });
              botReply = `✅ Urgenza ${urg[0].id} assegnata a te!\n${urg[0].problema}`;
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
          const tgText = `${canaleIcona} <b>[${canaleNome}]</b>\n👤 <b>${senderName}</b>:\n${testo}`;
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

    // ============ ANAGRAFICA (Clienti + Assets) ============

    case 'getAnagraficaClienti': {
      const search = body.search || '';
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
      if (search && search.trim()) base += `&or=(nome_asset.ilike.*${search}*,numero_serie.ilike.*${search}*,modello.ilike.*${search}*,nome_account.ilike.*${search}*)`;
      if (!all) {
        const data = await sb(env, base + '&limit=2000', 'GET');
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
      // Admin only: delete all anagrafica data for re-import
      await sb(env, 'anagrafica_assets?id=neq.00000000-0000-0000-0000-000000000000', 'DELETE');
      await sb(env, 'anagrafica_clienti?id=neq.00000000-0000-0000-0000-000000000000', 'DELETE');
      return ok({ cleared: true });
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
  if (!chatId) return null;
  let token = env.TELEGRAM_BOT_TOKEN || '';
  if (!token) {
    try {
      const cfgRows = await sb(env, 'config', 'GET', null, '?chiave=eq.telegram_bot_token&select=valore');
      if (cfgRows && cfgRows[0]) token = cfgRows[0].valore || '';
    } catch(e) {}
  }
  if (!token) return null;
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
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
    const [h, m] = p.ora_inizio.split(':').map(Number);
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
          `⏰ <b>Intervento non iniziato!</b>\n📋 ${cliNome} (ore ${p.ora_inizio})\nÈ passata 1 ora — aggiorna lo stato con /incorso o dall'app.`, 'HTML'
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
          `🔔 <b>Aggiorna intervento!</b>\n📋 ${cliNome} — in corso da 8+ ore\nAggiorna le note o completa con /risolto`, 'HTML'
        ).catch(() => {});
      }
    }
  }
  console.log(`[CRON] checkInterventoReminders: ${pianificati?.length || 0} pianificati, ${inCorso?.length || 0} in_corso checked`);
}

// Helper per nome entità
async function getEntityName(env, table, id) {
  if (!id) return '—';
  const rows = await sb(env, table, 'GET', null, `?id=eq.${id}&select=nome,ragione_sociale,cognome`).catch(() => []);
  if (!rows?.length) return id;
  const r = rows[0];
  return r.ragione_sociale || ((r.nome || '') + ' ' + (r.cognome || '')).trim() || id;
}
