export const RISK_FACTOR_KEYS = [
  "diabetes",
  "hypertension",
  "cholesterol",
  "obesity",
  "vertigo",
  "carotid_bruit",
  "avc",
  "smoking",
] as const;

export type RiskFactorKey = (typeof RISK_FACTOR_KEYS)[number];

export const RISK_FACTOR_LABELS: Record<RiskFactorKey, string> = {
  diabetes: "Diabète",
  hypertension: "Hypertension",
  cholesterol: "Hypercholestérolémie",
  obesity: "Obésité",
  vertigo: "Vertiges",
  carotid_bruit: "Souffle carotidien",
  avc: "AVC",
  smoking: "Tabagisme",
};
