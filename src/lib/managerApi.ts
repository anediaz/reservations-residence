import { callApi } from './api'
import type { Reservation, ReservationRequest, ReservationStatus } from '../types/reservation'

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
