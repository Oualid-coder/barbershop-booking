export function generateTimeSlots(openTime, closeTime, durationMinutes) {
  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const toTime = (minutes) => {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0')
    const m = (minutes % 60).toString().padStart(2, '0')
    return `${h}:${m}`
  }

  const open = toMinutes(openTime)
  const close = toMinutes(closeTime)
  const slots = []

  for (let t = open; t + durationMinutes <= close; t += durationMinutes) {
    slots.push(toTime(t))
  }

  return slots
}

export function getDayOfWeek(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay()
}

export function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    day: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
    num: d.getDate(),
    month: d.toLocaleDateString('fr-FR', { month: 'short' }),
  }
}

export function getNext30Days() {
  const days = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < 30; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    days.push(`${yyyy}-${mm}-${dd}`)
  }

  return days
}
