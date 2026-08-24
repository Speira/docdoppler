import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import type Database from "better-sqlite3";
import { createPatientsRouter } from "./routes/patients.js";
import { createPatientReportsRouter, createReportsRouter } from "./routes/reports.js";
import { createWorklistRouter } from "./routes/worklist.js";
import { createSettingsRouter } from "./routes/settings.js";

export function createApp(db: Database.Database): Express {
  const app: Express = express();
  app.use(express.json());

  // Local-only clinic LAN, single trusted network: allow any origin.
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use("/patients", createPatientsRouter(db));
  app.use("/patients/:id/reports", createPatientReportsRouter(db));
  app.use("/reports", createReportsRouter(db));
  app.use("/worklist", createWorklistRouter(db));
  app.use("/settings", createSettingsRouter(db));

  app.get("/", (req: Request, res: Response) => {
    res.send("Hello World!");
  });

  return app;
}
