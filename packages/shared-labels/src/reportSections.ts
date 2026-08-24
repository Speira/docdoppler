export const REPORT_SECTION_KEYS = [
  "tsa",
  "aorte_abdominale",
  "membres_inferieurs",
] as const;

export type ReportSectionKey = (typeof REPORT_SECTION_KEYS)[number];

export const REPORT_SECTION_LABELS: Record<ReportSectionKey, string> = {
  tsa: "Troncs supra-aortiques (TSA)",
  aorte_abdominale: "Aorte abdominale",
  membres_inferieurs: "Artères des membres inférieurs",
};

export const REPORT_FIELD_LABELS = {
  indication: "Indication",
  correspondant_dossier: "Correspondant du dossier",
  conclusion: "Conclusion",
  tsa_imt_droit: "IMT droit (mm)",
  tsa_imt_gauche: "IMT gauche (mm)",
  tsa_aci_acc_ratio_droit: "Ratio ACI/ACC droit",
  tsa_aci_acc_ratio_gauche: "Ratio ACI/ACC gauche",
  tsa_findings_text: "Constatations",
  aorte_diametre: "Diamètre / calibre",
  aorte_anevrisme: "Anévrisme",
  aorte_anevrisme_diametre_mm: "Diamètre de l'anévrisme (mm)",
  aorte_findings_text: "Constatations",
  mi_pression_cheville_droite: "Pression systolique cheville droite (mmHg)",
  mi_pression_cheville_gauche: "Pression systolique cheville gauche (mmHg)",
  mi_pression_bras_droit: "Pression systolique bras droit (mmHg)",
  mi_pression_bras_gauche: "Pression systolique bras gauche (mmHg)",
  mi_ips_droit: "IPS droit",
  mi_ips_gauche: "IPS gauche",
  mi_findings_text: "Constatations",
} as const;

export type ReportFieldKey = keyof typeof REPORT_FIELD_LABELS;
