import { useEffect, useState } from 'react'
import { deleteResource, listResources, upsertResource } from '../../lib/managerApi'
import { ApiError } from '../../lib/api'
import type { ResourceConfig } from '../../types/config'

interface ConfigPanelProps {
  idToken: string
}

interface FormState {
  resource_id: string
  name: string
  calendar_id: string
  price_per_unit: string
  cleaning_fee: string
  check_in_time: string
  check_out_time: string
  max_units: string
}

const EMPTY_FORM: FormState = {
  resource_id: '',
  name: '',
  calendar_id: '',
  price_per_unit: '',
  cleaning_fee: '',
  check_in_time: '',
  check_out_time: '',
  max_units: '',
}

function toFormState(resource: ResourceConfig): FormState {
  return {
    resource_id: resource.resource_id,
    name: resource.name,
    calendar_id: resource.calendar_id,
    price_per_unit: String(resource.price_per_unit ?? ''),
    cleaning_fee: String(resource.cleaning_fee ?? ''),
    check_in_time: resource.check_in_time,
    check_out_time: resource.check_out_time,
    max_units: String(resource.max_units ?? ''),
  }
}

function toResource(form: FormState): ResourceConfig {
  return {
    resource_id: form.resource_id,
    name: form.name || form.resource_id,
    calendar_id: form.calendar_id,
    price_per_unit: Number(form.price_per_unit),
    cleaning_fee: Number(form.cleaning_fee),
    check_in_time: form.check_in_time,
    check_out_time: form.check_out_time,
    max_units: Number(form.max_units),
  }
}

