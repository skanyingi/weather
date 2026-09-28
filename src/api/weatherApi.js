/**
 * Visual Crossing Timeline Weather API client.
 *
 * All requests go directly from the browser to Visual Crossing — there is no
 * backend in this project.
 *
 * Query cost matters: the free plan allows 1,000 weather records per day and a
 * single 3-day hourly request costs ~25 records, so this module keeps the
 * payload lean by requesting only the elements the UI actually renders.
 */

import { buildTimelineWindow } from '../utils/time.js'

const BASE_URL = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline'
const API_KEY = import.meta.env.VITE_WEATHER_API_KEY

/** Exactly the fields the UI needs. Trimming cuts response size and cost. */
const ELEMENTS = [
  'datetime',
  'datetimeEpoch',
  'temp',
  'feelslike',
  'windspeed',
  'precipprob',
  'preciptype',
  'humidity',
  'cloudcover',
  'conditions',
  'icon',
].join(',')

const UNIT_GROUP = 'metric'

/** Abort a request that has not settled within this many milliseconds. */
const REQUEST_TIMEOUT_MS = 15000

export class WeatherApiError extends Error {
  constructor(message, { kind = 'unknown', status = null } = {}) {
    super(message)
    this.name = 'WeatherApiError'
    this.kind = kind
    this.status = status
  }
}

function assertConfigured() {
  if (!API_KEY) {
    throw new WeatherApiError(
      'No API key configured. Copy .env.example to .env and set VITE_WEATHER_API_KEY.',
      { kind: 'missing_key' },
    )
  }
}

function buildUrl(location, params, pathDates) {
  const search = new URLSearchParams({ key: API_KEY, ...params })
  // The date window is part of the path, not the query string: /timeline/{loc}/{date1}/{date2}
  const dateSegment = pathDates?.length ? `/${pathDates.join('/')}` : ''
  return `${BASE_URL}/${encodeURIComponent(location)}${dateSegment}?${search.toString()}`
}

/**
 * Translate a non-2xx response into a message worth showing a user.
 *
 * Visual Crossing answers errors with plain text (not JSON), e.g.
 * `Bad API Request:No valid locations could be determined from the input`.
 */
async function toApiError(response) {
  let detail = ''
  try {
    detail = (await response.text()).trim()
  } catch {
    // Body already consumed or unreadable; fall through to the status default.
  }

  if (response.status === 400) {
    if (/no valid locations/i.test(detail)) {
      return new WeatherApiError("We couldn't find that location. Try a city, postcode or address.", {
        kind: 'invalid_location',
        status: 400,
      })
    }
    return new WeatherApiError(detail || 'The weather service rejected that request.', {
      kind: 'bad_request',
      status: 400,
    })
  }

  if (response.status === 401 || response.status === 403) {
    return new WeatherApiError('The API key was rejected. Check VITE_WEATHER_API_KEY in your .env file.', {
      kind: 'bad_key',
      status: response.status,
    })
  }

  if (response.status === 429) {
    return new WeatherApiError(
      "You've used today's free weather records. The limit resets daily, or upgrade your plan.",
      { kind: 'rate_limited', status: 429 },
    )
  }

  if (response.status >= 500) {
    return new WeatherApiError('The weather service is temporarily unavailable. Please try again.', {
      kind: 'service_down',
      status: response.status,
    })
  }

  return new WeatherApiError(detail || `Weather request failed (${response.status}).`, {
    kind: 'unknown',
    status: response.status,
  })
}

async function requestJson(url, { signal } = {}) {
  assertConfigured()

  // Bridge the caller's AbortSignal to our timeout so a hung request cannot
  // leave the UI spinning forever.
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const onExternalAbort = () => controller.abort()
  signal?.addEventListener('abort', onExternalAbort)

  let response
  try {
    response = await fetch(url, { signal: controller.signal })
  } catch (error) {
    if (signal?.aborted) throw error
    if (error.name === 'AbortError') {
      throw new WeatherApiError('The weather request timed out. Check your connection and retry.', {
        kind: 'timeout',
      })
    }
    throw new WeatherApiError('Could not reach the weather service. Check your connection and retry.', {
      kind: 'network',
    })
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onExternalAbort)
  }

  if (!response.ok) throw await toApiError(response)

  try {
    return await response.json()
  } catch {
    throw new WeatherApiError('The weather service returned an unreadable response.', {
      kind: 'bad_payload',
    })
  }
}

/**
 * Cheap probe: resolves a location to its timezone and current conditions.
 *
 * This runs first because Visual Crossing only reveals the location's UTC
 * offset inside the response, and we need that offset to express "the last 24
 * hours" in the location's own local time. Costs a single weather record.
 *
 * @param {string} location Address, "City,Country", postcode, or "lat,lon".
 */
export async function fetchLocationSummary(location, { signal } = {}) {
  const url = buildUrl(location, {
    include: 'current',
    unitGroup: UNIT_GROUP,
    elements: 'datetime,datetimeEpoch,temp,feelslike,windspeed,precipprob,preciptype,humidity,cloudcover,conditions,icon',
  })
  return requestJson(url, { signal })
}

/**
 * Full hourly payload spanning roughly the past 24h through the next 24h.
 *
 * @param {string} location As above.
 * @param {string} startDate `YYYY-MM-DD` in the location's local time.
 * @param {string} endDate   `YYYY-MM-DD` in the location's local time.
 */
export async function fetchTimeline(location, { startDate, endDate, signal } = {}) {
  const url = buildUrl(
    location,
    {
      include: 'hours,current',
      unitGroup: UNIT_GROUP,
      elements: ELEMENTS,
    },
    [startDate, endDate],
  )
  return requestJson(url, { signal })
}

/** Convenience wrapper: probe for the offset, then fetch the timeline. */
export async function fetchWeatherForLocation(location, { signal, nowMs = Date.now() } = {}) {
  const summary = await fetchLocationSummary(location, { signal })
  const offsetSeconds = Number(summary.tzoffset ?? 0)
  const { startDate, endDate } = buildTimelineWindow(Math.floor(nowMs / 1000), offsetSeconds)
  const timeline = await fetchTimeline(location, { startDate, endDate, signal })
  return { summary, timeline }
}
