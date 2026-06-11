import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Toggle, Spinner, InlineNumber } from '../../components/admin/shared'

export default function ServicesView() {
  const [services, setServices] = useState([])
  const [loading, setLoading]   = useState(true)

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

  return (
    <div>
      <p className="text-warm-gray text-sm mb-5">Désactivez un service pour le masquer aux clients. Cliquez sur un prix ou une durée pour le modifier.</p>
      {loading ? <Spinner /> : (
        <div className="space-y-3">
          {services.map(s => (
            <div
              key={s.id}
              className={`bg-white border border-ivory-border rounded-xl px-4 py-3 flex items-center gap-4 transition-opacity ${!s.active ? 'opacity-40' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-vip-black font-playfair font-semibold text-sm">{s.name}</p>
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
                {s.description && <p className="text-ivory-border text-xs mt-1 truncate">{s.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-warm-gray text-xs">{s.active ? 'Actif' : 'Inactif'}</span>
                <Toggle checked={s.active} onChange={v => toggleActive(s.id, v)} label={`Activer ${s.name}`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
