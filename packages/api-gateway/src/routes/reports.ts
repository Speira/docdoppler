import { Router, type Request, type Response } from "express";
import type Database from "better-sqlite3";
import { getPatient } from "../db/patients.js";
import { createReport, listReportsByPatient } from "../db/reports.js";
import { validateCreateReport } from "../validation/reports.js";

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

  router.get("/", (req: Request, res: Response) => {
    const patientId = parseId(req.params.id as string);
    if (patientId === undefined || !getPatient(db, patientId)) {
      res.status(404).json({ error: "PATIENT_NOT_FOUND" });
      return;
    }
    res.status(200).json(listReportsByPatient(db, patientId));
  });

  return router;
}
