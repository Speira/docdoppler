import { describe, expect, it } from "vitest";
import { validateWorklistQuery } from "./worklist.js";

describe("validateWorklistQuery", () => {
  it("accepts a valid ISO date", () => {
    const result = validateWorklistQuery({ date: "2026-08-12" });
    expect(result).toEqual({ valid: true, date: "2026-08-12" });
  });

  it("rejects a missing date", () => {
    const result = validateWorklistQuery({});
    expect(result).toEqual({ valid: false, error: "DATE_INVALID" });
  });

  it("rejects a malformed date string", () => {
    const result = validateWorklistQuery({ date: "12/08/2026" });
    expect(result).toEqual({ valid: false, error: "DATE_INVALID" });
  });

  it("rejects a calendar-invalid date", () => {
    const result = validateWorklistQuery({ date: "2026-02-30" });
    expect(result).toEqual({ valid: false, error: "DATE_INVALID" });
  });
});
