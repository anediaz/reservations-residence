import { callApi } from './api'
import type { Reservation, ReservationRequest, ReservationStatus } from '../types/reservation'
import type { Resident } from '../types/resident'
import type { ResourceConfig } from '../types/config'

export function listRequests(idToken: string): Promise<ReservationRequest[]> {
  return callApi('listRequests', { idToken })
}

export function approveRequest(idToken: string, reservationId: string): Promise<{ ok: true }> {
  return callApi('approveRequest', { idToken, reservationId })
}

export function refuseRequest(idToken: string, reservationId: string, reason: string): Promise<{ ok: true }> {
  return callApi('refuseRequest', { idToken, reservationId, reason })
}

export function confirmPayment(idToken: string, reservationId: string): Promise<{ ok: true }> {
  return callApi('confirmPayment', { idToken, reservationId })
}

export function adminCancel(idToken: string, reservationId: string, reason: string): Promise<{ ok: true }> {
  return callApi('adminCancel', { idToken, reservationId, reason })
}

export function listReservations(idToken: string, status?: ReservationStatus): Promise<Reservation[]> {
  return callApi('listReservations', { idToken, filters: status ? { status } : {} })
}

export function listResidents(idToken: string): Promise<Resident[]> {
  return callApi('listResidents', { idToken })
}

export function upsertResident(
  idToken: string,
  resident: Partial<Pick<Resident, 'resident_id' | 'email' | 'lot' | 'role' | 'status'>>
): Promise<{ ok: true; resident_id: string }> {
  return callApi('upsertResident', { idToken, resident })
}

export function revokeResident(idToken: string, residentId: string): Promise<{ ok: true }> {
  return callApi('revokeResident', { idToken, residentId })
}

export function deleteResident(idToken: string, residentId: string): Promise<{ ok: true }> {
  return callApi('deleteResident', { idToken, residentId })
}

export function listResources(idToken: string): Promise<ResourceConfig[]> {
  return callApi('listResources', { idToken })
}

export function upsertResource(idToken: string, resource: ResourceConfig): Promise<{ ok: true; resource_id: string }> {
  return callApi('upsertResource', { idToken, resource })
}

export function deleteResource(idToken: string, resourceId: string): Promise<{ ok: true }> {
  return callApi('deleteResource', { idToken, resourceId })
}
