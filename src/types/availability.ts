export interface BlockedRange {
  start_at: string
  end_at: string
}

export interface PublicResource {
  resource_id: string
  name: string
  booking_unit: string
  price_per_unit: number
  cleaning_fee: number
  check_in_time: string
  check_out_time: string
  max_units: number
  calendar_id: string
}
