import { describe, expect, it, beforeEach } from "vitest";
import supertest from "supertest";
import type Database from "better-sqlite3";
import type { Express } from "express";
import { createConnection } from "../db/index.js";
import { createApp } from "../app.js";

describe("GET /worklist", () => {
  let db: Database.Database;
  let app: Express;

  beforeEach(() => {
    db = createConnection(":memory:");
    app = createApp(db);
  });

  it("returns patients matching the given exam_date", async () => {
    await supertest(app).post("/patients").send({
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
      exam_date: "2026-08-12",
    });
    await supertest(app).post("/patients").send({
      first_name: "Other",
      last_name: "Day",
      dob: "1990-01-01",
      sex: "F",
      exam_date: "2026-08-13",
    });

    const response = await supertest(app).get("/worklist?date=2026-08-12");
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].last_name).toBe("Dupont");
    expect(response.body[0].accession_number).toBe("20260812-001");
  });

  it("returns an empty array when no patients match the date", async () => {
    const response = await supertest(app).get("/worklist?date=2026-08-12");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns 400 for a missing date", async () => {
    const response = await supertest(app).get("/worklist");
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "DATE_INVALID" });
  });

  it("returns 400 for a malformed date", async () => {
    const response = await supertest(app).get("/worklist?date=12-08-2026");
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "DATE_INVALID" });
  });
});
