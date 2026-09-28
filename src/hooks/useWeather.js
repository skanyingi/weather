import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchWeatherForLocation, WeatherApiError } from '../api/weatherApi.js'
import { isCoordinatePair, reverseGeocode } from '../api/reverseGeocode.js'
import { flattenHours, splitPastAndFuture } from '../utils/time.js'
import { iconFromConditions } from '../utils/weatherCodes.js'

const GEOLOCATION_TIMEOUT_MS = 8000

/** How long to wait after the last keystroke before a search is allowed. */
const SEARCH_DEBOUNCE_MS = 400

const CACHE_PREFIX = 'weather-app:cache:'
const CACHE_MAX_AGE_MS = 10 * 60 * 1000

function readCache(key) {
  try {
    const raw = window.sessionStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (Date.now() - entry.savedAt > CACHE_MAX_AGE_MS) {
      window.sessionStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return entry.payload
  } catch {
    return null
  }
}

function writeCache(key, payload) {
  try {
    window.sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ savedAt: Date.now(), payload }))
  } catch {
    // Quota or private-mode failures are non-fatal; the cache is an optimisation.
  }
}

/**
 * Shape the raw API responses into the view model the components render.
 *
 * The past/future split is done here (once) rather than in the components so
 * every view agrees on which hour is "now".
 */
function buildViewModel(summary, timeline, nowMs, placeLabel = null) {
  const hours = flattenHours(timeline.days)
  const { past, future } = splitPastAndFuture(hours, Math.floor(nowMs / 1000))

  const current = timeline.currentConditions ?? summary.currentConditions
  const hourly = (hour) => ({
    ...hour,
    icon: iconFromConditions(hour.icon, hour.conditions),
  })

  // Visual Crossing echoes a coordinate query back verbatim, so `resolved` is
  // "lat,lon" for the geolocated view. A reverse-geocoded name is preferred
  // when we have one, which is what makes that view read "Westlands, Nairobi,
  // Kenya" instead of a pair of numbers.
  const apiResolved = timeline.resolvedAddress ?? summary.resolvedAddress ?? ''
  const resolved = placeLabel || apiResolved

  return {
    location: {
      query: timeline.address ?? summary.address ?? '',
      resolved,
      // True when the only name we have is the raw coordinate string.
      isUnresolved: !placeLabel && /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(String(apiResolved).trim()),
      latitude: timeline.latitude ?? summary.latitude,
      longitude: timeline.longitude ?? summary.longitude,
      timeZone: timeline.timezone ?? summary.timezone ?? null,
      tzoffset: Number(timeline.tzoffset ?? summary.tzoffset ?? 0),
    },
    current: current
      ? {
          temp: current.temp,
          feelsLike: current.feelslike,
          windSpeed: current.windspeed,
          precipProbability: current.precipprob ?? 0,
          humidity: current.humidity,
          cloudCover: current.cloudcover,
          conditions: current.conditions,
          icon: iconFromConditions(current.icon, current.conditions),
          observedAtMs: typeof current.datetimeEpoch === 'number' ? current.datetimeEpoch * 1000 : nowMs,
        }
      : null,
    pastHours: past.map(hourly),
    futureHours: future.map(hourly),
    fetchedAtMs: nowMs,
  }
}

/**
 * Owns all weather data fetching and the load/refresh lifecycle.
 *
 * Status is a small explicit state machine rather than a pile of booleans:
 *   'locating'  -> asking the browser for coordinates
 *   'prompting' -> permission denied; waiting for a manual search
 *   'loading'   -> first load for a location, nothing on screen yet
 *   'refreshing'-> reload over existing data, so the UI can keep it visible
 *   'ready'     -> data rendered
 *   'error'     -> user-facing failure, previous data (if any) discarded
 */
