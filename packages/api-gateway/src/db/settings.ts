import type Database from "better-sqlite3";

export interface ClinicSettingsRow {
  id: number;
  doctor_name: string;
  professional_membership: string;
  rpps_number: string;
  adeli_number: string;
  address: string;
  mindray_service_date: string | null;
  mindray_characteristics: string;
  updated_at: string;
}

export interface UpdateClinicSettingsInput {
  doctor_name: string;
  professional_membership: string;
  rpps_number: string;
  adeli_number: string;
  address: string;
  mindray_service_date: string | null;
  mindray_characteristics: string;
}

export function getSettings(db: Database.Database): ClinicSettingsRow {
  return db
    .prepare("SELECT * FROM clinic_settings WHERE id = 1")
    .get() as ClinicSettingsRow;
}

export function updateSettings(
  db: Database.Database,
  input: UpdateClinicSettingsInput,
): ClinicSettingsRow {
  db.prepare(
    `UPDATE clinic_settings SET
       doctor_name = ?,
       professional_membership = ?,
       rpps_number = ?,
       adeli_number = ?,
       address = ?,
       mindray_service_date = ?,
       mindray_characteristics = ?,
       updated_at = datetime('now')
     WHERE id = 1`,
  ).run(
    input.doctor_name,
    input.professional_membership,
    input.rpps_number,
    input.adeli_number,
    input.address,
    input.mindray_service_date,
    input.mindray_characteristics,
  );
  return getSettings(db);
}
