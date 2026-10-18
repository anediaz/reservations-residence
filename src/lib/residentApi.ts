import { callApi } from './api'
import type { BlockedRange, PublicResource } from '../types/availability'

export function listResourcesPublic(): Promise<PublicResource[]> {
  return callApi('listResourcesPublic')
}

export function getAvailability(resourceId: string): Promise<BlockedRange[]> {
  return callApi('getAvailability', { resourceId })
}

export interface SubmitReservationPayload {
  resourceId: string
  startAt: string
  endAt: string
  requesterEmail: string
  requesterLot: string
  requesterContact: string
}

export function submitReservationRequest(
  payload: SubmitReservationPayload
): Promise<{ ok: true; reservation_id: string; reference: string }> {
  return callApi('submitReservationRequest', { ...payload })
}
