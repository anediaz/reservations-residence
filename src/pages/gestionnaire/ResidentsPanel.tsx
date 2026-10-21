import { useState } from 'react'
import { deleteResident, listResidents, revokeResident, upsertResident } from '../../lib/managerApi'
import { ApiError } from '../../lib/api'
import { invalidate } from '../../lib/cache'
import { useCachedQuery } from '../../lib/useCachedQuery'
import type { Resident, ResidentRole, ResidentStatus } from '../../types/resident'
import { formatDate } from '../../lib/format'
import TableSkeleton from '../../components/TableSkeleton'
import ReloadButton from '../../components/ReloadButton'
import Spinner from '../../components/Spinner'

const COLUMNS = ['Email', 'Lot', 'Rôle', 'Statut', 'Créé le', '']

interface ResidentsPanelProps {
  idToken: string
  currentEmail: string
}

interface EditState {
  lot: string
  role: ResidentRole
  status: ResidentStatus
}

const ROLE_LABELS: Record<ResidentRole, string> = {
  resident: 'Résident',
  admin: 'Gestionnaire',
  super_admin: 'Super gestionnaire',
}

function ResidentsPanel({ idToken, currentEmail }: ResidentsPanelProps) {
  const residentsKey = `listResidents:${idToken}`
  const { data: residents, error: loadError, loading, reload } = useCachedQuery(residentsKey, () =>
    listResidents(idToken)
  )
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [lot, setLot] = useState('')
  const [role, setRole] = useState<ResidentRole>('resident')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<EditState | null>(null)

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await upsertResident(idToken, { email, lot, role })
      setEmail('')
      setLot('')
      setRole('resident')
      invalidate(residentsKey)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(resident: Resident) {
    setEditingId(resident.resident_id)
    setEditValues({ lot: resident.lot, role: resident.role, status: resident.status })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues(null)
  }

  async function saveEdit(resident: Resident) {
    if (!editValues) return
    setBusyId(resident.resident_id)
    try {
      await upsertResident(idToken, {
        resident_id: resident.resident_id,
        email: resident.email,
        lot: editValues.lot,
        role: editValues.role,
        status: editValues.status,
      })
      cancelEdit()
      invalidate(residentsKey)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleStatus(resident: Resident) {
    setBusyId(resident.resident_id)
    try {
      if (resident.status === 'active') {
        await revokeResident(idToken, resident.resident_id)
      } else {
        await upsertResident(idToken, {
          resident_id: resident.resident_id,
          email: resident.email,
          lot: resident.lot,
          role: resident.role,
          status: 'active',
        })
      }
      invalidate(residentsKey)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(resident: Resident) {
    if (!window.confirm(`Supprimer définitivement ${resident.email} ?`)) return
    setBusyId(resident.resident_id)
    try {
      await deleteResident(idToken, resident.resident_id)
      invalidate(residentsKey)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setBusyId(null)
    }
  }

  const isReloading = loading && residents !== null

  return (
    <div className={isReloading ? 'manager-panel manager-panel-reloading' : 'manager-panel'}>
      {(error || loadError) && <p className="manager-error">{error ?? loadError}</p>}

      <div className="manager-panel-header">
        <span />
        <ReloadButton onClick={reload} loading={loading} />
      </div>

      {!residents ? (
        <TableSkeleton columns={COLUMNS} className="manager-table-residents" />
      ) : residents.length === 0 ? (
        <p>Aucun résident.</p>
      ) : (
        <div className="manager-table-scroll">
        <table className="manager-table manager-table-residents">
          <thead>
            <tr>
              <th>Email</th>
              <th>Lot</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>Créé le</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {residents.map((r) => {
              const isEditing = editingId === r.resident_id
              const isBusy = busyId === r.resident_id
              const isSelf = r.email.toLowerCase() === currentEmail.toLowerCase()
              const isProtected = isSelf || r.role === 'super_admin'
              return (
                <tr
                  key={r.resident_id}
                  className={[isSelf && 'manager-row-self', isBusy && 'manager-row-busy'].filter(Boolean).join(' ') || undefined}
                >
                  <td>
                    {r.email}
                    {isSelf && <span className="manager-badge-self">moi</span>}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editValues?.lot ?? ''}
                        onChange={(e) => setEditValues((v) => (v ? { ...v, lot: e.target.value } : v))}
                      />
                    ) : (
                      r.lot
                    )}
                  </td>
                  <td>
                    {isEditing && r.role !== 'super_admin' ? (
                      <select
                        value={editValues?.role}
                        onChange={(e) =>
                          setEditValues((v) => (v ? { ...v, role: e.target.value as ResidentRole } : v))
                        }
                      >
                        <option value="resident">Résident</option>
                        <option value="admin">Gestionnaire</option>
                      </select>
                    ) : (
                      ROLE_LABELS[r.role]
                    )}
                  </td>
                  <td>{r.status === 'active' ? 'Actif' : 'Inactif'}</td>
                  <td>{formatDate(r.created_at)}</td>
                  <td>
                    <div className="manager-actions">
                      {isEditing ? (
                        <>
                          <button type="button" className="cta" disabled={isBusy} onClick={() => saveEdit(r)}>
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
                          {!isProtected && (
                            <>
                              <button
                                type="button"
                                className="cta cta-secondary"
                                disabled={isBusy}
                                onClick={() => handleToggleStatus(r)}
                              >
                                {r.status === 'active' ? 'Révoquer' : 'Réactiver'}
                              </button>
                              <button type="button" className="cta cta-danger" disabled={isBusy} onClick={() => handleDelete(r)}>
                                Supprimer
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}

      <div className="manager-section-divider">
        <h2 className="manager-history-title">Ajouter un résident</h2>

        <form className="manager-form" onSubmit={handleAdd}>
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              e.target.setCustomValidity('')
            }}
            onInvalid={(e) => {
              const input = e.currentTarget
              input.setCustomValidity(
                input.validity.valueMissing
                  ? 'Merci de renseigner un email.'
                  : 'Merci de renseigner un email valide.'
              )
            }}
            required
          />
          <input
            type="text"
            placeholder="lot (ex: appartement 12)"
            value={lot}
            onChange={(e) => setLot(e.target.value)}
          />
          <select value={role} onChange={(e) => setRole(e.target.value as ResidentRole)}>
            <option value="resident">Résident</option>
            <option value="admin">Gestionnaire</option>
            <option value="super_admin">Super gestionnaire</option>
          </select>
          <button type="submit" className="cta" disabled={submitting}>
            {submitting && <Spinner />}
            Ajouter
          </button>
        </form>
      </div>
    </div>
  )
}

export default ResidentsPanel
