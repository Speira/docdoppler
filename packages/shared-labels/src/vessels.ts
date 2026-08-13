export const VESSEL_KEYS = [
  "carotide",
  "artere_membre_sup",
  "veine_membre_sup",
  "artere_membre_inf",
  "veine_membre_inf",
] as const;

export type VesselKey = (typeof VESSEL_KEYS)[number];

export const VESSEL_LABELS: Record<VesselKey, string> = {
  carotide: "Carotide",
  artere_membre_sup: "Artère membre supérieur",
  veine_membre_sup: "Veine membre supérieur",
  artere_membre_inf: "Artère membre inférieur",
  veine_membre_inf: "Veine membre inférieur",
};
