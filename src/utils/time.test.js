import { describe, expect, it } from 'vitest'
import {
  buildTimelineWindow,
  epochToLocalDateString,
  epochToLocalParts,
  flattenHours,
  formatHourLabel,
  futureLabel,
  relativeLabel,
  splitPastAndFuture,
} from './time.js'

/** Build a synthetic hourly record. `offsetHours` is relative to `nowEpoch`. */
function hour(offsetHours, nowEpoch) {
  const epoch = (nowEpoch + offsetHours * 3600) * 1000
  return {
    datetimeEpoch: nowEpoch + offsetHours * 3600,
    epochMs: epoch,
    temp: 20 + offsetHours,
    precipprob: 0,
  }
}

describe('epochToLocalParts', () => {
  // 2026-09-28T00:00:00Z
  const midnightUtc = 1790553600

  it('shifts UTC into the queried location local time', () => {
    expect(epochToLocalParts(midnightUtc, 0)).toMatchObject({ year: 2026, month: 9, day: 28, hour: 0 })
  })

  it('applies a positive offset', () => {
    // UTC+1 (Europe/London in September) turns midnight UTC into 01:00 local.
    expect(epochToLocalParts(midnightUtc, 1)).toMatchObject({ day: 28, hour: 1 })
  })

  it('applies a negative offset and rolls back the day', () => {
    // UTC-4 (America/New_York) turns midnight UTC into 20:00 on the 27th.
    expect(epochToLocalParts(midnightUtc, -4)).toMatchObject({ day: 27, hour: 20 })
  })

  it('handles fractional offsets used by some zones', () => {
    expect(epochToLocalParts(midnightUtc, 5.5)).toMatchObject({ day: 28, hour: 5, minute: 30 })
  })
})

describe('epochToLocalDateString', () => {
  it('zero-pads month and day', () => {
    // 2026-01-05T00:00:00Z
    expect(epochToLocalDateString(1767571200, 0)).toBe('2026-01-05')
  })

  it('rolls the date back for a western offset', () => {
    expect(epochToLocalDateString(1767571200, -5)).toBe('2026-01-04')
  })
})

describe('buildTimelineWindow', () => {
  // 2026-09-28T13:20:00Z
  const now = 1790601600

  it('requests from one day before to one day after the current local date', () => {
    const { startDate, endDate } = buildTimelineWindow(now, 1)
    expect(startDate).toBe('2026-09-27')
    expect(endDate).toBe('2026-09-30')
  })

  it('produces a different window for a location on the other side of the world', () => {
    // Same instant, but a location at UTC+13 is already on the 29th, so the
    // 24h-behind boundary reaches back to the 28th rather than the 27th.
    const { startDate } = buildTimelineWindow(now, 13)
    expect(startDate).toBe('2026-09-28')
  })

  it('shifts the window earlier for a western timezone', () => {
    // UTC-10 puts "now" on the 28th at 03:20 local, reaching back to the 27th.
    const { startDate, endDate } = buildTimelineWindow(now, -10)
    expect(startDate).toBe('2026-09-27')
    expect(endDate).toBe('2026-09-30')
  })

  it('covers a full local day for the end date so the last day is never truncated', () => {
    // The API resolves an end date at midnight local, so endDate must be at
    // least one day past the local date containing now+24h. 14:20 local on the
    // 28th means now+24h falls on the 29th, so the request must end on the 30th.
    const { endDate } = buildTimelineWindow(now, 1)
    expect(endDate).toBe('2026-09-30')
  })
})

describe('flattenHours', () => {
  it('flattens days into a time-ordered list', () => {
    const days = [
      { datetime: '2026-09-28', hours: [{ datetimeEpoch: 300 }, { datetimeEpoch: 200 }] },
      { datetime: '2026-09-27', hours: [{ datetimeEpoch: 100 }] },
    ]
    const flat = flattenHours(days)
    expect(flat.map((h) => h.datetimeEpoch)).toEqual([100, 200, 300])
  })

  it('adds epochMs and the parent day date', () => {
    const days = [{ datetime: '2026-09-27', hours: [{ datetimeEpoch: 100 }] }]
    const [first] = flattenHours(days)
    expect(first.epochMs).toBe(100000)
    expect(first.localDate).toBe('2026-09-27')
  })

  it('skips records missing datetimeEpoch rather than emitting NaN entries', () => {
    const days = [{ datetime: '2026-09-27', hours: [{ datetimeEpoch: 100 }, { temp: 5 }] }]
    expect(flattenHours(days)).toHaveLength(1)
  })

  it('tolerates a day with no hours array', () => {
    expect(flattenHours([{ datetime: '2026-09-27' }, {}])).toEqual([])
  })
})

