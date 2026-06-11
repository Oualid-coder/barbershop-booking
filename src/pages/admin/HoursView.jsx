import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Toggle, Spinner, DAY_NAMES } from '../../components/admin/shared'

export default function HoursView() {
  const [hours, setHours]     = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(null)

  useEffect(() => {
    supabase.from('business_hours').select('*').order('day_of_week').then(({ data }) => {
      setHours(data || [])
      setLoading(false)
    })
  }, [])

  async function updateField(id, field, value) {
    setHours(prev => prev.map(h => h.id === id ? { ...h, [field]: value } : h))
    setSaving(id)
    await supabase.from('business_hours').update({ [field]: value }).eq('id', id)
    setSaving(null)
  }

  return (
    <div>
      <p className="text-warm-gray text-sm mb-5">Modifications sauvegardées automatiquement.</p>
      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {hours.map(h => (
            <div
              key={h.id}
              className={`bg-white border border-ivory-border rounded-xl px-4 py-3 flex items-center gap-3 transition-opacity ${h.is_closed ? 'opacity-50' : ''}`}
            >
              <span className="text-vip-black text-sm font-medium w-24 shrink-0">{DAY_NAMES[h.day_of_week]}</span>

              {h.is_closed ? (
                <span className="text-warm-gray text-sm flex-1">Fermé</span>
              ) : (
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                  <input
                    type="time" value={h.open_time.slice(0, 5)}
                    onChange={e => updateField(h.id, 'open_time', e.target.value)}
                    className="bg-white border border-ivory-border rounded-lg px-2 py-1.5 text-vip-black text-sm focus:outline-none focus:border-gold transition-colors"
                  />
                  <span className="text-ivory-border text-xs">→</span>
                  <input
                    type="time" value={h.close_time.slice(0, 5)}
                    onChange={e => updateField(h.id, 'close_time', e.target.value)}
                    className="bg-white border border-ivory-border rounded-lg px-2 py-1.5 text-vip-black text-sm focus:outline-none focus:border-gold transition-colors"
                  />
                  {saving === h.id && <div className="w-3 h-3 border border-gold border-t-transparent rounded-full animate-spin" />}
                </div>
              )}

              <Toggle checked={!h.is_closed} onChange={open => updateField(h.id, 'is_closed', !open)} label={`${DAY_NAMES[h.day_of_week]} ouvert`} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
