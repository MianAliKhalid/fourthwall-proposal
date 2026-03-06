'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setAttemptsRemaining(null)
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        if (typeof data.attemptsRemaining === 'number') {
          setAttemptsRemaining(data.attemptsRemaining)
        }
        setIsLoading(false)
        return
      }

      // Successful login - redirect to home or the original page
      const params = new URLSearchParams(window.location.search)
      const from = params.get('from') || '/dashboard'
      router.push(from)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-brand-50/30 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl shadow-gray-900/[0.04] p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Display */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-red-700">{error}</p>
                  {attemptsRemaining !== null && attemptsRemaining > 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining before lockout
                    </p>
                  )}
                  {attemptsRemaining === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Account temporarily locked. Try again in 15 minutes.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoFocus
                disabled={isLoading}
                placeholder="Enter your username"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 placeholder-gray-400 transition-all duration-200 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLoading}
                placeholder="Enter your password"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 placeholder-gray-400 transition-all duration-200 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={`
                w-full py-3.5 rounded-xl text-white font-semibold text-[15px] transition-all duration-200 cursor-pointer
                ${isLoading
                  ? 'bg-brand-400 cursor-wait'
                  : 'bg-brand-600 hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/25 active:scale-[0.98]'
                }
              `}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2.5">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Access is restricted to authorized team members only.
        </p>
      </div>
    </div>
  )
}
