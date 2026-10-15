import { useEffect, useState } from 'react'
import { adminCancel, confirmPayment, listReservations } from '../../lib/managerApi'
import { ApiError } from '../../lib/api'
import type { Reservation } from '../../types/reservation'
import { formatDate } from '../../lib/format'

interface ReservationsPanelProps {
  idToken: string
}

const STATUS_LABELS: Record<string, string> = {
  requested: 'Demandée',
  pending_payment: 'En attente de paiement',
  confirmed: 'Confirmée',
  completed: 'Terminée',
  refused: 'Refusée',
  expired: 'Expirée',
  cancelled: 'Annulée',
}

function ReservationsPanel({ idToken }: ReservationsPanelProps) {
  const [reservations, setReservations] = useState<Reservation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  function load() {
    listReservations(idToken)
      .then((data) => {
        setReservations(data)
        setError(null)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur inattendue.'))
  }

  useEffect(load, [idToken])

  async function handleConfirmPayment(reservationId: string) {
    setBusyId(reservationId)
    try {
      await confirmPayment(idToken, reservationId)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleCancel(reservationId: string) {
    const reason = window.prompt('Motif de l\'annulation ?') ?? ''
    setBusyId(reservationId)
    try {
      await adminCancel(idToken, reservationId, reason)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setBusyId(null)
    }
  }

  if (error) {
    return <p className="manager-error">{error}</p>
  }

  if (!reservations) {
    return <p>Chargement…</p>
  }

  if (reservations.length === 0) {
    return <p>Aucune réservation.</p>
  }

  return (
    <table className="manager-table">
      <thead>
        <tr>
          <th>Référence</th>
          <th>Dates</th>
          <th>Demandeur</th>
          <th>Statut</th>
          <th>Montant</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {reservations.map((r) => (
          <tr key={r.reservation_id}>
            <td>{r.reference}</td>
            <td>{formatDate(r.start_at)} → {formatDate(r.end_at)}</td>
            <td>{r.requester_email}</td>
            <td>{STATUS_LABELS[r.status] ?? r.status}</td>
            <td>{r.amount_total} €</td>
            <td className="manager-actions">
              {r.status === 'pending_payment' && (
                <button
                  type="button"
                  className="cta"
                  disabled={busyId === r.reservation_id}
                  onClick={() => handleConfirmPayment(r.reservation_id)}
                >
                  Virement reçu
                </button>
              )}
              {(r.status === 'pending_payment' || r.status === 'confirmed') && (
                <button
                  type="button"
                  className="cta cta-secondary"
                  disabled={busyId === r.reservation_id}
                  onClick={() => handleCancel(r.reservation_id)}
                >
                  Annuler
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default ReservationsPanel
