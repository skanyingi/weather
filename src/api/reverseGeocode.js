/**
 * Reverse geocoding for the geolocation-based default view.
 *
 * Visual Crossing echoes a `lat,lon` query back verbatim as `resolvedAddress`,
 * so a geolocated lookup produces no place name to display. This module turns
 * those coordinates into something a person recognises — "Westlands, Nairobi,
 * Kenya" rather than "-1.2516,36.8459".
 *
 * Uses the BigDataCloud client endpoint: free, no API key, and it sends
 * `access-control-allow-origin: *` so it can be called straight from the
 * browser. Failures are non-fatal by design — the caller falls back to showing
 * coordinates, which is what the app did before this existed.
 */

const ENDPOINT = 'https://api.bigdatacloud.net/data/reverse-geocode-client'

/**
 * The free endpoint is usually ~1s but occasionally stalls for 9s+. The budget
 * is generous because this request runs in parallel with the weather fetch, so
 * its latency is hidden rather than added to perceived load. Failing returns
 * null and the UI falls back to coordinates.
 */
const REQUEST_TIMEOUT_MS = 12000

/**
 * A few country names come back in a legalistic form that is too long for a
 * one-line label. Trimmed here rather than in the UI.
 */
const COUNTRY_NAME_OVERRIDES = {
  'United Kingdom of Great Britain and Northern Ireland': 'United Kingdom',
  'United States of America': 'United States',
  'Russian Federation': 'Russia',
  'Republic of Korea': 'South Korea',
  "Korea, Democratic People's Republic of": 'North Korea',
  'Bolivia, Plurinational State of': 'Bolivia',
  'Tanzania, United Republic of': 'Tanzania',
  'Iran, Islamic Republic of': 'Iran',
  'Venezuela, Bolivarian Republic of': 'Venezuela',
  'Moldova, Republic of': 'Moldova',
  'Brunei Darussalam': 'Brunei',
  'Congo, Democratic Republic of the': 'DR Congo',
  'Congo': 'Republic of the Congo',
  "Lao People's Democratic Republic": 'Laos',
  'Viet Nam': 'Vietnam',
  'Czechia': 'Czech Republic',
  'Netherlands': 'Netherlands',
}

/**
 * Admin-level names matching these are administrative bookkeeping rather than
 * places anyone would recognise — "Karura ward", "L Ward", "Mumbai Zone 5",
 * "exclusive economic zone of the United States". Filtered out so the label
 * stays readable.
 */
const NOISE_PATTERN =
  /\b(ward|division|sub-?location|metropolitan region|census|precinct|parish|economic zone)\b/i

/** Names ending in these are administrative units, not neighbourhood names. */
const ADMINISTRATIVE_SUFFIX_PATTERN = /\s+(district|counties|borough|precinct|zone)s?$/i

/** True when a name is worth showing in a short place label. */
function isMeaningful(name) {
  return typeof name === 'string' && name.trim().length > 1
}

/**
 * True when a name is a plausible place label.
 *
 * A proper noun starts with an uppercase letter, which rules out the
 * descriptive phrases BigDataCloud emits for unpopulated points
 * ("exclusive economic zone of the United States").
 */
function isPlaceName(name) {
  return isMeaningful(name) && /^\p{Lu}/u.test(name.trim())
}

