import { useEffect, useState } from 'react'
import { approveRequest, listRequests, refuseRequest } from '../../lib/managerApi'
import { ApiError } from '../../lib/api'
import type { ReservationRequest } from '../../types/reservation'
import { formatDate } from '../../lib/format'

interface RequestsPanelProps {
  idToken: string
}

function RequestsPanel({ idToken }: RequestsPanelProps) {
  const [requests, setRequests] = useState<ReservationRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  function load() {
    listRequests(idToken)
      .then((data) => {
        setRequests(data)
        setError(null)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur inattendue.'))
  }

  useEffect(load, [idToken])

  async function handleApprove(reservationId: string) {
    setBusyId(reservationId)
    try {
      await approveRequest(idToken, reservationId)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRefuse(reservationId: string) {
    const reason = window.prompt('Motif du refus ?') ?? ''
    setBusyId(reservationId)
    try {
      await refuseRequest(idToken, reservationId, reason)
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

  if (!requests) {
    return <p>Chargement…</p>
  }

  if (requests.length === 0) {
    return <p>Aucune demande en attente.</p>
  }

  return (
    <table className="manager-table">
      <thead>
        <tr>
          <th>Référence</th>
          <th>Dates</th>
          <th>Demandeur</th>
          <th>Lot</th>
          <th>Montant</th>
          <th>Signalements</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {requests.map((r) => (
          <tr key={r.reservation_id}>
            <td>{r.reference}</td>
            <td>{formatDate(r.start_at)} → {formatDate(r.end_at)}</td>
            <td>{r.requester_email}<br />{r.requester_contact}</td>
            <td>{r.requester_lot}</td>
            <td>{r.amount_total} €</td>
            <td>
              {r.hasConflict && <span className="manager-flag manager-flag-conflict">Conflit de dates</span>}
              {r.unknownAddress && <span className="manager-flag manager-flag-unknown">Adresse inconnue</span>}
            </td>
            <td className="manager-actions">
              <button
                type="button"
                className="cta"
                disabled={busyId === r.reservation_id}
                onClick={() => handleApprove(r.reservation_id)}
              >
                Approuver
              </button>
              <button
                type="button"
                className="cta cta-secondary"
                disabled={busyId === r.reservation_id}
                onClick={() => handleRefuse(r.reservation_id)}
              >
                Refuser
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default RequestsPanel
