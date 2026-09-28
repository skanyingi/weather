# Weather App

A single-page weather app showing current conditions plus an hourly timeline covering the
previous and next 24 hours for any location. No backend — the browser calls the
[Visual Crossing Timeline Weather API](https://www.visualcrossing.com/weather-api) directly.

Built with React (Vite) and Framer Motion, styled with plain CSS, and deployable as a static
site to Vercel or Netlify.

## Features

- **Search** for any city, postcode or address, with a debounced query and Enter-to-submit
- **Geolocation default** — the app opens on your current location when permission is granted,
  and falls back to a search prompt when it is denied or unavailable
- **Current conditions** — temperature, feels-like, wind speed, chance of rain, humidity,
  cloud cover, and a condition label with icon
- **48-hour timeline** — the past 24 hours and the next 24 hours as two separately labelled,
  horizontally scrollable strips
- **Refresh on demand** with a visible loading state
- **Readable place names** — a geolocated lookup shows "Westlands, Nairobi, Kenya", not raw coordinates
- **Handfuls of error handling** — unresolvable locations, exhausted free-tier record limits,
  bad API keys, timeouts, and service outages each get their own message
- **Animated loading and transitions** via Framer Motion, with skeleton loaders sized to match
  the real content so the layout does not shift

## Getting started

### 1. Get an API key

Sign up for a free account at <https://www.visualcrossing.com/sign-up/> and copy the API key
from the account page. The free plan allows **1,000 weather records per day**, which works out
to roughly 35 full app loads — plenty for development, and note that every search and every
refresh spends records.

### 2. Install and configure

```bash
npm install
cp .env.example .env
```

Then edit `.env` and paste in your key:

```
VITE_WEATHER_API_KEY=your_actual_key_here
```

The key is read through Vite's `import.meta.env`, so it must be prefixed with `VITE_` to be
exposed to the client. `.env` is gitignored; `.env.example` is committed as a template.

> Because there is no backend, the key is visible to anyone who opens your deployed site. That
> is acceptable for a free-tier demo key. For anything public-facing with real usage, proxy
> requests through a serverless function so the key stays private.

### 3. Run

```bash
npm run dev      # dev server with hot reload
npm test         # unit tests for the timezone and windowing logic
npm run build    # production build into dist/
npm run preview  # serve the production build locally
```

## Deploying

The app builds to a static `dist/` directory with no server-side runtime, so both hosts work
out of the box.

### Vercel

1. Push the project to a Git repository and import it in the Vercel dashboard.
2. Vercel detects Vite automatically. Confirm **Build Command** is `npm run build` and
   **Output Directory** is `dist`.
3. Add the key under **Settings → Environment Variables**:
   - Key: `VITE_WEATHER_API_KEY`
   - Value: your key
   - Apply to **Production**, **Preview**, and **Development**.
4. Deploy.

### Netlify

1. Push to Git and connect the repository in Netlify.
2. Build command: `npm run build`. Publish directory: `dist`.
3. Add the key under **Site configuration → Environment variables**: `VITE_WEATHER_API_KEY`.
4. Deploy.

`public/_redirects` is already included, so client-side routes fall through to `index.html`.

## Project structure

```
src/
├── api/
│   ├── reverseGeocode.js    Coordinate pair → "Westlands, Nairobi, Kenya"
│   ├── reverseGeocode.test.js
│   └── weatherApi.js        API client: URL building, timeouts, error classification
├── components/
│   ├── CurrentWeather.jsx Current conditions card
│   ├── ErrorState.jsx     User-facing error state
│   ├── HourlyTimeline.jsx Past-24h and next-24h strips
│   ├── LoadingState.jsx   Skeleton loaders matching the real layout
│   ├── LocationPrompt.jsx Fallback shown when geolocation is unavailable
│   ├── RefreshButton.jsx  Refresh control with spinner and timestamp
│   ├── SearchBar.jsx      Search input
│   └── WeatherIcon.jsx    Inline SVG icon set
├── hooks/
│   └── useWeather.js      Fetch lifecycle, geolocation, dedupe, caching
├── utils/
│   ├── time.js            Timezone math and the past/future split
│   ├── time.test.js       Unit tests for the above
│   └── weatherCodes.js    Icon code normalisation
├── App.jsx
├── index.css
└── main.jsx
```

## How the 24-hour windows work

This is the part of the app most likely to be wrong if written naively, so it is worth
spelling out.

Visual Crossing returns every timestamp in the **local time of the queried location**, which
is frequently not the browser's timezone. Assuming the two match produces an off-by-hours
window, and gets worse the further the location is from UTC.

The approach here has three parts:

**1. Resolve the location's timezone before asking for the timeline.** The API only reveals a
location's UTC offset inside the response, so there is no way to compute "24 hours ago in
London" before the first request. `useWeather` therefore makes a cheap probe call
(`include=current`, 1 weather record) to read `tzoffset`, then computes the request window from
that offset.

**2. End the window a day late.** The API resolves an end date at *midnight local*, so
requesting through "today + 24h" can truncate the final day. `buildTimelineWindow` adds one
extra day to the end and trims the surplus off client-side.

**3. Split on absolute epochs, never on array positions.** Every hourly record carries
`datetimeEpoch` (seconds since 1970 UTC). `splitPastAndFuture` classifies on those absolute
values rather than trusting ordering or local hour strings. This is what keeps the window
correct through a daylight-saving transition — a local day can be 23 or 25 hours long, but
the split still yields exactly 24 entries per side.

Labels are then rendered with `Intl.DateTimeFormat` using the IANA timezone from the response,
so times read correctly for the searched location. The card footer names that zone explicitly,
since it may not match the viewer's own.

## Why the geolocation view needs reverse geocoding

Visual Crossing accepts `lat,lon` for a location but **echoes it back verbatim** as
`resolvedAddress` — querying `38.9697,-77.385` returns `"38.9697,-77.385"` with no place name. So
without extra work, the default view shows a pair of numbers where a location name should be.

`src/api/reverseGeocode.js` fills that gap using the
[BigDataCloud](https://www.bigdatacloud.com/products/free-reverse-geocode-api) client endpoint: free,
no API key, and it returns `access-control-allow-origin: *` so it can be called directly from the
browser. It runs **in parallel** with the weather fetch rather than after it, so the label does not
add to perceived load time.

A few details that mattered in practice:

- **Only coordinate queries are reverse geocoded.** A typed search like `Nairobi, Kenya` already
  resolves to a name, and skipping the extra request avoids spending a round trip for nothing.
- **Sub-city areas win over the city name.** Nairobi resolves as "Westlands, Nairobi, Kenya" and
  Manhattan as "Manhattan, New York City, United States", because the area is the more useful
  signal. This prefers the `locality` field, falling back to a mid-level admin entry.
- **Administrative noise is filtered.** The raw admin hierarchy contains entries like "Karura ward"
  and "L Ward", which would read as gibberish in a one-line label.
- **Redundant regions are dropped**, so Nairobi does not become "Nairobi, Nairobi City, Kenya".
- **Unpopulated points degrade to nothing.** At sea, the API returns descriptive phrases like
  "exclusive economic zone of the United States"; these are rejected and the header falls back to
  showing the raw coordinates.
- **Failures are non-fatal.** A timeout or error returns `null` and the UI shows coordinates, which
  is exactly the previous behaviour.

Reverse geocoding adds **no** Visual Crossing record cost.

## Notes on API usage

Each full load makes two requests costing about 26 weather records total. To stay inside the
free tier:

- Only the 11 elements the UI actually renders are requested
- Search input is debounced by 400ms
- A search matching the already-loaded location is ignored
- In-flight requests are aborted when a new one starts, so only the newest can commit
- The refresh button is disabled while a request is in flight
- The last successful payload is cached in `sessionStorage` for 10 minutes

## Tech choices

**Plain CSS over Tailwind.** Custom properties for theming, no build-time config, and the
whole stylesheet is readable in one sitting. No `className` string noise in the components.

**Inline SVG icons over an icon library.** Visual Crossing already returns a machine-readable
`icon` code (`partly-cloudy-day`, `rain`, `thunderstorm`, …), so a direct mapping is the
shortest path. Custom SVGs inherit `currentColor` and animate with Framer Motion.

**A two-step data flow.** `weatherApi.js` knows nothing about React and `useWeather.js` owns
all state and lifecycle, which keeps both testable in isolation.