/** Case/punctuation-insensitive comparison, so "New York" ≠ "New York City" is false. */
function sameName(a, b) {
  if (!isMeaningful(a) || !isMeaningful(b)) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** True when one name is a substring of the other, e.g. "Nairobi" in "Nairobi City". */
function overlaps(a, b) {
  if (!isMeaningful(a) || !isMeaningful(b)) return false
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  return x.includes(y) || y.includes(x)
}

function shortCountry(name, countryCode) {
  if (!name) return countryCode ?? ''
  if (COUNTRY_NAME_OVERRIDES[name]) return COUNTRY_NAME_OVERRIDES[name]
  // Anything implausibly long for a label is a legal form we have not mapped.
  if (name.length > 28) return countryCode ?? name
  return name
}

/**
 * Choose the sub-city area name, e.g. "Westlands" or "Manhattan".
 *
 * The `locality` scalar is the API's own answer to "which part of the city is
 * this", so it is preferred whenever it adds something beyond the city name.
 * When it merely repeats the city (common), fall back to scanning the admin
 * hierarchy for a mid-level entry — a borough, suburb or estate — while
 * skipping the deeper administrative noise.
 */
function isUsablePlaceName(name) {
  return isPlaceName(name) && !NOISE_PATTERN.test(name) && !ADMINISTRATIVE_SUFFIX_PATTERN.test(name)
}

function pickArea(payload, city) {
  const locality = payload?.locality
  const administrative = payload?.localityInfo?.administrative ?? []

  if (isUsablePlaceName(locality) && !sameName(locality, city)) {
    return locality
  }

  // Levels 5-7 hold city districts, boroughs and suburbs. Below that it is
  // wards and zones; above that it is states and regions, which are handled
  // separately via `principalSubdivision`.
  const candidates = administrative
    .filter((entry) => entry.adminLevel >= 5 && entry.adminLevel <= 7)
    .filter((entry) => isUsablePlaceName(entry.name))
    .filter((entry) => !sameName(entry.name, city) && !sameName(entry.name, locality))

  // Prefer the coarsest remaining level: a recognisable district beats a finer
  // subdivision of it. The array is not reliably ordered, so sort by level.
  candidates.sort((a, b) => a.adminLevel - b.adminLevel)
  return candidates[0]?.name ?? null
}

/**
 * Turn a BigDataCloud payload into the strings the UI needs.
 *
 * @returns {{area: string|null, city: string|null, region: string|null,
 *            country: string, label: string}}
 */
export function formatReverseGeocode(payload) {
  const city = isMeaningful(payload?.city) ? payload.city : null
  const locality = isMeaningful(payload?.locality) ? payload.locality : null
  const country = shortCountry(payload?.countryName, payload?.countryCode)
  const area = pickArea(payload, city)

  // The region is redundant when the city name already implies it
  // ("Nairobi" / "Nairobi City", "New York City" / "New York").
  const region =
    isPlaceName(payload?.principalSubdivision) && !overlaps(payload.principalSubdivision, city)
      ? payload.principalSubdivision
      : null

  // `locality` stands in for `city` when the city field is empty, but only if
  // it is a real place name: at sea or in unpopulated areas the API sets
  // `locality` to a descriptive phrase such as "exclusive economic zone of
  // the United States", which must not become the label.
  const cityOrLocality = city ?? (isUsablePlaceName(locality) ? locality : null)

  // Assemble most-specific-first, dropping duplicates and empty segments:
  // "Manhattan, New York City, United States".
  const parts = []
  for (const part of [area, cityOrLocality, region, country]) {
    if (!isPlaceName(part)) continue
    if (parts.some((existing) => sameName(existing, part))) continue
    parts.push(part)
  }

  return { area, city, region, country, label: parts.join(', ') }
}

/**
 * Look up a place name for a coordinate pair.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<{area: string|null, city: string|null, region: string|null,
 *                    country: string, label: string}|null>} null on any failure.
 */
export async function reverseGeocode(latitude, longitude, { signal } = {}) {
  const url =
    `${ENDPOINT}?latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}&localityLanguage=en`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const onExternalAbort = () => controller.abort()
  signal?.addEventListener('abort', onExternalAbort)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null
    const payload = await response.json()
    const formatted = formatReverseGeocode(payload)
    return formatted.label ? formatted : null
  } catch {
    // Reverse geocoding is cosmetic. Losing it must never break the forecast.
    return null
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}

/**
 * True when a location string is a bare "lat,lon" pair.
 *
 * Geolocated lookups are the only ones that need reverse geocoding; a typed
 * search like "Nairobi, Kenya" already resolves to a name.
 */
export function isCoordinatePair(location) {
  if (typeof location !== 'string') return false
  const match = location
    .trim()
    .match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (!match) return false
  return Math.abs(Number(match[1])) <= 90 && Math.abs(Number(match[2])) <= 180
}
