// Simple deterministic guideline (33ml/kg, +0.5L on activity days for extra
// fluid/electrolyte turnover) — not a logged value, just a target shown on
// the Dashboard.
export function recommendedWaterLiters(weightKg, dayType) {
  if (!weightKg) return null
  const base = weightKg * 0.033
  const bump = dayType === 'activity' ? 0.5 : 0
  return Math.round((base + bump) * 10) / 10
}
