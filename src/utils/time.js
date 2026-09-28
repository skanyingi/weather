/**
 * Timezone and window helpers.
 *
 * Visual Crossing returns every timestamp in the *local time of the queried
 * location*, which is frequently NOT the same as the browser's timezone. So we
 * never trust the user's machine clock alone: each hourly record carries
 * `datetimeEpoch` (absolute seconds since 1970-01-01 UTC), and every split or
 * comparison in this module is based on those absolute epochs. Local-time
 * strings are only ever used for display, via the IANA zone from the response.
 */

const HOUR_SECONDS = 3600
const DAY_SECONDS = 86400
const SECONDS_PER_HOUR = 3600

/**
 * Convert an epoch (seconds) into the "wall clock" parts that a person at the
 * queried location would read off a clock. `tzoffset` is Visual Crossing's
 * UTC offset in hours for that location.
 *
 * Returns UTC-getter parts deliberately: adding the offset first makes the UTC
 * getters behave like local getters, which avoids a dependency on the browser's
 * own timezone and keeps this testable in any environment.
 */
export function epochToLocalParts(epochSeconds, tzoffset = 0) {
  const shifted = new Date((epochSeconds + tzoffset * SECONDS_PER_HOUR) * 1000)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  }
}

/** Format epoch seconds as `YYYY-MM-DD` in the queried location's local time. */
export function epochToLocalDateString(epochSeconds, tzoffset = 0) {
  const { year, month, day } = epochToLocalParts(epochSeconds, tzoffset)
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Build the `date1`/`date2` path segment that asks for roughly the last 24h and
 * the next 24h of hourly data.
 *
 * The API resolves an end date at midnight, so `now + 24h` alone can cut the
 * final day short. Adding one extra day guarantees a full local day is always
 * returned, and we trim the surplus off client-side.
 *
 * Rounded to the hour so the request boundaries align with the hourly records
 * the API returns.
 */
export function buildTimelineWindow(nowEpochSeconds, tzoffset = 0) {
  const startEpoch = Math.floor((nowEpochSeconds - 24 * HOUR_SECONDS) / HOUR_SECONDS) * HOUR_SECONDS
  const endEpoch = nowEpochSeconds + 24 * HOUR_SECONDS + DAY_SECONDS
  return {
    startDate: epochToLocalDateString(startEpoch, tzoffset),
    endDate: epochToLocalDateString(endEpoch, tzoffset),
  }
}

/**
 * Flatten `days[].hours[]` into a single time-ordered list of hour records,
 * each carrying the absolute epoch needed for past/future classification.
 */
export function flattenHours(days = []) {
  const hours = []
  for (const day of days) {
    for (const hour of day.hours ?? []) {
      if (typeof hour.datetimeEpoch !== 'number') continue
      hours.push({
        ...hour,
        // Epoch in milliseconds makes `new Date()` usage trivial downstream.
        epochMs: hour.datetimeEpoch * 1000,
        localDate: day.datetime,
      })
    }
  }
  return hours.sort((a, b) => a.datetimeEpoch - b.datetimeEpoch)
}

/**
 * Split the hourly list into the 24 hours leading up to `nowEpochSeconds` and
 * the 24 hours following it.
 *
 * Classification is done on absolute epochs rather than array position, so a
 * daylight-saving transition inside the window (which makes a local day 23 or
 * 25 hours long) still yields exactly 24 entries per side.
 *
 * `future` is returned oldest-first so the timeline reads left-to-right in
 * chronological order; `past` is returned oldest-first too, which lets the UI
 * put "24h ago" on the left and "now" on the right.
 */
export function splitPastAndFuture(hours, nowEpochSeconds, limit = 24) {
  // Sort defensively so ordering is a property of this function, not an
  // assumption callers have to satisfy.
  const ordered = [...hours].sort((a, b) => a.datetimeEpoch - b.datetimeEpoch)

  const past = []
  const future = []

  for (const hour of ordered) {
    if (hour.datetimeEpoch <= nowEpochSeconds) {
      past.push(hour)
    } else {
      future.push(hour)
    }
  }

  // `past` is oldest-first, so slice(-limit) keeps the hours nearest now.
  // Note the window is inclusive of the current hour, so 24 entries span 23
  // hours back to now.
  return {
    past: past.slice(-limit),
    future: future.slice(0, limit),
  }
}

const hourFormatterCache = new Map()

function getHourFormatter(timeZone) {
  if (!hourFormatterCache.has(timeZone)) {
    hourFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone,
      }),
    )
  }
  return hourFormatterCache.get(timeZone)
}

/**
 * Human-readable hour label in the *queried location's* timezone.
 *
 * Pass the IANA zone from the API response. Falls back to the browser zone when
 * the API did not supply one, which only happens in degenerate responses.
 */
export function formatHourLabel(epochMs, timeZone) {
  if (!timeZone) {
    return new Date(epochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  try {
    return getHourFormatter(timeZone).format(new Date(epochMs))
  } catch {
    // An unknown IANA zone throws a RangeError; degrade rather than crash.
    return new Date(epochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }
}

const MS_PER_HOUR = 3600_000

/** Short relative label for the leading edge of the past-24h strip. */
export function relativeLabel(epochMs, nowMs) {
  const hoursAgo = Math.round((nowMs - epochMs) / MS_PER_HOUR)
  if (hoursAgo <= 0) return 'now'
  if (hoursAgo === 1) return '1h ago'
  return `${hoursAgo}h ago`
}

/** Compact "in 3h" style label for the future strip. */
export function futureLabel(epochMs, nowMs) {
  const hoursAhead = Math.round((epochMs - nowMs) / MS_PER_HOUR)
  if (hoursAhead <= 0) return 'now'
  if (hoursAhead === 1) return 'in 1h'
  return `in ${hoursAhead}h`
}
