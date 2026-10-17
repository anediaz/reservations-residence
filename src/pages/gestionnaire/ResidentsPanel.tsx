import { useEffect, useState } from 'react'
import { deleteResident, listResidents, revokeResident, upsertResident } from '../../lib/managerApi'
import { ApiError } from '../../lib/api'
import type { Resident, ResidentRole, ResidentStatus } from '../../types/resident'
import { formatDate } from '../../lib/format'

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
  const [residents, setResidents] = useState<Resident[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [lot, setLot] = useState('')
  const [role, setRole] = useState<ResidentRole>('resident')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<EditState | null>(null)

  function load() {
    return listResidents(idToken)
      .then((data) => {
        setResidents(data)
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
      await upsertResident(idToken, { email, lot, role })
      setEmail('')
      setLot('')
      setRole('resident')
      await load()
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
      await load()
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
      await load()
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
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
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
          Ajouter
        </button>
      </form>

      {error && <p className="manager-error">{error}</p>}

      {!residents ? (
        <p>Chargement…</p>
      ) : residents.length === 0 ? (
        <p>Aucun résident.</p>
      ) : (
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
                <tr key={r.resident_id} className={isSelf ? 'manager-row-self' : undefined}>
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
                  <td className="manager-actions">
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
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default ResidentsPanel
