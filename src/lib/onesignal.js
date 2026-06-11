import { supabase } from './supabase'

const APP_ID = 'b578b9f9-247f-4c6a-8bd2-a5af632d4b60'

// Initialise le SDK OneSignal et demande la permission push.
// À appeler uniquement depuis AdminDashboard — abonne le navigateur du barbier.
export function initOneSignal() {
  window.OneSignalDeferred = window.OneSignalDeferred || []
  window.OneSignalDeferred.push(async (OneSignal) => {
    await OneSignal.init({
      appId: APP_ID,
      notifyButton: { enable: false },
      allowLocalhostAsSecureOrigin: true,
    })
    // Ne re-demande pas si déjà accordé ou refusé
    await OneSignal.Notifications.requestPermission()
  })
}

// Déclenche la notification (email + push) via l'Edge Function.
// Fire-and-forget — une panne ne bloque pas la confirmation client.
export function notifyNewBooking({ barber_id, client_name, client_phone, service_name, booking_date, booking_time }) {
  supabase.functions.invoke('notify-booking', {
    body: { barber_id, client_name, client_phone, service_name, booking_date, booking_time },
  }).catch(() => {})
}
