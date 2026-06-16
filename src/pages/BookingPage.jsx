import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { notifyNewBooking } from '../lib/onesignal'
import {
  generateTimeSlots,
  getDayOfWeek,
  formatDate,
  getNext30Days,
} from '../lib/bookingUtils'
import StepIndicator from '../components/StepIndicator'
import ServiceCard from '../components/ServiceCard'
import DateSelector from '../components/DateSelector'
import TimeSlotGrid from '../components/TimeSlotGrid'

const STEPS = ['Barbier', 'Service', 'Créneau', 'Confirmation']

// ─── Razor SVG décoration header ─────────────────────────────────────────────

function RazorDecor() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Handle/écailles */}
      <rect x="3" y="33" width="20" height="14" rx="4" fill="#C9A84C" opacity="0.12"/>
      <rect x="4" y="34" width="18" height="12" rx="3.5" stroke="#C9A84C" strokeWidth="1.5" opacity="0.5"/>
      {/* Rivets */}
      <circle cx="9"  cy="40" r="1.5" fill="#C9A84C" opacity="0.45"/>
      <circle cx="16" cy="40" r="1.5" fill="#C9A84C" opacity="0.45"/>
      {/* Pivot */}
      <circle cx="26" cy="40" r="3.5" fill="#C9A84C" opacity="0.35"/>
      <circle cx="26" cy="40" r="1.8" fill="#C9A84C" opacity="0.7"/>
      <circle cx="26" cy="40" r="0.7" fill="#0D0D0D"/>
      {/* Lame (corps) */}
      <path d="M26 35.5L73 22L75 28V52L26 44.5Z" fill="#0D0D0D" opacity="0.07"/>
      {/* Dos de lame (or) */}
      <path d="M26 35.5L73 22" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round"/>
      {/* Tranchant (bas) */}
      <path d="M26 44.5L75 52L73 22" stroke="#0D0D0D" strokeOpacity="0.18" strokeWidth="1" strokeLinejoin="round"/>
      {/* Pointe de lame */}
      <path d="M73 22L75 28V52L73 50Z" fill="#0D0D0D" opacity="0.2"/>
    </svg>
  )
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ service, date, time, barberName, onReset }) {
  return (
    <div className="min-h-screen bg-ivory flex flex-col items-center justify-center px-6 text-center font-dm">
      <div className="w-16 h-16 rounded-full border-2 border-gold flex items-center justify-center mb-6">
        <svg className="w-7 h-7 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="font-playfair text-2xl font-bold text-vip-black mb-2">Réservation confirmée</h1>
      <p className="text-warm-gray text-sm mb-8 leading-relaxed max-w-xs">
        Votre rendez-vous est enregistré.<br />À bientôt chez VIP Cut's !
      </p>

      <div className="bg-white border border-ivory-border rounded-2xl w-full max-w-xs px-6 py-5 space-y-3 text-left mb-8">
        <p className="text-warm-gray text-xs uppercase tracking-widest mb-4 font-medium">Votre rendez-vous</p>
        {barberName && <Row label="Barbier" value={barberName} />}
        <Row label="Service" value={service?.name} />
        <Row label="Date" value={formatDate(date)} />
        <div className="flex justify-between border-t border-ivory-border pt-3">
          <span className="text-warm-gray text-sm">Heure</span>
          <span className="text-gold font-playfair font-bold text-lg">{time}</span>
        </div>
      </div>

      <button
        onClick={onReset}
        className="text-warm-gray text-sm hover:text-bordeaux transition-colors"
      >
        Faire une nouvelle réservation
      </button>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-warm-gray text-sm">{label}</span>
      <span className="text-vip-black text-sm font-medium text-right max-w-[55%]">{value}</span>
    </div>
  )
}

// ─── Back button ──────────────────────────────────────────────────────────────

function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-warm-gray text-sm mb-6 hover:text-bordeaux transition-colors group"
    >
      <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Retour
    </button>
  )
}

// ─── Booking page ─────────────────────────────────────────────────────────────

