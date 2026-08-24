CREATE TABLE IF NOT EXISTS patients (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  dob              TEXT NOT NULL,
  sex              TEXT NOT NULL CHECK (sex IN ('M', 'F')),
  exam_date        TEXT NOT NULL DEFAULT CURRENT_DATE,
  accession_number TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS patients_set_updated_at
AFTER UPDATE ON patients
BEGIN
  UPDATE patients SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS risk_factors (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id    INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  diabetes      INTEGER NOT NULL DEFAULT 0 CHECK (diabetes IN (0, 1)),
  hypertension  INTEGER NOT NULL DEFAULT 0 CHECK (hypertension IN (0, 1)),
  cholesterol   INTEGER NOT NULL DEFAULT 0 CHECK (cholesterol IN (0, 1)),
  obesity       INTEGER NOT NULL DEFAULT 0 CHECK (obesity IN (0, 1)),
  vertigo       INTEGER NOT NULL DEFAULT 0 CHECK (vertigo IN (0, 1)),
  carotid_bruit INTEGER NOT NULL DEFAULT 0 CHECK (carotid_bruit IN (0, 1)),
  avc           INTEGER NOT NULL DEFAULT 0 CHECK (avc IN (0, 1)),
  smoking       INTEGER NOT NULL DEFAULT 0 CHECK (smoking IN (0, 1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS risk_factors_set_updated_at
AFTER UPDATE ON risk_factors
BEGIN
  UPDATE risk_factors SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_risk_factors_patient_id ON risk_factors(patient_id);

-- Arterial-only scope (TSA / aorte abdominale / membres inférieurs) — see
-- docs/report-module.md's 2026-08-17 revision note. This table has never
-- held real data, so it's defined directly rather than migrated.
CREATE TABLE IF NOT EXISTS reports (
  id                            INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                    INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_name                   TEXT NOT NULL,
  exam_date                     TEXT NOT NULL,
  correspondant_dossier         TEXT NOT NULL DEFAULT '',
  indication                    TEXT NOT NULL DEFAULT '',
  tsa_imt_droit                 REAL,
  tsa_imt_gauche                REAL,
  tsa_aci_acc_ratio_droit       REAL,
  tsa_aci_acc_ratio_gauche      REAL,
  tsa_findings_text             TEXT NOT NULL DEFAULT '',
  aorte_diametre                TEXT NOT NULL DEFAULT '',
  aorte_anevrisme               INTEGER NOT NULL DEFAULT 0 CHECK (aorte_anevrisme IN (0, 1)),
  aorte_anevrisme_diametre_mm   REAL,
  aorte_findings_text           TEXT NOT NULL DEFAULT '',
  mi_pression_cheville_droite   REAL,
  mi_pression_cheville_gauche   REAL,
  mi_pression_bras_droit        REAL,
  mi_pression_bras_gauche       REAL,
  mi_ips_droit                  REAL,
  mi_ips_gauche                 REAL,
  mi_findings_text              TEXT NOT NULL DEFAULT '',
  conclusion                    TEXT NOT NULL DEFAULT '',
  created_at                    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reports_patient_id ON reports(patient_id);

-- Single-row clinic identity settings (letterhead, RPPS/Adeli, Mindray
-- service info) — see docs/report-module.md "Clinic identity settings".
-- id is pinned to 1 by the CHECK constraint so there is never more than
-- one row; the INSERT OR IGNORE below guarantees the row always exists.
CREATE TABLE IF NOT EXISTS clinic_settings (
  id                       INTEGER PRIMARY KEY CHECK (id = 1),
  doctor_name              TEXT NOT NULL DEFAULT '',
  professional_membership  TEXT NOT NULL DEFAULT '',
  rpps_number              TEXT NOT NULL DEFAULT '',
  adeli_number             TEXT NOT NULL DEFAULT '',
  address                  TEXT NOT NULL DEFAULT '',
  mindray_service_date     TEXT,
  mindray_characteristics  TEXT NOT NULL DEFAULT '',
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO clinic_settings (id) VALUES (1);
