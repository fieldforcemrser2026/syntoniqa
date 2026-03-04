-- ============================================================
-- Syntoniqa — Supabase Security Fix
-- Data: 2026-03-04
-- Risolve: 21 errori Security Advisor (Supabase email 01 Mar 2026)
--
-- SICUREZZA: Il Worker usa service_role key che bypassa RLS.
-- Abilitare RLS senza policy = blocco totale per anon/authenticated key.
-- Il Worker continua a funzionare al 100%.
--
-- ISTRUZIONI: Eseguire tutto nello Supabase SQL Editor
-- Progetto: Syntoniqa (sajzbanhkehkkhhgztkq)
-- ============================================================


-- ============================================================
-- STEP 1: Abilita RLS su tutte le 20 tabelle senza protezione
-- (service_role bypassa sempre RLS — nessun impatto sul Worker)
-- ============================================================

ALTER TABLE public.squadre             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.priorita            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipi_intervento     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tagliandi           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fasi_installazione  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_config          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_compilata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reperibilita        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trasferte           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installazioni       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagellini_voci      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documenti           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allegati            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_snapshot        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_canali         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_membri         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messaggi       ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 2: Fix view v_dashboard (SECURITY DEFINER → INVOKER)
--
-- Prima recupera la definizione attuale con questa query:
--   SELECT 'CREATE OR REPLACE VIEW public.v_dashboard AS ' || definition
--   FROM pg_views
--   WHERE schemaname = 'public' AND viewname = 'v_dashboard';
--
-- Poi esegui il blocco qui sotto (che usa la stessa definizione
-- ma senza SECURITY DEFINER — Postgres default è SECURITY INVOKER)
-- ============================================================

-- STEP 2a: Recupera la definizione attuale della view
SELECT
  'CREATE OR REPLACE VIEW public.v_dashboard WITH (security_invoker = true) AS '
  || definition AS sql_da_rieseguire
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'v_dashboard';

-- STEP 2b: Esegui l'output di 2a come nuova query.
-- Esempio del risultato atteso (la tua definizione sarà diversa):
--
--   CREATE OR REPLACE VIEW public.v_dashboard
--   WITH (security_invoker = true)
--   AS SELECT ... FROM ...;
--
-- In alternativa, se Postgres < 15:
--   DROP VIEW public.v_dashboard;
--   CREATE VIEW public.v_dashboard AS <stessa definizione senza SECURITY DEFINER>;


-- ============================================================
-- STEP 3: Verifica — tutte le tabelle devono mostrare rls = true
-- ============================================================

SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'squadre','priorita','tipi_intervento','tagliandi','fasi_installazione',
    'sla_config','checklist_template','checklist_compilata','reperibilita',
    'trasferte','installazioni','pagellini_voci','documenti','allegati',
    'kpi_log','kpi_snapshot','log','chat_canali','chat_membri','chat_messaggi'
  )
ORDER BY tablename;

-- Risultato atteso: tutte le righe con rls_enabled = true


-- ============================================================
-- STEP 4: Verifica view — security_type deve essere 'invoker'
-- ============================================================

SELECT
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'v_dashboard';

-- Poi controlla con:
SELECT
  c.relname AS view_name,
  CASE WHEN c.relkind = 'v' AND c.reloptions::text LIKE '%security_invoker%'
       THEN 'SECURITY INVOKER ✅'
       WHEN c.relkind = 'v'
       THEN 'Verifica manuale — cerca SECURITY DEFINER nella definizione'
  END AS security_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'v_dashboard';


-- ============================================================
-- NOTE IMPORTANTI
-- ============================================================
--
-- 1. NESSUNA POLICY AGGIUNTA INTENZIONALMENTE:
--    Con RLS abilitato e zero policy → accesso negato per default
--    a qualsiasi chiamata con anon_key o authenticated_key.
--    Il Worker usa service_role_key → bypassa sempre RLS.
--    Questo è il comportamento CORRETTO per Syntoniqa.
--
-- 2. SE IN FUTURO AGGIUNGI UN'APP CHE USA authenticated KEY:
--    Dovrai aggiungere policy specifiche per ogni tabella.
--    Esempio policy permissiva per tenant:
--      CREATE POLICY "tenant_access" ON public.chat_messaggi
--      USING (tenant_id = '785d94d0-b947-4a00-9c4e-3b67833e7045');
--
-- 3. TABELLE GIÀ CON RLS (non incluse sopra — probabilmente ok):
--    Controlla con:
--      SELECT tablename, rowsecurity FROM pg_tables
--      WHERE schemaname = 'public' ORDER BY tablename;
--
-- ============================================================
