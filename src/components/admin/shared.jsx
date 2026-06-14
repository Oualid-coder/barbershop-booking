import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  generateTimeSlots,
  getDayOfWeek,
  getNext30Days,
  formatDateShort,
} from '../../lib/bookingUtils'

// ─── Constants ────────────────────────────────────────────────────────────────

export const STATUS_BADGE = {
  pending:   'bg-ivory-dark text-warm-gray border border-ivory-border',
  confirmed: 'bg-gold/10 text-gold border border-gold/30',
  cancelled: 'bg-bordeaux/10 text-bordeaux border border-bordeaux/25',
}
export const STATUS_LABEL = {
  pending:   'En attente',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
}

export const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function localDateLabel(dateStr, opts = {}) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', opts)
}

// ─── Primitives ───────────────────────────────────────────────────────────────

export function Toggle({ checked, onChange, label }) {
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

export function Spinner({ small = false }) {
  return (
    <div className={`flex items-center justify-center ${small ? 'h-12' : 'h-40'}`}>
      <div className={`border-2 border-gold border-t-transparent rounded-full animate-spin ${small ? 'w-4 h-4' : 'w-6 h-6'}`} />
    </div>
  )
}

export function BookingSkeleton() {
  return (
    <div className="bg-white border border-ivory-border rounded-xl overflow-hidden animate-pulse">
      <div className="flex items-start gap-3 px-4 pt-3 pb-3">
        <div className="w-12 h-5 bg-ivory-dark rounded shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 bg-ivory-dark rounded w-2/5" />
              <div className="h-3 bg-ivory-dark rounded w-1/4" />
            </div>
            <div className="h-5 bg-ivory-dark rounded-full w-16 shrink-0" />
          </div>
          <div className="h-3 bg-ivory-dark rounded w-3/5" />
        </div>
      </div>
    </div>
  )
}

export function CalendarSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-5">
        <div className="w-9 h-9 bg-ivory-dark rounded-xl" />
        <div className="h-5 bg-ivory-dark rounded w-36" />
        <div className="w-9 h-9 bg-ivory-dark rounded-xl" />
      </div>
      <div className="grid grid-cols-7 mb-1 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-4 bg-ivory-dark rounded mx-1" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-ivory-border rounded-xl overflow-hidden border border-ivory-border">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="min-h-[48px] bg-ivory" />
        ))}
      </div>
    </div>
  )
}

export function Empty({ message, sub }) {
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

export function BookingCard({ booking, onStatusChange, onMove, barberName }) {
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
              <a href={`tel:${booking.client_phone}`} className="text-warm-gray text-xs hover:text-gold transition-colors">
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
          {barberName && (
            <p className="text-ivory-border text-xs mt-0.5">✂ {barberName}</p>
          )}
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

export function MoveModal({ booking, onClose, onMoved }) {
  const [businessHours, setBusinessHours] = useState([])
  const [targetDate, setTargetDate]       = useState(null)
  const [targetTime, setTargetTime]       = useState(null)
  const [slots, setSlots]                 = useState([])
  const [loadingHours, setLoadingHours]   = useState(true)
  const [loadingSlots, setLoadingSlots]   = useState(false)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState(null)

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

  function handleDateSelect(date) { setTargetDate(date); loadSlots(date) }

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
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-ivory-border px-5 py-4 flex items-start justify-between">
          <div>
            <h3 className="text-vip-black font-playfair font-semibold">Déplacer le rendez-vous</h3>
            <p className="text-warm-gray text-xs mt-0.5">{booking.client_name} · {booking.services?.name}</p>
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
                          isSel ? 'bg-vip-black border-vip-black' : 'bg-white border-ivory-border hover:border-gold/60',
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
                <div className="bg-bordeaux/10 border border-bordeaux/25 rounded-xl px-4 py-3 text-bordeaux text-sm">{error}</div>
              )}

              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-3.5 rounded-xl border-2 border-ivory-border text-warm-gray text-sm font-medium hover:bg-ivory-dark transition-colors">
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

export function DayPanel({ date, bookings, onClose, onStatusChange, onMove, isOwner }) {
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
            <BookingCard key={b.id} booking={b} onStatusChange={onStatusChange} onMove={onMove} barberName={isOwner ? b.barbers?.name : undefined} />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Inline number editor ─────────────────────────────────────────────────────

export function InlineText({ value, onCommit, placeholder = '', className = '' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)

  function open() { setDraft(value); setEditing(true) }

  function commit() {
    setEditing(false)
    if (draft.trim() && draft.trim() !== value) onCommit(draft.trim())
  }

  function handleKey(e) {
    if (e.key === 'Enter') { e.target.blur(); commit() }
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="text" value={draft} autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={handleKey}
        placeholder={placeholder}
        className={`bg-white border border-ivory-border rounded-lg px-1.5 py-0.5 text-vip-black focus:outline-none focus:border-gold transition-colors ${className}`}
      />
    )
  }

  return (
    <button
      onClick={open}
      title="Cliquer pour modifier"
      className={`text-left hover:text-gold transition-colors underline decoration-dotted underline-offset-2 ${className}`}
    >
      {value || <span className="text-ivory-border italic">{placeholder}</span>}
    </button>
  )
}

export function InlineNumber({ value, onCommit, suffix, min, step = 1, className = '' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(String(value))

  function open() { setDraft(String(value)); setEditing(true) }

  function commit() {
    const parsed = step === 1 ? parseInt(draft, 10) : parseFloat(draft)
    setEditing(false)
    if (!isNaN(parsed) && parsed >= (min ?? 0) && parsed !== value) onCommit(parsed)
  }

  function handleKey(e) {
    if (e.key === 'Enter') { e.target.blur(); commit() }
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="number" value={draft} min={min} step={step} autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={handleKey}
        className={`bg-white border border-ivory-border rounded-lg px-1.5 py-0.5 text-vip-black text-xs focus:outline-none focus:border-gold transition-colors w-16 ${className}`}
      />
    )
  }

  return (
    <button
      onClick={open}
      title="Cliquer pour modifier"
      className="text-warm-gray text-xs hover:text-gold transition-colors underline decoration-dotted underline-offset-2"
    >
      {value}{suffix}
    </button>
  )
}
