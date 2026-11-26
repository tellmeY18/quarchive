/**
 * Static lookup table of Indian states and union territories: Wikidata QIDs,
 * primary languages and approximate bounding boxes for geolocation.
 *
 * Data sources: Wikidata (QIDs), Survey of India / OpenStreetMap (bboxes),
 * Census of India (languages).
 */

/**
 * @typedef {Object} BoundingBox
 * @property {number} north
 * @property {number} south
 * @property {number} east
 * @property {number} west
 */

/**
 * @typedef {Object} IndianState
 * @property {string} name
 * @property {string} qid
 * @property {string[]} languages
 * @property {BoundingBox} bbox
 */

/** @type {IndianState[]} All 28 states and 8 union territories. */
export const INDIAN_STATES = [
  // States (28)
  {
    name: 'Andhra Pradesh', qid: 'Q1159', languages: ['te', 'ur', 'hi'],
    bbox: { north: 19.13, south: 12.62, east: 84.78, west: 76.76 },
  },
  {
    name: 'Arunachal Pradesh', qid: 'Q1162', languages: ['en', 'hi'],
    bbox: { north: 29.47, south: 26.65, east: 97.42, west: 91.55 },
  },
  {
    name: 'Assam', qid: 'Q1164', languages: ['as', 'bn', 'hi'],
    bbox: { north: 27.97, south: 24.13, east: 96.02, west: 89.69 },
  },
  {
    name: 'Bihar', qid: 'Q1165', languages: ['hi', 'ur'],
    bbox: { north: 27.52, south: 24.28, east: 88.17, west: 83.33 },
  },
  {
    name: 'Chhattisgarh', qid: 'Q1168', languages: ['hi'],
    bbox: { north: 24.11, south: 17.78, east: 84.40, west: 80.25 },
  },
  {
    name: 'Goa', qid: 'Q1171', languages: ['kok', 'mr', 'hi', 'en'],
    bbox: { north: 15.80, south: 14.88, east: 74.34, west: 73.68 },
  },
  {
    name: 'Gujarat', qid: 'Q1061', languages: ['gu', 'hi'],
    bbox: { north: 24.71, south: 20.05, east: 74.48, west: 68.16 },
  },
  {
    name: 'Haryana', qid: 'Q1174', languages: ['hi'],
    bbox: { north: 30.92, south: 27.66, east: 77.60, west: 74.46 },
  },
  {
    name: 'Himachal Pradesh', qid: 'Q1177', languages: ['hi'],
    bbox: { north: 33.26, south: 30.38, east: 79.00, west: 75.58 },
  },
  {
    name: 'Jharkhand', qid: 'Q1184', languages: ['hi'],
    bbox: { north: 25.35, south: 21.97, east: 87.97, west: 83.33 },
  },
  {
    name: 'Karnataka', qid: 'Q1185', languages: ['kn', 'ur', 'te', 'hi'],
    bbox: { north: 18.45, south: 11.59, east: 78.59, west: 74.05 },
  },
  {
    name: 'Kerala', qid: 'Q1186', languages: ['ml', 'en'],
    bbox: { north: 12.79, south: 8.18, east: 77.42, west: 74.86 },
  },
  {
    name: 'Madhya Pradesh', qid: 'Q1188', languages: ['hi'],
    bbox: { north: 26.87, south: 21.08, east: 82.82, west: 74.03 },
  },
  {
    name: 'Maharashtra', qid: 'Q1191', languages: ['mr', 'hi', 'ur'],
    bbox: { north: 22.03, south: 15.60, east: 80.90, west: 72.65 },
  },
  {
    name: 'Manipur', qid: 'Q1193', languages: ['mni', 'en'],
    bbox: { north: 25.69, south: 23.83, east: 94.74, west: 93.00 },
  },
  {
    name: 'Meghalaya', qid: 'Q1195', languages: ['en', 'kha'],
    bbox: { north: 26.12, south: 25.03, east: 92.80, west: 89.82 },
  },
  {
    name: 'Mizoram', qid: 'Q1502', languages: ['lus', 'en'],
    bbox: { north: 24.52, south: 21.94, east: 93.44, west: 92.26 },
  },
  {
    name: 'Nagaland', qid: 'Q1599', languages: ['en'],
    bbox: { north: 27.05, south: 25.20, east: 95.24, west: 93.34 },
  },
  {
    name: 'Odisha', qid: 'Q22048', languages: ['or', 'hi'],
    bbox: { north: 22.57, south: 17.80, east: 87.49, west: 81.39 },
  },
  {
    name: 'Punjab', qid: 'Q22424', languages: ['pa', 'hi'],
    bbox: { north: 32.51, south: 29.54, east: 76.94, west: 73.88 },
  },
  {
    name: 'Rajasthan', qid: 'Q1437', languages: ['hi'],
    bbox: { north: 30.19, south: 23.06, east: 78.27, west: 69.48 },
  },
  {
    name: 'Sikkim', qid: 'Q1505', languages: ['ne', 'en'],
    bbox: { north: 28.13, south: 27.08, east: 88.91, west: 88.01 },
  },
  {
    name: 'Tamil Nadu', qid: 'Q1445', languages: ['ta', 'en'],
    bbox: { north: 13.56, south: 8.07, east: 80.35, west: 76.23 },
  },
  {
    name: 'Telangana', qid: 'Q677037', languages: ['te', 'ur', 'hi'],
    bbox: { north: 19.92, south: 15.83, east: 81.33, west: 77.28 },
  },
  {
    name: 'Tripura', qid: 'Q1363', languages: ['bn', 'kok'],
    bbox: { north: 24.53, south: 22.94, east: 92.33, west: 91.15 },
  },
  {
    name: 'Uttar Pradesh', qid: 'Q1498', languages: ['hi', 'ur'],
    bbox: { north: 30.41, south: 23.87, east: 84.63, west: 77.09 },
  },
  {
    name: 'Uttarakhand', qid: 'Q1499', languages: ['hi'],
    bbox: { north: 31.46, south: 28.72, east: 81.03, west: 77.58 },
  },
  {
    name: 'West Bengal', qid: 'Q1356', languages: ['bn', 'hi', 'ne'],
    bbox: { north: 27.22, south: 21.54, east: 89.88, west: 85.82 },
  },

  // Union Territories (8)
  {
    name: 'Andaman and Nicobar Islands', qid: 'Q40888',
    languages: ['hi', 'en', 'bn', 'ta'],
    bbox: { north: 13.68, south: 6.76, east: 93.95, west: 92.24 },
  },
  {
    name: 'Chandigarh', qid: 'Q43433', languages: ['hi', 'pa', 'en'],
    bbox: { north: 30.79, south: 30.67, east: 76.85, west: 76.71 },
  },
  {
    name: 'Dadra and Nagar Haveli and Daman and Diu', qid: 'Q66743975',
    languages: ['gu', 'hi', 'mr'],
    bbox: { north: 20.77, south: 20.06, east: 73.22, west: 72.79 },
  },
  {
    name: 'Delhi', qid: 'Q1353', languages: ['hi', 'ur', 'pa', 'en'],
    bbox: { north: 28.88, south: 28.40, east: 77.35, west: 76.84 },
  },
  {
    name: 'Jammu and Kashmir', qid: 'Q66743951', languages: ['ur', 'hi', 'ks', 'doi'],
    bbox: { north: 35.00, south: 32.30, east: 76.87, west: 73.75 },
  },
  {
    name: 'Ladakh', qid: 'Q200667', languages: ['hi', 'en', 'bo'],
    bbox: { north: 37.05, south: 32.15, east: 80.30, west: 75.40 },
  },
  {
    name: 'Lakshadweep', qid: 'Q26927', languages: ['ml', 'en'],
    bbox: { north: 12.50, south: 8.27, east: 74.00, west: 71.73 },
  },
  {
    name: 'Puducherry', qid: 'Q66724', languages: ['ta', 'fr', 'en', 'ml'],
    bbox: { north: 12.03, south: 10.77, east: 79.86, west: 79.61 },
  },
]

