import { describe, expect, it, beforeEach } from "vitest";
import supertest from "supertest";
import type Database from "better-sqlite3";
import type { Express } from "express";
import { createConnection } from "../db/index.js";
import { createApp } from "../app.js";

describe("settings routes", () => {
  let db: Database.Database;
  let app: Express;

  beforeEach(() => {
    db = createConnection(":memory:");
    app = createApp(db);
  });

  describe("GET /settings", () => {
    it("returns the empty singleton row before anything is saved", async () => {
      const response = await supertest(app).get("/settings");
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
      expect(response.body.doctor_name).toBe("");
    });
  });

  describe("PUT /settings", () => {
    it("saves and returns the updated settings", async () => {
      const response = await supertest(app).put("/settings").send({
        doctor_name: "Dr Pembele",
        professional_membership: "Membre de la société française de radiologie",
        rpps_number: "12345678901",
        adeli_number: "939912345",
        address: "6 avenue Yuri Gagarine 93270 Sevran",
        mindray_service_date: "2020-03-01",
        mindray_characteristics: "Mindray Resona 7, sonde linéaire L14-5",
      });
      expect(response.status).toBe(200);
      expect(response.body.doctor_name).toBe("Dr Pembele");
      expect(response.body.mindray_service_date).toBe("2020-03-01");

      const getResponse = await supertest(app).get("/settings");
      expect(getResponse.body.doctor_name).toBe("Dr Pembele");
    });

    it("rejects a malformed mindray_service_date", async () => {
      const response = await supertest(app)
        .put("/settings")
        .send({ mindray_service_date: "not-a-date" });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("MINDRAY_SERVICE_DATE_INVALID");
    });
  });
});
