import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { insertArteries, getArteriesForReport, getArteriesForReports } from "./arteries.js";
import type { Spectre } from "@speira-docdoppler/shared-labels";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  db.prepare(
    "INSERT INTO patients (id, first_name, last_name, dob, sex) VALUES (1, 'Jean', 'Dupont', '1958-03-12', 'M')",
  ).run();
  db.prepare(
    "INSERT INTO reports (id, patient_id, doctor_name, exam_date) VALUES (1, 1, 'Dr Martin', '2026-08-13')",
  ).run();
  return db;
}

describe("report arteries", () => {
  it("round-trips what was entered, keyed by side and artery", () => {
    const db = makeDb();
    insertArteries(db, 1, {
      droite: {
        afc: { vsm: 90, spectre: "triphasique" },
        afs: { vsm: null, spectre: "monophasique" },
      },
    });
    expect(getArteriesForReport(db, 1)).toEqual({
      droite: {
        afc: { vsm: 90, spectre: "triphasique" },
        afs: { vsm: null, spectre: "monophasique" },
      },
    });
  });

  it("writes no row for an artery with neither spectre nor vsm", () => {
    const db = makeDb();
    insertArteries(db, 1, {
      droite: {
        afc: { vsm: null, spectre: "triphasique" },
        poplitee: { vsm: null, spectre: "" },
      },
    });
    const count = db
      .prepare("SELECT COUNT(*) AS n FROM report_arteries WHERE report_id = 1")
      .get() as { n: number };
    expect(count.n).toBe(1);
    expect(getArteriesForReport(db, 1).droite?.poplitee).toBeUndefined();
  });

  it("returns an empty object for a report with no arteries", () => {
    const db = makeDb();
    expect(getArteriesForReport(db, 1)).toEqual({});
  });

  it("deletes its rows when the report's patient is deleted", () => {
    const db = makeDb();
    insertArteries(db, 1, { droite: { afc: { vsm: null, spectre: "triphasique" } } });
    db.prepare("DELETE FROM patients WHERE id = 1").run();
    const count = db
      .prepare("SELECT COUNT(*) AS n FROM report_arteries")
      .get() as { n: number };
    expect(count.n).toBe(0);
  });

  it("rejects a spectre outside the allowed set", () => {
    const db = makeDb();
    expect(() =>
      // Deliberately outside the Spectre union — exercises the DB's own
      // CHECK constraint, not the (separate) request-level validation.
      insertArteries(db, 1, { droite: { afc: { vsm: null, spectre: "bruit" as Spectre } } }),
    ).toThrow();
  });

  it("groups arteries for several reports in one read", () => {
    const db = makeDb();
    db.prepare(
      "INSERT INTO reports (id, patient_id, doctor_name, exam_date) VALUES (2, 1, 'Dr Martin', '2026-08-14')",
    ).run();
    insertArteries(db, 1, { droite: { afc: { vsm: null, spectre: "triphasique" } } });
    insertArteries(db, 2, { gauche: { afs: { vsm: null, spectre: "diphasique" } } });
    const grouped = getArteriesForReports(db, [1, 2]);
    expect(grouped.get(1)?.droite?.afc?.spectre).toBe("triphasique");
    expect(grouped.get(2)?.gauche?.afs?.spectre).toBe("diphasique");
  });
});
