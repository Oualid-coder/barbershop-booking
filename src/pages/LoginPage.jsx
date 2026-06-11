import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState(null)
  const [loading, setLoading] = useState(false)
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
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full bg-white border-2 border-ivory-border rounded-xl px-4 py-4 text-vip-black placeholder-ivory-border focus:outline-none focus:border-gold transition-colors"
            />
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
