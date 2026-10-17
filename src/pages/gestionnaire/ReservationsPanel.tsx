import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminCancel, blockDates, confirmPayment, listReservations, listResources } from '../../lib/managerApi'
import { ApiError } from '../../lib/api'
import type { Reservation } from '../../types/reservation'
import type { ResourceConfig } from '../../types/config'
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
  blocked: 'Bloquée',
}

function ReservationsPanel({ idToken }: ReservationsPanelProps) {
  const [reservations, setReservations] = useState<Reservation[] | null>(null)
  const [resources, setResources] = useState<ResourceConfig[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [blockResourceId, setBlockResourceId] = useState('')
  const [blockStart, setBlockStart] = useState('')
  const [blockEnd, setBlockEnd] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [blockSubmitting, setBlockSubmitting] = useState(false)
  const [searchParams] = useSearchParams()
  const highlightedId = searchParams.get('reservationId')
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null)

  function load() {
    listReservations(idToken)
      .then((data) => {
        setReservations(data)
        setError(null)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur inattendue.'))
  }

  useEffect(load, [idToken])

  useEffect(() => {
    if (highlightedId && reservations) {
      highlightedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedId, reservations])

  useEffect(() => {
    listResources(idToken)
      .then((data) => {
        setResources(data)
        setBlockResourceId((current) => current || data[0]?.resource_id || '')
      })
      .catch(() => undefined)
  }, [idToken])

  async function handleBlockDates(event: React.FormEvent) {
    event.preventDefault()
    setBlockSubmitting(true)
    try {
      await blockDates(idToken, blockResourceId, blockStart, blockEnd, blockReason)
      setBlockStart('')
      setBlockEnd('')
      setBlockReason('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setBlockSubmitting(false)
    }
  }

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

  return (
    <div>
      {error && <p className="manager-error">{error}</p>}

      {!reservations ? (
        <p>Chargement…</p>
      ) : reservations.length === 0 ? (
        <p>Aucune réservation.</p>
      ) : (
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
              <tr
                key={r.reservation_id}
                ref={r.reservation_id === highlightedId ? highlightedRowRef : null}
                className={r.reservation_id === highlightedId ? 'manager-row-highlighted' : undefined}
              >
                <td>{r.reference}</td>
                <td>{formatDate(r.start_at)} → {formatDate(r.end_at)}</td>
                <td>{r.status === 'blocked' ? r.requester_contact : r.requester_email}</td>
                <td>{STATUS_LABELS[r.status] ?? r.status}</td>
                <td>{r.status === 'blocked' ? '—' : `${r.amount_total} €`}</td>
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
                  {(r.status === 'pending_payment' || r.status === 'confirmed' || r.status === 'blocked') && (
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
      )}

      <form className="manager-config-form" onSubmit={handleBlockDates}>
        <h3 className="manager-config-form-title">Bloquer des dates</h3>
        <label>
          Ressource
          <select value={blockResourceId} onChange={(e) => setBlockResourceId(e.target.value)}>
            {resources.map((r) => (
              <option key={r.resource_id} value={r.resource_id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Du
          <input type="date" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} required />
        </label>
        <label>
          Au
          <input type="date" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} required />
        </label>
        <label>
          Motif
          <input
            type="text"
            placeholder="Travaux, AG, ménage exceptionnel…"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
          />
        </label>
        <button type="submit" className="cta" disabled={blockSubmitting || !blockResourceId}>
          Bloquer
        </button>
      </form>
    </div>
  )
}

export default ReservationsPanel
