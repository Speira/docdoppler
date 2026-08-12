import { Router, type Request, type Response } from "express";
import type Database from "better-sqlite3";
import { listPatientsByExamDate } from "../db/patients.js";
import { validateWorklistQuery } from "../validation/worklist.js";

export function createWorklistRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (req: Request, res: Response) => {
    const result = validateWorklistQuery(req.query);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(200).json(listPatientsByExamDate(db, result.date));
  });

  return router;
}
