/**
 * Internet Archive account auth helpers.
 *
 * The password is sent to /api/login once and never persisted — only the
 * S3 keys and display fields are stored, in localStorage when "remember"
 * is ticked and in sessionStorage otherwise (same semantics as
 * src/store/authStore.js).
 */

import { apiGet, apiPost } from './fetch.js'
import { getStorage, loadRaw, remove, saveRaw } from './store.js'

/** Raw key names; storageKey() adds the `quarchive:` prefix. */
export const STORAGE_KEYS = {
  accessKey: 'access_key',
  secretKey: 'secret_key',
  screenname: 'screenname',
  email: 'email',
}

const INVALID_CREDENTIALS = 'Incorrect email or password'
const CONNECTION_FAILED = 'Connection failed \u2014 please try again'
const KEY_ERROR = 'Could not generate upload keys \u2014 please try again'

/** Only forward fetch-related options to the request layer. */
const fetchDeps = ({ fetchImpl, signal, timeoutMs } = {}) => ({
  fetchImpl,
  signal,
  timeoutMs,
})

/**
 * Read a hydrated session (localStorage first, then sessionStorage).
 *
 * @param {object} [deps]
 * @returns {{isLoggedIn: boolean, screenname: string|null, email: string|null,
 *   accessKey: string|null, secretKey: string|null}|null}
 */
export function loadAuth(deps = {}) {
  const local = deps.local ?? getStorage('local')
  const session = deps.session ?? getStorage('session')

  const read = (store) => ({
    accessKey: loadRaw(STORAGE_KEYS.accessKey, { storage: store }),
    secretKey: loadRaw(STORAGE_KEYS.secretKey, { storage: store }),
    screenname: loadRaw(STORAGE_KEYS.screenname, { storage: store }),
    email: loadRaw(STORAGE_KEYS.email, { storage: store }),
  })

  let values = read(local)
  if (!values.accessKey || !values.secretKey) values = read(session)
  if (!values.accessKey || !values.secretKey) return null

  return {
    isLoggedIn: true,
    screenname: values.screenname,
    email: values.email,
    accessKey: values.accessKey,
    secretKey: values.secretKey,
  }
}

/**
 * Persist a session. Passwords are deliberately not accepted here.
 *
 * @param {{screenname:string,email:string,accessKey:string,secretKey:string}} userData
 * @param {boolean} [remember=false]
 * @param {object} [deps]
 * @returns {boolean} Whether all values were written
 */
export function saveAuth(userData, remember = false, deps = {}) {
  const storage = deps.storage ?? getStorage(remember ? 'local' : 'session')
  return Object.entries(STORAGE_KEYS).reduce((ok, [field, key]) => {
    const value = userData?.[field]
    if (value === undefined || value === null) return ok
    return saveRaw(key, value, { storage }) && ok
  }, true)
}

/** Remove credentials from both storages (called on logout). @param {object} [deps] */
export function logout(deps = {}) {
  const storages = [
    deps.local ?? getStorage('local'),
    deps.session ?? getStorage('session'),
  ]
  for (const storage of storages) {
    for (const key of Object.values(STORAGE_KEYS)) remove(key, { storage })
  }
}

/**
 * POST /api/login.
 *
 * @param {{email:string,password:string,remember?:boolean}} args
 * @param {object} [deps] Fetch injection via `{ fetchImpl, signal, timeoutMs }`
 * @returns {Promise<{success:boolean,needsKeys?:boolean,cookies?:object,
 *   error?:string,user?:object}>}
 */
export async function login({ email, password, remember = false }, deps = {}) {
  try {
    const res = await apiPost('/api/login', { email, password }, fetchDeps(deps))
    const data = await res.json()

    if (data.ok) {
      const user = {
        screenname: data.screenname,
        email: data.email,
        accessKey: data.accessKey,
        secretKey: data.secretKey,
      }
      saveAuth(user, remember, deps)
      return { success: true, user }
    }

    if (data.error === 'no_keys') {
      return {
        success: false,
        needsKeys: true,
        cookies: data.cookies,
      }
    }

    return {
      success: false,
      error: data.error === 'Invalid credentials'
        ? INVALID_CREDENTIALS
        : data.error || 'Login failed',
    }
  } catch {
    return { success: false, error: CONNECTION_FAILED }
  }
}

/**
 * POST /api/s3keys after a login that reported `no_keys`.
 *
 * @param {{cookies:object,email:string,remember?:boolean}} args
 * @param {object} [deps] Fetch injection
 * @returns {Promise<{success:boolean,error?:string,user?:object}>}
 */
export async function generateS3Keys(
  { cookies, email, remember = false },
  deps = {},
) {
  try {
    if (!cookies) return { success: false, error: KEY_ERROR }

    const res = await apiPost('/api/s3keys', {
      loggedInUser: cookies.loggedInUser,
      loggedInSig: cookies.loggedInSig,
    }, fetchDeps(deps))
    const data = await res.json()

    if (data.ok) {
      const user = {
        screenname: email.split('@')[0],
        email,
        accessKey: data.accessKey,
        secretKey: data.secretKey,
      }
      saveAuth(user, remember, deps)
      return { success: true, user }
    }

    return { success: false, error: KEY_ERROR }
  } catch {
    return { success: false, error: KEY_ERROR }
  }
}

/**
 * Check stored S3 keys against /api/validate. Failures return false; the
 * caller decides whether to call {@link logout}.
 *
 * @param {{accessKey:string,secretKey:string}} auth
 * @param {object} [deps] Fetch injection
 * @returns {Promise<boolean>}
 */
export async function validateAuth({ accessKey, secretKey } = {}, deps = {}) {
  if (!accessKey || !secretKey) return false

  try {
    const res = await apiGet('/api/validate', {
      ...fetchDeps(deps),
      headers: {
        Authorization: `LOW ${accessKey}:${secretKey}`,
      },
    })
    const data = await res.json()
    return Boolean(data.ok)
  } catch {
    return false
  }
}
