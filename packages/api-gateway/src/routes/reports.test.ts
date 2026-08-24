import { describe, expect, it, beforeEach } from "vitest";
import supertest from "supertest";
import type Database from "better-sqlite3";
import type { Express } from "express";
import { createConnection } from "../db/index.js";
import { createApp } from "../app.js";

describe("patient reports routes", () => {
  let db: Database.Database;
  let app: Express;

  beforeEach(() => {
    db = createConnection(":memory:");
    app = createApp(db);
  });

  async function createTestPatient() {
    const response = await supertest(app).post("/patients").send({
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    return response.body;
  }

  describe("POST /patients/:id/reports", () => {
    it("creates a report with the minimal valid payload", async () => {
      const patient = await createTestPatient();
      const response = await supertest(app)
        .post(`/patients/${patient.id}/reports`)
        .send({ doctor_name: "Dr. Martin", exam_date: "2026-08-13" });
      expect(response.status).toBe(201);
      expect(response.body.patient_id).toBe(patient.id);
      expect(response.body.doctor_name).toBe("Dr. Martin");
      expect(response.body.tsa_findings_text).toBe("");
    });

    it("stores TSA findings and computes IPS from the four pressure inputs", async () => {
      const patient = await createTestPatient();
      const response = await supertest(app)
        .post(`/patients/${patient.id}/reports`)
        .send({
          doctor_name: "Dr. Martin",
          exam_date: "2026-08-13",
          tsa: { findings_text: "Plaque modérée", imt_droit: 0.62 },
          membres_inferieurs: {
            pression_cheville_droite: 120,
            pression_cheville_gauche: 130,
            pression_bras_droit: 130,
            pression_bras_gauche: 140,
          },
        });
      expect(response.status).toBe(201);
      expect(response.body.tsa_findings_text).toBe("Plaque modérée");
      expect(response.body.tsa_imt_droit).toBe(0.62);
      expect(response.body.mi_ips_droit).toBe(0.86);
      expect(response.body.mi_ips_gauche).toBe(0.93);
    });

    it("returns 404 for an unknown patient", async () => {
      const response = await supertest(app)
        .post("/patients/999/reports")
        .send({ doctor_name: "Dr. Martin", exam_date: "2026-08-13" });
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "PATIENT_NOT_FOUND" });
    });

    it("returns 400 for a missing doctor_name", async () => {
      const patient = await createTestPatient();
      const response = await supertest(app)
        .post(`/patients/${patient.id}/reports`)
        .send({ exam_date: "2026-08-13" });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "DOCTOR_NAME_REQUIRED" });
    });

    it("returns 404 (not 400) for an unknown patient with an invalid body", async () => {
      const response = await supertest(app)
        .post("/patients/999/reports")
        .send({});
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "PATIENT_NOT_FOUND" });
    });
  });

  describe("GET /patients/:id/reports", () => {
    it("lists a patient's reports newest first", async () => {
      const patient = await createTestPatient();
      await supertest(app)
        .post(`/patients/${patient.id}/reports`)
        .send({ doctor_name: "Dr. Martin", exam_date: "2026-08-13" });
      const second = await supertest(app)
        .post(`/patients/${patient.id}/reports`)
        .send({ doctor_name: "Dr. Leroy", exam_date: "2026-08-14" });
      const response = await supertest(app).get(`/patients/${patient.id}/reports`);
      expect(response.status).toBe(200);
      expect(response.body[0].id).toBe(second.body.id);
      expect(response.body).toHaveLength(2);
    });

    it("returns an empty array when a patient has no reports", async () => {
      const patient = await createTestPatient();
      const response = await supertest(app).get(`/patients/${patient.id}/reports`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("returns 404 for an unknown patient", async () => {
      const response = await supertest(app).get("/patients/999/reports");
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "PATIENT_NOT_FOUND" });
    });
  });
});

describe("GET /reports/:id/pdf", () => {
  let db: Database.Database;
  let app: Express;

  beforeEach(() => {
    db = createConnection(":memory:");
    app = createApp(db);
  });

  async function createTestReport() {
    const patientResponse = await supertest(app).post("/patients").send({
      first_name: "Jean",
      last_name: "Dupont",
      dob: "1958-03-12",
      sex: "M",
    });
    const reportResponse = await supertest(app)
      .post(`/patients/${patientResponse.body.id}/reports`)
      .send({ doctor_name: "Dr. Martin", exam_date: "2026-08-13" });
    return reportResponse.body;
  }

  it("streams a PDF for an existing report", async () => {
    const report = await createTestReport();
    const response = await supertest(app).get(`/reports/${report.id}/pdf`);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.body.slice(0, 4).toString()).toBe("%PDF");
  });

  it("sets a Content-Disposition header with a descriptive filename", async () => {
    const report = await createTestReport();
    const response = await supertest(app).get(`/reports/${report.id}/pdf`);
    expect(response.headers["content-disposition"]).toBe(
      `inline; filename="Rapport_Echodoppler_DUPONT_Jean_2026-08-13_${report.id}.pdf"; ` +
        `filename*=UTF-8''Rapport_Echodoppler_DUPONT_Jean_2026-08-13_${report.id}.pdf`,
    );
  });

  it("returns 404 for an unknown report", async () => {
    const response = await supertest(app).get("/reports/999/pdf");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "REPORT_NOT_FOUND" });
  });

  it("returns 404 for a non-numeric report id", async () => {
    const response = await supertest(app).get("/reports/not-a-number/pdf");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "REPORT_NOT_FOUND" });
  });
});
