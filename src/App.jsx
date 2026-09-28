import { useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useWeather } from './hooks/useWeather.js'
import { SearchBar } from './components/SearchBar.jsx'
import { CurrentWeather } from './components/CurrentWeather.jsx'
import { HourlyTimeline } from './components/HourlyTimeline.jsx'
import { RefreshButton } from './components/RefreshButton.jsx'
import { LoadingState } from './components/LoadingState.jsx'
import { ErrorState } from './components/ErrorState.jsx'
import { LocationPrompt } from './components/LocationPrompt.jsx'

export default function App() {
  const { status, data, error, searching, lastUpdatedMs, search, refresh, useMyLocation } = useWeather()

  const isBusy = status === 'loading' || status === 'locating'
  const isRefreshing = status === 'refreshing'

  // Only offer "try again" when a location is loaded; otherwise the user needs
  // to search first and a retry button would have nothing to retry.
  const handleRetry = useCallback(() => {
    refresh()
  }, [refresh])

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__title">
          <h1>Weather</h1>
          {data ? (
            <>
              <p className="app__subtitle">{data.location.resolved || data.location.query}</p>
              {/* Only shown when reverse geocoding could not name the point, so
                  the coordinates remain visible rather than the header going blank. */}
              {data.location.isUnresolved && data.location.latitude != null ? (
                <p className="app__coords">
                  {data.location.latitude.toFixed(3)}, {data.location.longitude.toFixed(3)}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
        <RefreshButton
          onRefresh={refresh}
          loading={isRefreshing || isBusy}
          lastUpdatedMs={lastUpdatedMs}
        />
      </header>

      <SearchBar
        onSearch={search}
        onSubmit={search}
        searching={searching}
        disabled={false}
      />

      {error && status === 'error' ? (
        <ErrorState error={error} onRetry={data ? handleRetry : undefined} />
      ) : null}

      <main className="app__main">
        <AnimatePresence mode="wait" initial={false}>
          {status === 'locating' || status === 'loading' ? (
            <motion.div key="loading" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <LoadingState />
            </motion.div>
          ) : null}

          {status === 'prompting' && !data ? (
            <motion.div key="prompt" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <LocationPrompt
                message={error?.kind?.startsWith('geolocation') ? error.message : undefined}
                onRetry={useMyLocation}
              />
            </motion.div>
          ) : null}

          {data && status !== 'loading' ? (
            <motion.div
              key={`data-${data.location.query}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              {data.current ? <CurrentWeather current={data.current} location={data.location} /> : null}
              <HourlyTimeline data={data} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
    </div>
  )
}
