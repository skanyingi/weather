/**
 * Maps Visual Crossing weather element codes and condition strings onto the
 * small icon set rendered by `WeatherIcon`.
 *
 * Visual Crossing returns an `icon` string such as `partly-cloudy-day` or
 * `clear-night`. The values below cover the documented set; anything unknown
 * falls back to `cloudy` so the UI never renders a gap.
 */

const ICON_CODES = [
  'clear-day',
  'clear-night',
  'cloudy',
  'partly-cloudy-day',
  'partly-cloudy-night',
  'rain',
  'snow',
  'sleet',
  'snow-showers-day',
  'snow-showers-night',
  'rain-showers-day',
  'rain-showers-night',
  'fog',
  'wind',
  'hail',
  'thunderstorm',
]

const ICON_SET = new Set(ICON_CODES)

/**
 * @param {string|null|undefined} iconCode Value of the `icon` element.
 * @returns {string} A guaranteed-supported icon code.
 */
export function normalizeIcon(iconCode) {
  if (typeof iconCode === 'string' && ICON_SET.has(iconCode)) {
    return iconCode
  }
  return 'cloudy'
}

/**
 * Derive the icon for a record that may only have a `conditions` string.
 * Used for the `currentConditions` object, whose icon codes can differ slightly
 * from the hourly ones.
 */
export function iconFromConditions(iconCode, conditions) {
  if (iconCode && ICON_SET.has(iconCode)) return iconCode
  const text = (conditions ?? '').toLowerCase()

  if (text.includes('thunder')) return 'thunderstorm'
  if (text.includes('hail')) return 'hail'
  if (text.includes('sleet')) return 'sleet'
  if (text.includes('snow')) return 'snow'
  if (text.includes('rain') || text.includes('shower')) return 'rain'
  if (text.includes('fog') || text.includes('mist') || text.includes('haze')) return 'fog'
  if (text.includes('wind')) return 'wind'
  if (text.includes('clear') || text.includes('sunny')) return 'clear-day'
  if (text.includes('partly')) return 'partly-cloudy-day'
  return 'cloudy'
}

/** True when the code represents a night-time variant (for theming). */
export function isNightIcon(iconCode) {
  return iconCode.endsWith('-night')
}
