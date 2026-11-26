/**
 * Opt-in browser geolocation helpers.
 *
 * Detection is only started when the caller invokes `detectUserState()`;
 * nothing runs at import time and no coordinates ever leave the device.
 * The resolved state (including a `null` result) is cached for 24 hours so
 * repeated calls do not re-prompt.
 */

import { GEO_CACHE_TTL_MS, GEO_TIMEOUT_MS } from './constants.js'
import { loadJSON, remove, saveJSON } from './store.js'
import { resolveStateFromCoords } from './indianStates.js'

const CACHE_KEY = 'user_state'

/** @param {object} [deps] @returns {boolean} */
export function isGeolocationSupported({ navigatorImpl = globalThis.navigator } = {}) {
  return typeof navigatorImpl !== 'undefined' && 'geolocation' in navigatorImpl
}

/**
 * Read the current position from the browser Geolocation API.
 *
 * @param {PositionOptions} [options]
 * @param {object} [deps]
 * @param {*} [deps.navigatorImpl]
 * @returns {Promise<{latitude:number,longitude:number}>}
 */
export function getCurrentPosition(
  options = {},
  { navigatorImpl = globalThis.navigator } = {},
) {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported({ navigatorImpl })) {
      reject(new Error('Geolocation is not supported by this browser'))
      return
    }

    navigatorImpl.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      (error) => reject(error),
      {
        enableHighAccuracy: false,
        timeout: GEO_TIMEOUT_MS,
        maximumAge: 300000, // 5 minutes
        ...options,
      },
    )
  })
}

/**
 * Detect the user's Indian state/UT: fresh cache → live coords → resolve →
 * cache. Permission denials and storage failures are swallowed.
 *
 * @param {object} [deps]
 * @param {*} [deps.navigatorImpl]
 * @param {Storage} [deps.storage]
 * @param {Function} [deps.now] Clock injectable for tests
 * @returns {Promise<import('./indianStates.js').IndianState|null>}
 */
export async function detectUserState(deps = {}) {
  const { now = Date.now, storage } = deps

  const cached = loadJSON(CACHE_KEY, null, { storage })
  if (cached && typeof cached === 'object' &&
      Object.prototype.hasOwnProperty.call(cached, 'state')) {
    if (now() - cached.timestamp < GEO_CACHE_TTL_MS) return cached.state
  }

  try {
    const { latitude, longitude } = await getCurrentPosition({}, deps)
    const state = resolveStateFromCoords(latitude, longitude) || null

    saveJSON(CACHE_KEY, { state, timestamp: now() }, { storage })
    return state
  } catch {
    // Permission denied, timeout, unsupported, etc.
    return null
  }
}

/** Clear the cached state without prompting. @param {object} [deps] */
export function clearGeoCache(deps = {}) {
  remove(CACHE_KEY, { storage: deps.storage })
}

/**
 * Read a fresh cached state without triggering a permission prompt.
 *
 * @param {object} [deps]
 * @returns {import('./indianStates.js').IndianState|null}
 */
export function getCachedUserState(deps = {}) {
  const { now = Date.now, storage } = deps
  const cached = loadJSON(CACHE_KEY, null, { storage })
  if (!cached || typeof cached !== 'object') return null
  if (now() - cached.timestamp >= GEO_CACHE_TTL_MS) return null
  return cached.state ?? null
}
