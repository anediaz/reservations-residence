import type { PublicResource } from '../types/availability'
import './ResourcePicker.css'

const BOOKING_UNIT_LABELS: Record<string, string> = {
  nights: 'nuit',
  hours: 'heure',
  days: 'jour',
}

function bookingUnitLabel(unit: string): string {
  return BOOKING_UNIT_LABELS[unit] || unit || 'unité'
}

interface ResourcePickerProps {
  resources: PublicResource[]
  selectedId: string
  onSelect: (resourceId: string) => void
}

function ResourcePicker({ resources, selectedId, onSelect }: ResourcePickerProps) {
  if (resources.length === 0) {
    return <p>Aucune ressource disponible.</p>
  }

  return (
    <div className="resource-picker">
      {resources.map((r) => (
        <button
          key={r.resource_id}
          type="button"
          className={r.resource_id === selectedId ? 'resource-picker-card resource-picker-card-selected' : 'resource-picker-card'}
          onClick={() => onSelect(r.resource_id)}
        >
          <span className="resource-picker-name">{r.name}</span>
          <span className="resource-picker-price">{r.price_per_unit} € / {bookingUnitLabel(r.booking_unit)}</span>
        </button>
      ))}
    </div>
  )
}

export default ResourcePicker
