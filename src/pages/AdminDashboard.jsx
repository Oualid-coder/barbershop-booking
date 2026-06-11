import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { initOneSignal, getNotificationPermission, requestPushPermission } from '../lib/onesignal'
import {
  getToday,
  BookingCard,
  MoveModal,
  BookingSkeleton,
  Empty,
} from '../components/admin/shared'

// ─── Lazy-loaded tab views ────────────────────────────────────────────────────
// Loaded on first tab activation — TodayView stays inline (default tab)

const CalendarView = lazy(() => import('./admin/CalendarView'))
const ServicesView = lazy(() => import('./admin/ServicesView'))
const HoursView    = lazy(() => import('./admin/HoursView'))
const QRView       = lazy(() => import('./admin/QRView'))

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'today',    label: "Aujourd'hui" },
  { id: 'calendar', label: 'Calendrier'  },
  { id: 'services', label: 'Services'    },
  { id: 'horaires', label: 'Horaires'    },
  { id: 'qr',       label: 'QR Code'     },
]

// ─── Skeleton fallbacks for Suspense ─────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-2 pt-2">
      {[1, 2, 3].map(i => <BookingSkeleton key={i} />)}
    </div>
  )
}

// ─── TodayView (inline — default tab, must render without async delay) ────────

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

  const handleStatusChange = useCallback((id, status) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
    supabase.from('bookings').update({ status }).eq('id', id).then(() => load())
  }, [load])

  const handleMoved = useCallback((updatedBooking) => {
    setBookings(prev => prev.filter(b => b.id !== updatedBooking.id))
    setMovingBooking(null)
  }, [])

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

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <BookingSkeleton key={i} />)}
        </div>
      ) : bookings.length === 0 ? (
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

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [activeTab, setActiveTab]   = useState('today')
  const [barber, setBarber]         = useState(undefined)
  const [notifPerm, setNotifPerm]   = useState(getNotificationPermission)
  const { session }  = useAuth()
  const navigate     = useNavigate()
  const osInitRef    = useRef(false)

  // initOneSignal (once) + barber fetch run in the same effect invocation
  useEffect(() => {
    if (!osInitRef.current) {
      osInitRef.current = true
      initOneSignal()
    }
    if (!session) return
    supabase
      .from('barbers')
      .select('id, name')
      .eq('user_id', session.user.id)
      .eq('active', true)
      .single()
      .then(({ data }) => setBarber(data ?? null))
  }, [session])

  useEffect(() => {
    function onPermissionChange() { setNotifPerm(getNotificationPermission()) }
    window.addEventListener('onesignal:permissionChange', onPermissionChange)
    return () => window.removeEventListener('onesignal:permissionChange', onPermissionChange)
  }, [])

  const handleEnableNotifications = useCallback(async () => {
    await requestPushPermission()
    setNotifPerm(getNotificationPermission())
  }, [])

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
        <button onClick={handleLogout} className="text-xs text-warm-gray hover:text-bordeaux transition-colors">
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
        <div className="flex items-center gap-3">
          {notifPerm !== 'granted' && notifPerm !== 'denied' && (
            <button
              onClick={handleEnableNotifications}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gold/40 text-gold hover:bg-gold/10 transition-colors"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="hidden sm:inline">Activer les notifications</span>
            </button>
          )}
          <span className="text-warm-gray text-xs hidden sm:block truncate max-w-[160px]">{session?.user?.email}</span>
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
        {activeTab === 'today' && <TodayView barberId={barber.id} />}
        <Suspense fallback={<TabSkeleton />}>
          {activeTab === 'calendar' && <CalendarView barberId={barber.id} />}
          {activeTab === 'services' && <ServicesView />}
          {activeTab === 'horaires' && <HoursView />}
          {activeTab === 'qr'       && <QRView />}
        </Suspense>
      </main>
    </div>
  )
}
