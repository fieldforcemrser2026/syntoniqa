-- ═══════════════════════════════════════════════════════════════════
-- Syntoniqa — Migrazione: tabella pm_sync_log
-- Esegui questo script nell'editor SQL di Supabase
-- Dashboard → SQL Editor → New query → incolla → Run
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pm_sync_log (
  id              TEXT         PRIMARY KEY,
  tenant_id       UUID         NOT NULL,
  utente_id       TEXT,
  utente_nome     TEXT,
  records_raw     JSONB        NOT NULL DEFAULT '[]',
  total_records   INTEGER      DEFAULT 0,
  updated_count   INTEGER      DEFAULT 0,
  not_found_count INTEGER      DEFAULT 0,
  errors_count    INTEGER      DEFAULT 0,
  skipped_count   INTEGER      DEFAULT 0,
  note            TEXT,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- Indice per recuperare storico per tenant, dal più recente
CREATE INDEX IF NOT EXISTS idx_pm_sync_log_tenant_created
  ON pm_sync_log(tenant_id, created_at DESC);

-- RLS: solo service_role può scrivere (il Worker usa service_role key)
ALTER TABLE pm_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON pm_sync_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verifica
SELECT 'pm_sync_log creata correttamente' AS status;
