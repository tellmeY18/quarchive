import { useCallback, useState } from 'react'
import useAuthStore from '../store/authStore'

export default function useArchiveAuth() {
  const [needsKeyGeneration, setNeedsKeyGeneration] = useState(false)

  const store = useAuthStore()

  const login = useCallback(async ({ email, password, remember }) => {
    store.setLoggingIn(true)

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (data.ok) {
        const userData = {
          screenname: data.screenname,
          email: data.email,
          accessKey: data.accessKey,
          secretKey: data.secretKey,
        }
        store.setLoggedIn(userData)
        store.persistSession(userData, remember)
        return { success: true }
      }

      if (data.error === 'no_keys') {
        setNeedsKeyGeneration(true)
        store.setLoggingIn(false)
        return { success: false, needsKeys: true, cookies: data.cookies }
      }

      store.setLoginError(data.error === 'Invalid credentials'
        ? 'Incorrect email or password'
        : data.error || 'Login failed')
      return { success: false }
    } catch {
      store.setLoginError('Connection failed \u2014 please try again')
      return { success: false }
    }
  }, [store])

  const generateKeys = useCallback(async ({ cookies, email, remember }) => {
    try {
      const res = await fetch('/api/s3keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loggedInUser: cookies.loggedInUser,
          loggedInSig: cookies.loggedInSig,
        }),
      })

      const data = await res.json()

      if (data.ok) {
        const userData = {
          screenname: email.split('@')[0],
          email,
          accessKey: data.accessKey,
          secretKey: data.secretKey,
        }
        store.setLoggedIn(userData)
        store.persistSession(userData, remember)
        setNeedsKeyGeneration(false)
        return { success: true }
      }

      store.setLoginError('Could not generate upload keys \u2014 please try again')
      return { success: false }
    } catch {
      store.setLoginError('Could not generate upload keys \u2014 please try again')
      return { success: false }
    }
  }, [store])

  const logout = useCallback(() => {
    store.logout()
  }, [store])

  return { login, generateKeys, logout, needsKeyGeneration }
}
