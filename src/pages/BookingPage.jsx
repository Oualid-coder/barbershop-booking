import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
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

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ service, date, time, onReset }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-400/10 border border-amber-400 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-2xl font-semibold text-white mb-2">Réservation confirmée</h1>
      <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
        Votre rendez-vous est enregistré.<br />À bientôt !
      </p>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xs px-6 py-5 space-y-3 text-left mb-8">
        <p className="text-zinc-500 text-xs uppercase tracking-widest mb-4">Votre rendez-vous</p>
        <Row label="Service" value={service?.name} />
        <Row label="Date" value={formatDate(date)} />
        <div className="flex justify-between border-t border-zinc-800 pt-3">
          <span className="text-zinc-400 text-sm">Heure</span>
          <span className="text-amber-400 font-semibold">{time}</span>
        </div>
      </div>

      <button
        onClick={onReset}
        className="text-zinc-500 text-sm hover:text-zinc-300 transition-colors"
      >
        Faire une nouvelle réservation
      </button>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-400 text-sm">{label}</span>
      <span className="text-white text-sm font-medium text-right max-w-[55%]">{value}</span>
    </div>
  )
}

// ─── Back button ──────────────────────────────────────────────────────────────

function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-zinc-500 text-sm mb-6 hover:text-amber-400 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  // Load services + business hours + barbers once
  useEffect(() => {
    async function load() {
      const [{ data: svc }, { data: hours }, { data: brbs }] = await Promise.all([
        supabase.from('services').select('*').eq('active', true).order('price'),
        supabase.from('business_hours').select('*').order('day_of_week'),
        supabase.from('barbers').select('id, name').eq('active', true).order('name'),
      ])
      setServices(svc || [])
      setBusinessHours(hours || [])
      setBarbers(brbs || [])
      setLoading(false)
    }
    load()
  }, [])

  // Load blocked slots when date changes
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

  // Days closed per business_hours
  const closedDays = businessHours.filter((h) => h.is_closed).map((h) => h.day_of_week)
  const availableDates = getNext30Days().filter((d) => !closedDays.includes(getDayOfWeek(d)))

  // Generate available time slots for selected date + service
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
      service_id: selectedService.id,
      barber_id: selectedBarber?.id ?? null,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim(),
      booking_date: selectedDate,
      booking_time: selectedTime,
      status: 'pending',
    })

    setSubmitting(false)

    if (error) {
      if (error.code === '23505') {
        setSubmitError("Ce créneau vient d'être réservé. Veuillez en choisir un autre.")
        setStep(3)
        setSelectedTime(null)
      } else {
        setSubmitError('Une erreur est survenue. Veuillez réessayer.')
      }
      return
    }

    // Confirmation visible immédiatement — la notification part en arrière-plan
    setBooked(true)

    // Fire-and-forget : une erreur d'email ne doit jamais bloquer la confirmation client
    supabase.functions.invoke('notify-booking', {
      body: {
        client_name:  clientName.trim(),
        client_phone: clientPhone.trim(),
        service_name: selectedService.name,
        booking_date: selectedDate,
        booking_time: selectedTime,
        barber_id:    selectedBarber?.id ?? null,
      },
    }).catch(() => {}) // Échec silencieux — la résa est déjà en base
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
        onReset={handleReset}
      />
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="px-4 pt-10 pb-5 text-center border-b border-zinc-900">
        <div className="w-6 h-px bg-amber-400 mx-auto mb-4" />
        <h1 className="text-base font-semibold tracking-[0.25em] uppercase text-white">
          Barbershop
        </h1>
        <p className="text-zinc-600 text-xs mt-1 tracking-widest uppercase">
          Réservation en ligne
        </p>
      </header>

      <StepIndicator step={step} steps={STEPS} />

      <main className="px-4 pb-28 max-w-lg mx-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Step 1 : Barbier ─────────────────────────────────────── */}
            {step === 1 && (
              <section>
                <SectionHeader
                  title="Choisissez votre barbier"
                  sub="Sélectionnez un barbier pour commencer"
                />
                <div className="space-y-3">
                  {barbers.map((barber) => (
                    <button
                      key={barber.id}
                      onClick={() => handleSelectBarber(barber)}
                      className={[
                        'w-full text-left bg-zinc-900 border rounded-xl px-4 py-4 flex items-center gap-4 transition-all active:scale-[0.99]',
                        selectedBarber?.id === barber.id
                          ? 'border-amber-400'
                          : 'border-zinc-800 hover:border-zinc-600',
                      ].join(' ')}
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                        <span className="text-amber-400 font-semibold text-sm">
                          {barber.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-white font-medium">{barber.name}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ── Step 2 : Service ─────────────────────────────────────── */}
            {step === 2 && (
              <section>
                <BackButton onClick={() => setStep(1)} />

                {/* Barber recap */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    <span className="text-amber-400 font-semibold text-xs">
                      {selectedBarber?.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-white font-medium">{selectedBarber?.name}</p>
                </div>

                <SectionHeader
                  title="Choisissez votre service"
                  sub="Sélectionnez une prestation pour continuer"
                />
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

            {/* ── Step 3 : Date + Créneau ──────────────────────────────── */}
            {step === 3 && (
              <section>
                <BackButton onClick={() => setStep(2)} />

                {/* Service recap */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 mb-6 flex justify-between items-center">
                  <div>
                    <p className="text-white font-medium">{selectedService?.name}</p>
                    <p className="text-zinc-500 text-sm">{selectedService?.duration_minutes} min</p>
                  </div>
                  <span className="text-amber-400 font-bold">{selectedService?.price} €</span>
                </div>

                <SectionHeader title="Choisissez une date" sub="Disponibilités sur 30 jours" />
                <DateSelector
                  dates={availableDates}
                  selected={selectedDate}
                  onSelect={handleSelectDate}
                />

                {selectedDate && (
                  <div className="mt-8">
                    <SectionHeader
                      title="Choisissez un créneau"
                      sub={formatDate(selectedDate)}
                    />
                    <TimeSlotGrid
                      slots={availableSlots}
                      selected={selectedTime}
                      onSelect={setSelectedTime}
                    />
                  </div>
                )}

                {submitError && <ErrorBanner message={submitError} />}

                <div className="mt-8">
                  <button
                    disabled={!selectedDate || !selectedTime}
                    onClick={handleProceedToConfirmation}
                    className="w-full bg-amber-400 text-zinc-950 font-bold py-4 rounded-xl disabled:opacity-25 disabled:cursor-not-allowed hover:bg-amber-300 active:scale-[0.99] transition-all"
                  >
                    Continuer
                  </button>
                </div>
              </section>
            )}

            {/* ── Step 4 : Formulaire + Confirmation ───────────────────── */}
            {step === 4 && (
              <section>
                <BackButton onClick={() => setStep(3)} />

                {/* Booking recap */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 mb-8">
                  <p className="text-zinc-500 text-xs uppercase tracking-widest mb-4">Récapitulatif</p>
                  <div className="space-y-2.5">
                    <Row label="Barbier" value={selectedBarber?.name} />
                    <Row label="Service" value={selectedService?.name} />
                    <Row label="Date" value={formatDate(selectedDate)} />
                    <Row label="Durée" value={`${selectedService?.duration_minutes} min`} />
                    <div className="flex justify-between border-t border-zinc-800 pt-3 mt-1">
                      <span className="text-zinc-400 text-sm">Heure</span>
                      <span className="text-amber-400 font-bold">{selectedTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 text-sm">Total</span>
                      <span className="text-white font-semibold">{selectedService?.price} €</span>
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
                  />
                  <Field
                    label="Numéro de téléphone"
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="06 00 00 00 00"
                    error={errors.clientPhone}
                  />
                </div>

                {submitError && <ErrorBanner message={submitError} />}

                <div className="mt-8">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full bg-amber-400 text-zinc-950 font-bold py-4 rounded-xl disabled:opacity-50 hover:bg-amber-300 active:scale-[0.99] transition-all"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                        Confirmation…
                      </span>
                    ) : (
                      'Confirmer la réservation'
                    )}
                  </button>
                  <p className="text-zinc-700 text-xs text-center mt-4">
                    Vos coordonnées sont transmises uniquement au barbershop.
                  </p>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

// ─── Small shared UI pieces ───────────────────────────────────────────────────

function SectionHeader({ title, sub }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
      {sub && <p className="text-zinc-500 text-sm mt-0.5 capitalize">{sub}</p>}
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder, error }) {
  return (
    <div>
      <label className="block text-zinc-400 text-sm mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="on"
        className={[
          'w-full bg-zinc-900 border rounded-xl px-4 py-4 text-white placeholder-zinc-700',
          'focus:outline-none transition-colors text-base',
          error ? 'border-red-500 focus:border-red-400' : 'border-zinc-800 focus:border-amber-400',
        ].join(' ')}
      />
      {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
    </div>
  )
}

function ErrorBanner({ message }) {
  return (
    <div className="mt-4 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3 text-red-300 text-sm">
      {message}
    </div>
  )
}
