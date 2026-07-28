import express, { type Express, type Request, type Response } from "express";
import type Database from "better-sqlite3";

export function createApp(db: Database.Database): Express {
  const app: Express = express();
  app.use(express.json());

  app.get("/", (req: Request, res: Response) => {
    res.send("Hello World!");
  });

  return app;
}
