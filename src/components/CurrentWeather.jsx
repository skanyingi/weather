import { motion } from 'framer-motion'
import { WeatherIcon } from './WeatherIcon.jsx'

/**
 * The current conditions card: temperature, apparent temperature, wind speed,
 * chance of rain, and the condition label with its icon.
 */
export function CurrentWeather({ current, location }) {
  const rainChance = Math.round(current.precipProbability ?? 0)

  return (
    <motion.section
      className="current"
      aria-label="Current conditions"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="current__headline">
        <div>
          <h2 className="current__temp">
            {Math.round(current.temp)}
            <span className="current__unit">°C</span>
          </h2>
          <p className="current__feels">Feels like {Math.round(current.feelsLike)}°</p>
        </div>
        <div className="current__condition">
          <WeatherIcon code={current.icon} size={72} />
          <p className="current__conditions">{current.conditions}</p>
        </div>
      </div>

      <dl className="current__stats">
        <div className="stat">
          <dt>Wind</dt>
          <dd>{Math.round(current.windSpeed)} km/h</dd>
        </div>
        <div className="stat">
          <dt>Chance of rain</dt>
          <dd>{rainChance}%</dd>
        </div>
        <div className="stat">
          <dt>Humidity</dt>
          <dd>{Math.round(current.humidity ?? 0)}%</dd>
        </div>
        <div className="stat">
          <dt>Cloud cover</dt>
          <dd>{Math.round(current.cloudCover ?? 0)}%</dd>
        </div>
      </dl>

      {location.timeZone ? <p className="current__tz">Times shown in {location.timeZone}</p> : null}
    </motion.section>
  )
}
