import { describe, expect, it, beforeEach } from "vitest";
import supertest from "supertest";
import type Database from "better-sqlite3";
import type { Express } from "express";
import { createConnection } from "../db/index.js";
import { createApp } from "../app.js";

describe("patients routes", () => {
  let db: Database.Database;
  let app: Express;

  beforeEach(() => {
    db = createConnection(":memory:");
    app = createApp(db);
  });

  describe("POST /patients", () => {
    it("creates a patient", async () => {
      const response = await supertest(app).post("/patients").send({
        first_name: "Jean",
        last_name: "Dupont",
        dob: "1958-03-12",
        sex: "M",
      });
      expect(response.status).toBe(201);
      expect(response.body.first_name).toBe("Jean");
      expect(response.body.id).toBeTypeOf("number");
    });

    it("rejects a payload missing first_name", async () => {
      const response = await supertest(app).post("/patients").send({
        last_name: "Dupont",
        dob: "1958-03-12",
        sex: "M",
      });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "FIRST_NAME_REQUIRED" });
    });
  });

  describe("GET /patients", () => {
    it("lists patients ordered by last name", async () => {
      await supertest(app).post("/patients").send({
        first_name: "Bernard",
        last_name: "Martin",
        dob: "1970-01-01",
        sex: "M",
      });
      await supertest(app).post("/patients").send({
        first_name: "Alice",
        last_name: "Durand",
        dob: "1980-01-01",
        sex: "F",
      });
      const response = await supertest(app).get("/patients");
      expect(response.status).toBe(200);
      expect(
        response.body.map((p: { last_name: string }) => p.last_name),
      ).toEqual(["Durand", "Martin"]);
    });
  });

  describe("GET /patients/:id", () => {
    it("returns the patient with riskFactors null when none exist", async () => {
      const created = await supertest(app).post("/patients").send({
        first_name: "Jean",
        last_name: "Dupont",
        dob: "1958-03-12",
        sex: "M",
      });
      const response = await supertest(app).get(
        `/patients/${created.body.id}`,
      );
      expect(response.status).toBe(200);
      expect(response.body.riskFactors).toBeNull();
    });

    it("returns 404 for an unknown patient", async () => {
      const response = await supertest(app).get("/patients/999");
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "PATIENT_NOT_FOUND" });
    });

    it("returns 404 for a non-numeric id", async () => {
      const response = await supertest(app).get("/patients/not-a-number");
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "PATIENT_NOT_FOUND" });
    });
  });

  describe("PATCH /patients/:id", () => {
    it("updates only the provided fields", async () => {
      const created = await supertest(app).post("/patients").send({
        first_name: "Jean",
        last_name: "Dupont",
        dob: "1958-03-12",
        sex: "M",
      });
      const response = await supertest(app)
        .patch(`/patients/${created.body.id}`)
        .send({ first_name: "Jeanne" });
      expect(response.status).toBe(200);
      expect(response.body.first_name).toBe("Jeanne");
      expect(response.body.last_name).toBe("Dupont");
    });

    it("returns 404 for an unknown patient", async () => {
      const response = await supertest(app)
        .patch("/patients/999")
        .send({ first_name: "Jeanne" });
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "PATIENT_NOT_FOUND" });
    });

    it("returns 400 for an invalid field", async () => {
      const created = await supertest(app).post("/patients").send({
        first_name: "Jean",
        last_name: "Dupont",
        dob: "1958-03-12",
        sex: "M",
      });
      const response = await supertest(app)
        .patch(`/patients/${created.body.id}`)
        .send({ sex: "X" });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "SEX_INVALID" });
    });
  });
});
