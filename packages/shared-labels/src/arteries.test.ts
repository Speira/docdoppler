import { describe, expect, it } from "vitest";
import {
  MI_ARTERY_KEYS,
  MI_ARTERY_LABELS,
  MI_SIDES,
  SPECTRE_OPTIONS,
  fluxForSpectre,
} from "./arteries.js";

describe("fluxForSpectre", () => {
  it("derives laminaire from triphasique", () => {
    expect(fluxForSpectre("triphasique")).toBe("laminaire");
  });

  it("derives amortie from monophasique", () => {
    expect(fluxForSpectre("monophasique")).toBe("amortie");
  });

  it("derives nothing from diphasique", () => {
    expect(fluxForSpectre("diphasique")).toBeNull();
  });

  it("derives nothing from an unexamined or unknown spectre", () => {
    expect(fluxForSpectre("")).toBeNull();
    expect(fluxForSpectre("bruit")).toBeNull();
  });
});

describe("artery constants", () => {
  it("lists the six arteries in print order", () => {
    expect(MI_ARTERY_KEYS).toEqual([
      "afc",
      "afs",
      "poplitee",
      "tibiale_anterieure",
      "tibiale_posterieure",
      "fibulaire",
    ]);
  });

  it("labels every artery in French", () => {
    for (const key of MI_ARTERY_KEYS) {
      expect(MI_ARTERY_LABELS[key].length).toBeGreaterThan(0);
    }
    expect(MI_ARTERY_LABELS.afc).toBe("Artère fémorale commune (AFC)");
  });

  it("lists droite before gauche", () => {
    expect(MI_SIDES).toEqual(["droite", "gauche"]);
  });

  it("offers the three spectre values", () => {
    expect(SPECTRE_OPTIONS).toEqual([
      "monophasique",
      "diphasique",
      "triphasique",
    ]);
  });
});