describe('splitPastAndFuture', () => {
  it('splits on the now boundary', () => {
    const now = 1000
    const hours = [hour(-2, now), hour(-1, now), hour(0, now), hour(1, now), hour(2, now)]
    const { past, future } = splitPastAndFuture(hours, now)
    // now itself counts as past, per the "hours that have elapsed" reading.
    expect(past.map((h) => h.datetimeEpoch)).toEqual([now - 7200, now - 3600, now])
    expect(future.map((h) => h.datetimeEpoch)).toEqual([now + 3600, now + 7200])
  })

  it('returns past oldest-first and future oldest-first', () => {
    const now = 1000
    // Deliberately unsorted, and with no record at exactly `now`.
    const hours = [hour(1, now), hour(-1, now), hour(2, now), hour(-2, now)]
    const { past, future } = splitPastAndFuture(hours, now)
    expect(past.map((h) => h.datetimeEpoch)).toEqual([now - 7200, now - 3600])
    expect(future.map((h) => h.datetimeEpoch)).toEqual([now + 3600, now + 7200])
  })

  it('caps each side at 24 entries', () => {
    const now = 1000
    const hours = [
      ...Array.from({ length: 40 }, (_, i) => hour(-i, now)),
      ...Array.from({ length: 40 }, (_, i) => hour(i + 1, now)),
    ]
    const { past, future } = splitPastAndFuture(hours, now)
    expect(past).toHaveLength(24)
    expect(future).toHaveLength(24)
  })

  it('keeps the most recent 24 past hours, not the first 24', () => {
    const now = 1000
    const hours = Array.from({ length: 40 }, (_, i) => hour(-i, now))
    const { past } = splitPastAndFuture(hours, now)
    // The window is inclusive of the current hour, so 24 entries run from
    // 23h back up to now. The point is that 39h-back is dropped.
    expect(past[0].datetimeEpoch).toBe(now - 23 * 3600)
    expect(past.at(-1).datetimeEpoch).toBe(now)
  })

  it('handles an unbalanced window with no past data', () => {
    const now = 1000
    const hours = [hour(1, now), hour(2, now)]
    const { past, future } = splitPastAndFuture(hours, now)
    expect(past).toEqual([])
    expect(future).toHaveLength(2)
  })

  it('handles a window with no future data', () => {
    const now = 1000
    const hours = [hour(-1, now), hour(-2, now)]
    const { past, future } = splitPastAndFuture(hours, now)
    expect(past).toHaveLength(2)
    expect(future).toEqual([])
  })

  it('returns empty sides for an empty input', () => {
    expect(splitPastAndFuture([], 1000)).toEqual({ past: [], future: [] })
  })

  it('still returns exactly 24 per side across a spring-forward DST transition', () => {
    // Europe/London springs forward 2026-03-29, making that local day 23 hours
    // long. Classification is on absolute epochs, so the count stays stable.
    const now = 1774789200 // 2026-03-29T13:00:00Z
    const hours = [
      ...Array.from({ length: 30 }, (_, i) => hour(-i, now)),
      ...Array.from({ length: 30 }, (_, i) => hour(i + 1, now)),
    ]
    const { past, future } = splitPastAndFuture(hours, now)
    expect(past).toHaveLength(24)
    expect(future).toHaveLength(24)
  })

  it('is unaffected by the machine timezone, since it only reads epochs', () => {
    const now = 1000
    const hours = [hour(-1, now), hour(1, now)]
    const first = splitPastAndFuture(hours, now)
    const originalTz = process.env.TZ
    try {
      process.env.TZ = 'Pacific/Kiritimati'
      const second = splitPastAndFuture(hours, now)
      expect(second).toEqual(first)
    } finally {
      process.env.TZ = originalTz
    }
  })
})

describe('formatHourLabel', () => {
  it('renders in the given IANA zone regardless of the browser zone', () => {
    // 2026-09-28T23:30:00Z is 09:30 the next day in Sydney (+10).
    const label = formatHourLabel(1790638200000, 'Australia/Sydney')
    expect(label).toBe('09:30')
  })

  it('renders UTC when asked for UTC', () => {
    expect(formatHourLabel(1790638200000, 'UTC')).toBe('23:30')
  })

  it('pads the hour to two digits', () => {
    // 2026-09-28T09:05:00Z
    expect(formatHourLabel(1790586300000, 'UTC')).toBe('09:05')
  })

  it('renders the previous day when the zone is behind UTC', () => {
    // 2026-09-28T02:00:00Z is 22:00 on the 27th in New York (-4).
    expect(formatHourLabel(1790560800000, 'America/New_York')).toBe('22:00')
  })

  it('falls back to the browser locale when no zone is supplied', () => {
    expect(formatHourLabel(1790638200000, null)).toMatch(/\d{1,2}:\d{2}/)
  })

  it('does not throw on an unknown zone', () => {
    expect(() => formatHourLabel(1790638200000, 'Not/AZone')).not.toThrow()
  })
})

describe('relativeLabel', () => {
  const nowMs = 1_000_000_000_000

  it('labels the current hour as now', () => {
    expect(relativeLabel(nowMs, nowMs)).toBe('now')
  })

  it('uses a singular form for one hour ago', () => {
    expect(relativeLabel(nowMs - 3600_000, nowMs)).toBe('1h ago')
  })

  it('pluralises further back', () => {
    expect(relativeLabel(nowMs - 5 * 3600_000, nowMs)).toBe('5h ago')
  })
})

describe('futureLabel', () => {
  const nowMs = 1_000_000_000_000

  it('labels the next hour', () => {
    expect(futureLabel(nowMs + 3600_000, nowMs)).toBe('in 1h')
  })

  it('pluralises further ahead', () => {
    expect(futureLabel(nowMs + 6 * 3600_000, nowMs)).toBe('in 6h')
  })

  it('does not produce a negative label for a record at or before now', () => {
    expect(futureLabel(nowMs, nowMs)).toBe('now')
    expect(futureLabel(nowMs - 3600_000, nowMs)).toBe('now')
  })
})
