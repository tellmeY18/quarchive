import { create } from 'zustand'

const STORAGE_KEYS = {
  accessKey: 'quarchive_access_key',
  secretKey: 'quarchive_secret_key',
  screenname: 'quarchive_screenname',
  email: 'quarchive_email',
}

const useAuthStore = create((set, get) => ({
  // State
  isLoggedIn: false,
  screenname: null,
  email: null,
  accessKey: null,
  secretKey: null,
  loginError: null,
  isLoggingIn: false,

  // Actions
  setLoggedIn: (userData) =>
    set({
      isLoggedIn: true,
      screenname: userData.screenname,
      email: userData.email,
      accessKey: userData.accessKey,
      secretKey: userData.secretKey,
      loginError: null,
      isLoggingIn: false,
    }),

  setLoginError: (msg) =>
    set({
      loginError: msg,
      isLoggingIn: false,
    }),

  setLoggingIn: (bool) =>
    set({ isLoggingIn: bool }),

  logout: () => {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    })
    set({
      isLoggedIn: false,
      screenname: null,
      email: null,
      accessKey: null,
      secretKey: null,
      loginError: null,
      isLoggingIn: false,
    })
  },

  persistSession: (userData, rememberMe) => {
    const storage = rememberMe ? localStorage : sessionStorage
    storage.setItem(STORAGE_KEYS.accessKey, userData.accessKey)
    storage.setItem(STORAGE_KEYS.secretKey, userData.secretKey)
    storage.setItem(STORAGE_KEYS.screenname, userData.screenname)
    storage.setItem(STORAGE_KEYS.email, userData.email)
  },

  hydrateSession: () => {
    let accessKey = localStorage.getItem(STORAGE_KEYS.accessKey)
    let secretKey = localStorage.getItem(STORAGE_KEYS.secretKey)
    let screenname = localStorage.getItem(STORAGE_KEYS.screenname)
    let email = localStorage.getItem(STORAGE_KEYS.email)

    if (!accessKey || !secretKey) {
      accessKey = sessionStorage.getItem(STORAGE_KEYS.accessKey)
      secretKey = sessionStorage.getItem(STORAGE_KEYS.secretKey)
      screenname = sessionStorage.getItem(STORAGE_KEYS.screenname)
      email = sessionStorage.getItem(STORAGE_KEYS.email)
    }

    if (accessKey && secretKey) {
      set({
        isLoggedIn: true,
        screenname,
        email,
        accessKey,
        secretKey,
        loginError: null,
        isLoggingIn: false,
      })
    }
  },

  validateSession: async () => {
    const { accessKey, secretKey, isLoggedIn } = get()

    if (!isLoggedIn || !accessKey || !secretKey) {
      return
    }

    try {
      const res = await fetch("/api/validate", {
        headers: {
          Authorization: "LOW " + accessKey + ":" + secretKey,
        },
      })

      const data = await res.json()

      if (!data.ok) {
        get().logout()
      }
    } catch {
      get().logout()
    }
  },
}))

export default useAuthStore
