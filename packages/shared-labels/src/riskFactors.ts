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
  hypertension: "HTA",
  cholesterol: "Dyslipidémie",
  obesity: "Obésité",
  vertigo: "Vertiges",
  carotid_bruit: "Souffle carotidien",
  avc: "AVC",
  smoking: "Tabagisme",
};

// Set factors (stored as SQLite 0/1) as one readable line, in form order —
// shared by the report PDF and the DICOM worklist so both read the same.
// null when none is set: the PDF and the worklist each need their own fallback.
export function formatRiskFactorList(
  flags: Partial<Record<RiskFactorKey, number>> | undefined,
): string | null {
  const labels = RISK_FACTOR_KEYS.filter((key) => flags?.[key] === 1).map(
    (key) => RISK_FACTOR_LABELS[key],
  );
  return labels.length === 0 ? null : labels.join(", ");
}