const _byQid = new Map(INDIAN_STATES.map((s) => [s.qid, s]))
const _byNameLower = new Map(INDIAN_STATES.map((s) => [s.name.toLowerCase(), s]))

/** @param {BoundingBox} bbox @returns {{lat:number,lng:number}} */
function bboxCenter(bbox) {
  return {
    lat: (bbox.north + bbox.south) / 2,
    lng: (bbox.east + bbox.west) / 2,
  }
}

/** @returns {number} Squared euclidean distance */
function distSq(lat1, lng1, lat2, lng2) {
  const dLat = lat1 - lat2
  const dLng = lng1 - lng2
  return dLat * dLat + dLng * dLng
}

/** @returns {boolean} */
function isInsideBbox(lat, lng, bbox) {
  return (
    lat >= bbox.south && lat <= bbox.north &&
    lng >= bbox.west && lng <= bbox.east
  )
}

/**
 * Resolve coordinates to the closest matching state/UT, or null outside India.
 * Overlapping bounding boxes are disambiguated by bbox-centre distance.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {IndianState|null}
 */
export function resolveStateFromCoords(lat, lng) {
  if (lat < 6.0 || lat > 38.0 || lng < 68.0 || lng > 98.0) return null

  const candidates = INDIAN_STATES.filter((s) => isInsideBbox(lat, lng, s.bbox))
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  let best = candidates[0]
  let bestDist = Infinity

  for (const state of candidates) {
    const center = bboxCenter(state.bbox)
    const d = distSq(lat, lng, center.lat, center.lng)
    if (d < bestDist) {
      bestDist = d
      best = state
    }
  }

  return best
}

/** Alias used by the app's geolocation helpers. */
export const resolveState = resolveStateFromCoords

/** @param {string} qid @returns {IndianState|undefined} */
export function getStateByQid(qid) {
  return _byQid.get(qid)
}

/**
 * Case-insensitive exact match, then first partial name match.
 *
 * @param {string} name
 * @returns {IndianState|undefined}
 */
export function getStateByName(name) {
  const needle = String(name || '').toLowerCase()
  const exact = _byNameLower.get(needle)
  if (exact) return exact
  return INDIAN_STATES.find((s) => s.name.toLowerCase().includes(needle))
}

/** @returns {IndianState[]} All states and UTs. */
export function getStates() {
  return INDIAN_STATES
}
