import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Spinner, Empty } from '../../components/admin/shared'

const BARBER_COLORS = ['#C9A84C', '#6B1E2A', '#2A6B4A', '#1E3A6B', '#6B5E1E']
const PAGE_SIZE = 20

export default function HistoryView() {
  const [bookings,       setBookings]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [barbers,        setBarbers]        = useState([])
  const [filterStatus,   setFilterStatus]   = useState('all')
  const [filterBarberId, setFilterBarberId] = useState('all')
  const [search,         setSearch]         = useState('')
  const [page,           setPage]           = useState(1)

  useEffect(() => {
    supabase
      .from('barbers')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        setBarbers((data || []).map((b, i) => ({ ...b, color: BARBER_COLORS[i % BARBER_COLORS.length] })))
      })
  }, [])

  useEffect(() => {
    setLoading(true)
    let q = supabase
      .from('bookings')
      .select('id, booking_date, booking_time, client_name, client_phone, status, barber_id, services(name, duration_minutes), barbers(name)')
      .order('booking_date', { ascending: false })
      .order('booking_time', { ascending: false })

    if (filterStatus !== 'all')   q = q.eq('status', filterStatus)
    if (filterBarberId !== 'all') q = q.eq('barber_id', filterBarberId)

    q.then(({ data }) => { setBookings(data || []); setLoading(false); setPage(1) })
  }, [filterStatus, filterBarberId])

  const filtered = useMemo(() => {
    if (!search.trim()) return bookings
    const q = search.trim().toLowerCase()
    return bookings.filter(b =>
      b.client_name?.toLowerCase().includes(q) ||
      b.client_phone?.includes(q)
    )
  }, [bookings, search])

  const visible = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < filtered.length

  function formatDate(d) {
    return new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  const btnBase = 'text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors'
  const btnActive = 'bg-vip-black text-ivory border-vip-black'
  const btnInactive = 'bg-white text-warm-gray border-ivory-border hover:border-warm-gray/50 hover:text-vip-black'

  return (
    <div>
      <p className="text-warm-gray text-sm mb-5">
        Historique complet des réservations.
      </p>

      {/* Filters */}
      <div className="space-y-3 mb-5">
        {/* Search */}
        <input
          type="text"
          placeholder="Rechercher par nom ou téléphone…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="w-full bg-white border border-ivory-border rounded-xl px-4 py-2.5 text-vip-black text-sm placeholder-ivory-border focus:outline-none focus:border-gold transition-colors"
        />

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'all',       label: 'Toutes'     },
            { id: 'confirmed', label: 'Confirmées' },
            { id: 'cancelled', label: 'Annulées'   },
          ].map(f => (
            <button key={f.id} onClick={() => setFilterStatus(f.id)}
              className={`${btnBase} ${filterStatus === f.id ? btnActive : btnInactive}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Barber filter */}
        {barbers.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterBarberId('all')}
              className={`${btnBase} ${filterBarberId === 'all' ? btnActive : btnInactive}`}>
              Tous les barbiers
            </button>
            {barbers.map(b => (
              <button key={b.id} onClick={() => setFilterBarberId(b.id)}
                className={`${btnBase} ${filterBarberId === b.id ? 'text-ivory border-transparent' : btnInactive}`}
                style={filterBarberId === b.id ? { backgroundColor: b.color, borderColor: b.color } : {}}>
                {b.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {loading ? <Spinner /> : filtered.length === 0 ? (
        <Empty message="Aucune réservation trouvée" sub="Modifiez les filtres ou la recherche" />
      ) : (
        <>
          <div className="space-y-2">
            {visible.map(b => {
              const barber = barbers.find(br => br.id === b.barber_id)
              return (
                <div key={b.id} className="bg-white border border-ivory-border rounded-xl px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Date + heure */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gold font-playfair font-bold text-sm">
                          {b.booking_time.slice(0, 5)}
                        </span>
                        <span className="text-warm-gray text-xs capitalize">
                          {formatDate(b.booking_date)}
                        </span>
                        {barber && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: `${barber.color}20`, color: barber.color, border: `1px solid ${barber.color}40` }}
                          >
                            ✂ {barber.name}
                          </span>
                        )}
                      </div>
                      {/* Client */}
                      <p className="text-vip-black font-playfair font-semibold text-sm leading-snug">{b.client_name}</p>
                      <a href={`tel:${b.client_phone}`} className="text-xs text-warm-gray hover:text-gold transition-colors">
                        {b.client_phone}
                      </a>
                      {/* Service */}
                      {b.services && (
                        <p className="text-warm-gray text-xs mt-1">
                          {b.services.name}
                          {b.services.duration_minutes && ` · ${b.services.duration_minutes} min`}
                        </p>
                      )}
                    </div>
                    {/* Badge statut */}
                    <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                      b.status === 'confirmed'
                        ? 'bg-green-500/10 text-green-600 border-green-500/30'
                        : 'bg-bordeaux/10 text-bordeaux border-bordeaux/25'
                    }`}>
                      {b.status === 'confirmed' ? 'Confirmé' : 'Annulé'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="mt-4 w-full py-2.5 rounded-xl border border-ivory-border text-warm-gray text-sm hover:border-gold/50 hover:text-gold transition-colors"
            >
              Voir plus ({filtered.length - visible.length} restantes)
            </button>
          )}
        </>
      )}
    </div>
  )
}
