# APEX F1 dashboard template

A responsive React + TypeScript race-centre starter using the [OpenF1 API](https://openf1.org/docs/#api-endpoints) for session, driver, lap, and weather data. Firebase App, Authentication, and Firestore are wired as optional services so the dashboard can run before you add project credentials.

## Run locally

1. Install Node.js 20 or newer.
2. Install dependencies with `npm install`.
3. Start the development server with `npm run dev`.

The OpenF1 API provides historical data from 2023 onward without authentication. Real-time data requires an OpenF1 subscription. The page loads the latest available session and displays a clear error if the API is unavailable.

## Connect Firebase

1. Create a project in the [Firebase console](https://console.firebase.google.com/).
2. Register a web app and copy its Firebase config.
3. Copy `.env.example` to `.env.local` and fill in the `VITE_FIREBASE_*` values.
4. Restart the Vite development server.

The Firebase client is initialized in `src/lib/firebase.ts`; `auth` and `db` are exported for adding sign-in and Firestore-backed features. Firebase web config is intended to be public, but secure your data with Firebase Authentication and Firestore Security Rules before writing private user data.

## OpenF1 integration

The API client in `src/lib/openf1.ts` fetches the latest session, its meeting name, then its drivers, laps, and weather. Requests are paced to reduce rate limiting, and transient HTTP errors such as `429` are retried with backoff. If meeting details are unavailable, the dashboard falls back to the session location. The leaderboard ranks drivers by their fastest non-pit-out lap. Add other endpoints such as `/positions`, `/intervals`, `/pit`, `/race_control`, and `/team_radio` there as your project grows.