export default function BookingPage() {
  const [step, setStep] = useState(1)
  const [services, setServices] = useState([])
  const [businessHours, setBusinessHours] = useState([])
  const [barbers, setBarbers] = useState([])
  const [selectedBarber, setSelectedBarber] = useState(null)
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState(null)
  const [blockedSlots, setBlockedSlots] = useState([])
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [booked, setBooked] = useState(false)

  useEffect(() => {
    async function load() {
      const [
        { data: svc,   error: errSvc   },
        { data: hours, error: errHours },
        { data: brbs,  error: errBrbs  },
      ] = await Promise.all([
        supabase.from('services').select('*').eq('active', true).order('price'),
        supabase.from('business_hours').select('*').order('day_of_week'),
        supabase.from('barbers').select('id, name').eq('active', true).order('name'),
      ])
      if (errSvc)   console.error('[BookingPage] services:', errSvc)
      if (errHours) console.error('[BookingPage] business_hours:', errHours)
      if (errBrbs)  console.error('[BookingPage] barbers:', errBrbs)
      setServices(svc || [])
      setBusinessHours(hours || [])
      setBarbers(brbs || [])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    supabase
      .from('blocked_slots')
      .select('blocked_time')
      .eq('blocked_date', selectedDate)
      .then(({ data }) => {
        setBlockedSlots(data?.map((s) => s.blocked_time.slice(0, 5)) || [])
      })
  }, [selectedDate])

  const closedDays = businessHours.filter((h) => h.is_closed).map((h) => h.day_of_week)
  const availableDates = getNext30Days().filter((d) => !closedDays.includes(getDayOfWeek(d)))

  const availableSlots = (() => {
    if (!selectedDate || !selectedService) return []
    const hours = businessHours.find((h) => h.day_of_week === getDayOfWeek(selectedDate))
    if (!hours || hours.is_closed) return []
    const all = generateTimeSlots(
      hours.open_time.slice(0, 5),
      hours.close_time.slice(0, 5),
      selectedService.duration_minutes
    )
    return all.filter((slot) => !blockedSlots.includes(slot))
  })()

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleSelectBarber(barber) {
    setSelectedBarber(barber)
    setSelectedService(null)
    setSelectedDate(null)
    setSelectedTime(null)
    setSubmitError(null)
    setStep(2)
  }

  function handleSelectService(service) {
    setSelectedService(service)
    setSelectedDate(null)
    setSelectedTime(null)
    setSubmitError(null)
    setStep(3)
  }

  function handleSelectDate(date) {
    setSelectedDate(date)
    setSelectedTime(null)
  }

  function handleProceedToConfirmation() {
    if (!selectedDate || !selectedTime) return
    setErrors({})
    setSubmitError(null)
    setStep(4)
  }

  function validate() {
    const errs = {}
    if (!clientName.trim()) errs.clientName = 'Votre nom est requis'
    if (!clientPhone.trim()) errs.clientPhone = 'Votre numéro est requis'
    else if (!/^[0-9+\s]{8,15}$/.test(clientPhone.trim())) errs.clientPhone = 'Numéro invalide'
    return errs
  }

  async function handleSubmit() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setSubmitting(true)
    setSubmitError(null)

    const { error } = await supabase.from('bookings').insert({
      service_id:   selectedService.id,
      barber_id:    selectedBarber?.id ?? null,
      client_name:  clientName.trim(),
      client_phone: clientPhone.trim(),
      booking_date: selectedDate,
      booking_time: selectedTime,
      status:       'confirmed',
    })

    setSubmitting(false)

    if (error) {
      if (error.code === '23505') {
        setSubmitError("Ce créneau vient d'être réservé. Veuillez en choisir un autre.")
        setStep(3)
        setSelectedTime(null)
      } else if (error.message?.includes('RATE_LIMIT_EXCEEDED')) {
        setSubmitError('Vous avez atteint la limite de réservations (3 par 24h). Contactez le salon directement.')
      } else {
        setSubmitError('Une erreur est survenue. Veuillez réessayer.')
      }
      return
    }

    setBooked(true)

    notifyNewBooking({
      barber_id:    selectedBarber?.id ?? null,
      client_name:  clientName.trim(),
      client_phone: clientPhone.trim(),
      service_name: selectedService.name,
      booking_date: selectedDate,
      booking_time: selectedTime,
    })
  }

  function handleReset() {
    setStep(1)
    setSelectedBarber(null)
    setSelectedService(null)
    setSelectedDate(null)
    setSelectedTime(null)
    setClientName('')
    setClientPhone('')
    setErrors({})
    setSubmitError(null)
    setBooked(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (booked) {
    return (
      <SuccessScreen
        service={selectedService}
        date={selectedDate}
        time={selectedTime}
        barberName={selectedBarber?.name}
        onReset={handleReset}
      />
    )
  }

  return (
    <div className="min-h-screen bg-ivory font-dm text-vip-black">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="relative px-6 pt-10 pb-6 border-b border-ivory-border overflow-hidden">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-px bg-gold" />
              <p className="text-gold text-xs font-medium tracking-[0.35em] uppercase">Paris 18e</p>
            </div>
            <h1 className="font-playfair text-3xl font-bold tracking-[0.12em] text-vip-black leading-none">
              VIP Cut's
            </h1>
            <p className="text-warm-gray text-xs mt-1.5 tracking-wide uppercase font-medium">
              Coiffeur Barbier
            </p>
            <p className="text-warm-gray text-xs mt-1 flex items-center gap-1">
              <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              86 rue Joseph de Maistre · 75018 Paris
            </p>
          </div>
        </div>
      </header>

      {/* Gold separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-40" />

      <StepIndicator step={step} steps={STEPS} />

      <main className="px-5 pb-28 max-w-lg mx-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Étape 1 : Barbier ──────────────────────────────────── */}
            {step === 1 && (
              <section>
                <SectionHeader
                  title="Votre barbier"
                  sub="Choisissez avec qui vous souhaitez être coiffé"
                />
                <div className="space-y-3">
                  {barbers.map((barber) => {
                    const isSelected = selectedBarber?.id === barber.id
                    return (
                      <button
                        key={barber.id}
                        onClick={() => handleSelectBarber(barber)}
                        className={[
                          'w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-[0.99] text-left',
                          isSelected
                            ? 'border-gold bg-gold/5'
                            : 'border-ivory-border bg-white hover:border-gold/50',
                        ].join(' ')}
                      >
                        {/* Avatar */}
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-vip-black' : 'bg-ivory-dark'}`}>
                          <span className={`font-playfair text-2xl font-bold transition-colors ${isSelected ? 'text-gold' : 'text-warm-gray'}`}>
                            {barber.name.charAt(0)}
                          </span>
                        </div>
                        <span className="font-playfair text-xl font-semibold text-vip-black flex-1">
                          {barber.name}
                        </span>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center shrink-0">
                            <svg className="w-3 h-3 text-vip-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Étape 2 : Service ──────────────────────────────────── */}
            {step === 2 && (
              <section>
                <BackButton onClick={() => setStep(1)} />

                {/* Barbier sélectionné */}
                <div className="bg-white border border-ivory-border rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-vip-black flex items-center justify-center shrink-0">
                    <span className="font-playfair text-xs font-bold text-gold">
                      {selectedBarber?.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-playfair font-semibold text-vip-black">{selectedBarber?.name}</span>
                </div>

                <SectionHeader title="Votre prestation" sub="Sélectionnez un service" />
                <div className="space-y-3">
                  {services.map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      selected={selectedService?.id === service.id}
                      onSelect={() => handleSelectService(service)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Étape 3 : Date + Créneau ───────────────────────────── */}
            {step === 3 && (
              <section>
                <BackButton onClick={() => setStep(2)} />

                {/* Service sélectionné */}
                <div className="bg-white border border-ivory-border rounded-xl px-4 py-3 mb-6 flex justify-between items-center">
                  <div>
                    <p className="font-playfair font-semibold text-vip-black">{selectedService?.name}</p>
                    <p className="text-warm-gray text-sm">{selectedService?.duration_minutes} min</p>
                  </div>
                  <span className="text-gold font-playfair font-bold text-xl">{selectedService?.price} €</span>
                </div>

                <SectionHeader title="Date & Créneau" sub="Disponibilités sur 30 jours" />
                <DateSelector
                  dates={availableDates}
                  selected={selectedDate}
                  onSelect={handleSelectDate}
                />

                {selectedDate && (
                  <div className="mt-8">
                    <SectionHeader title="Choisissez un créneau" sub={formatDate(selectedDate)} />
                    <TimeSlotGrid
                      slots={availableSlots}
                      selected={selectedTime}
                      onSelect={setSelectedTime}
                    />
                  </div>
                )}

                {submitError && <ErrorBanner message={submitError} />}

                <div className="mt-8">
                  <PrimaryButton
                    disabled={!selectedDate || !selectedTime}
                    onClick={handleProceedToConfirmation}
                  >
                    Continuer
                  </PrimaryButton>
                </div>
              </section>
            )}

            {/* ── Étape 4 : Formulaire + Confirmation ────────────────── */}
            {step === 4 && (
              <section>
                <BackButton onClick={() => setStep(3)} />

                {/* Récapitulatif */}
                <div className="bg-white border border-ivory-border rounded-2xl px-5 py-4 mb-8">
                  <p className="text-warm-gray text-xs uppercase tracking-widest mb-4 font-medium">Récapitulatif</p>
                  <div className="space-y-2.5">
                    <Row label="Barbier"  value={selectedBarber?.name} />
                    <Row label="Service"  value={selectedService?.name} />
                    <Row label="Date"     value={formatDate(selectedDate)} />
                    <Row label="Durée"    value={`${selectedService?.duration_minutes} min`} />
                    <div className="flex justify-between border-t border-ivory-border pt-3 mt-1">
                      <span className="text-warm-gray text-sm">Heure</span>
                      <span className="text-gold font-playfair font-bold text-xl">{selectedTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-warm-gray text-sm">Total</span>
                      <span className="text-vip-black font-semibold">{selectedService?.price} €</span>
                    </div>
                  </div>
                </div>

                <SectionHeader title="Vos coordonnées" sub="Pour confirmer votre réservation" />

                <div className="space-y-4">
                  <Field
                    label="Prénom et nom"
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Jean Dupont"
                    error={errors.clientName}
                    inputMode="text"
                    autoCorrect="off"
                    autoCapitalize="words"
                    autoComplete="name"
                  />
                  <Field
                    label="Numéro de téléphone"
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="06 00 00 00 00"
                    error={errors.clientPhone}
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>

                {submitError && <ErrorBanner message={submitError} />}

                <div className="mt-8">
                  <PrimaryButton onClick={handleSubmit} disabled={submitting}>
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-ivory border-t-transparent rounded-full animate-spin" />
                        Confirmation…
                      </span>
                    ) : 'Confirmer la réservation'}
                  </PrimaryButton>
                  <p className="text-warm-gray text-xs text-center mt-4">
                    Vos coordonnées sont transmises uniquement au salon.
                  </p>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-ivory-border px-5 py-5 max-w-lg mx-auto w-full flex items-center justify-between gap-3">
        <span className="text-ivory-border text-xs shrink-0">© 2026 VIP Cut's</span>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <a href="/privacy" className="text-warm-gray text-xs hover:text-vip-black transition-colors">
            Confidentialité
          </a>
          <a href="/legal" className="text-warm-gray text-xs hover:text-vip-black transition-colors">
            Mentions légales
          </a>
          <a href="/admin/login" className="text-warm-gray text-xs hover:text-vip-black transition-colors">
            Espace professionnel
          </a>
        </div>
      </footer>
    </div>
  )
}

// ─── Petits composants partagés ───────────────────────────────────────────────

function SectionHeader({ title, sub }) {
  return (
    <div className="mb-5">
      <h2 className="font-playfair text-xl font-semibold text-vip-black">{title}</h2>
      {sub && <p className="text-warm-gray text-sm mt-0.5 capitalize">{sub}</p>}
    </div>
  )
}

function PrimaryButton({ children, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-vip-black text-ivory font-dm font-bold py-4 rounded-xl disabled:opacity-25 disabled:cursor-not-allowed hover:bg-bordeaux active:scale-[0.99] transition-all"
    >
      {children}
    </button>
  )
}

function Field({ label, type, value, onChange, placeholder, error, inputMode, autoCorrect, autoCapitalize, autoComplete = 'on' }) {
  return (
    <div>
      <label className="block text-warm-gray text-sm mb-2 font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        autoCorrect={autoCorrect}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        className={[
          'w-full bg-white border-2 rounded-xl px-4 py-4 text-vip-black placeholder-ivory-border',
          'focus:outline-none transition-colors text-base font-dm',
          error
            ? 'border-bordeaux focus:border-bordeaux'
            : 'border-ivory-border focus:border-gold',
        ].join(' ')}
      />
      {error && <p className="text-bordeaux text-xs mt-1.5">{error}</p>}
    </div>
  )
}

function ErrorBanner({ message }) {
  return (
    <div className="mt-4 bg-bordeaux/5 border border-bordeaux/20 rounded-xl px-4 py-3 text-bordeaux text-sm">
      {message}
    </div>
  )
}
