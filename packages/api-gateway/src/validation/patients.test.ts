import { describe, expect, it } from "vitest";
import {
  validateCreatePatient,
  validateUpdatePatient,
  validateRiskFactorsEntry,
} from "./patients.js";

describe("validateCreatePatient", () => {
  const valid = {
    first_name: "Jean",
    last_name: "Dupont",
    dob: "1958-03-12",
    sex: "M",
  };

  it("accepts a fully valid payload", () => {
    const result = validateCreatePatient(valid);
    expect(result.valid).toBe(true);
  });

  it("rejects a missing first_name", () => {
    const result = validateCreatePatient({ ...valid, first_name: "" });
    expect(result).toEqual({ valid: false, error: "FIRST_NAME_REQUIRED" });
  });

  it("rejects a missing last_name", () => {
    const result = validateCreatePatient({ ...valid, last_name: "" });
    expect(result).toEqual({ valid: false, error: "LAST_NAME_REQUIRED" });
  });

  it("rejects a missing dob", () => {
    const result = validateCreatePatient({ ...valid, dob: "" });
    expect(result).toEqual({ valid: false, error: "DOB_REQUIRED" });
  });

  it("rejects a malformed dob", () => {
    const result = validateCreatePatient({ ...valid, dob: "12/03/1958" });
    expect(result).toEqual({ valid: false, error: "DOB_INVALID" });
  });

  it("rejects an impossible calendar date", () => {
    const result = validateCreatePatient({ ...valid, dob: "1958-02-30" });
    expect(result).toEqual({ valid: false, error: "DOB_INVALID" });
  });

  it("rejects a dob in the future", () => {
    const result = validateCreatePatient({ ...valid, dob: "2999-01-01" });
    expect(result).toEqual({ valid: false, error: "DOB_IN_FUTURE" });
  });

  it("rejects a missing sex", () => {
    const result = validateCreatePatient({ ...valid, sex: "" });
    expect(result).toEqual({ valid: false, error: "SEX_REQUIRED" });
  });

  it("rejects an invalid sex", () => {
    const result = validateCreatePatient({ ...valid, sex: "X" });
    expect(result).toEqual({ valid: false, error: "SEX_INVALID" });
  });

  it("defaults exam_date to today when omitted", () => {
    const result = validateCreatePatient(valid);
    const today = new Date().toISOString().slice(0, 10);
    expect(result).toEqual({ valid: true, data: { ...valid, exam_date: today } });
  });

  it("accepts an explicit exam_date", () => {
    const result = validateCreatePatient({ ...valid, exam_date: "2026-09-01" });
    expect(result).toEqual({
      valid: true,
      data: { ...valid, exam_date: "2026-09-01" },
    });
  });

  it("rejects a malformed exam_date", () => {
    const result = validateCreatePatient({ ...valid, exam_date: "01/09/2026" });
    expect(result).toEqual({ valid: false, error: "EXAM_DATE_INVALID" });
  });

  it("rejects an impossible calendar exam_date", () => {
    const result = validateCreatePatient({ ...valid, exam_date: "2026-02-30" });
    expect(result).toEqual({ valid: false, error: "EXAM_DATE_INVALID" });
  });
});

describe("validateUpdatePatient", () => {
  it("accepts an empty payload as a no-op update", () => {
    expect(validateUpdatePatient({})).toEqual({ valid: true, data: {} });
  });

  it("accepts a single valid field", () => {
    expect(validateUpdatePatient({ first_name: "Jeanne" })).toEqual({
      valid: true,
      data: { first_name: "Jeanne" },
    });
  });

  it("rejects an empty string for a provided field", () => {
    const result = validateUpdatePatient({ first_name: "" });
    expect(result).toEqual({ valid: false, error: "FIRST_NAME_REQUIRED" });
  });

  it("rejects an invalid sex", () => {
    const result = validateUpdatePatient({ sex: "X" });
    expect(result).toEqual({ valid: false, error: "SEX_INVALID" });
  });

  it("rejects a malformed dob", () => {
    const result = validateUpdatePatient({ dob: "not-a-date" });
    expect(result).toEqual({ valid: false, error: "DOB_INVALID" });
  });

  it("accepts a valid exam_date", () => {
    expect(validateUpdatePatient({ exam_date: "2026-09-01" })).toEqual({
      valid: true,
      data: { exam_date: "2026-09-01" },
    });
  });

  it("rejects a malformed exam_date", () => {
    const result = validateUpdatePatient({ exam_date: "not-a-date" });
    expect(result).toEqual({ valid: false, error: "EXAM_DATE_INVALID" });
  });

  it("leaves exam_date untouched when omitted", () => {
    expect(validateUpdatePatient({ first_name: "Jeanne" })).toEqual({
      valid: true,
      data: { first_name: "Jeanne" },
    });
  });
});

describe("validateRiskFactorsEntry", () => {
  it("accepts an empty payload", () => {
    expect(validateRiskFactorsEntry({})).toEqual({ valid: true, data: {} });
  });

  it("accepts a subset of boolean fields", () => {
    expect(validateRiskFactorsEntry({ diabetes: true, avc: false })).toEqual({
      valid: true,
      data: { diabetes: true, avc: false },
    });
  });

  it("accepts smoking as a valid field", () => {
    expect(validateRiskFactorsEntry({ smoking: true })).toEqual({
      valid: true,
      data: { smoking: true },
    });
  });

  it("rejects a non-boolean field value", () => {
    const result = validateRiskFactorsEntry({ diabetes: "yes" });
    expect(result).toEqual({
      valid: false,
      error: "RISK_FACTOR_VALUE_INVALID",
    });
  });
});
