export function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  const value = Number(trimmed)
  return Number.isNaN(value) ? null : value
}

// Live preview only — mirrors the server-side formula in
// packages/api-gateway/src/db/reports.ts so the doctor sees the ratio as he
// types, but the stored value is always the one the server computes.
export function computeIpsPreview(
  chevilleRaw: string,
  brasDroitRaw: string,
  brasGaucheRaw: string,
): number | null {
  const cheville = parseOptionalNumber(chevilleRaw)
  const brasDroit = parseOptionalNumber(brasDroitRaw)
  const brasGauche = parseOptionalNumber(brasGaucheRaw)
  if (cheville === null || brasDroit === null || brasGauche === null) return null
  return Math.round((cheville / Math.max(brasDroit, brasGauche)) * 100) / 100
}
