import { motion } from 'framer-motion'

/**
 * Shown when the geolocation prompt was denied, timed out, or is unsupported.
 *
 * This is a normal path through the app, not a failure state: the search bar is
 * already focused and prominent, so the user's next step is obvious.
 */
export function LocationPrompt({ onRetry, message }) {
  return (
    <motion.section
      className="prompt"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <h2 className="prompt__title">Where would you like the weather?</h2>
      <p className="prompt__body">
        {message ?? 'We use your location to show local conditions by default. Search for a city instead, or try again.'}
      </p>
      {onRetry ? (
        <button type="button" className="button button--ghost" onClick={onRetry}>
          Try my location again
        </button>
      ) : null}
    </motion.section>
  )
}
