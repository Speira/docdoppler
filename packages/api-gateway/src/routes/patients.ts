import { Router, type Request, type Response } from "express";
import type Database from "better-sqlite3";
import {
  createPatient,
  getPatient,
  listPatients,
  updatePatient,
  getLatestRiskFactors,
} from "../db/patients.js";
import {
  validateCreatePatient,
  validateUpdatePatient,
} from "../validation/patients.js";

function parsePatientId(rawId: string): number | undefined {
  const id = Number(rawId);
  return Number.isInteger(id) ? id : undefined;
}

export function createPatientsRouter(db: Database.Database): Router {
  const router = Router();

  router.post("/", (req: Request, res: Response) => {
    const result = validateCreatePatient(req.body);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(createPatient(db, result.data));
  });

  router.get("/", (_req: Request, res: Response) => {
    res.status(200).json(listPatients(db));
  });

  router.get("/:id", (req: Request, res: Response) => {
    const id = parsePatientId(req.params.id as string);
    const patient = id === undefined ? undefined : getPatient(db, id);
    if (!patient) {
      res.status(404).json({ error: "PATIENT_NOT_FOUND" });
      return;
    }
    res
      .status(200)
      .json({ ...patient, riskFactors: getLatestRiskFactors(db, id as number) ?? null });
  });

  router.patch("/:id", (req: Request, res: Response) => {
    const id = parsePatientId(req.params.id as string);
    const result = validateUpdatePatient(req.body);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
    const patient = id === undefined ? undefined : updatePatient(db, id, result.data);
    if (!patient) {
      res.status(404).json({ error: "PATIENT_NOT_FOUND" });
      return;
    }
    res.status(200).json(patient);
  });

  return router;
}
