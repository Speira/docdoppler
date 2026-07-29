# Patients + Risk Factors SQLite Schema — Design

Date: 2026-07-26

## Scope

Design the SQLite schema and surrounding connection/boot code for the
`patients` and `risk_factors` tables, as specified in `CLAUDE.md`. The
`reports` table is explicitly **out of scope** — its `findings per vessel
type` shape needs its own design pass when the doctor report builder screen
is built.

## Constraints (from CLAUDE.md)

- Local-only, single SQLite file, no cloud DB.
- No auth for MVP.
- No ORM required at this schema size.

## Decisions

1. **Risk factors are dated history (1:N), not a single snapshot.** Each
   secretary intake creates a new `risk_factors` row rather than overwriting
   the previous one. This preserves how a patient's risk factors changed
   across visits.
2. **Driver: `better-sqlite3`.** Synchronous API, no async ceremony for
   simple CRUD, the standard choice for local Node/Express apps.
3. **Migrations: single `schema.sql`, run idempotently on boot.** Every
   statement uses `IF NOT EXISTS`; no migration framework or version-tracking
   table. Revisit if/when the schema needs a breaking change (e.g. adding a
   column to an existing table) — at that point, guard an `ALTER TABLE` with
   a `PRAGMA user_version` check.
4. **Code location: inside `packages/api-gateway`.** Only the API gateway
   touches the DB directly; `client-secretary` talks to it over HTTP. No
   need for a separate `packages/db` workspace at this size.
5. **Primary keys: `INTEGER PRIMARY KEY AUTOINCREMENT`.** Simplest option for
   a local single-clinic app with no cross-DB merge/sync needs.
6. **Timestamps on both tables.** `created_at`/`updated_at` on `patients`;
   `created_at` (doubling as assessment date) and `updated_at` on
   `risk_factors`, the latter only for correcting entry typos shortly after
   creation, not for revising history.

## Module layout

```
packages/api-gateway/src/db/
  schema.sql       -- CREATE TABLE IF NOT EXISTS statements + triggers
  index.ts         -- opens better-sqlite3 connection, runs schema.sql on boot
data/
  docdoppler.sqlite3   -- the actual DB file, gitignored
```

`better-sqlite3` is added as a dependency of `api-gateway`.

## Schema

```sql
-- packages/api-gateway/src/db/schema.sql

CREATE TABLE IF NOT EXISTS patients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  dob        TEXT NOT NULL,                    -- ISO 8601 date, e.g. '1958-03-12'
  sex        TEXT NOT NULL CHECK (sex IN ('M', 'F')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),  -- doubles as the assessment date
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS risk_factors_set_updated_at
AFTER UPDATE ON risk_factors
BEGIN
  UPDATE risk_factors SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_risk_factors_patient_id ON risk_factors(patient_id);
```

Notes:

- `sex` is stored as internal codes `'M'`/`'F'`. The French UI translates to
  "Homme"/"Femme" at the display layer, not in the DB.
- Booleans are stored as `INTEGER 0/1` with a `CHECK` constraint — SQLite has
  no native boolean type.

## Boot behavior

`db/index.ts`, on module load:

1. Resolves the DB file path — default `data/docdoppler.sqlite3`,
   overridable via a `DB_PATH` env var (e.g. `:memory:` for tests).
2. Opens a `better-sqlite3` connection.
3. Runs `PRAGMA foreign_keys = ON` (SQLite disables FK enforcement by
   default; needed since `risk_factors.patient_id` references `patients`).
4. Reads `schema.sql` and executes it via `db.exec(...)` — safe on every
   boot since every statement is `IF NOT EXISTS`.
5. Exports the connection as a singleton for the rest of `api-gateway` to
   import.

## Testing

- Unit tests for the schema/connection module can point `DB_PATH` at
  `:memory:` to get a fresh isolated DB per test run, with no file cleanup
  needed.
- Once CRUD routes exist, integration tests can insert a patient, insert
  multiple dated `risk_factors` rows for it, and assert `ON DELETE CASCADE`
  removes the `risk_factors` rows when the patient is deleted.

## Out of scope (deferred)

- `reports` table and its `findings` shape.
- Any migration framework or schema versioning beyond `IF NOT EXISTS`.
- Validation of `first_name`/`last_name`/`dob` format — deferred to the
  application/API layer, not the DB layer.
