import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { WeatherIcon } from './WeatherIcon.jsx'
import { formatHourLabel, futureLabel, relativeLabel } from '../utils/time.js'

/**
 * The past-24h and next-24h hourly strips.
 *
 * Split into two labelled groups rather than one continuous 48-hour run, so it
 * is always obvious which side of "now" a given hour sits on. Both groups are
 * horizontally scrollable with scroll-snap; the future group auto-scrolls to
 * its first hour so the user lands on the forecast rather than on stale data.
 *
 * Hour labels are rendered in the *queried location's* timezone (passed in as
 * `timeZone`), which is frequently not the browser's timezone.
 */

function HourCard({ hour, timeZone, nowMs, variant }) {
  // "Now" is the most recent past hour; highlight it so the seam between the
  // two groups is visually obvious.
  const isNow = variant === 'past' && nowMs - hour.epochMs < 30 * 60 * 1000
  const rainChance = Math.round(hour.precipProbability ?? hour.precipprob ?? 0)

  return (
    <motion.li
      className={`hour-card${isNow ? ' hour-card--now' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <span className="hour-card__time">{formatHourLabel(hour.epochMs, timeZone)}</span>
      <WeatherIcon code={hour.icon} size={30} />
      <span className="hour-card__temp">{Math.round(hour.temp)}°</span>
      <span
        className={`hour-card__rain${rainChance >= 40 ? ' hour-card__rain--likely' : ''}`}
        title={`${rainChance}% chance of precipitation`}
      >
        {rainChance}%
      </span>
      <span className="hour-card__relative">
        {variant === 'past' ? relativeLabel(hour.epochMs, nowMs) : futureLabel(hour.epochMs, nowMs)}
      </span>
    </motion.li>
  )
}

function HourlyGroup({ title, hours, timeZone, nowMs, variant, autoScroll }) {
  const stripRef = useRef(null)

  useEffect(() => {
    if (autoScroll) stripRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
  }, [autoScroll, hours.length])

  return (
    <section className="timeline__group" aria-label={title}>
      <header className="timeline__heading">
        <h3>{title}</h3>
        <span className="timeline__count">{hours.length} hours</span>
      </header>
      <ul className="timeline__strip" ref={stripRef}>
        {hours.map((hour) => (
          <HourCard
            key={hour.datetimeEpoch}
            hour={hour}
            timeZone={timeZone}
            nowMs={nowMs}
            variant={variant}
          />
        ))}
      </ul>
    </section>
  )
}

export function HourlyTimeline({ data }) {
  const { timeZone, pastHours, futureHours } = data
  const nowMs = data.fetchedAtMs

  return (
    <div className="timeline">
      <HourlyGroup
        title="Past 24 hours"
        hours={pastHours}
        timeZone={timeZone}
        nowMs={nowMs}
        variant="past"
      />
      <HourlyGroup
        title="Next 24 hours"
        hours={futureHours}
        timeZone={timeZone}
        nowMs={nowMs}
        variant="future"
        autoScroll
      />
    </div>
  )
}
