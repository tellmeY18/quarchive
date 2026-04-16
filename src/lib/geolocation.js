/**
 * @file geolocation.js
 * @description Browser geolocation helpers for detecting a user's Indian state/UT
 * from coordinates using local bounding-box matching (no external API calls).
 */

import { resolveStateFromCoords } from './indianStates'

const GEO_CACHE_KEY = 'quarchive_user_state'
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Check whether Geolocation API is available in this browser/runtime.
 * @returns {boolean}
 */
export function isGeolocationSupported() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

/**
 * Read current position from browser Geolocation API.
 *
 * @param {PositionOptions} [options]
 * @returns {Promise<{ latitude: number, longitude: number }>}
 */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('Geolocation is not supported by this browser'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        reject(error)
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
        ...options,
      },
    )
  })
}

/**
 * Detect user's Indian state/UT.
 *
 * Flow:
 * 1) Return cached result if fresh.
 * 2) Read browser coordinates.
 * 3) Resolve state from bounding boxes.
 * 4) Cache result (including null) to avoid repeated prompts.
 *
 * @returns {Promise<import('./indianStates').INDIAN_STATES[number] | null>}
 */
export async function detectUserState() {
  // 1) Cache lookup
  try {
    const cached = localStorage.getItem(GEO_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      const isFresh = Date.now() - parsed.timestamp < GEO_CACHE_TTL
      if (isFresh && Object.prototype.hasOwnProperty.call(parsed, 'state')) {
        return parsed.state
      }
    }
  } catch {
    // Ignore cache failures and continue
  }

  // 2) Resolve from live coordinates
  try {
    const { latitude, longitude } = await getCurrentPosition()
    const state = resolveStateFromCoords(latitude, longitude) || null

    // 3) Cache best-effort
    try {
      localStorage.setItem(
        GEO_CACHE_KEY,
        JSON.stringify({
          state,
          timestamp: Date.now(),
        }),
      )
    } catch {
      // Ignore storage failures
    }

    return state
  } catch {
    // Permission denied, timeout, unsupported, etc.
    return null
  }
}

/**
 * Clear cached geolocation state.
 */
export function clearGeoCache() {
  try {
    localStorage.removeItem(GEO_CACHE_KEY)
  } catch {
    // Ignore storage failures
  }
}

/**
 * Read cached state (if fresh) without triggering permission prompt.
 *
 * @returns {import('./indianStates').INDIAN_STATES[number] | null}
 */
export function getCachedUserState() {
  try {
    const cached = localStorage.getItem(GEO_CACHE_KEY)
    if (!cached) return null

    const parsed = JSON.parse(cached)
    const isFresh = Date.now() - parsed.timestamp < GEO_CACHE_TTL
    if (!isFresh) return null

    return parsed.state ?? null
  } catch {
    return null
  }
}
