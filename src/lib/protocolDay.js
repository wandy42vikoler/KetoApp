export function protocolDayNumber(protocolStartDate) {
  if (!protocolStartDate) return null
  const start = new Date(`${protocolStartDate}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today - start) / (24 * 60 * 60 * 1000))
  return diffDays + 1
}

// Days remaining until a target event (e.g. a trip departure). Positive =
// upcoming, 0 = today, negative = past.
export function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(`${dateStr}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / (24 * 60 * 60 * 1000))
}
