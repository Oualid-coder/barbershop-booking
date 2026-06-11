import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import {
  generateTimeSlots,
  getDayOfWeek,
  getNext30Days,
  formatDateShort,
} from '../lib/bookingUtils'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES   = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const DAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTH_NAMES = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

const TABS = [
  { id: 'today',    label: "Aujourd'hui" },
  { id: 'calendar', label: 'Calendrier'  },
  { id: 'services', label: 'Services'    },
  { id: 'horaires', label: 'Horaires'    },
  { id: 'qr',       label: 'QR Code'     },
]

const STATUS_BADGE = {
  pending:   'bg-ivory-dark text-warm-gray border border-ivory-border',
  confirmed: 'bg-gold/10 text-gold border border-gold/30',
  cancelled: 'bg-bordeaux/10 text-bordeaux border border-bordeaux/25',
}
const STATUS_LABEL = {
  pending:   'En attente',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

function localDateLabel(dateStr, opts = {}) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', opts)
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function Toggle({ checked, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-gold' : 'bg-ivory-border'
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  )
}

function Spinner({ small = false }) {
  return (
    <div className={`flex items-center justify-center ${small ? 'h-12' : 'h-40'}`}>
      <div className={`border-2 border-gold border-t-transparent rounded-full animate-spin ${small ? 'w-4 h-4' : 'w-6 h-6'}`} />
    </div>
  )
}

function Empty({ message, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-ivory-dark border border-ivory-border flex items-center justify-center mb-3">
        <svg className="w-4 h-4 text-ivory-border" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-warm-gray text-sm">{message}</p>
      {sub && <p className="text-ivory-border text-xs mt-1">{sub}</p>}
    </div>
  )
}

// ─── Booking card ─────────────────────────────────────────────────────────────

function BookingCard({ booking, onStatusChange, onMove }) {
  const cancelled = booking.status === 'cancelled'

  return (
    <div className={`bg-white border border-ivory-border rounded-xl overflow-hidden transition-opacity ${cancelled ? 'opacity-40' : ''}`}>
      <div className="flex items-start gap-3 px-4 pt-3 pb-2">
        <span className="text-gold font-playfair font-bold text-base w-12 shrink-0 mt-0.5">
          {booking.booking_time.slice(0, 5)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-vip-black font-semibold text-sm leading-snug font-playfair">{booking.client_name}</p>
              <a
                href={`tel:${booking.client_phone}`}
                className="text-warm-gray text-xs hover:text-gold transition-colors"
              >
                {booking.client_phone}
              </a>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[booking.status]}`}>
              {STATUS_LABEL[booking.status]}
            </span>
          </div>
          <p className="text-warm-gray text-xs mt-1.5">
            {booking.services?.name}
            {booking.services?.duration_minutes && ` · ${booking.services.duration_minutes} min`}
            {booking.services?.price != null && ` · ${booking.services.price} €`}
          </p>
        </div>
      </div>

      {!cancelled && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-ivory-border/60 flex-wrap">
          {booking.status === 'pending' && (
            <button
              onClick={() => onStatusChange(booking.id, 'confirmed')}
              className="text-xs px-2.5 py-1 rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 transition-colors"
            >
              Confirmer
            </button>
          )}
          <button
            onClick={() => onStatusChange(booking.id, 'cancelled')}
            className="text-xs px-2.5 py-1 rounded-lg bg-bordeaux/10 text-bordeaux border border-bordeaux/25 hover:bg-bordeaux/20 transition-colors"
          >
            Annuler
          </button>
          {onMove && (
            <button
              onClick={() => onMove(booking)}
              className="ml-auto text-xs px-2.5 py-1 rounded-lg bg-ivory-dark text-warm-gray border border-ivory-border hover:bg-ivory-dark/80 hover:text-vip-black transition-colors"
            >
              Déplacer →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Move modal ───────────────────────────────────────────────────────────────

function MoveModal({ booking, onClose, onMoved }) {
  const [businessHours, setBusinessHours] = useState([])
  const [targetDate, setTargetDate] = useState(null)
  const [targetTime, setTargetTime] = useState(null)
  const [slots, setSlots] = useState([])
  const [loadingHours, setLoadingHours] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.from('business_hours').select('*').order('day_of_week').then(({ data }) => {
      setBusinessHours(data || [])
      setLoadingHours(false)
    })
  }, [])

  const closedDays     = businessHours.filter(h => h.is_closed).map(h => h.day_of_week)
  const availableDates = getNext30Days().filter(d => !closedDays.includes(getDayOfWeek(d)))

  const loadSlots = useCallback(async (date) => {
    setLoadingSlots(true)
    setTargetTime(null)
    setError(null)

    const hours = businessHours.find(h => h.day_of_week === getDayOfWeek(date))
    if (!hours || hours.is_closed) { setSlots([]); setLoadingSlots(false); return }

    const allSlots = generateTimeSlots(
      hours.open_time.slice(0, 5),
      hours.close_time.slice(0, 5),
      booking.services.duration_minutes
    )

    const [{ data: blocked }, { data: existing }] = await Promise.all([
      supabase.from('blocked_slots').select('blocked_time').eq('blocked_date', date),
      supabase.from('bookings')
        .select('booking_time')
        .eq('booking_date', date)
        .neq('status', 'cancelled')
        .neq('id', booking.id),
    ])

    const taken = new Set([
      ...(blocked  || []).map(s => s.blocked_time.slice(0, 5)),
      ...(existing || []).map(b => b.booking_time.slice(0, 5)),
    ])

    setSlots(allSlots.filter(s => !taken.has(s)))
    setLoadingSlots(false)
  }, [booking, businessHours])

  function handleDateSelect(date) {
    setTargetDate(date)
    loadSlots(date)
  }

  async function handleConfirm() {
    if (!targetDate || !targetTime) return
    setSaving(true)
    setError(null)

    const { error } = await supabase
      .from('bookings')
      .update({ booking_date: targetDate, booking_time: targetTime })
      .eq('id', booking.id)

    setSaving(false)

    if (error) {
      if (error.code === '23505') {
        setError("Ce créneau vient d'être réservé. Choisissez-en un autre.")
        loadSlots(targetDate)
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.')
      }
      return
    }

    onMoved({ ...booking, booking_date: targetDate, booking_time: targetTime })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-vip-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white border border-ivory-border rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-y-auto shadow-2xl">
        {/* Modal header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-ivory-border px-5 py-4 flex items-start justify-between">
          <div>
            <h3 className="text-vip-black font-playfair font-semibold">Déplacer le rendez-vous</h3>
            <p className="text-warm-gray text-xs mt-0.5">
              {booking.client_name} · {booking.services?.name}
            </p>
            <p className="text-ivory-border text-xs">
              Actuellement : {localDateLabel(booking.booking_date, { weekday: 'short', day: 'numeric', month: 'short' })} à {booking.booking_time.slice(0, 5)}
            </p>
          </div>
          <button onClick={onClose} className="text-ivory-border hover:text-vip-black transition-colors mt-0.5 shrink-0 ml-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {loadingHours ? <Spinner small /> : (
            <>
              {/* Date selector */}
              <div>
                <p className="text-vip-black text-sm font-medium mb-3">Nouvelle date</p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                  {availableDates.map(date => {
                    const { day, num, month } = formatDateShort(date)
                    const isSel = date === targetDate
                    return (
                      <button
                        key={date}
                        onClick={() => handleDateSelect(date)}
                        className={[
                          'flex-shrink-0 snap-start flex flex-col items-center w-12 py-2.5 rounded-xl border-2 transition-all',
                          isSel
                            ? 'bg-vip-black border-vip-black'
                            : 'bg-white border-ivory-border hover:border-gold/60',
                        ].join(' ')}
                      >
                        <span className={`text-xs capitalize ${isSel ? 'text-gold' : 'text-warm-gray'}`}>{day}</span>
                        <span className={`text-base font-playfair font-bold leading-tight ${isSel ? 'text-ivory' : 'text-vip-black'}`}>{num}</span>
                        <span className={`text-xs capitalize ${isSel ? 'text-gold/70' : 'text-warm-gray'}`}>{month}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Slot selector */}
              {targetDate && (
                <div>
                  <p className="text-vip-black text-sm font-medium mb-3">Nouveau créneau</p>
                  {loadingSlots ? <Spinner small /> : slots.length === 0 ? (
                    <p className="text-warm-gray text-sm text-center py-4">Aucun créneau disponible</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {slots.map(slot => (
                        <button
                          key={slot}
                          onClick={() => setTargetTime(slot)}
                          className={[
                            'py-2.5 rounded-xl border-2 text-sm font-semibold transition-all',
                            targetTime === slot
                              ? 'bg-vip-black border-vip-black text-ivory'
                              : 'bg-white border-ivory-border text-vip-black hover:border-gold/60',
                          ].join(' ')}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="bg-bordeaux/10 border border-bordeaux/25 rounded-xl px-4 py-3 text-bordeaux text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3.5 rounded-xl border-2 border-ivory-border text-warm-gray text-sm font-medium hover:bg-ivory-dark transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!targetDate || !targetTime || saving}
                  className="flex-1 py-3.5 rounded-xl bg-vip-black text-ivory text-sm font-bold disabled:opacity-30 hover:bg-bordeaux transition-colors"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-ivory border-t-transparent rounded-full animate-spin" />
                      Déplacement…
                    </span>
                  ) : 'Confirmer'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Day panel ────────────────────────────────────────────────────────────────

function DayPanel({ date, bookings, onClose, onStatusChange, onMove }) {
  const label  = localDateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })
  const active = bookings.filter(b => b.status !== 'cancelled').length

  return (
    <div className="bg-white border border-ivory-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-ivory-border">
        <div>
          <p className="text-vip-black font-playfair font-semibold capitalize text-sm">{label}</p>
          <p className="text-warm-gray text-xs mt-0.5">
            {active} réservation{active !== 1 ? 's' : ''} active{active !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={onClose} className="text-ivory-border hover:text-vip-black transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
        {bookings.length === 0 ? (
          <Empty message="Aucune réservation" sub="Journée libre" />
        ) : (
          bookings.map(b => (
            <BookingCard
              key={b.id}
              booking={b}
              onStatusChange={onStatusChange}
              onMove={onMove}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Calendar view ────────────────────────────────────────────────────────────

function CalendarView({ barberId }) {
  const now   = new Date()
  const [year, setYear]                    = useState(now.getFullYear())
  const [month, setMonth]                  = useState(now.getMonth())
  const [bookingsByDate, setBookingsByDate] = useState({})
  const [selectedDate, setSelectedDate]    = useState(null)
  const [loading, setLoading]              = useState(true)
  const [movingBooking, setMovingBooking]  = useState(null)
  const today = getToday()

  const fetchMonth = useCallback(async (y, m) => {
    setLoading(true)
    const pad = n => String(n).padStart(2, '0')
    const firstDay = `${y}-${pad(m + 1)}-01`
    const lastDay  = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`

    const { data } = await supabase
      .from('bookings')
      .select('*, services(name, duration_minutes, price)')
      .gte('booking_date', firstDay)
      .lte('booking_date', lastDay)
      .eq('barber_id', barberId)
      .order('booking_time')

    const grouped = {}
    ;(data || []).forEach(b => {
      if (!grouped[b.booking_date]) grouped[b.booking_date] = []
      grouped[b.booking_date].push(b)
    })
    setBookingsByDate(grouped)
    setLoading(false)
  }, [barberId])

  useEffect(() => { fetchMonth(year, month) }, [year, month, fetchMonth])

  function prevMonth() {
    setSelectedDate(null)
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    setSelectedDate(null)
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  function handleStatusChange(id, status) {
    setBookingsByDate(prev => {
      const updated = {}
      for (const date in prev) {
        updated[date] = prev[date].map(b => b.id === id ? { ...b, status } : b)
      }
      return updated
    })
    supabase.from('bookings').update({ status }).eq('id', id).then(() => {
      fetchMonth(year, month)
    })
  }

  function handleMoved(updatedBooking) {
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
  }

  const calendarDays = getCalendarDays(year, month)

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-ivory-border text-warm-gray hover:text-vip-black hover:border-gold/60 transition-colors"
          aria-label="Mois précédent"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-base font-playfair font-semibold text-vip-black capitalize">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-ivory-border text-warm-gray hover:text-vip-black hover:border-gold/60 transition-colors"
          aria-label="Mois suivant"
        >
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

      {/* Calendar grid */}
      {loading ? <Spinner /> : (
        <>
          <div className="grid grid-cols-7 gap-px bg-ivory-border rounded-xl overflow-hidden border border-ivory-border">
            {calendarDays.map(({ dateStr, num, currentMonth }) => {
              const dayBookings = bookingsByDate[dateStr] || []
              const activeCount = dayBookings.filter(b => b.status !== 'cancelled').length
              const isToday     = dateStr === today
              const isSelected  = dateStr === selectedDate && currentMonth

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
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-gold' : 'bg-gold'}`} />
                      {activeCount > 1 && (
                        <span className={`text-[10px] leading-none font-semibold ${isSelected ? 'text-gold' : 'text-gold'}`}>
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
              <DayPanel
                date={selectedDate}
                bookings={bookingsByDate[selectedDate] || []}
                onClose={() => setSelectedDate(null)}
                onStatusChange={handleStatusChange}
                onMove={setMovingBooking}
              />
            </div>
          )}
        </>
      )}

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

// ─── Today view ───────────────────────────────────────────────────────────────

function TodayView({ barberId }) {
  const [bookings, setBookings]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [movingBooking, setMovingBooking] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*, services(name, duration_minutes, price)')
      .eq('booking_date', getToday())
      .eq('barber_id', barberId)
      .order('booking_time')
    setBookings(data || [])
    setLoading(false)
  }, [barberId])

  useEffect(() => { load() }, [load])

  function handleStatusChange(id, status) {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
    supabase.from('bookings').update({ status }).eq('id', id).then(() => {
      load()
    })
  }

  function handleMoved(updatedBooking) {
    setBookings(prev => prev.filter(b => b.id !== updatedBooking.id))
    setMovingBooking(null)
  }

  const today  = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const active = bookings.filter(b => b.status !== 'cancelled').length

  return (
    <div>
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <h2 className="text-base font-playfair font-semibold text-vip-black capitalize">{today}</h2>
          <p className="text-warm-gray text-xs mt-0.5">
            {active} réservation{active !== 1 ? 's' : ''} active{active !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={load} className="text-ivory-border hover:text-gold transition-colors" title="Actualiser">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {loading ? <Spinner /> : bookings.length === 0 ? (
        <Empty message="Aucune réservation aujourd'hui" sub="La journée est libre" />
      ) : (
        <div className="space-y-2">
          {bookings.map(b => (
            <BookingCard
              key={b.id}
              booking={b}
              onStatusChange={handleStatusChange}
              onMove={setMovingBooking}
            />
          ))}
        </div>
      )}

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

// ─── Services view ────────────────────────────────────────────────────────────

function ServicesView() {
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

  return (
    <div>
      <p className="text-warm-gray text-sm mb-5">Désactivez un service pour le masquer aux clients.</p>
      {loading ? <Spinner /> : (
        <div className="space-y-3">
          {services.map(s => (
            <div
              key={s.id}
              className={`bg-white border border-ivory-border rounded-xl px-4 py-3 flex items-center gap-4 transition-opacity ${!s.active ? 'opacity-40' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-vip-black font-playfair font-semibold text-sm">{s.name}</p>
                <p className="text-warm-gray text-xs mt-0.5">{s.duration_minutes} min · {s.price} €</p>
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

// ─── Hours view ───────────────────────────────────────────────────────────────

function HoursView() {
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

// ─── QR view ─────────────────────────────────────────────────────────────────

function QRView() {
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin

  return (
    <div className="flex flex-col items-center">
      <p className="text-warm-gray text-sm mb-8 text-center leading-relaxed max-w-xs">
        Placez ce QR code dans votre salon pour que les clients puissent réserver depuis leur téléphone.
      </p>

      <div id="qr-print-area" className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4 mb-6 shadow-sm border border-ivory-border">
        <QRCodeSVG value={appUrl} size={200} level="H" bgColor="#ffffff" fgColor="#0D0D0D" />
        <p className="text-warm-gray text-xs font-mono text-center break-all max-w-[200px]">{appUrl}</p>
      </div>

      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 bg-vip-black text-ivory font-bold px-6 py-3 rounded-xl hover:bg-bordeaux active:scale-[0.99] transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Imprimer le QR Code
      </button>
      <p className="text-ivory-border text-xs text-center mt-4">L'impression n'affichera que le QR code</p>
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('today')
  const [barber, setBarber]       = useState(undefined)
  const { session } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!session) return
    supabase
      .from('barbers')
      .select('id, name')
      .eq('user_id', session.user.id)
      .eq('active', true)
      .single()
      .then(({ data }) => setBarber(data ?? null))
  }, [session])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

  if (barber === undefined) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (barber === null) {
    return (
      <div className="min-h-screen bg-ivory flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-bordeaux/10 border border-bordeaux/25 flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-bordeaux" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-vip-black font-playfair font-semibold text-lg mb-2">Compte non configuré</h2>
        <p className="text-warm-gray text-sm mb-6 max-w-xs">
          Votre compte n'est associé à aucun barbier. Contactez l'administrateur.
        </p>
        <button
          onClick={handleLogout}
          className="text-xs text-warm-gray hover:text-bordeaux transition-colors"
        >
          Déconnexion
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ivory">
      {/* Header */}
      <header className="bg-vip-black flex items-center justify-between px-4 py-4">
        <div>
          <p className="text-gold text-[10px] tracking-[0.25em] uppercase font-medium mb-0.5">Dashboard</p>
          <h1 className="text-ivory font-playfair font-bold text-lg leading-none">
            VIP Cut's
            <span className="text-gold/60 font-normal text-sm ml-2">— {barber.name}</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-warm-gray text-xs hidden sm:block truncate max-w-[200px]">{session?.user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-xs text-warm-gray hover:text-bordeaux transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Déconnexion
          </button>
        </div>
      </header>

      {/* Nav tabs */}
      <nav className="flex gap-1 px-3 py-2 bg-vip-black border-t border-white/5 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-ivory text-vip-black'
                : 'text-warm-gray hover:bg-white/5 hover:text-ivory'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="px-4 py-6 max-w-2xl mx-auto">
        {activeTab === 'today'    && <TodayView barberId={barber.id} />}
        {activeTab === 'calendar' && <CalendarView barberId={barber.id} />}
        {activeTab === 'services' && <ServicesView />}
        {activeTab === 'horaires' && <HoursView />}
        {activeTab === 'qr'       && <QRView />}
      </main>
    </div>
  )
}
