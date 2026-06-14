import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Toggle, Spinner, InlineNumber, InlineText } from '../../components/admin/shared'

export default function ServicesView({ isOwner = false }) {
  const [services, setServices]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [adding, setAdding]           = useState(false)
  const [newSvc, setNewSvc]           = useState({ name: '', description: '', duration_minutes: 30, price: 20 })
  const [saving, setSaving]           = useState(false)
  const [addError, setAddError]       = useState(null)

  useEffect(() => {
    supabase.from('services').select('*').order('price').then(({ data }) => {
      setServices(data || [])
      setLoading(false)
    })
  }, [])

  async function toggleActive(id, active) {
    setServices(prev => prev.map(s => s.id === id ? { ...s, active } : s))
    const { error } = await supabase.from('services').update({ active }).eq('id', id)
    if (error) setServices(prev => prev.map(s => s.id === id ? { ...s, active: !active } : s))
  }

  async function updateField(id, field, value) {
    const prev = services.find(s => s.id === id)?.[field]
    setServices(p => p.map(s => s.id === id ? { ...s, [field]: value } : s))
    const { error } = await supabase.from('services').update({ [field]: value }).eq('id', id)
    if (error) setServices(p => p.map(s => s.id === id ? { ...s, [field]: prev } : s))
  }

  async function deleteService(id) {
    setServices(prev => prev.filter(s => s.id !== id))
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) {
      supabase.from('services').select('*').order('price').then(({ data }) => setServices(data || []))
    }
    setConfirmDelete(null)
  }

  async function addService() {
    if (!newSvc.name.trim()) { setAddError('Le nom est requis.'); return }
    setSaving(true)
    setAddError(null)
    const { data, error } = await supabase
      .from('services')
      .insert({ name: newSvc.name.trim(), description: newSvc.description.trim() || null, duration_minutes: newSvc.duration_minutes, price: newSvc.price, active: true })
      .select()
      .single()
    setSaving(false)
    if (error) { setAddError('Erreur lors de la création.'); return }
    setServices(prev => [...prev, data].sort((a, b) => a.price - b.price))
    setNewSvc({ name: '', description: '', duration_minutes: 30, price: 20 })
    setAdding(false)
  }

  return (
    <div>
      <p className="text-warm-gray text-sm mb-5">
        Désactivez un service pour le masquer aux clients. Cliquez sur un nom, prix ou durée pour le modifier.
        {isOwner && ' En tant que propriétaire, vous pouvez ajouter et supprimer des services.'}
      </p>

      {loading ? <Spinner /> : (
        <div className="space-y-3">
          {services.map(s => (
            <div
              key={s.id}
              className={`bg-white border border-ivory-border rounded-xl px-4 py-3 transition-opacity ${!s.active ? 'opacity-40' : ''}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  {isOwner ? (
                    <InlineText
                      value={s.name}
                      onCommit={v => updateField(s.id, 'name', v)}
                      className="text-vip-black font-playfair font-semibold text-sm w-full"
                    />
                  ) : (
                    <p className="text-vip-black font-playfair font-semibold text-sm">{s.name}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <InlineNumber
                      value={s.duration_minutes}
                      onCommit={v => updateField(s.id, 'duration_minutes', v)}
                      suffix=" min" min={5} step={5}
                    />
                    <span className="text-ivory-border text-xs">·</span>
                    <InlineNumber
                      value={s.price}
                      onCommit={v => updateField(s.id, 'price', v)}
                      suffix=" €" min={1} step={0.5}
                    />
                  </div>
                  {isOwner ? (
                    <InlineText
                      value={s.description || ''}
                      onCommit={v => updateField(s.id, 'description', v)}
                      placeholder="Ajouter une description…"
                      className="text-ivory-border text-xs mt-1 w-full"
                    />
                  ) : (
                    s.description && <p className="text-ivory-border text-xs mt-1 truncate">{s.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-warm-gray text-xs">{s.active ? 'Actif' : 'Inactif'}</span>
                  <Toggle checked={s.active} onChange={v => toggleActive(s.id, v)} label={`Activer ${s.name}`} />
                </div>
              </div>

              {isOwner && (
                <div className="mt-2.5 pt-2.5 border-t border-ivory-border/60">
                  {confirmDelete === s.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-bordeaux flex-1">Supprimer "{s.name}" ?</span>
                      <button
                        onClick={() => deleteService(s.id)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-bordeaux text-ivory font-medium hover:bg-bordeaux/80 transition-colors"
                      >
                        Confirmer
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-ivory-border text-warm-gray hover:bg-ivory-dark transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(s.id)}
                      className="text-xs text-bordeaux/60 hover:text-bordeaux transition-colors"
                    >
                      Supprimer ce service
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isOwner && !loading && (
        <div className="mt-4">
          {adding ? (
            <div className="bg-white border border-ivory-border rounded-xl p-4 space-y-3">
              <p className="text-vip-black font-playfair font-semibold text-sm">Nouveau service</p>

              {addError && (
                <div className="bg-bordeaux/10 border border-bordeaux/25 rounded-xl px-3 py-2 text-bordeaux text-xs">{addError}</div>
              )}

              <input
                type="text"
                placeholder="Nom du service *"
                value={newSvc.name}
                onChange={e => setNewSvc(p => ({ ...p, name: e.target.value }))}
                autoFocus
                className="w-full bg-white border border-ivory-border rounded-xl px-4 py-2.5 text-vip-black text-sm placeholder-ivory-border focus:outline-none focus:border-gold transition-colors"
              />
              <input
                type="text"
                placeholder="Description (optionnel)"
                value={newSvc.description}
                onChange={e => setNewSvc(p => ({ ...p, description: e.target.value }))}
                className="w-full bg-white border border-ivory-border rounded-xl px-4 py-2.5 text-vip-black text-sm placeholder-ivory-border focus:outline-none focus:border-gold transition-colors"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-warm-gray mb-1 block">Durée (min)</label>
                  <input
                    type="number" min={5} step={5}
                    value={newSvc.duration_minutes}
                    onChange={e => setNewSvc(p => ({ ...p, duration_minutes: parseInt(e.target.value, 10) || 30 }))}
                    className="w-full bg-white border border-ivory-border rounded-xl px-4 py-2.5 text-vip-black text-sm focus:outline-none focus:border-gold transition-colors"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-warm-gray mb-1 block">Prix (€)</label>
                  <input
                    type="number" min={1} step={0.5}
                    value={newSvc.price}
                    onChange={e => setNewSvc(p => ({ ...p, price: parseFloat(e.target.value) || 20 }))}
                    className="w-full bg-white border border-ivory-border rounded-xl px-4 py-2.5 text-vip-black text-sm focus:outline-none focus:border-gold transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setAdding(false); setAddError(null) }}
                  className="flex-1 py-2.5 rounded-xl border border-ivory-border text-warm-gray text-sm font-medium hover:bg-ivory-dark transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={addService}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-vip-black text-ivory text-sm font-bold disabled:opacity-40 hover:bg-bordeaux transition-colors"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-ivory border-t-transparent rounded-full animate-spin" />
                      Création…
                    </span>
                  ) : 'Ajouter'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setAdding(true); setAddError(null) }}
              className="w-full py-3 rounded-xl border-2 border-dashed border-ivory-border text-warm-gray text-sm hover:border-gold/50 hover:text-gold transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Ajouter un service
            </button>
          )}
        </div>
      )}
    </div>
  )
}
