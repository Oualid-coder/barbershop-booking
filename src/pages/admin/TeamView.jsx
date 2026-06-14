import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Toggle, Spinner, Empty } from '../../components/admin/shared'

function BarberRow({ barber, onToggle }) {
  return (
    <div className={`bg-white border border-ivory-border rounded-xl px-4 py-3 flex items-center gap-4 transition-opacity ${!barber.active ? 'opacity-50' : ''}`}>
      <div className="w-9 h-9 rounded-full bg-vip-black flex items-center justify-center shrink-0">
        <span className="text-gold font-playfair font-bold text-sm">{barber.name.charAt(0).toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-vip-black font-playfair font-semibold text-sm">{barber.name}</p>
          {barber.role === 'owner' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30 font-medium">
              Propriétaire
            </span>
          )}
        </div>
        <p className="text-warm-gray text-xs mt-0.5 truncate">{barber.email}</p>
      </div>
      {barber.role !== 'owner' && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-warm-gray text-xs">{barber.active ? 'Actif' : 'Inactif'}</span>
          <Toggle checked={barber.active} onChange={v => onToggle(barber.id, v)} label={`Activer ${barber.name}`} />
        </div>
      )}
    </div>
  )
}

export default function TeamView() {
  const [barbers, setBarbers]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [adding, setAdding]       = useState(false)
  const [form, setForm]           = useState({ name: '', email: '', password: '' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(null)
  const [showPass, setShowPass]   = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    supabase
      .from('barbers')
      .select('id, name, email, active, role')
      .order('name')
      .then(({ data }) => { setBarbers(data || []); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActive(id, active) {
    setBarbers(prev => prev.map(b => b.id === id ? { ...b, active } : b))
    const { error } = await supabase.from('barbers').update({ active }).eq('id', id)
    if (error) setBarbers(prev => prev.map(b => b.id === id ? { ...b, active: !active } : b))
  }

  async function createBarber() {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Tous les champs sont requis.')
      return
    }
    setSaving(true)
    setError(null)

    const { data, error: fnErr } = await supabase.functions.invoke('create-barber', {
      body: { name: form.name.trim(), email: form.email.trim(), password: form.password },
    })

    setSaving(false)
    if (fnErr || data?.error) {
      setError(fnErr?.message || data?.error || 'Erreur lors de la création.')
      return
    }

    setSuccess(`${form.name.trim()} a été ajouté à l'équipe.`)
    setForm({ name: '', email: '', password: '' })
    setAdding(false)
    load()
  }

  function handleFormKey(e) {
    if (e.key === 'Enter' && !saving) createBarber()
    if (e.key === 'Escape') { setAdding(false); setError(null) }
  }

  return (
    <div>
      <p className="text-warm-gray text-sm mb-5">
        Gérez l'équipe. Désactivez un barbier pour masquer son profil aux clients.
      </p>

      {success && (
        <div className="mb-4 bg-gold/10 border border-gold/30 rounded-xl px-4 py-3 text-gold text-sm flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess(null)} className="text-gold/60 hover:text-gold ml-3 shrink-0">✕</button>
        </div>
      )}

      {loading ? <Spinner /> : barbers.length === 0 ? (
        <Empty message="Aucun barbier configuré" sub="Ajoutez un membre de l'équipe ci-dessous" />
      ) : (
        <div className="space-y-3 mb-5">
          {barbers.map(b => (
            <BarberRow key={b.id} barber={b} onToggle={toggleActive} />
          ))}
        </div>
      )}

      {adding ? (
        <div className="bg-white border border-ivory-border rounded-xl p-4 space-y-3">
          <p className="text-vip-black font-playfair font-semibold text-sm">Nouveau barbier</p>

          {error && (
            <div className="bg-bordeaux/10 border border-bordeaux/25 rounded-xl px-3 py-2 text-bordeaux text-xs">{error}</div>
          )}

          <div className="space-y-2">
            <input
              type="text"
              placeholder="Prénom"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              onKeyDown={handleFormKey}
              autoFocus
              className="w-full bg-white border border-ivory-border rounded-xl px-4 py-3 text-vip-black text-sm placeholder-ivory-border focus:outline-none focus:border-gold transition-colors"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              onKeyDown={handleFormKey}
              autoComplete="off"
              className="w-full bg-white border border-ivory-border rounded-xl px-4 py-3 text-vip-black text-sm placeholder-ivory-border focus:outline-none focus:border-gold transition-colors"
            />
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Mot de passe temporaire"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                onKeyDown={handleFormKey}
                autoComplete="new-password"
                className="w-full bg-white border border-ivory-border rounded-xl px-4 py-3 pr-10 text-vip-black text-sm placeholder-ivory-border focus:outline-none focus:border-gold transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ivory-border hover:text-warm-gray transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showPass
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-9.9 0C6.268 8.943 8.943 7 12 7s5.732 1.943 6.9 5c-1.168 3.057-3.843 5-6.9 5s-5.732-1.943-6.9-5z" />
                  }
                </svg>
              </button>
            </div>
          </div>

          <p className="text-ivory-border text-xs">Le barbier pourra changer son mot de passe depuis l'onglet Compte.</p>

          <div className="flex gap-2">
            <button
              onClick={() => { setAdding(false); setError(null) }}
              className="flex-1 py-2.5 rounded-xl border border-ivory-border text-warm-gray text-sm font-medium hover:bg-ivory-dark transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={createBarber}
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
          onClick={() => { setAdding(true); setSuccess(null) }}
          className="w-full py-3 rounded-xl border-2 border-dashed border-ivory-border text-warm-gray text-sm hover:border-gold/50 hover:text-gold transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter un barbier
        </button>
      )}
    </div>
  )
}
