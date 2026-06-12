export function validateClientName(name) {
  if (!name || name.trim().length === 0) return 'Le nom est requis.'
  if (name.trim().length < 2) return 'Le nom doit contenir au moins 2 caractères.'
  if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(name.trim())) return 'Le nom contient des caractères invalides.'
  return null
}

export function validateClientPhone(phone) {
  const cleaned = phone.replace(/\s/g, '')
  if (!cleaned) return 'Le numéro de téléphone est requis.'
  if (!/^(?:\+33|0033|0)[1-9]\d{8}$/.test(cleaned)) return 'Format invalide. Ex : 06 12 34 56 78'
  return null
}
