import { useState } from 'react'
import { supabase } from '../../lib/supabase'

function EyeIcon({ visible }) {
  return visible ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-9.9 0C6.268 8.943 8.943 7 12 7s5.732 1.943 6.9 5c-1.168 3.057-3.843 5-6.9 5s-5.732-1.943-6.9-5z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
    </svg>
  )
}

export default function AccountView({ email }) {
  const [oldPassword,     setOldPassword]     = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState(null)
  const [success,         setSuccess]         = useState(false)
  const [showOld,         setShowOld]         = useState(false)
  const [showNew,         setShowNew]         = useState(false)
  const [showConfirm,     setShowConfirm]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Les nouveaux mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: oldPassword,
    })
    if (signInError) {
      setError('Mot de passe actuel incorrect.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)

    if (updateError) {
      setError('Erreur lors de la mise à jour. Réessayez.')
      return
    }

    setSuccess(true)
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const inputClass = 'w-full bg-white border border-ivory-border rounded-lg px-3 py-2.5 pr-9 text-vip-black text-sm focus:outline-none focus:border-gold transition-colors'

  return (
    <div>
      <p className="text-warm-gray text-sm mb-5">Modifiez votre mot de passe de connexion.</p>

      <form onSubmit={handleSubmit} className="bg-white border border-ivory-border rounded-xl px-5 py-5 space-y-4">
        <div>
          <label className="block text-vip-black text-xs font-medium mb-1.5">Mot de passe actuel</label>
          <div className="relative">
            <input
              type={showOld ? 'text' : 'password'}
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShowOld(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ivory-border hover:text-gold transition-colors"
              aria-label={showOld ? 'Masquer' : 'Afficher'}
            >
              <EyeIcon visible={showOld} />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-vip-black text-xs font-medium mb-1.5">Nouveau mot de passe</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShowNew(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ivory-border hover:text-gold transition-colors"
              aria-label={showNew ? 'Masquer' : 'Afficher'}
            >
              <EyeIcon visible={showNew} />
            </button>
          </div>
          <p className="text-ivory-border text-xs mt-1">8 caractères minimum</p>
        </div>

        <div>
          <label className="block text-vip-black text-xs font-medium mb-1.5">Confirmer le nouveau mot de passe</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ivory-border hover:text-gold transition-colors"
              aria-label={showConfirm ? 'Masquer' : 'Afficher'}
            >
              <EyeIcon visible={showConfirm} />
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-bordeaux/5 border border-bordeaux/20 rounded-lg px-3 py-2.5">
            <svg className="w-3.5 h-3.5 text-bordeaux shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-bordeaux text-xs">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 bg-gold/5 border border-gold/20 rounded-lg px-3 py-2.5">
            <svg className="w-3.5 h-3.5 text-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-gold text-xs font-medium">Mot de passe mis à jour avec succès.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-vip-black text-ivory text-sm font-semibold py-2.5 rounded-xl hover:bg-bordeaux active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-ivory border-t-transparent rounded-full animate-spin" />
              Vérification…
            </>
          ) : 'Mettre à jour le mot de passe'}
        </button>
      </form>
    </div>
  )
}
