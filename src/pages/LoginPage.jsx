import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()

  // Already logged in → redirect immediately
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-6 h-px bg-amber-400 mx-auto mb-4" />
          <h1 className="text-base font-semibold tracking-[0.25em] uppercase text-white">
            Barbershop
          </h1>
          <p className="text-zinc-600 text-xs mt-1 tracking-widest uppercase">
            Espace administrateur
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@barbershop.fr"
              required
              autoComplete="email"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white placeholder-zinc-700 focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-zinc-400 text-sm mb-2">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white placeholder-zinc-700 focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-900 rounded-xl px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-400 text-zinc-950 font-bold py-4 rounded-xl disabled:opacity-50 hover:bg-amber-300 active:scale-[0.99] transition-all mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                Connexion…
              </span>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        <p className="text-zinc-700 text-xs text-center mt-8">
          Accès réservé à l'administrateur du salon
        </p>
      </div>
    </div>
  )
}
