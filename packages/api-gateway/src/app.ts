import express, { type Express, type Request, type Response } from "express";
import { getDb } from "./db/index.js";

const app: Express = express();

getDb();

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});

app.listen(3000);
