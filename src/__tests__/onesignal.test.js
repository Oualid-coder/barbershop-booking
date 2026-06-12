import { describe, it, expect, afterEach, vi } from 'vitest'

// Mock supabase before importing onesignal (onesignal.js imports it at module level)
vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
  },
}))

import { getNotificationPermission } from '../lib/onesignal'

describe('getNotificationPermission', () => {
  const originalNotification = globalThis.Notification

  afterEach(() => {
    Object.defineProperty(globalThis, 'Notification', {
      value: originalNotification,
      configurable: true,
      writable: true,
    })
  })

  it("retourne 'default' quand window.Notification n'est pas supporté", () => {
    Object.defineProperty(globalThis, 'Notification', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    expect(getNotificationPermission()).toBe('default')
  })

  it("retourne 'granted' quand la permission est accordée", () => {
    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'granted' },
      configurable: true,
      writable: true,
    })
    expect(getNotificationPermission()).toBe('granted')
  })

  it("retourne 'denied' quand la permission est refusée", () => {
    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'denied' },
      configurable: true,
      writable: true,
    })
    expect(getNotificationPermission()).toBe('denied')
  })

  it("retourne 'default' quand la permission est à la valeur par défaut", () => {
    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'default' },
      configurable: true,
      writable: true,
    })
    expect(getNotificationPermission()).toBe('default')
  })
})
