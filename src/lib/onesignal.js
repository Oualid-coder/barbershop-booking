import { supabase } from './supabase'

const APP_ID = 'b578b9f9-247f-4c6a-8bd2-a5af632d4b60'

// Resolves with the OneSignal instance once init() is done
let resolveReady
const oneSignalReady = new Promise(r => { resolveReady = r })

export function initOneSignal() {
  window.OneSignalDeferred = window.OneSignalDeferred || []
  window.OneSignalDeferred.push(async (OneSignal) => {
    await OneSignal.init({
      appId: APP_ID,
      notifyButton: { enable: false },
      allowLocalhostAsSecureOrigin: import.meta.env.DEV,
    })

    resolveReady(OneSignal)

    // Propagate permission changes to any listener (e.g. AdminDashboard button)
    OneSignal.Notifications.addEventListener('permissionChange', () => {
      window.dispatchEvent(new CustomEvent('onesignal:permissionChange'))
    })

    // Auto-request on desktop/Android — iOS PWA requires a user gesture instead
    setTimeout(async () => {
      if (window.Notification?.permission === 'default') {
        await OneSignal.Notifications.requestPermission()
      }
    }, 3000)
  })
}

// Returns the current native permission: 'default' | 'granted' | 'denied'
export function getNotificationPermission() {
  return window.Notification?.permission ?? 'default'
}

// Must be called from a user gesture on iOS PWA
export async function requestPushPermission() {
  const OneSignal = await oneSignalReady
  await OneSignal.Notifications.requestPermission()
}

// Déclenche la notification (email + push) via l'Edge Function.
// Fire-and-forget — une panne ne bloque pas la confirmation client.
export function notifyNewBooking({ barber_id, client_name, client_phone, service_name, booking_date, booking_time }) {
  supabase.functions.invoke('notify-booking', {
    body: { barber_id, client_name, client_phone, service_name, booking_date, booking_time },
  }).catch(() => {})
}
