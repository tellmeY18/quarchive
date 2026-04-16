import { useState } from 'react'

export default function LoginForm({ onSubmit, isLoading, error }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({ email, password, remember })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email */}
      <div>
        <label
          htmlFor="login-email"
          className="block text-sm font-medium text-pyqp-text mb-1.5"
        >
          Email
        </label>
        <input
          id="login-email"
          type="email"
          required
          disabled={isLoading}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-pyqp-border bg-pyqp-card px-3 py-2 text-sm text-pyqp-text placeholder:text-pyqp-muted focus:outline-none focus:ring-2 focus:ring-pyqp-accent/40 focus:border-pyqp-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />
      </div>

      {/* Password */}
      <div>
        <label
          htmlFor="login-password"
          className="block text-sm font-medium text-pyqp-text mb-1.5"
        >
          Password
        </label>
        <input
          id="login-password"
          type="password"
          required
          disabled={isLoading}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your archive.org password"
          className="w-full rounded-lg border border-pyqp-border bg-pyqp-card px-3 py-2 text-sm text-pyqp-text placeholder:text-pyqp-muted focus:outline-none focus:ring-2 focus:ring-pyqp-accent/40 focus:border-pyqp-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />
      </div>

      {/* Remember me */}
      <div className="flex items-center gap-2">
        <input
          id="login-remember"
          type="checkbox"
          disabled={isLoading}
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-4 w-4 rounded border-pyqp-border text-pyqp-accent focus:ring-pyqp-accent/40 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <label
          htmlFor="login-remember"
          className="text-sm text-pyqp-text-light select-none"
        >
          Remember me on this device
        </label>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-pyqp-accent text-white px-4 py-2.5 text-sm font-medium hover:bg-pyqp-accent-hover focus:outline-none focus:ring-2 focus:ring-pyqp-accent/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700 flex items-start gap-2">
          <svg
            className="h-4 w-4 mt-0.5 shrink-0 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Signup link */}
      <p className="text-sm text-pyqp-muted text-center">
        {"Don't have an account? "}
        <a
          href="https://archive.org/account/signup"
          target="_blank"
          rel="noopener noreferrer"
          className="text-pyqp-accent hover:text-pyqp-accent-hover font-medium underline underline-offset-2 transition-colors"
        >
          Sign up at archive.org
          <span className="inline-block ml-0.5 text-xs">{'\u2197'}</span>
        </a>
      </p>

      {/* Security note */}
      <div className="border-t border-pyqp-border pt-4 mt-4">
        <p className="flex items-center gap-2 text-xs text-pyqp-muted">
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
          <span>
            Your password is sent directly to Archive.org. We never store it.
          </span>
        </p>
      </div>
    </form>
  )
}
