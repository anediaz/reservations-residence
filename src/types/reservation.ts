export type ReservationStatus =
  | 'requested'
  | 'pending_payment'
  | 'confirmed'
  | 'completed'
  | 'refused'
  | 'expired'
  | 'cancelled'

export interface ReservationRequest {
  reservation_id: string
  reference: string
  resource_id: string
  requester_email: string
  requester_lot: string
  requester_contact: string
  start_at: string
  end_at: string
  units: number
  amount_total: number
  hasConflict: boolean
  unknownAddress: boolean
}

export interface Reservation {
  reservation_id: string
  reference: string
  resource_id: string
  resident_id: string
  requester_email: string
  requester_lot: string
  requester_contact: string
  start_at: string
  end_at: string
  units: number
  status: ReservationStatus
  amount_units: number
  amount_cleaning: number
  amount_total: number
  hold_expires_at: string
  paid_at: string
  refund_status: string
  cleaning_status: string
  calendar_event_id: string
}
