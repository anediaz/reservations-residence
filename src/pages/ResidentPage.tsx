import { useEffect, useState } from 'react'
import { getAvailability, listResourcesPublic, submitReservationRequest } from '../lib/residentApi'
import { ApiError } from '../lib/api'
import { invalidate } from '../lib/cache'
import { useCachedQuery } from '../lib/useCachedQuery'
import type { BlockedRange } from '../types/availability'
import AppHeader from '../components/AppHeader'
import ResourcePicker from '../components/ResourcePicker'
import DateRangeCalendar from '../components/DateRangeCalendar'
import Skeleton from '../components/Skeleton'
import Spinner from '../components/Spinner'
import './ResidentPage.css'

function datesOverlap(aStart: string, aEnd: string, b: BlockedRange): boolean {
  return new Date(aStart) < new Date(b.end_at) && new Date(b.start_at) < new Date(aEnd)
}

const BOOKING_UNIT_LABELS: Record<string, string> = {
  nights: 'nuit',
  hours: 'heure',
  days: 'jour',
}

function bookingUnitLabel(unit: string, count: number): string {
  const label = BOOKING_UNIT_LABELS[unit] || unit || 'unité'
  return count > 1 ? `${label}s` : label
}

function ResidentPage() {
  const { data: resourcesData, loading: resourcesLoading, error: resourcesError } = useCachedQuery(
    'listResourcesPublic',
    () => listResourcesPublic()
  )
  const resources = resourcesData ?? []
  const [resourceId, setResourceId] = useState('')
  const availabilityKey = resourceId ? `getAvailability:${resourceId}` : null
  const { data: blockedData, loading: blockedLoading } = useCachedQuery<BlockedRange[]>(availabilityKey, () =>
    getAvailability(resourceId)
  )
  const blocked = blockedData ?? []
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [requesterEmail, setRequesterEmail] = useState('')
  const [requesterLot, setRequesterLot] = useState('')
  const [requesterContact, setRequesterContact] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ reservation_id: string; reference: string } | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResourceId((current) => current || resourcesData?.[0]?.resource_id || '')
  }, [resourcesData])

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
        comment,
      })
      setResult(res)
      setStartAt('')
      setEndAt('')
      setRequesterEmail('')
      setRequesterLot('')
      setRequesterContact('')
      setComment('')
      if (availabilityKey) invalidate(availabilityKey)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <AppHeader />
      <main className="page resident-page">
        <div className="resident-intro">
          <h1>Réserver une ressource</h1>
          <p className="resident-subtitle">Choisissez une ressource, consultez les disponibilités puis envoyez votre demande.</p>
        </div>

        {(error || resourcesError) && <p className="resident-error">{error ?? resourcesError}</p>}

        <ResourcePicker
          resources={resources}
          selectedId={resourceId}
          onSelect={(id) => {
            setResourceId(id)
            setResult(null)
          }}
          loading={resourcesLoading}
        />

        {(resourcesLoading || resource) && (
          <section className="resident-section">
            <h2 className="resident-section-title">
              {resourcesLoading ? <Skeleton width="160px" height="22px" /> : resource?.name}
            </h2>
            <dl className="resident-info-grid">
              {resourcesLoading ? (
                [0, 1, 2, 3].map((i) => (
                  <div key={i} className="resident-info-item">
                    <dt><Skeleton width="60px" height="11px" /></dt>
                    <dd><Skeleton width="90px" height="15px" /></dd>
                  </div>
                ))
              ) : resource && (
                <>
                  <div className="resident-info-item">
                    <dt>Prix</dt>
                    <dd>
                      {resource.price_per_unit} € / {bookingUnitLabel(resource.booking_unit, 1)}
                      <br />+ {resource.cleaning_fee} € ménage
                    </dd>
                  </div>
                  <div className="resident-info-item">
                    <dt>Arrivée</dt>
                    <dd>à partir de {resource.check_in_time}</dd>
                  </div>
                  <div className="resident-info-item">
                    <dt>Départ</dt>
                    <dd>avant {resource.check_out_time}</dd>
                  </div>
                  <div className="resident-info-item">
                    <dt>Durée maximale</dt>
                    <dd>{resource.max_units} {bookingUnitLabel(resource.booking_unit, resource.max_units)}</dd>
                  </div>
                </>
              )}
            </dl>
          </section>
        )}

        {(resourcesLoading || resource) && (
          <section className="resident-booking-card">
            <h2 className="resident-section-title">Faire une demande</h2>

            {result && (
              <p className="resident-notice">
                Demande envoyée — référence {result.reference}. Un mail de confirmation vient de vous être envoyé.
              </p>
            )}

            {resourcesLoading ? (
              <div className="resident-form">
                <Skeleton width="100%" height="320px" />
                <Skeleton width="100%" height="42px" />
                <Skeleton width="100%" height="42px" />
                <Skeleton width="100%" height="42px" />
                <Skeleton width="100%" height="46px" />
              </div>
            ) : resource && (
            <form className="resident-form" onSubmit={handleSubmit}>
              <div className={blockedLoading ? 'resident-calendar-wrapper resident-calendar-wrapper-loading' : 'resident-calendar-wrapper'}>
                <DateRangeCalendar
                  startAt={startAt}
                  endAt={endAt}
                  onChange={(s, e) => {
                    setStartAt(s)
                    setEndAt(e)
                  }}
                  blocked={blocked}
                />
                {blockedLoading && <p className="resident-calendar-loading-overlay">Chargement des disponibilités…</p>}
              </div>
              {resource.calendar_id && (
                <a
                  href={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(resource.calendar_id)}&ctz=Europe%2FParis`}
                  target="_blank"
                  rel="noreferrer"
                  className="resident-calendar-link"
                >
                  Voir l'agenda Google
                </a>
              )}
              {conflict && <p className="resident-error">Ces dates ne sont plus disponibles.</p>}

              <p className="resident-form-hint">* champ obligatoire</p>

              <label>
                Email *
                <input type="email" value={requesterEmail} onChange={(e) => setRequesterEmail(e.target.value)} required />
              </label>
              <label>
                Numéro d'appartement *
                <input type="text" value={requesterLot} onChange={(e) => setRequesterLot(e.target.value)} required />
              </label>
              <label>
                Contact téléphone (optionnel)
                <input type="text" value={requesterContact} onChange={(e) => setRequesterContact(e.target.value)} />
              </label>
              <label>
                Commentaire (optionnel)
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Précisions utiles pour le gestionnaire"
                />
              </label>

              {nights > 0 && (
                <p className="resident-price-preview">{nights} {bookingUnitLabel(resource.booking_unit, nights)} — {amountTotal} € (ménage inclus)</p>
              )}

              <button type="submit" className="cta" disabled={submitting || !resourceId || conflict}>
                {submitting && <Spinner />}
                Envoyer la demande
              </button>
            </form>
            )}
          </section>
        )}
      </main>
    </>
  )
}

export default ResidentPage
