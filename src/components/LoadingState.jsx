import { motion } from 'framer-motion'

/**
 * Skeleton placeholder shown during the initial load.
 *
 * Dimensions deliberately mirror `CurrentWeather` and `HourlyTimeline` so the
 * real content lands in already-allocated space and the page does not shift
 * when data arrives.
 */

function SkeletonBlock({ width, height, radius = 8 }) {
  return <span className="skeleton" style={{ width, height, borderRadius: radius }} />
}

function SkeletonHour() {
  return (
    <li className="hour-card hour-card--skeleton">
      <SkeletonBlock width={38} height={10} />
      <SkeletonBlock width={30} height={30} radius={10} />
      <SkeletonBlock width={26} height={16} />
      <SkeletonBlock width={30} height={9} />
    </li>
  )
}

export function LoadingState() {
  return (
    <div className="loading" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading weather data…</span>

      <section className="current current--skeleton">
        <div className="current__headline">
          <div>
            <SkeletonBlock width={150} height={62} radius={12} />
            <SkeletonBlock width={104} height={13} />
          </div>
          <SkeletonBlock width={72} height={72} radius={24} />
        </div>
        <dl className="current__stats">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="stat" key={index}>
              <SkeletonBlock width={64} height={10} />
              <SkeletonBlock width={72} height={18} />
            </div>
          ))}
        </dl>
      </section>

      <div className="timeline">
        {[0, 1].map((group) => (
          <section className="timeline__group" key={group} aria-hidden="true">
            <header className="timeline__heading">
              <SkeletonBlock width={116} height={13} />
            </header>
            <ul className="timeline__strip">
              {Array.from({ length: 8 }).map((_, index) => (
                <SkeletonHour key={index} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <motion.p
        className="loading__hint"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        Fetching the latest conditions and hourly timeline…
      </motion.p>
    </div>
  )
}
