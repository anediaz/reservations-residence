import { useEffect, useState } from 'react'
import { getAvailability, listResourcesPublic, submitReservationRequest } from '../lib/residentApi'
import { ApiError } from '../lib/api'
import type { BlockedRange, PublicResource } from '../types/availability'
import { formatDate } from '../lib/format'
import './ResidentPage.css'

function datesOverlap(aStart: string, aEnd: string, b: BlockedRange): boolean {
  return new Date(aStart) < new Date(b.end_at) && new Date(b.start_at) < new Date(aEnd)
}

const BOOKING_UNIT_LABELS: Record<string, string> = {
  nights: 'nuit(s)',
  hours: 'heure(s)',
  days: 'jour(s)',
}

function bookingUnitLabel(unit: string): string {
  return BOOKING_UNIT_LABELS[unit] || unit || 'unité(s)'
}

function ResidentPage() {
  const [resources, setResources] = useState<PublicResource[]>([])
  const [resourceId, setResourceId] = useState('')
  const [blocked, setBlocked] = useState<BlockedRange[]>([])
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [requesterEmail, setRequesterEmail] = useState('')
  const [requesterLot, setRequesterLot] = useState('')
  const [requesterContact, setRequesterContact] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ reservation_id: string; reference: string } | null>(null)

  useEffect(() => {
    listResourcesPublic()
      .then((data) => {
        setResources(data)
        setResourceId((current) => current || data[0]?.resource_id || '')
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur inattendue.'))
  }, [])

  useEffect(() => {
    if (!resourceId) return
    getAvailability(resourceId)
      .then(setBlocked)
      .catch(() => setBlocked([]))
  }, [resourceId])

  const resource = resources.find((r) => r.resource_id === resourceId)
  const conflict = startAt && endAt ? blocked.some((b) => datesOverlap(startAt, endAt, b)) : false

  let nights = 0
  let amountTotal = 0
  if (resource && startAt && endAt && !conflict) {
    nights = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / (24 * 60 * 60 * 1000))
    if (nights > 0) {
      amountTotal = nights * resource.price_per_unit + resource.cleaning_fee
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!resourceId || !startAt || !endAt || new Date(startAt) >= new Date(endAt)) {
      setError('Dates invalides.')
      return
    }
    if (conflict) {
      setError('Ces dates ne sont plus disponibles.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await submitReservationRequest({
        resourceId,
        startAt,
        endAt,
        requesterEmail,
        requesterLot,
        requesterContact,
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <main className="page resident-page">
        <h1>Demande envoyée</h1>
        <p>Référence : {result.reference}</p>
        <p>Un mail de confirmation vient de vous être envoyé, avec un lien de suivi de votre demande.</p>
      </main>
    )
  }

  return (
    <main className="page resident-page">
      <h1>Espace résident</h1>
      {error && <p className="resident-error">{error}</p>}

      <ul className="resident-resource-list">
        {resources.map((r) => (
          <li key={r.resource_id}>
            <button
              type="button"
              className={r.resource_id === resourceId ? 'cta' : 'cta cta-secondary'}
              onClick={() => setResourceId(r.resource_id)}
            >
              {r.name}
            </button>
          </li>
        ))}
      </ul>

      {resource && (
        <div className="resident-resource-info">
          <h2>{resource.name}</h2>
          <p>Prix : {resource.price_per_unit} € / {bookingUnitLabel(resource.booking_unit)}</p>
          <p>Ménage : {resource.cleaning_fee} €</p>
          <p>Arrivée à partir de {resource.check_in_time}, départ avant {resource.check_out_time}</p>
          <p>Durée maximale : {resource.max_units} {bookingUnitLabel(resource.booking_unit)}</p>
        </div>
      )}

      {resource?.calendar_id && (
        <iframe
          title={`Agenda ${resource.name}`}
          src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(resource.calendar_id)}&ctz=Europe%2FParis`}
          style={{ border: 0 }}
          width="100%"
          height="500"
        />
      )}

      {resource && (
        <form className="resident-form" onSubmit={handleSubmit}>
          {blocked.length > 0 && (
            <div>
              <p>Dates déjà prises :</p>
              <ul>
                {blocked.map((b, i) => (
                  <li key={i}>{formatDate(b.start_at)} → {formatDate(b.end_at)}</li>
                ))}
              </ul>
            </div>
          )}

          <label>
            Du
            <input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
          </label>
          <label>
            Au
            <input type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
          </label>
          {conflict && <p className="resident-error">Ces dates ne sont plus disponibles.</p>}

          <label>
            Email
            <input type="email" value={requesterEmail} onChange={(e) => setRequesterEmail(e.target.value)} required />
          </label>
          <label>
            Lot
            <input type="text" value={requesterLot} onChange={(e) => setRequesterLot(e.target.value)} required />
          </label>
          <label>
            Contact (téléphone)
            <input type="text" value={requesterContact} onChange={(e) => setRequesterContact(e.target.value)} />
          </label>

          {nights > 0 && (
            <p>{nights} nuit(s) — {amountTotal} € (ménage inclus)</p>
          )}

          <button type="submit" className="cta" disabled={submitting || !resourceId || conflict}>
            Envoyer la demande
          </button>
        </form>
      )}
    </main>
  )
}

export default ResidentPage
