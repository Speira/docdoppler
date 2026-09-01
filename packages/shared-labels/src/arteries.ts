export const MI_ARTERY_KEYS = [
  "afc",
  "afs",
  "poplitee",
  "tibiale_anterieure",
  "tibiale_posterieure",
  "fibulaire",
] as const;

export type MiArteryKey = (typeof MI_ARTERY_KEYS)[number];

export const MI_ARTERY_LABELS: Record<MiArteryKey, string> = {
  afc: "Artère fémorale commune (AFC)",
  afs: "Artère fémorale superficielle (AFS)",
  poplitee: "Artère poplitée",
  tibiale_anterieure: "Artère tibiale antérieure",
  tibiale_posterieure: "Artère tibiale postérieure",
  fibulaire: "Artère fibulaire",
};

export const MI_SIDES = ["droite", "gauche"] as const;

export type MiSide = (typeof MI_SIDES)[number];

export const MI_SIDE_LABELS: Record<MiSide, string> = {
  droite: "Droite",
  gauche: "Gauche",
};

export const SPECTRE_OPTIONS = [
  "monophasique",
  "diphasique",
  "triphasique",
] as const;

export type Spectre = (typeof SPECTRE_OPTIONS)[number];

// The single source of truth for the Flux clause. Flux is never entered or
// stored — it follows from the spectre. Confirmed with the doctor 2026-09-01:
// triphasique = laminaire, monophasique = amortie, diphasique = say nothing.
export function fluxForSpectre(spectre: string): string | null {
  if (spectre === "triphasique") return "laminaire";
  if (spectre === "monophasique") return "amortie";
  return null;
}
