import { motion } from 'framer-motion'

/**
 * User-facing error state.
 *
 * `retry` is optional: when absent (or when there is no location to retry
 * against) the message is presented as guidance toward search instead of a
 * button that would not work.
 */
export function ErrorState({ error, onRetry, onDismiss }) {
  const message = error?.message ?? 'Something went wrong.'
  const canRetry = typeof onRetry === 'function'

  return (
    <motion.section
      className="error"
      role="alert"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <span className="error__badge" aria-hidden="true">
        !
      </span>
      <h2 className="error__title">We couldn’t load that forecast</h2>
      <p className="error__message">{message}</p>
      <div className="error__actions">
        {canRetry ? (
          <button type="button" className="button button--primary" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        {onDismiss ? (
          <button type="button" className="button button--ghost" onClick={onDismiss}>
            Dismiss
          </button>
        ) : null}
      </div>
    </motion.section>
  )
}
