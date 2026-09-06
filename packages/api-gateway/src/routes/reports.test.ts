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

    it("round-trips arteres through the endpoint", async () => {
      const patient = await createTestPatient();
      const response = await supertest(app)
        .post(`/patients/${patient.id}/reports`)
        .send({
          doctor_name: "Dr Martin",
          exam_date: "2026-08-13",
          membres_inferieurs: {
            arteres: { droite: { afc: { vsm: 90, spectre: "triphasique" } } },
          },
        });
      expect(response.status).toBe(201);
      expect(response.body.arteres.droite.afc).toEqual({
        vsm: 90,
        spectre: "triphasique",
      });
    });

    it("rejects an invalid spectre with REPORT_FIELD_INVALID", async () => {
      const patient = await createTestPatient();
      const response = await supertest(app)
        .post(`/patients/${patient.id}/reports`)
        .send({
          doctor_name: "Dr Martin",
          exam_date: "2026-08-13",
          membres_inferieurs: { arteres: { droite: { afc: { spectre: "bruit" } } } },
        });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "REPORT_FIELD_INVALID" });
    });
  });

  describe("GET /patients/:id/reports", () => {
    async function addReports(patientId: number, count: number) {
      const ids: number[] = [];
      for (let i = 0; i < count; i += 1) {
        const response = await supertest(app)
          .post(`/patients/${patientId}/reports`)
          .send({ doctor_name: "Dr. Martin", exam_date: "2026-08-13" });
        ids.push(response.body.id);
      }
      return ids;
    }

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
      expect(response.body.items[0].id).toBe(second.body.id);
      expect(response.body.items).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it("returns an empty page when a patient has no reports", async () => {
      const patient = await createTestPatient();
      const response = await supertest(app).get(`/patients/${patient.id}/reports`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ items: [], total: 0, limit: 10, offset: 0 });
    });

    it("returns only the slim projection, without artery data", async () => {
      const patient = await createTestPatient();
      await supertest(app)
        .post(`/patients/${patient.id}/reports`)
        .send({
          doctor_name: "Dr. Martin",
          exam_date: "2026-08-13",
          tsa: { findings_text: "Plaque modérée" },
          membres_inferieurs: {
            arteres: { droite: { afc: { vsm: 90, spectre: "triphasique" } } },
          },
        });

      const response = await supertest(app).get(`/patients/${patient.id}/reports`);

      expect(Object.keys(response.body.items[0]).sort()).toEqual([
        "created_at",
        "exam_date",
        "id",
        "patient_id",
      ]);
    });

    it("applies the default limit and reports the true total", async () => {
      const patient = await createTestPatient();
      await addReports(patient.id, 12);

      const response = await supertest(app).get(`/patients/${patient.id}/reports`);

      expect(response.body.items).toHaveLength(10);
      expect(response.body.total).toBe(12);
      expect(response.body.limit).toBe(10);
      expect(response.body.offset).toBe(0);
    });

    it("honours limit and offset and keeps the pages contiguous", async () => {
      const patient = await createTestPatient();
      await addReports(patient.id, 5);

      const all = await supertest(app).get(`/patients/${patient.id}/reports`);
      const page = await supertest(app).get(
        `/patients/${patient.id}/reports?limit=2&offset=2`,
      );

      expect(page.status).toBe(200);
      expect(page.body.items.map((r: { id: number }) => r.id)).toEqual(
        all.body.items.slice(2, 4).map((r: { id: number }) => r.id),
      );
      expect(page.body.total).toBe(5);
      expect(page.body.limit).toBe(2);
      expect(page.body.offset).toBe(2);
    });

    it("clamps an oversized limit and echoes the one applied", async () => {
      const patient = await createTestPatient();
      const response = await supertest(app).get(
        `/patients/${patient.id}/reports?limit=5000`,
      );
      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(100);
    });

    it("returns 400 for a malformed limit or offset", async () => {
      const patient = await createTestPatient();
      for (const query of ["limit=abc", "limit=0", "limit=-1", "offset=x", "offset=-2"]) {
        const response = await supertest(app).get(
          `/patients/${patient.id}/reports?${query}`,
        );
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "REPORT_PAGINATION_INVALID" });
      }
    });

    it("returns 404 for an unknown patient", async () => {
      const response = await supertest(app).get("/patients/999/reports");
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "PATIENT_NOT_FOUND" });
    });

    it("returns 404 (not 400) for an unknown patient with a bad query", async () => {
      const response = await supertest(app).get("/patients/999/reports?limit=abc");
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
