import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AccountView({ email }) {
  const [oldPassword,     setOldPassword]     = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState(null)
  const [success,         setSuccess]         = useState(false)

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

  const inputClass = 'w-full bg-white border border-ivory-border rounded-lg px-3 py-2.5 text-vip-black text-sm focus:outline-none focus:border-gold transition-colors'

  return (
    <div>
      <p className="text-warm-gray text-sm mb-5">Modifiez votre mot de passe de connexion.</p>

      <form onSubmit={handleSubmit} className="bg-white border border-ivory-border rounded-xl px-5 py-5 space-y-4">
        <div>
          <label className="block text-vip-black text-xs font-medium mb-1.5">Mot de passe actuel</label>
          <input
            type="password"
            value={oldPassword}
            onChange={e => setOldPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-vip-black text-xs font-medium mb-1.5">Nouveau mot de passe</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            className={inputClass}
          />
          <p className="text-ivory-border text-xs mt-1">8 caractères minimum</p>
        </div>

        <div>
          <label className="block text-vip-black text-xs font-medium mb-1.5">Confirmer le nouveau mot de passe</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className={inputClass}
          />
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
