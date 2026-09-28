import { memo } from 'react'
import { motion } from 'framer-motion'
import { isNightIcon, normalizeIcon } from '../utils/weatherCodes.js'

/**
 * Inline SVG weather icons.
 *
 * Hand-rolled rather than pulled from an icon package: the set is small, this
 * keeps `icon` codes mapped 1:1, and every shape can be animated with Framer
 * Motion. `currentColor` + `currentColor` opacity let each path inherit the
 * per-state theming applied by CSS.
 */

const Sun = ({ spinning }) => (
  <>
    <g className="icon__sun-rays" style={spinning ? undefined : { transformOrigin: '12px 12px' }}>
      {Array.from({ length: 8 }).map((_, index) => (
        <line
          key={index}
          x1="12"
          y1="3.2"
          x2="12"
          y2="5.4"
          transform={`rotate(${index * 45} 12 12)`}
          strokeLinecap="round"
        />
      ))}
    </g>
    <circle cx="12" cy="12" r="4.2" className="icon__sun-core" />
  </>
)

const Cloud = ({ className = '' }) => (
  <path
    className={className}
    d="M7.2 19h9.6a3.6 3.6 0 0 0 .35-7.18 5.2 5.2 0 0 0-9.94-1.3A3.85 3.85 0 0 0 7.2 19Z"
  />
)

const Rain = () => (
  <>
    <Cloud className="icon__cloud" />
    <g className="icon__rain" strokeLinecap="round">
      <line x1="8.6" y1="20.4" x2="7.6" y2="22.4" />
      <line x1="12.4" y1="20.4" x2="11.4" y2="22.4" />
      <line x1="16.2" y1="20.4" x2="15.2" y2="22.4" />
    </g>
  </>
)

const Snow = () => (
  <>
    <Cloud className="icon__cloud" />
    <g className="icon__snow">
      {[
        [8.6, 21.4],
        [12.6, 21.4],
        [16.6, 21.4],
      ].map(([cx, cy]) => (
        <g key={cx}>
          <line x1={cx - 1.2} y1={cy} x2={cx + 1.2} y2={cy} strokeLinecap="round" />
          <line x1={cx} y1={cy - 1.2} x2={cx} y2={cy + 1.2} strokeLinecap="round" />
        </g>
      ))}
    </g>
  </>
)

const Sleet = () => (
  <>
    <Cloud className="icon__cloud" />
    <g className="icon__rain" strokeLinecap="round">
      <line x1="9" y1="20.4" x2="8.2" y2="22.4" />
    </g>
    <g className="icon__snow">
      <line x1="13.2" y1="21.4" x2="15.4" y2="21.4" strokeLinecap="round" />
      <line x1="14.3" y1="20.3" x2="14.3" y2="22.5" strokeLinecap="round" />
    </g>
  </>
)

const Showers = ({ night }) => (
  <>
    {night ? <Moon /> : <Sun spinning={false} />}
    <Cloud className="icon__cloud icon__cloud--overlap" />
    <g className="icon__rain" strokeLinecap="round">
      <line x1="10.4" y1="20.2" x2="9.4" y2="22.4" />
      <line x1="14.2" y1="20.2" x2="13.2" y2="22.4" />
    </g>
  </>
)

const Moon = () => <path className="icon__moon" d="M17.4 14.6a6.4 6.4 0 0 1-7.9-7.9 6.6 6.6 0 1 0 7.9 7.9Z" />

const Fog = () => (
  <>
    <Cloud className="icon__cloud" />
    <g className="icon__fog" strokeLinecap="round">
      <line x1="6.4" y1="20.4" x2="17.6" y2="20.4" />
      <line x1="8.4" y1="22.6" x2="15.6" y2="22.6" />
    </g>
  </>
)

const Wind = () => (
  <g className="icon__wind" strokeLinecap="round" fill="none">
    <path d="M3.4 9.2h9.2a2.9 2.9 0 1 0-2.9-2.9" />
    <path d="M3.4 13.4h12a2.9 2.9 0 1 1-2.9 2.9" />
    <path d="M3.4 17.6h6.4" />
  </g>
)

const Bolt = () => <path className="icon__bolt" d="M13.4 18.6 8.6 22l1.9-5.2H6.6l5-6.4-1.6 4.4Z" />

const Thunderstorm = () => (
  <>
    <Cloud className="icon__cloud" />
    <g className="icon__rain" strokeLinecap="round">
      <line x1="8.8" y1="20.2" x2="7.9" y2="22.2" />
      <line x1="16" y1="20.2" x2="15.1" y2="22.2" />
    </g>
    <g transform="translate(2.4 1) scale(0.82)">
      <Bolt />
    </g>
  </>
)

const Hail = () => (
  <>
    <Cloud className="icon__cloud" />
    <g className="icon__hail">
      <circle cx="8.8" cy="21.4" r="1.2" />
      <circle cx="12.8" cy="21.4" r="1.2" />
      <circle cx="16.8" cy="21.4" r="1.2" />
    </g>
  </>
)

const ICONS = {
  'clear-day': <Sun spinning />,
  'clear-night': <Moon />,
  cloudy: <Cloud className="icon__cloud" />,
  'partly-cloudy-day': (
    <>
      <Sun spinning={false} />
      <Cloud className="icon__cloud icon__cloud--overlap" />
    </>
  ),
  'partly-cloudy-night': (
    <>
      <Moon />
      <Cloud className="icon__cloud icon__cloud--overlap" />
    </>
  ),
  rain: <Rain />,
  snow: <Snow />,
  sleet: <Sleet />,
  'snow-showers-day': <Showers night={false} />,
  'snow-showers-night': <Showers night />,
  'rain-showers-day': <Showers night={false} />,
  'rain-showers-night': <Showers night />,
  fog: <Fog />,
  wind: <Wind />,
  hail: <Hail />,
  thunderstorm: <Thunderstorm />,
}

/**
 * @param {object} props
 * @param {string} props.code Visual Crossing `icon` value.
 * @param {number} [props.size] Pixel size for the square SVG.
 * @param {boolean} [props.animate] Enable the gentle idle motion.
 */
function WeatherIconBase({ code, size = 40, animate = true }) {
  const normalized = normalizeIcon(code)
  const night = isNightIcon(normalized)

  return (
    <motion.svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`weather-icon${night ? ' weather-icon--night' : ''}`}
      role="img"
      aria-hidden="true"
      animate={animate ? { opacity: 1, scale: 1 } : undefined}
      initial={animate ? { opacity: 0, scale: 0.86 } : undefined}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {ICONS[normalized] ?? ICONS.cloudy}
    </motion.svg>
  )
}

export const WeatherIcon = memo(WeatherIconBase)
