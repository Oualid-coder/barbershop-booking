import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDateShort, generateTimeSlots, getDayOfWeek, getNext30Days } from '../../lib/bookingUtils'
import {
  getToday,
  CalendarSkeleton,
  BookingCard,
  MoveModal,
  DayPanel,
} from '../../components/admin/shared'

const DAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTH_NAMES = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

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

export default function CalendarView({ barberId }) {
  const now  = new Date()
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
    const { data } = await supabase
      .from('bookings')
      .select('*, services(name, duration_minutes, price)')
      .gte('booking_date', `${y}-${pad(m + 1)}-01`)
      .lte('booking_date', `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`)
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
      for (const date in prev) {
        updated[date] = prev[date].map(b => b.id === id ? { ...b, status } : b)
      }
      return updated
    })
    supabase.from('bookings').update({ status }).eq('id', id).then(() => {
      fetchMonth(year, month)
    })
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

      {/* Calendar grid or skeleton */}
      {loading ? <CalendarSkeleton /> : (
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
                      <span className="w-1.5 h-1.5 rounded-full bg-gold" />
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
