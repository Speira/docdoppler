import { Router, type Request, type Response } from "express";
import type Database from "better-sqlite3";
import { getPatient, getLatestRiskFactors } from "../db/patients.js";
import {
  createReport,
  countReportsByPatient,
  listReportSummaries,
  getReport,
} from "../db/reports.js";
import { getSettings } from "../db/settings.js";
import {
  validateCreateReport,
  validateReportListQuery,
} from "../validation/reports.js";
import { buildReportPdf, buildReportPdfFilename } from "../pdf/report-pdf.js";

function parseId(rawId: string): number | undefined {
  const id = Number(rawId);
  return Number.isInteger(id) ? id : undefined;
}

export function createPatientReportsRouter(db: Database.Database): Router {
  const router = Router({ mergeParams: true });

  router.post("/", (req: Request, res: Response) => {
    const patientId = parseId(req.params.id as string);
    if (patientId === undefined || !getPatient(db, patientId)) {
      res.status(404).json({ error: "PATIENT_NOT_FOUND" });
      return;
    }
    const result = validateCreateReport(req.body);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(createReport(db, patientId, result.data));
  });

  // Bounded on purpose: a patient file that has accumulated years of reports
  // must not turn one page load into an unbounded download. The list carries
  // the slim projection only; the full report is read one at a time.
  router.get("/", (req: Request, res: Response) => {
    const patientId = parseId(req.params.id as string);
    if (patientId === undefined || !getPatient(db, patientId)) {
      res.status(404).json({ error: "PATIENT_NOT_FOUND" });
      return;
    }
    const result = validateReportListQuery(req.query);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
    const { limit, offset } = result.data;
    res.status(200).json({
      items: listReportSummaries(db, patientId, { limit, offset }),
      total: countReportsByPatient(db, patientId),
      limit,
      offset,
    });
  });

  return router;
}

export function createReportsRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/:id/pdf", async (req: Request, res: Response) => {
    const id = parseId(req.params.id as string);
    const report = id === undefined ? undefined : getReport(db, id);
    if (!report) {
      res.status(404).json({ error: "REPORT_NOT_FOUND" });
      return;
    }
    const patient = getPatient(db, report.patient_id);
    if (!patient) {
      res.status(404).json({ error: "REPORT_NOT_FOUND" });
      return;
    }
    const riskFactors = getLatestRiskFactors(db, patient.id);
    const settings = getSettings(db);
    const pdfBytes = await buildReportPdf(patient, riskFactors, report, settings);
    const filename = buildReportPdfFilename(patient, report);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.status(200).send(Buffer.from(pdfBytes));
  });

  return router;
}
