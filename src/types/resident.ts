export type ResidentRole = 'resident' | 'admin' | 'super_admin'
export type ResidentStatus = 'active' | 'inactive'

export interface Resident {
  resident_id: string
  email: string
  lot: string
  role: ResidentRole
  status: ResidentStatus
  created_at: string
}
