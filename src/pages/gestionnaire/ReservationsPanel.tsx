import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  adminCancel,
  approveRequest,
  blockDates,
  confirmPayment,
  listReservations,
  listRequests,
  listResources,
  refuseRequest,
} from '../../lib/managerApi'
import { ApiError } from '../../lib/api'
import { invalidate } from '../../lib/cache'
import { useCachedQuery } from '../../lib/useCachedQuery'
import { getAvailability } from '../../lib/residentApi'
import type { BlockedRange } from '../../types/availability'
import { formatDate } from '../../lib/format'
import TableSkeleton from '../../components/TableSkeleton'
import DateRangeCalendar from '../../components/DateRangeCalendar'
import ReloadButton from '../../components/ReloadButton'
import Spinner from '../../components/Spinner'

const RESERVATION_COLUMNS = ['Référence', 'Dates', 'Demandeur', 'Statut', 'Montant', '']

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
  const requestsKey = `listRequests:${idToken}`
  const reservationsKey = `listReservations:${idToken}`
  const resourcesKey = `listResources:${idToken}`

  const { data: requests, error: requestsError, loading: requestsLoading, reload: reloadRequests } =
    useCachedQuery(requestsKey, () => listRequests(idToken))
  const {
    data: reservations,
    error: reservationsError,
    loading: reservationsLoading,
    reload: reloadReservations,
  } = useCachedQuery(reservationsKey, () => listReservations(idToken))
  const { data: resources } = useCachedQuery(resourcesKey, () => listResources(idToken))

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

  const availabilityKey = blockResourceId ? `getAvailability:${blockResourceId}` : null
  const { data: blockedData } = useCachedQuery<BlockedRange[]>(availabilityKey, () =>
    getAvailability(blockResourceId)
  )
  const blocked = blockedData ?? []

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlockResourceId((current) => current || resources?.[0]?.resource_id || '')
  }, [resources])

  useEffect(() => {
    if (highlightedId && reservations) {
      highlightedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedId, reservations])

  function refreshAfterMutation() {
    invalidate(requestsKey)
    invalidate(reservationsKey)
  }

  async function handleApprove(reservationId: string) {
    setBusyId(reservationId)
    try {
      await approveRequest(idToken, reservationId)
      refreshAfterMutation()
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
      refreshAfterMutation()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleBlockDates(event: React.FormEvent) {
    event.preventDefault()
    setBlockSubmitting(true)
    try {
      await blockDates(idToken, blockResourceId, blockStart, blockEnd, blockReason)
      setBlockStart('')
      setBlockEnd('')
      setBlockReason('')
      refreshAfterMutation()
      if (availabilityKey) invalidate(availabilityKey)
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
      refreshAfterMutation()
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
      refreshAfterMutation()
      if (availabilityKey) invalidate(availabilityKey)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setBusyId(null)
    }
  }

  const history = reservations?.filter((r) => r.status !== 'requested') ?? null
  const todayIso = new Date().toISOString().slice(0, 10)
  const isUpcoming = (endAt: string) => endAt.slice(0, 10) >= todayIso
  const upcoming = history?.filter((r) => isUpcoming(r.end_at)) ?? null
  const past = history?.filter((r) => !isUpcoming(r.end_at)) ?? null
  const loadError = requestsError || reservationsError

  function renderReservationRow(r: NonNullable<typeof reservations>[number]) {
    return (
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
        <td>
          <div className="manager-actions">
            {r.status === 'pending_payment' && (
              <button
                type="button"
                className="cta"
                disabled={busyId === r.reservation_id}
                onClick={() => handleConfirmPayment(r.reservation_id)}
              >
                {busyId === r.reservation_id && <Spinner />}
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
                {busyId === r.reservation_id && <Spinner />}
                Annuler
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div>
      {(error || loadError) && <p className="manager-error">{error ?? loadError}</p>}

      {requests === null ? null : requests.length > 0 ? (
        <div className="manager-pending-block">
          <div className="manager-panel-header">
            <h2 className="manager-pending-title">Demandes en attente ({requests.length})</h2>
            <ReloadButton onClick={reloadRequests} loading={requestsLoading} />
          </div>
          <table className="manager-table manager-table-requests">
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
                    {r.lotMismatch && <span className="manager-flag manager-flag-unknown">Lot incohérent</span>}
                  </td>
                  <td>
                    <div className="manager-actions">
                      <button
                        type="button"
                        className="cta"
                        disabled={busyId === r.reservation_id}
                        onClick={() => handleApprove(r.reservation_id)}
                      >
                        {busyId === r.reservation_id && <Spinner />}
                        Approuver
                      </button>
                      <button
                        type="button"
                        className="cta cta-secondary"
                        disabled={busyId === r.reservation_id}
                        onClick={() => handleRefuse(r.reservation_id)}
                      >
                        {busyId === r.reservation_id && <Spinner />}
                        Refuser
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="manager-panel-header">
        <h2 className="manager-history-title">Réservations à venir</h2>
        <ReloadButton onClick={reloadReservations} loading={reservationsLoading} />
      </div>

      {upcoming === null ? (
        <TableSkeleton columns={RESERVATION_COLUMNS} className="manager-table-reservations" />
      ) : upcoming.length === 0 ? (
        <p>Aucune réservation à venir.</p>
      ) : (
        <table className="manager-table manager-table-reservations">
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
          <tbody>{upcoming.map(renderReservationRow)}</tbody>
        </table>
      )}

      <div className="manager-panel-header manager-section-divider">
        <h2 className="manager-history-title">Historique des réservations</h2>
      </div>

      {past === null ? (
        <TableSkeleton columns={RESERVATION_COLUMNS} className="manager-table-reservations" />
      ) : past.length === 0 ? (
        <p>Aucune réservation passée.</p>
      ) : (
        <table className="manager-table manager-table-reservations">
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
          <tbody>{past.map(renderReservationRow)}</tbody>
        </table>
      )}

      <form className="manager-config-form" onSubmit={handleBlockDates}>
        <h3 className="manager-config-form-title">Bloquer des dates</h3>
        <label>
          Ressource
          <select value={blockResourceId} onChange={(e) => setBlockResourceId(e.target.value)}>
            {(resources ?? []).map((r) => (
              <option key={r.resource_id} value={r.resource_id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <DateRangeCalendar
          startAt={blockStart}
          endAt={blockEnd}
          onChange={(s, e) => {
            setBlockStart(s)
            setBlockEnd(e)
          }}
          blocked={blocked}
        />
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
          {blockSubmitting && <Spinner />}
          Bloquer
        </button>
      </form>
    </div>
  )
}

export default ReservationsPanel
