-- ═══════════════════════════════════════════════════════════════════
-- Syntoniqa — Migrazione: PM columns su anagrafica_assets
-- Esegui questo script nell'editor SQL di Supabase
-- Dashboard → SQL Editor → New query → incolla → Run
-- ═══════════════════════════════════════════════════════════════════

-- ── Aggiungi colonne PM a anagrafica_assets (se non esistono già) ────────
ALTER TABLE anagrafica_assets
  ADD COLUMN IF NOT EXISTS prossimo_controllo   DATE,
  ADD COLUMN IF NOT EXISTS ultimo_controllo     DATE,
  ADD COLUMN IF NOT EXISTS ciclo_pm             TEXT,
  ADD COLUMN IF NOT EXISTS intervallo_settimane INTEGER,
  ADD COLUMN IF NOT EXISTS schedule_type        TEXT,
  ADD COLUMN IF NOT EXISTS status               TEXT;

-- Indici per query veloci sulla dashboard PM
CREATE INDEX IF NOT EXISTS idx_anagrafica_assets_prossimo_controllo
  ON anagrafica_assets(prossimo_controllo)
  WHERE prossimo_controllo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_anagrafica_assets_numero_serie
  ON anagrafica_assets(numero_serie)
  WHERE numero_serie IS NOT NULL;

-- ── Verifica finale ──────────────────────────────────────────────────────
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'anagrafica_assets'
  AND column_name IN ('prossimo_controllo','ultimo_controllo','ciclo_pm','intervallo_settimane','schedule_type','status')
ORDER BY column_name;
