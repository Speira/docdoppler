import { Router, type Request, type Response } from "express";
import type Database from "better-sqlite3";
import { getSettings, updateSettings } from "../db/settings.js";
import { validateUpdateSettings } from "../validation/settings.js";

export function createSettingsRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (_req: Request, res: Response) => {
    res.status(200).json(getSettings(db));
  });

  router.put("/", (req: Request, res: Response) => {
    const result = validateUpdateSettings(req.body);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(200).json(updateSettings(db, result.data));
  });

  return router;
}