function ConfigPanel({ idToken }: ConfigPanelProps) {
  const [resources, setResources] = useState<ResourceConfig[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<FormState | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  function load() {
    return listResources(idToken)
      .then((data) => {
        setResources(data)
        setError(null)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur inattendue.'))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken])

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await upsertResource(idToken, toResource(addForm))
      setAddForm(EMPTY_FORM)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(resource: ResourceConfig) {
    setEditingId(resource.resource_id)
    setEditValues(toFormState(resource))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues(null)
  }

  async function saveEdit() {
    if (!editValues) return
    setBusyId(editValues.resource_id)
    try {
      await upsertResource(idToken, toResource(editValues))
      cancelEdit()
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(resource: ResourceConfig) {
    if (!window.confirm(`Supprimer définitivement ${resource.name} ?`)) return
    setBusyId(resource.resource_id)
    try {
      await deleteResource(idToken, resource.resource_id)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      {error && <p className="manager-error">{error}</p>}

      {!resources ? (
        <p>Chargement…</p>
      ) : resources.length === 0 ? (
        <p>Aucune ressource.</p>
      ) : (
        <div className="resource-list">
          {resources.map((r) => {
            const isEditing = editingId === r.resource_id
            const isBusy = busyId === r.resource_id
            const values = isEditing ? editValues : toFormState(r)
            return (
              <div className="resource-card" key={r.resource_id}>
                <div className="resource-field">
                  <span className="resource-field-label">Identifiant</span>
                  <span className="resource-field-value">{r.resource_id}</span>
                </div>
                <div className="resource-field">
                  <span className="resource-field-label">Nom</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={values?.name ?? ''}
                      onChange={(e) => setEditValues((v) => (v ? { ...v, name: e.target.value } : v))}
                    />
                  ) : (
                    <span className="resource-field-value">{r.name}</span>
                  )}
                </div>
                <div className="resource-field resource-field-grow">
                  <span className="resource-field-label">Agenda</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={values?.calendar_id ?? ''}
                      onChange={(e) => setEditValues((v) => (v ? { ...v, calendar_id: e.target.value } : v))}
                    />
                  ) : r.calendar_id ? (
                    /^https?:\/\//i.test(r.calendar_id) ? (
                      <a
                        className="resource-field-value"
                        href={r.calendar_id}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Lien
                      </a>
                    ) : (
                      <span className="resource-field-value resource-field-truncate">{r.calendar_id}</span>
                    )
                  ) : (
                    <span className="resource-field-value">—</span>
                  )}
                </div>
                <div className="resource-field">
                  <span className="resource-field-label">Prix/nuit</span>
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values?.price_per_unit ?? ''}
                      onChange={(e) => setEditValues((v) => (v ? { ...v, price_per_unit: e.target.value } : v))}
                    />
                  ) : (
                    <span className="resource-field-value">{r.price_per_unit} €</span>
                  )}
                </div>
                <div className="resource-field">
                  <span className="resource-field-label">Ménage</span>
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values?.cleaning_fee ?? ''}
                      onChange={(e) => setEditValues((v) => (v ? { ...v, cleaning_fee: e.target.value } : v))}
                    />
                  ) : (
                    <span className="resource-field-value">{r.cleaning_fee} €</span>
                  )}
                </div>
                <div className="resource-field">
                  <span className="resource-field-label">Nuits max</span>
                  {isEditing ? (
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={values?.max_units ?? ''}
                      onChange={(e) => setEditValues((v) => (v ? { ...v, max_units: e.target.value } : v))}
                    />
                  ) : (
                    <span className="resource-field-value">{r.max_units}</span>
                  )}
                </div>
                <div className="resource-field">
                  <span className="resource-field-label">Arrivée</span>
                  {isEditing ? (
                    <input
                      type="time"
                      value={values?.check_in_time ?? ''}
                      onChange={(e) => setEditValues((v) => (v ? { ...v, check_in_time: e.target.value } : v))}
                    />
                  ) : (
                    <span className="resource-field-value">{r.check_in_time}</span>
                  )}
                </div>
                <div className="resource-field">
                  <span className="resource-field-label">Départ</span>
                  {isEditing ? (
                    <input
                      type="time"
                      value={values?.check_out_time ?? ''}
                      onChange={(e) => setEditValues((v) => (v ? { ...v, check_out_time: e.target.value } : v))}
                    />
                  ) : (
                    <span className="resource-field-value">{r.check_out_time}</span>
                  )}
                </div>
                <div className="manager-actions resource-actions">
                  {isEditing ? (
                    <>
                      <button type="button" className="cta" disabled={isBusy} onClick={saveEdit}>
                        Enregistrer
                      </button>
                      <button type="button" className="cta cta-secondary" disabled={isBusy} onClick={cancelEdit}>
                        Annuler
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="cta cta-secondary" disabled={isBusy} onClick={() => startEdit(r)}>
                        Modifier
                      </button>
                      <button type="button" className="cta cta-danger" disabled={isBusy} onClick={() => handleDelete(r)}>
                        Supprimer
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <form className="manager-config-form" onSubmit={handleAdd}>
        <h3 className="manager-config-form-title">Ajouter une ressource</h3>
        <label>
          Identifiant
          <input
            type="text"
            placeholder="chambre-amis"
            value={addForm.resource_id}
            onChange={(e) => setAddForm((f) => ({ ...f, resource_id: e.target.value }))}
            required
          />
        </label>
        <label>
          Nom
          <input
            type="text"
            placeholder="Chambre d'amis"
            value={addForm.name}
            onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>
        <label>
          URL de l'agenda Google
          <input
            type="text"
            value={addForm.calendar_id}
            onChange={(e) => setAddForm((f) => ({ ...f, calendar_id: e.target.value }))}
            placeholder="exemple@group.calendar.google.com"
          />
        </label>
        <label>
          Prix par nuit (€)
          <input
            type="number"
            min="0"
            step="0.01"
            value={addForm.price_per_unit}
            onChange={(e) => setAddForm((f) => ({ ...f, price_per_unit: e.target.value }))}
            required
          />
        </label>
        <label>
          Forfait ménage (€)
          <input
            type="number"
            min="0"
            step="0.01"
            value={addForm.cleaning_fee}
            onChange={(e) => setAddForm((f) => ({ ...f, cleaning_fee: e.target.value }))}
            required
          />
        </label>
        <label>
          Nuits consécutives maximum
          <input
            type="number"
            min="1"
            step="1"
            value={addForm.max_units}
            onChange={(e) => setAddForm((f) => ({ ...f, max_units: e.target.value }))}
            required
          />
        </label>
        <label>
          Heure d'arrivée
          <input
            type="time"
            value={addForm.check_in_time}
            onChange={(e) => setAddForm((f) => ({ ...f, check_in_time: e.target.value }))}
          />
        </label>
        <label>
          Heure de départ
          <input
            type="time"
            value={addForm.check_out_time}
            onChange={(e) => setAddForm((f) => ({ ...f, check_out_time: e.target.value }))}
          />
        </label>
        <button type="submit" className="cta" disabled={submitting}>
          Ajouter
        </button>
      </form>
    </div>
  )
}

export default ConfigPanel
