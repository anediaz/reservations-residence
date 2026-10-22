export function formatDate(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fr-FR')
}

const BOOKING_UNIT_LABELS: Record<string, string> = {
  nights: 'nuit',
  hours: 'heure',
  days: 'jour',
}

export function bookingUnitLabel(unit: string, count = 1): string {
  const label = BOOKING_UNIT_LABELS[unit] || unit || 'unité'
  return count > 1 ? `${label}s` : label
}
