/**
 * Guarded localStorage/sessionStorage helpers.
 *
 * All keys live under the `quarchive:` prefix. Storage is probed on every
 * call (never at import time) because Safari private mode and some embedded
 * webviews throw on access. Malformed JSON is removed on read.
 */

export const STORAGE_PREFIX = 'quarchive:'

/** @param {string} key @returns {string} Prefixed storage key */
export function storageKey(key) {
  const raw = String(key)
  return raw.startsWith(STORAGE_PREFIX) ? raw : `${STORAGE_PREFIX}${raw}`
}

/**
 * Get a usable Storage-like object, or null.
 *
 * @param {'local'|'session'} [kind='local']
 * @returns {Storage|null}
 */
export function getStorage(kind = 'local') {
  try {
    const storage = globalThis[kind === 'session' ? 'sessionStorage' : 'localStorage']
    if (!storage) return null
    const probe = `${STORAGE_PREFIX}__probe__`
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

/** @param {string} key @param {object} [options] @returns {string|null} */
export function loadRaw(key, { storage = getStorage() } = {}) {
  try {
    return storage?.getItem(storageKey(key)) ?? null
  } catch {
    return null
  }
}

/** @param {string} key @param {*} value @param {object} [options] @returns {boolean} */
export function saveRaw(key, value, { storage = getStorage() } = {}) {
  try {
    if (!storage) return false
    storage.setItem(storageKey(key), String(value))
    return true
  } catch {
    return false
  }
}

/**
 * Read and parse JSON. Bad values are cleaned up and the fallback returned.
 *
 * @param {string} key
 * @param {*} [fallback=null]
 * @param {object} [options]
 * @returns {*}
 */
export function loadJSON(key, fallback = null, options = {}) {
  const raw = loadRaw(key, options)
  if (raw === null) return fallback
  try {
    const parsed = JSON.parse(raw)
    return parsed === undefined ? fallback : parsed
  } catch {
    remove(key, options)
    return fallback
  }
}

/** @param {string} key @param {*} value @param {object} [options] @returns {boolean} */
export function saveJSON(key, value, options = {}) {
  try {
    return saveRaw(key, JSON.stringify(value), options)
  } catch {
    return false
  }
}

/** @param {string} key @param {object} [options] @returns {boolean} */
export function remove(key, { storage = getStorage() } = {}) {
  try {
    if (!storage) return false
    storage.removeItem(storageKey(key))
    return true
  } catch {
    return false
  }
}

function sameValue(a, b) {
  if (a === b) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * Add a value to the front of a stored array, dropping duplicates.
 *
 * @param {string} key
 * @param {*} value
 * @param {object} [options]
 * @param {number} [options.limit=20] Maximum retained entries (0 = unlimited)
 * @param {boolean} [options.unique=true]
 * @returns {Array} The persisted array
 */
export function pushFront(
  key,
  value,
  { limit = 20, unique = true, ...options } = {},
) {
  const stored = loadJSON(key, [], options)
  const list = Array.isArray(stored) ? stored : []
  const rest = unique ? list.filter((item) => !sameValue(item, value)) : list
  const next = [value, ...rest]
  const capped = limit > 0 ? next.slice(0, limit) : next
  saveJSON(key, capped, options)
  return capped
}

/**
 * Toggle a value in a stored array.
 *
 * @param {string} key
 * @param {*} value
 * @param {object} [options]
 * @returns {{active: boolean, list: Array}} Whether the value is now present
 */
export function toggle(key, value, options = {}) {
  const stored = loadJSON(key, [], options)
  const list = Array.isArray(stored) ? stored : []
  const index = list.findIndex((item) => sameValue(item, value))
  const active = index === -1
  const next = active
    ? [value, ...list]
    : list.filter((_, i) => i !== index)
  saveJSON(key, next, options)
  return { active, list: next }
}

/**
 * Toggle a stored boolean flag (e.g. a dismissed banner).
 *
 * @param {string} key
 * @param {boolean} [fallback=false]
 * @param {object} [options]
 * @returns {boolean} New value
 */
export function toggleFlag(key, fallback = false, options = {}) {
  const current = loadJSON(key, fallback, options)
  const next = !current
  saveJSON(key, next, options)
  return next
}
