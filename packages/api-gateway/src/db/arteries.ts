import type Database from "better-sqlite3";
import {
  MI_ARTERY_KEYS,
  MI_SIDES,
  type MiArteryKey,
  type MiSide,
} from "@speira-docdoppler/shared-labels";

export interface ArteryEntry {
  vsm: number | null;
  spectre: string;
}

export type ArteriesBySide = Partial<
  Record<MiSide, Partial<Record<MiArteryKey, ArteryEntry>>>
>;

interface ReportArteryRow {
  report_id: number;
  side: MiSide;
  artery: MiArteryKey;
  vsm: number | null;
  spectre: string;
}

// Sparse by design: an artery the doctor did not examine gets no row, so a
// report with no MI arterial exam writes nothing at all.
function hasData(entry: ArteryEntry): boolean {
  return entry.spectre !== "" || entry.vsm !== null;
}

export function insertArteries(
  db: Database.Database,
  reportId: number,
  arteres: ArteriesBySide,
): void {
  const statement = db.prepare(
    "INSERT INTO report_arteries (report_id, side, artery, vsm, spectre) VALUES (?, ?, ?, ?, ?)",
  );
  for (const side of MI_SIDES) {
    const bySide = arteres[side];
    if (!bySide) continue;
    for (const artery of MI_ARTERY_KEYS) {
      const entry = bySide[artery];
      if (!entry || !hasData(entry)) continue;
      statement.run(reportId, side, artery, entry.vsm, entry.spectre);
    }
  }
}

function group(rows: ReportArteryRow[]): ArteriesBySide {
  const arteres: ArteriesBySide = {};
  for (const row of rows) {
    const bySide = (arteres[row.side] ??= {});
    bySide[row.artery] = { vsm: row.vsm, spectre: row.spectre };
  }
  return arteres;
}

export function getArteriesForReport(
  db: Database.Database,
  reportId: number,
): ArteriesBySide {
  const rows = db
    .prepare("SELECT * FROM report_arteries WHERE report_id = ?")
    .all(reportId) as ReportArteryRow[];
  return group(rows);
}

export function getArteriesForReports(
  db: Database.Database,
  reportIds: number[],
): Map<number, ArteriesBySide> {
  const grouped = new Map<number, ArteriesBySide>();
  if (reportIds.length === 0) return grouped;
  const placeholders = reportIds.map(() => "?").join(", ");
  const rows = db
    .prepare(`SELECT * FROM report_arteries WHERE report_id IN (${placeholders})`)
    .all(...reportIds) as ReportArteryRow[];
  for (const id of reportIds) {
    grouped.set(
      id,
      group(rows.filter((row) => row.report_id === id)),
    );
  }
  return grouped;
}
