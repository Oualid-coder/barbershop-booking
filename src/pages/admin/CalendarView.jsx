import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  getToday,
  CalendarSkeleton,
  MoveModal,
  DayPanel,
  localDateLabel,
} from '../../components/admin/shared'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_HEADERS  = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTH_NAMES  = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]
const BARBER_COLORS = ['#C9A84C', '#6B1E2A', '#2A6B4A', '#1E3A6B', '#6B5E1E']

// 30-min slots 09:00 → 18:30 (closing marker 19:00 drawn separately)
const AGENDA_SLOTS = (() => {
  const s = []
  for (let h = 9; h < 19; h++) {
    s.push(`${String(h).padStart(2, '0')}:00`)
    s.push(`${String(h).padStart(2, '0')}:30`)
  }
  return s
})()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
  const days = []
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push({ dateStr: dateToStr(d), num: d.getDate(), currentMonth: false })
  }
  for (let n = 1; n <= lastDay.getDate(); n++) {
    const d = new Date(year, month, n)
    days.push({ dateStr: dateToStr(d), num: n, currentMonth: true })
  }
  for (let n = 1; days.length < 42; n++) {
    const d = new Date(year, month + 1, n)
    days.push({ dateStr: dateToStr(d), num: d.getDate(), currentMonth: false })
  }
  return days
}

// ─── CreateBookingForm ────────────────────────────────────────────────────────

