import { describe, it, expect } from 'vitest'
import { generateTimeSlots, getDayOfWeek, formatDate } from '../lib/bookingUtils'

// ─── generateTimeSlots ────────────────────────────────────────────────────────

describe('generateTimeSlots', () => {
  it('génère les créneaux de 30 min entre 09:00 et 10:30', () => {
    expect(generateTimeSlots('09:00', '10:30', 30)).toEqual(['09:00', '09:30', '10:00'])
  })

  it('génère 9 créneaux de 60 min entre 09:00 et 18:00', () => {
    const slots = generateTimeSlots('09:00', '18:00', 60)
    expect(slots).toHaveLength(9)
    expect(slots[0]).toBe('09:00')
    expect(slots[slots.length - 1]).toBe('17:00')
  })

  it('exclut le créneau dont la fin dépasserait la fermeture', () => {
    // 09:30 + 30 min = 10:00 > 09:45 → seul 09:00 est valide
    expect(generateTimeSlots('09:00', '09:45', 30)).toEqual(['09:00'])
  })

  it('retourne un tableau vide si la durée dépasse toute la plage', () => {
    expect(generateTimeSlots('09:00', '09:20', 30)).toEqual([])
  })

  it('gère les durées de 45 min', () => {
    expect(generateTimeSlots('10:00', '12:00', 45)).toEqual(['10:00', '10:45'])
  })

  it('inclut le créneau dont la fin coïncide exactement avec la fermeture', () => {
    // 09:30 + 30 = 10:00 <= 10:00 → doit être inclus
    const slots = generateTimeSlots('09:00', '10:00', 30)
    expect(slots).toContain('09:30')
  })

  it('formate les heures avec deux chiffres (padding)', () => {
    const slots = generateTimeSlots('08:00', '08:10', 5)
    expect(slots[0]).toBe('08:00')
    expect(slots[1]).toBe('08:05')
  })
})

// ─── getDayOfWeek ─────────────────────────────────────────────────────────────

describe('getDayOfWeek', () => {
  it('retourne 1 pour un lundi (2026-06-08)', () => {
    expect(getDayOfWeek('2026-06-08')).toBe(1)
  })

  it('retourne 5 pour un vendredi (2026-06-12)', () => {
    expect(getDayOfWeek('2026-06-12')).toBe(5)
  })

  it('retourne 6 pour un samedi (2026-06-13)', () => {
    expect(getDayOfWeek('2026-06-13')).toBe(6)
  })

  it('retourne 0 pour un dimanche (2026-06-14)', () => {
    expect(getDayOfWeek('2026-06-14')).toBe(0)
  })
})

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('retourne une chaîne non vide', () => {
    expect(formatDate('2026-06-12')).toBeTruthy()
  })

  it('contient le numéro du jour', () => {
    expect(formatDate('2026-06-12')).toContain('12')
  })

  it('contient "juin" pour le mois 6 (locale fr-FR)', () => {
    expect(formatDate('2026-06-12').toLowerCase()).toContain('juin')
  })

  it('contient "vendredi" pour le 12 juin 2026 (locale fr-FR)', () => {
    expect(formatDate('2026-06-12').toLowerCase()).toContain('vendredi')
  })

  it('contient "lundi" pour le 1er juin 2026 (locale fr-FR)', () => {
    expect(formatDate('2026-06-01').toLowerCase()).toContain('lundi')
  })
})