export function useWeather() {
  const [status, setStatus] = useState('locating')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [searching, setSearching] = useState(false)
  const [lastUpdatedMs, setLastUpdatedMs] = useState(null)

  // The location currently loaded, so refresh can re-request it.
  const activeLocationRef = useRef(null)
  // Identifies the newest request; stale responses are discarded.
  const requestIdRef = useRef(0)
  const abortRef = useRef(null)
  const debounceRef = useRef(null)

  const load = useCallback(async (location, { isRefresh = false, isBackground = false } = {}) => {
    const trimmed = location?.trim()
    if (!trimmed) return

    // Ignore a repeat of the location already on screen (e.g. a refresh click
    // immediately after a search, or the geolocation result matching a search).
    if (!isRefresh && trimmed === activeLocationRef.current) {
      setSearching(false)
      return
    }

    // Cancel any in-flight request so the newest one is the only one that can
    // commit. This is the guard against rapid duplicate calls.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = ++requestIdRef.current

    setError(null)

    if (isRefresh) {
      setStatus('refreshing')
    } else if (isBackground) {
      // A background swap (e.g. geolocation resolving after a manual search)
      // should not blank out data the user is already looking at.
      setStatus((prev) => (prev === 'ready' ? 'refreshing' : 'loading'))
    } else {
      setStatus('loading')
      setSearching(false)
    }

    try {
      const nowMs = Date.now()

      // Kick off reverse geocoding in parallel with the weather fetch rather
      // than after it, so the extra round trip costs no additional wait. Only
      // coordinate queries need it; a typed "Nairobi, Kenya" already has a name.
      const placeLabelPromise = isCoordinatePair(trimmed)
        ? reverseGeocode(...trimmed.split(',').map(Number), { signal: controller.signal }).then(
            (result) => result?.label ?? null,
          )
        : Promise.resolve(null)

      const [{ summary, timeline }, placeLabel] = await Promise.all([
        fetchWeatherForLocation(trimmed, { signal: controller.signal, nowMs }),
        placeLabelPromise,
      ])

      if (requestId !== requestIdRef.current) return

      const viewModel = buildViewModel(summary, timeline, Date.now(), placeLabel)
      setData(viewModel)
      setLastUpdatedMs(Date.now())
      setStatus('ready')
      activeLocationRef.current = trimmed
      writeCache(trimmed, { summary, timeline, placeLabel })
    } catch (caught) {
      if (requestId !== requestIdRef.current) return
      // An abort is an intentional supersede, not a failure to report.
      if (caught.name === 'AbortError') return

      const message =
        caught instanceof WeatherApiError
          ? caught.message
          : 'Something went wrong loading the forecast. Please try again.'
      setError({ message, kind: caught?.kind ?? 'unknown' })
      setStatus('error')
      activeLocationRef.current = null
    }
  }, [])

  /** Public search entry point, debounced so typing does not fire a call per key. */
  const search = useCallback(
    (query) => {
      const trimmed = query?.trim()
      if (!trimmed) return

      setSearching(true)
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        load(trimmed)
      }, SEARCH_DEBOUNCE_MS)
    },
    [load],
  )

  const refresh = useCallback(() => {
    if (!activeLocationRef.current) return
    // Jump straight to the network: a refresh is an explicit user action and
    // should feel instant rather than waiting out the debounce window.
    clearTimeout(debounceRef.current)
    load(activeLocationRef.current, { isRefresh: true })
  }, [load])

  const useMyLocation = useCallback(() => {
    setError(null)
    setStatus('locating')

    if (!('geolocation' in navigator)) {
      setError({ message: 'This browser does not support location services. Search for a city instead.', kind: 'unsupported' })
      setStatus('prompting')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`
        const cached = readCache(key)
        if (cached) {
          const viewModel = buildViewModel(
            cached.summary,
            cached.timeline,
            Date.now(),
            cached.placeLabel ?? null,
          )
          setData(viewModel)
          setLastUpdatedMs(Date.now())
          setStatus('ready')
          activeLocationRef.current = key
          // Refresh in the background so the screen is never stale on arrival.
          load(key, { isBackground: true })
          return
        }
        load(key, { isBackground: true })
      },
      (geoError) => {
        // Denial is an expected outcome, not a crash: fall back to search.
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setStatus('prompting')
          return
        }
        if (geoError.code === geoError.TIMEOUT) {
          setError({ message: 'Locating you took too long. Search for a city instead.', kind: 'geolocation_timeout' })
          setStatus('prompting')
          return
        }
        setError({ message: 'We could not determine your location. Search for a city instead.', kind: 'geolocation_failed' })
        setStatus('prompting')
      },
      { enableHighAccuracy: false, timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 5 * 60 * 1000 },
    )
  }, [load])

  // Attempt the geolocation-based default view on mount. Runs once: the empty
  // dependency list is intentional, and the callback is already memoized.
  useEffect(() => {
    useMyLocation()
  }, [useMyLocation])

  // Tear down any in-flight request and pending debounce on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      clearTimeout(debounceRef.current)
    }
  }, [])

  return {
    status,
    data,
    error,
    searching,
    lastUpdatedMs,
    search,
    refresh,
    useMyLocation,
  }
}
