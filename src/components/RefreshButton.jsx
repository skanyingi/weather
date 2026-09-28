import { motion } from 'framer-motion'

/**
 * Refresh control.
 *
 * The rotating icon and the label change together so the loading state is
 * legible without relying on motion alone.
 */
export function RefreshButton({ onRefresh, loading, lastUpdatedMs }) {
  return (
    <div className="refresh">
      <button
        type="button"
        className="button button--ghost"
        onClick={onRefresh}
        disabled={loading}
        aria-busy={loading}
      >
        <motion.svg
          className="refresh__spinner"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden="true"
          animate={loading ? { rotate: 360 } : { rotate: 0 }}
          transition={loading ? { repeat: Infinity, ease: 'linear', duration: 0.9 } : { duration: 0.2 }}
        >
          <path
            d="M20 12a8 8 0 1 1-2.34-5.66"
            fill="none"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </motion.svg>
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>
      {lastUpdatedMs ? <p className="refresh__timestamp">Updated {formatClock(lastUpdatedMs)}</p> : null}
    </div>
  )
}

function formatClock(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
