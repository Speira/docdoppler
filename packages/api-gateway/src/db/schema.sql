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

CREATE TABLE IF NOT EXISTS reports (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                  INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_name                 TEXT NOT NULL,
  exam_date                   TEXT NOT NULL,
  carotide_text               TEXT NOT NULL DEFAULT '',
  carotide_abnormal           INTEGER NOT NULL DEFAULT 0 CHECK (carotide_abnormal IN (0, 1)),
  artere_membre_sup_text      TEXT NOT NULL DEFAULT '',
  artere_membre_sup_abnormal  INTEGER NOT NULL DEFAULT 0 CHECK (artere_membre_sup_abnormal IN (0, 1)),
  veine_membre_sup_text       TEXT NOT NULL DEFAULT '',
  veine_membre_sup_abnormal   INTEGER NOT NULL DEFAULT 0 CHECK (veine_membre_sup_abnormal IN (0, 1)),
  artere_membre_inf_text      TEXT NOT NULL DEFAULT '',
  artere_membre_inf_abnormal  INTEGER NOT NULL DEFAULT 0 CHECK (artere_membre_inf_abnormal IN (0, 1)),
  veine_membre_inf_text       TEXT NOT NULL DEFAULT '',
  veine_membre_inf_abnormal   INTEGER NOT NULL DEFAULT 0 CHECK (veine_membre_inf_abnormal IN (0, 1)),
  created_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reports_patient_id ON reports(patient_id);
