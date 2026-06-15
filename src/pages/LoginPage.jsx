import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

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

export default function LoginPage() {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]           = useState(null)
  const [loading, setLoading]       = useState(false)
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && session) navigate('/admin/dashboard', { replace: true })
  }, [session, authLoading, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setLoading(false)
    if (error) { setError('Email ou mot de passe incorrect'); return }
    navigate('/admin/dashboard', { replace: true })
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ivory flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-10">
          <p className="text-gold text-[10px] tracking-[0.3em] uppercase font-medium mb-2">Espace administrateur</p>
          <h1 className="text-vip-black font-playfair font-bold text-3xl">VIP Cut's</h1>
          <p className="text-warm-gray text-xs mt-1">Coiffeur Barbier — Paris 18e</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-warm-gray text-sm mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@vipcutsbarber.fr"
              required
              autoComplete="email"
              className="w-full bg-white border-2 border-ivory-border rounded-xl px-4 py-4 text-vip-black placeholder-ivory-border focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-warm-gray text-sm mb-2">Mot de passe</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-white border-2 border-ivory-border rounded-xl px-4 py-4 pr-12 text-vip-black placeholder-ivory-border focus:outline-none focus:border-gold transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-ivory-border hover:text-gold transition-colors"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-bordeaux/10 border border-bordeaux/25 rounded-xl px-4 py-3 text-bordeaux text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-vip-black text-ivory font-bold py-4 rounded-xl disabled:opacity-50 hover:bg-bordeaux active:scale-[0.99] transition-all mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-ivory border-t-transparent rounded-full animate-spin" />
                Connexion…
              </span>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        <p className="text-ivory-border text-xs text-center mt-8">
          Accès réservé à l'équipe VIP Cut's
        </p>
      </div>
    </div>
  )
}
