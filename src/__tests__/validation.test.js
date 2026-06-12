import { describe, it, expect } from 'vitest'
import { validateClientName, validateClientPhone } from '../lib/validation'

// --- validateClientName ------------------------------------------------------

describe('validateClientName', () => {
  it('retourne une erreur pour une chaine vide', () => {
    expect(validateClientName('')).not.toBeNull()
  })

  it('retourne une erreur pour une chaine composee uniquement espaces', () => {
    expect(validateClientName('   ')).not.toBeNull()
  })

  it('retourne une erreur si le nom est trop court (1 caractere)', () => {
    expect(validateClientName('A')).not.toBeNull()
  })

  it('accepte un nom simple valide', () => {
    expect(validateClientName('Jean Dupont')).toBeNull()
  })

  it("accepte un nom avec trait d'union et apostrophe", () => {
    expect(validateClientName("Marie-Claire d'Arc")).toBeNull()
  })

  it('accepte les caracteres francais accentues', () => {
    expect(validateClientName('Helena Muller')).toBeNull()
  })

  it('retourne une erreur avec des chiffres dans le nom', () => {
    expect(validateClientName('Jean123')).not.toBeNull()
  })

  it('retourne une erreur avec des caracteres speciaux (balise HTML)', () => {
    expect(validateClientName('Jean<script>')).not.toBeNull()
  })

  it('retourne une erreur avec @ ou symboles non autorises', () => {
    expect(validateClientName('@username')).not.toBeNull()
    expect(validateClientName('Test#1')).not.toBeNull()
  })
})

// --- validateClientPhone -----------------------------------------------------

describe('validateClientPhone', () => {
  it('retourne une erreur pour une chaine vide', () => {
    expect(validateClientPhone('')).not.toBeNull()
  })

  it('accepte un numero mobile avec espaces (06 12 34 56 78)', () => {
    expect(validateClientPhone('06 12 34 56 78')).toBeNull()
  })

  it('accepte un numero mobile sans espaces (0612345678)', () => {
    expect(validateClientPhone('0612345678')).toBeNull()
  })

  it('accepte un numero avec prefixe international +33', () => {
    expect(validateClientPhone('+33612345678')).toBeNull()
  })

  it('accepte un numero fixe francais (0123456789)', () => {
    expect(validateClientPhone('0123456789')).toBeNull()
  })

  it('retourne une erreur pour un numero trop court', () => {
    expect(validateClientPhone('06 12 34 56')).not.toBeNull()
  })

  it('retourne une erreur pour un numero sans indicatif valide', () => {
    expect(validateClientPhone('123456789')).not.toBeNull()
  })

  it('retourne une erreur pour le prefixe 00 (non supporte)', () => {
    expect(validateClientPhone('00612345678')).not.toBeNull()
  })

  it('retourne une erreur pour 10 chiffres commencant par 00', () => {
    expect(validateClientPhone('0012345678')).not.toBeNull()
  })
})