function CreateBookingForm({ date, defaultBarberId, barbers, onSuccess, onCancel }) {
  const [services,   setServices]   = useState([])
  const [loadingSvc, setLoadingSvc] = useState(true)
  const [form, setForm] = useState({
    barberId:    defaultBarberId || barbers[0]?.id || '',
    serviceId:   '',
    time:        '09:00',
    clientName:  '',
    clientPhone: '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  useEffect(() => {
    supabase
      .from('services')
      .select('id, name, duration_minutes, price')
      .eq('active', true)
      .order('price')
      .then(({ data }) => { setServices(data || []); setLoadingSvc(false) })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const { barberId, serviceId, time, clientName, clientPhone } = form
    if (!clientName.trim() || !clientPhone.trim() || !serviceId || !barberId) {
      setError('Tous les champs sont requis.')
      return
    }
    const phone = clientPhone.replace(/\s/g, '')
    if (!/^(?:\+33|0033|0)[1-9]\d{8}$/.test(phone)) {
      setError('Format invalide. Ex : 06 12 34 56 78')
      return
    }
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('bookings').insert({
      barber_id:    barberId,
      service_id:   serviceId,
      booking_date: date,
      booking_time: time,
      client_name:  clientName.trim(),
      client_phone: clientPhone.trim(),
      status:       'confirmed',
    })
    setSaving(false)
    if (err) {
      setError(err.code === '23505'
        ? 'Ce créneau est déjà pris. Choisissez un autre horaire.'
        : 'Erreur lors de la création. Réessayez.')
      return
    }
    onSuccess()
  }

  const inputCls = 'w-full bg-white border border-ivory-border rounded-lg px-3 py-2 text-vip-black text-sm focus:outline-none focus:border-gold transition-colors placeholder-ivory-border'

  if (loadingSvc) return (
    <div className="px-4 py-4 flex justify-center border-t border-ivory-border bg-ivory/40">
      <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="border-t border-ivory-border px-4 py-4 space-y-3 bg-ivory/40">
      <p className="text-vip-black font-playfair font-semibold text-sm">Nouvelle réservation</p>

      {error && (
        <div className="bg-bordeaux/10 border border-bordeaux/25 rounded-lg px-3 py-2 text-bordeaux text-xs">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-warm-gray mb-1">Barbier</label>
          <select value={form.barberId} onChange={e => setForm(p => ({ ...p, barberId: e.target.value }))} className={inputCls}>
            {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-warm-gray mb-1">Heure</label>
          <select value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} className={`${inputCls} font-mono`}>
            {AGENDA_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-warm-gray mb-1">Service</label>
        <select value={form.serviceId} onChange={e => setForm(p => ({ ...p, serviceId: e.target.value }))} required className={inputCls}>
          <option value="">Choisir un service…</option>
          {services.map(s => <option key={s.id} value={s.id}>{s.name} — {s.price} €</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-warm-gray mb-1">Nom client</label>
          <input
            type="text" value={form.clientName} placeholder="Prénom Nom" autoComplete="off"
            onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-warm-gray mb-1">Téléphone</label>
          <input
            type="tel" value={form.clientPhone} placeholder="06 12 34 56 78" inputMode="tel"
            onChange={e => setForm(p => ({ ...p, clientPhone: e.target.value }))}
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-ivory-border text-warm-gray text-sm hover:bg-ivory-dark transition-colors">
          Annuler
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-vip-black text-ivory text-sm font-bold disabled:opacity-40 hover:bg-bordeaux transition-colors">
          {saving
            ? <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-ivory border-t-transparent rounded-full animate-spin" />
                Création…
              </span>
            : 'Confirmer'
          }
        </button>
      </div>
    </form>
  )
}

// ─── AgendaPanel (owner day view) ────────────────────────────────────────────

function AgendaPanel({ date, bookings, barbers, selectedBarberId, onClose, onCreated }) {
  const [creating, setCreating] = useState(false)

  const label  = localDateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })
  const active = useMemo(() => bookings.filter(b => b.status !== 'cancelled').length, [bookings])

  // One booking per slot max (UNIQUE constraint on booking_date+time)
  const bookingBySlot = useMemo(() => {
    const map = {}
    bookings.forEach(b => { map[b.booking_time.slice(0, 5)] = b })
    return map
  }, [bookings])

  const selectedBarber = useMemo(
    () => barbers.find(b => b.id === selectedBarberId),
    [barbers, selectedBarberId],
  )
  const color = selectedBarber?.color ?? BARBER_COLORS[0]

  return (
    <div className="bg-white border border-ivory-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ivory-border">
        <div>
          <p className="text-vip-black font-playfair font-semibold capitalize text-sm">{label}</p>
          <p className="text-warm-gray text-xs mt-0.5">
            {active} résa active{active !== 1 ? 's' : ''}
            {selectedBarber && (
              <> · <span style={{ color }} className="font-medium">✂ {selectedBarber.name}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-vip-black text-ivory hover:bg-bordeaux transition-colors font-medium"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Créer
            </button>
          )}
          <button onClick={onClose} className="text-ivory-border hover:text-vip-black transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Inline create form */}
      {creating && (
        <CreateBookingForm
          date={date}
          defaultBarberId={selectedBarberId}
          barbers={barbers}
          onSuccess={() => { setCreating(false); onCreated() }}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* Agenda grid — scrollable, 48px per slot */}
      <div className="overflow-y-auto" style={{ maxHeight: '22rem' }}>
        {AGENDA_SLOTS.map(slot => {
          const booking = bookingBySlot[slot]
          const isHour  = slot.endsWith(':00')

          return (
            <div key={slot} className="flex border-b border-ivory-border/25 last:border-0" style={{ minHeight: '48px' }}>
              {/* Time label — only shown on :00 slots for readability */}
              <div className={`w-14 shrink-0 flex items-start pt-2 pl-3 text-xs select-none ${isHour ? 'text-warm-gray font-medium' : 'text-transparent'}`}>
                {slot}
              </div>

              {/* Slot content */}
              <div className="flex-1 py-1 pr-3 pl-1">
                {booking ? (
                  <div
                    className={`rounded-lg px-2.5 py-1.5 min-h-[38px] flex flex-col justify-center ${booking.status === 'cancelled' ? 'opacity-40' : ''}`}
                    style={{ backgroundColor: `${color}18`, borderLeft: `3px solid ${color}` }}
                  >
                    <p className="text-vip-black font-semibold text-xs leading-tight font-playfair">
                      {booking.client_name}
                    </p>
                    <p className="text-warm-gray text-[10px] leading-tight mt-0.5">
                      {booking.services?.name}
                      {booking.services?.duration_minutes && ` · ${booking.services.duration_minutes} min`}
                    </p>
                    {booking.status === 'cancelled' && (
                      <p className="text-bordeaux text-[10px] mt-0.5">Annulé</p>
                    )}
                  </div>
                ) : (
                  /* Empty slot — subtle top border on :00 for visual rhythm */
                  <div className={`min-h-[38px] rounded-sm ${isHour ? 'border-t border-ivory-border/30' : ''}`} />
                )}
              </div>
            </div>
          )
        })}

        {/* 19:00 closing marker */}
        <div className="flex border-t border-ivory-border/25" style={{ minHeight: '20px' }}>
          <div className="w-14 shrink-0 pl-3 pt-1 text-xs text-warm-gray font-medium select-none">19:00</div>
          <div className="flex-1" />
        </div>
      </div>
    </div>
  )
}

// ─── Main CalendarView ────────────────────────────────────────────────────────

export default function CalendarView({ barberId, isOwner }) {
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [bookingsByDate, setBookingsByDate] = useState({})
  const [selectedDate,   setSelectedDate]   = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [movingBooking,  setMovingBooking]  = useState(null)

  // Owner-specific: list of {id, name, color} + which barber is selected
  const [barbers,          setBarbers]          = useState([])
  const [selectedBarberId, setSelectedBarberId] = useState(null)

  const today = getToday()

  // Fetch active barbers once for owner — assigns colors from fixed palette
  useEffect(() => {
    if (!isOwner) return
    supabase
      .from('barbers')
      .select('id, name')
      .eq('active', true)
      .order('name')
      .then(({ data }) => {
        const withColors = (data || [])
          .sort((a, b) => {
            if (a.id === barberId) return -1
            if (b.id === barberId) return 1
            return a.name.localeCompare(b.name)
          })
          .map((b, i) => ({
          ...b,
          color: BARBER_COLORS[i % BARBER_COLORS.length],
        }))
        setBarbers(withColors)
        if (withColors.length > 0) {
          setSelectedBarberId(withColors[0].id)
        } else {
          setLoading(false) // no barbers → stop loading
        }
      })
  }, [isOwner])

  // fetchMonth — re-created only when barber or month changes
  const fetchMonth = useCallback(async (y, m) => {
    // Owner: wait until a barber chip is selected (barbers fetch may still be in flight)
    if (isOwner && !selectedBarberId) return

    setLoading(true)
    const pad = n => String(n).padStart(2, '0')
    let q = supabase
      .from('bookings')
      .select('*, services(name, duration_minutes, price), barbers(name)')
      .gte('booking_date', `${y}-${pad(m + 1)}-01`)
      .lte('booking_date', `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`)
      .order('booking_time')

    q = isOwner
      ? q.eq('barber_id', selectedBarberId)  // owner sees one barber at a time
      : q.eq('barber_id', barberId)           // barber sees only their own

    const { data } = await q
    const grouped = {}
    ;(data || []).forEach(b => {
      if (!grouped[b.booking_date]) grouped[b.booking_date] = []
      grouped[b.booking_date].push(b)
    })
    setBookingsByDate(grouped)
    setLoading(false)
  }, [barberId, isOwner, selectedBarberId])

  // Re-fetch when month changes or when fetchMonth reference changes (barber switch)
  useEffect(() => { fetchMonth(year, month) }, [year, month, fetchMonth])

  const prevMonth = useCallback(() => {
    setSelectedDate(null)
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }, [month])

  const nextMonth = useCallback(() => {
    setSelectedDate(null)
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }, [month])

  const handleStatusChange = useCallback((id, status) => {
    setBookingsByDate(prev => {
      const updated = {}
      for (const date in prev) updated[date] = prev[date].map(b => b.id === id ? { ...b, status } : b)
      return updated
    })
    supabase.from('bookings').update({ status }).eq('id', id)
      .then(() => fetchMonth(year, month))
  }, [fetchMonth, year, month])

  const handleMoved = useCallback((updatedBooking) => {
    setBookingsByDate(prev => {
      const updated = {}
      for (const date in prev) {
        const filtered = prev[date].filter(b => b.id !== updatedBooking.id)
        if (filtered.length) updated[date] = filtered
      }
      const newDate = updatedBooking.booking_date
      const [ny, nm] = newDate.split('-').map(Number)
      if (ny === year && nm - 1 === month) {
        updated[newDate] = [...(updated[newDate] || []), updatedBooking]
          .sort((a, b) => a.booking_time.localeCompare(b.booking_time))
      }
      return updated
    })
    setSelectedDate(updatedBooking.booking_date)
    setMovingBooking(null)
  }, [year, month])

  // Dot color: owner uses selected barber's color, non-owner stays gold
  const dotColor = useMemo(
    () => isOwner
      ? (barbers.find(b => b.id === selectedBarberId)?.color ?? '#C9A84C')
      : '#C9A84C',
    [isOwner, barbers, selectedBarberId],
  )

  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month])

  return (
    <div>
      {/* Barber selector chips — owner only */}
      {isOwner && barbers.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1 snap-x">
          {barbers.map(b => {
            const isSel = b.id === selectedBarberId
            return (
              <button
                key={b.id}
                onClick={() => { setSelectedBarberId(b.id); setSelectedDate(null) }}
                className={`snap-start shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                  isSel
                    ? 'bg-vip-black text-ivory'
                    : 'bg-white text-warm-gray border-ivory-border hover:text-vip-black hover:border-warm-gray/50'
                }`}
                style={isSel ? { borderColor: b.color } : {}}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                {b.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-ivory-border text-warm-gray hover:text-vip-black hover:border-gold/60 transition-colors"
          aria-label="Mois précédent">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-base font-playfair font-semibold text-vip-black capitalize">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-ivory-border text-warm-gray hover:text-vip-black hover:border-gold/60 transition-colors"
          aria-label="Mois suivant">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map(h => (
          <div key={h} className="text-center text-xs text-warm-gray font-medium py-1">{h}</div>
        ))}
      </div>

      {/* Calendar grid or loading skeleton */}
      {loading ? <CalendarSkeleton /> : (
        <>
          <div className="grid grid-cols-7 gap-px bg-ivory-border rounded-xl overflow-hidden border border-ivory-border">
            {calendarDays.map(({ dateStr, num, currentMonth }) => {
              const dayBookings = bookingsByDate[dateStr] || []
              const activeCount = dayBookings.filter(b => b.status !== 'cancelled').length
              const isToday    = dateStr === today
              const isSelected = dateStr === selectedDate && currentMonth

              return (
                <button
                  key={dateStr}
                  disabled={!currentMonth}
                  onClick={() => currentMonth && setSelectedDate(prev => prev === dateStr ? null : dateStr)}
                  className={[
                    'relative flex flex-col items-center justify-center py-2 min-h-[48px] transition-colors bg-ivory',
                    !currentMonth  ? 'opacity-20 cursor-default' : 'cursor-pointer hover:bg-ivory-dark',
                    isSelected     ? 'bg-vip-black hover:bg-vip-black' : '',
                    isToday && !isSelected ? 'bg-gold/10' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span className={`text-sm font-medium leading-none ${
                    isSelected ? 'text-ivory' : isToday ? 'text-gold' : 'text-vip-black'
                  }`}>
                    {num}
                  </span>
                  {activeCount > 0 && currentMonth && (
                    <div className="flex items-center gap-0.5 mt-1">
                      {/* Dot color: selected barber's color for owner, gold for non-owner */}
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: isSelected ? '#ffffff' : dotColor }}
                      />
                      {activeCount > 1 && (
                        <span
                          className="text-[10px] leading-none font-semibold"
                          style={{ color: isSelected ? '#ffffff' : dotColor }}
                        >
                          {activeCount}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {selectedDate && (
            <div className="mt-4">
              {isOwner ? (
                // Owner: agenda view with time grid + create button
                <AgendaPanel
                  date={selectedDate}
                  bookings={bookingsByDate[selectedDate] || []}
                  barbers={barbers}
                  selectedBarberId={selectedBarberId}
                  onClose={() => setSelectedDate(null)}
                  onCreated={() => fetchMonth(year, month)}
                />
              ) : (
                // Non-owner: existing DayPanel unchanged
                <DayPanel
                  date={selectedDate}
                  bookings={bookingsByDate[selectedDate] || []}
                  onClose={() => setSelectedDate(null)}
                  onStatusChange={handleStatusChange}
                  onMove={setMovingBooking}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* MoveModal — only reachable from non-owner DayPanel */}
      {movingBooking && (
        <MoveModal
          booking={movingBooking}
          onClose={() => setMovingBooking(null)}
          onMoved={handleMoved}
        />
      )}
    </div>
  )
}
