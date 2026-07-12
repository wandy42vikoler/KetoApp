export function protocolDayNumber(protocolStartDate) {
  if (!protocolStartDate) return null
  const start = new Date(`${protocolStartDate}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today - start) / (24 * 60 * 60 * 1000))
  return diffDays + 1
}
